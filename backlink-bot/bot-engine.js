#!/usr/bin/env node
/**
 * bot-engine.js — Motor reutilizable para submisión a directorios
 * Máquina de estados: LANDING → COOKIES → FORMULARIO → SUBMIT → CONFIRMACION | ERROR | BLOQUEO
 * Incluye evasión de detección de bots con playwright-extra-plugin-stealth
 */

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const fs = require('fs');
const path = require('path');

// ── Estados ───────────────────────────────────────────────────────────────────
const STATE = {
  LANDING:                    'LANDING',
  COOKIES:                    'COOKIES',
  FORMULARIO:                 'FORMULARIO',
  PASO_INTERMEDIO:            'PASO_INTERMEDIO',
  SUBMIT:                     'SUBMIT',
  CONFIRMACION:               'confirmed',
  VERIFICACION_EMAIL:         'pendiente_verificacion_email',
  INTERVENCION_HUMANA:        'pendiente_intervencion_humana',
  ERROR:                      'error',
  BLOQUEADO:                  'bloqueado',
  DATOS_INSUFICIENTES:        'datos_insuficientes',
};

// ── Palabras clave de detección ───────────────────────────────────────────────
// IMPORTANTE: estas keywords solo se evalúan DESPUÉS de un submit, no en la carga inicial
const CONFIRM_KEYWORDS  = ['thank you', 'thanks for', 'gracias por', 'tu solicitud ha sido', 'hemos recibido', 'we received', 'submission received', 'successfully submitted', 'alta completada', 'cuenta creada', 'registro completado'];
const EMAIL_KEYWORDS    = ['verifica tu email', 'verifica tu correo', 'check your email', 'confirm your email', 'hemos enviado un correo', 'we sent you an email', 'te hemos enviado', 'revisa tu bandeja'];
const ERROR_KEYWORDS    = ['error', 'inválido', 'invalid', 'requerido', 'required', 'ya existe', 'already exists', 'incorrect', 'incorrecto', 'campo obligatorio'];
const CAPTCHA_SELECTORS = ['iframe[src*="recaptcha"]', 'iframe[src*="hcaptcha"]', '.cf-challenge', '#challenge-form', '[data-sitekey]'];
const OAUTH_SELECTORS   = ['button:has-text("Google")', 'button:has-text("Facebook")', 'button:has-text("Apple")', 'a:has-text("Continuar con Google")'];

// ── Cookie patterns ───────────────────────────────────────────────────────────
const COOKIE_PATTERNS = [
  // CMPs conocidos
  '#onetrust-accept-btn-handler',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  '#axeptio_btn_acceptAll',
  '.cc-accept',
  '.cookie-accept',
  // Texto ES
  'button:has-text("Aceptar todo")',
  'button:has-text("Aceptar todas")',
  'button:has-text("Aceptar cookies")',
  'button:has-text("Aceptar")',
  'button:has-text("Acepto")',
  'a:has-text("Aceptar todo")',
  'a:has-text("Aceptar")',
  // Texto EN
  'button:has-text("Accept all")',
  'button:has-text("Accept All")',
  'button:has-text("Accept")',
  'button:has-text("OK")',
  'button:has-text("Got it")',
  'button:has-text("I agree")',
  'button:has-text("Allow all")',
  // Atributos genéricos
  'button[id*="accept" i]',
  'button[class*="accept" i]',
  'button[id*="cookie" i]',
  '[aria-label*="accept" i]',
  '[data-testid*="accept" i]',
];

// ── createBot ─────────────────────────────────────────────────────────────────
async function createBot({ logFile, screenshotsDir, headless = true, locale = 'es-ES' } = {}) {
  const SCREENSHOTS = screenshotsDir || path.join(__dirname, 'screenshots');
  const LOG         = logFile        || path.join(__dirname, 'bot-engine.log');

  if (!fs.existsSync(SCREENSHOTS)) fs.mkdirSync(SCREENSHOTS, { recursive: true });

  function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    fs.appendFileSync(LOG, line + '\n');
  }

  const browser = await chromium.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      `--lang=${locale}`,
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale,
    timezoneId: locale.startsWith('es') ? 'Europe/Madrid' : 'Europe/London',
    // Headers adicionales para parecer más humano
    extraHTTPHeaders: {
      'Accept-Language': locale.startsWith('es') ? 'es-ES,es;q=0.9,en;q=0.8' : 'en-US,en;q=0.9',
    },
  });

  const page = await context.newPage();

  // ── Helpers ─────────────────────────────────────────────────────────────────

  async function screenshot(name, analyze = false, context = '') {
    const file = path.join(SCREENSHOTS, `${name}.png`);
    await page.screenshot({ path: file, fullPage: false }).catch(() => {});
    
    // Si analyze=true, usar visión para diagnosticar
    if (analyze && fs.existsSync(file)) {
      try {
        const { analyzeScreenshot } = require('./vision-analyzer');
        const analysis = await analyzeScreenshot(file, context);
        log(`[vision:${name}] state=${analysis.state}, errors=${analysis.errors.length}`);
        if (analysis.errors.length) {
          log(`[vision:${name}] ${analysis.errors.join(' | ')}`);
        }
        return { file, analysis };
      } catch (e) {
        log(`[vision:error] ${e.message}`);
      }
    }
    
    return file;
  }

  /** Espera networkidle + desaparición de spinners y overlays */
  async function waitReady(timeout = 15000) {
    await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
    await page.waitForFunction(() => {
      const els = document.querySelectorAll('[class*="spinner"], [class*="loader"], [class*="loading"]');
      return [...els].every(el => {
        const s = getComputedStyle(el);
        return s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0';
      });
    }, { timeout: 5000 }).catch(() => {});
  }

  /** Acepta cookie banners — recorre todos los patrones conocidos */
  async function acceptCookies() {
    for (const sel of COOKIE_PATTERNS) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1200 })) {
          await btn.click();
          await page.waitForTimeout(1200);
          log(`[cookies:accepted] via: ${sel}`);
          return true;
        }
      } catch {}
    }
    return false;
  }

  /** Detecta el estado actual de la página */
  async function detectState() {
    const content = await page.content().catch(() => '');
    const lower   = content.toLowerCase();

    // Captcha
    for (const sel of CAPTCHA_SELECTORS) {
      if (await page.locator(sel).count() > 0) return STATE.INTERVENCION_HUMANA;
    }

    // Confirmación
    if (CONFIRM_KEYWORDS.some(k => lower.includes(k))) return STATE.CONFIRMACION;

    // Verificación email
    if (EMAIL_KEYWORDS.some(k => lower.includes(k))) return STATE.VERIFICACION_EMAIL;

    // Error visible
    if (ERROR_KEYWORDS.some(k => lower.includes(k))) {
      // Solo si hay un elemento de error visible (no solo texto en el DOM)
      const errorVisible = await page.locator('[class*="error" i], [class*="alert" i], [role="alert"]').first().isVisible({ timeout: 500 }).catch(() => false);
      if (errorVisible) return STATE.ERROR;
    }

    // Formulario
    const formVisible = await page.locator('form input:visible, form textarea:visible').first().isVisible({ timeout: 500 }).catch(() => false);
    if (formVisible) return STATE.FORMULARIO;

    return STATE.LANDING;
  }

  /**
   * Rellena un campo buscando por: label → placeholder → selector CSS
   * hints: array de strings — pueden ser texto de label, placeholder, o selector CSS
   */
  async function fillField(hints, value) {
    if (value === undefined || value === null || value === '') {
      log(`[datos_insuficientes] fillField llamado con valor vacío para hints: ${hints.join(', ')}`);
      return false;
    }
    for (const hint of hints) {
      // Por label
      try {
        const el = page.getByLabel(hint, { exact: false });
        if (await el.first().isVisible({ timeout: 1200 })) {
          await el.first().fill(value);
          return true;
        }
      } catch {}
      // Por placeholder
      try {
        const el = page.getByPlaceholder(hint, { exact: false });
        if (await el.first().isVisible({ timeout: 1200 })) {
          await el.first().fill(value);
          return true;
        }
      } catch {}
      // Por selector CSS (solo si parece un selector)
      if (/^[#.\[a-z]/.test(hint)) {
        try {
          const el = page.locator(hint).first();
          if (await el.isVisible({ timeout: 1200 })) {
            await el.fill(value);
            return true;
          }
        } catch {}
      }
    }
    log(`[warn:fillField] no se encontró campo para: ${hints.join(', ')}`);
    return false;
  }

  /** Selecciona opción en un <select> */
  async function selectOption(hints, value) {
    for (const hint of hints) {
      try {
        const el = page.locator(hint).first();
        if (await el.isVisible({ timeout: 1200 })) {
          await el.selectOption({ label: value }).catch(() => el.selectOption({ value }));
          return true;
        }
      } catch {}
    }
    return false;
  }

  /** Selecciona opción en un <select> */
  async function selectOption(hints, value) {
    for (const hint of hints) {
      try {
        const el = page.locator(hint).first();
        if (await el.isVisible({ timeout: 1200 })) {
          // Intentar por label primero, luego por value
          await el.selectOption({ label: value }).catch(() => el.selectOption({ value }));
          return true;
        }
      } catch {}
    }
    return false;
  }

  /** Click buscando por texto de botón o selector */
  async function clickBtn(hints) {
    for (const hint of hints) {
      // Por role button con nombre
      try {
        const el = page.getByRole('button', { name: hint, exact: false });
        if (await el.first().isVisible({ timeout: 1200 })) {
          await el.first().click();
          return true;
        }
      } catch {}
      // Por role link con nombre
      try {
        const el = page.getByRole('link', { name: hint, exact: false });
        if (await el.first().isVisible({ timeout: 1200 })) {
          await el.first().click();
          return true;
        }
      } catch {}
      // Por selector CSS
      if (/^[#.\[a-z]/.test(hint)) {
        try {
          const el = page.locator(hint).first();
          if (await el.isVisible({ timeout: 1200 })) {
            await el.click();
            return true;
          }
        } catch {}
      }
    }
    log(`[warn:clickBtn] no se encontró botón para: ${hints.join(', ')}`);
    return false;
  }

  /**
   * Verifica si avanzamos tras una acción
   * Devuelve: 'confirmed' | 'pendiente_verificacion_email' | 'pendiente_intervencion_humana' | 'error_visible' | 'navigated_to:URL' | 'no_change'
   */
  async function checkProgress(prevUrl) {
    await page.waitForTimeout(2000);
    const newUrl  = page.url();
    const state   = await detectState();

    if (state === STATE.CONFIRMACION)        return STATE.CONFIRMACION;
    if (state === STATE.VERIFICACION_EMAIL)  return STATE.VERIFICACION_EMAIL;
    if (state === STATE.INTERVENCION_HUMANA) return STATE.INTERVENCION_HUMANA;
    if (state === STATE.ERROR)               return STATE.ERROR;
    if (newUrl !== prevUrl)                  return `navigated_to:${newUrl}`;
    return 'no_change';
  }

  /** Detecta si hay OAuth obligatorio (sin opción de email) */
  async function isOAuthOnly() {
    for (const sel of OAUTH_SELECTORS) {
      if (await page.locator(sel).first().isVisible({ timeout: 800 }).catch(() => false)) {
        const emailInput = await page.locator('input[type="email"]').first().isVisible({ timeout: 800 }).catch(() => false);
        if (!emailInput) return true;
      }
    }
    return false;
  }

  /**
   * Navega a una URL con la estrategia correcta según el tipo de página
   * strategy: 'fast' (domcontentloaded) | 'spa' (networkidle, para JS asíncrono)
   */
  async function goto(url, strategy = 'fast') {
    const waitUntil = strategy === 'spa' ? 'networkidle' : 'domcontentloaded';
    const timeout   = strategy === 'spa' ? 45000 : 30000;
    await page.goto(url, { waitUntil, timeout });
    await waitReady(strategy === 'spa' ? 20000 : 15000);
    await acceptCookies();
    await page.waitForTimeout(1500);
  }

  /**
   * Ejecuta una función de submisión con reintentos automáticos
   * submitFn: async (page) => string (estado final)
   */
  async function withRetry(id, submitFn, maxRetries = 2) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await submitFn(page);
        return result;
      } catch (err) {
        lastError = err;
        log(`[error:attempt${attempt}/${maxRetries}] ${id} — ${err.message}`);
        await screenshot(`error-${id}-attempt${attempt}`);
        if (attempt < maxRetries) await page.waitForTimeout(3000);
      }
    }
    return `${STATE.ERROR} — ${lastError?.message}`;
  }

  return {
    page,
    browser,
    context,
    log,
    screenshot,
    waitReady,
    acceptCookies,
    detectState,
    fillField,
    selectOption,
    clickBtn,
    checkProgress,
    isOAuthOnly,
    goto,
    withRetry,
    STATE,
  };
}

module.exports = { createBot, STATE };
