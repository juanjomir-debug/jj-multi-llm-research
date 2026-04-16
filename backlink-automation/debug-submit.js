#!/usr/bin/env node
// debug-submit.js — Captura estado DOM completo tras submit real

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS = path.join(__dirname, 'screenshots');

const BIZ = {
  name: 'Resistone Microcemento', url: 'https://www.microcemento.org',
  email: 'info@resistone.es', phone: '917528727',
  zip: '28925', cif: 'B85123040', password: 'Resistone2024!',
};

const COOKIE_PATTERNS = [
  'button:has-text("Aceptar todo")', 'button:has-text("Aceptar todas")',
  'button:has-text("Aceptar cookies")', 'button:has-text("Aceptar")',
  'a:has-text("Aceptar")', 'button:has-text("Accept all")',
  '#onetrust-accept-btn-handler', '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
];

async function acceptCookies(page) {
  for (const sel of COOKIE_PATTERNS) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1200 })) { await btn.click(); await page.waitForTimeout(1200); return; }
    } catch {}
  }
}

async function fullDOMState(page) {
  return page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), textarea, select'))
      .filter(el => el.offsetParent !== null)
      .map(el => ({ id: el.id, name: el.name, type: el.type, value: el.value?.substring(0,40), label: document.querySelector(`label[for="${el.id}"]`)?.innerText?.trim()?.substring(0,40) || '' }));
    const allErrors = Array.from(document.querySelectorAll('*'))
      .filter(el => {
        const txt = el.innerText?.trim();
        return txt && txt.length < 200 && el.children.length === 0 &&
          (el.className?.toString().toLowerCase().includes('error') ||
           el.className?.toString().toLowerCase().includes('invalid') ||
           el.getAttribute('role') === 'alert' ||
           el.className?.toString().toLowerCase().includes('alert'));
      })
      .map(el => el.innerText.trim())
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 10);
    return {
      url: location.href,
      inputs,
      errors: allErrors,
      bodyText: document.body?.innerText?.substring(0, 800) || '',
      submitBtns: Array.from(document.querySelectorAll('button[type="submit"], input[type="submit"]'))
        .map(el => ({ text: el.innerText?.trim() || el.value, disabled: el.disabled, visible: el.offsetParent !== null })),
    };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36', locale: 'es-ES', viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // ══════════════════════════════════════════════════════════
  // CERTICALIA
  // ══════════════════════════════════════════════════════════
  console.log('\n=== CERTICALIA ===');
  await page.goto('https://www.certicalia.com/usuarios/registro-profesional', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await acceptCookies(page);
  await page.waitForTimeout(1500);
  await page.waitForSelector('#nombre-input', { timeout: 8000 }).catch(() => {});

  await page.locator('#nombre-input').fill('Resistone').catch(() => {});
  await page.locator('#apellidos-input').fill('Microcemento').catch(() => {});
  await page.locator('#one_step_email, input[name="one_step[email]"]').first().fill(BIZ.email).catch(() => {});
  await page.locator('#telefono-input').fill(BIZ.phone).catch(() => {});
  await page.locator('#password-input').fill(BIZ.password).catch(() => {});
  await page.locator('#documentacion-input').fill(BIZ.cif).catch(() => {});
  await page.locator('#codigo-postal-input').fill(BIZ.zip).catch(() => {});
  await page.locator('#razon-social-input').fill(BIZ.name).catch(() => {});
  await page.locator('#aceptar-condiciones').check().catch(() => {});

  // Ver botones submit disponibles antes de clicar
  const beforeState = await fullDOMState(page);
  console.log('Submit buttons:', JSON.stringify(beforeState.submitBtns));
  await page.screenshot({ path: path.join(SCREENSHOTS, 'debug-certicalia-filled.png') });

  // Click submit y esperar respuesta del servidor
  await page.locator('button[type="submit"]').first().click();
  // Esperar navegación O respuesta de red
  await Promise.race([
    page.waitForNavigation({ timeout: 8000 }).catch(() => {}),
    page.waitForResponse(r => r.url().includes('certicalia') && r.status() !== 200, { timeout: 8000 }).catch(() => {}),
    page.waitForTimeout(8000),
  ]);

  await page.screenshot({ path: path.join(SCREENSHOTS, 'debug-certicalia-after.png') });
  const afterState = await fullDOMState(page);
  console.log('URL después:', afterState.url);
  console.log('Errores:', afterState.errors);
  console.log('Submit btns después:', JSON.stringify(afterState.submitBtns));
  console.log('Texto página (primeros 500):', afterState.bodyText.substring(0, 500));

  // ══════════════════════════════════════════════════════════
  // HABITISSIMO
  // ══════════════════════════════════════════════════════════
  console.log('\n=== HABITISSIMO ===');
  await page.goto('https://www.habitissimo.es/registrar/empresa', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await acceptCookies(page);
  await page.waitForTimeout(1500);

  // Paso 1
  const catInput = page.locator('input[placeholder*="Fontanero" i], input[placeholder*="Carpintero" i]').first();
  await catInput.fill('Microcemento').catch(() => {});
  await page.waitForTimeout(1500);
  const sug1 = await page.locator('[role="option"]').all();
  if (sug1.length) await sug1[0].click().catch(() => {});
  await page.waitForTimeout(800);

  const locInput = page.locator('input[placeholder*="Madrid" i], input[placeholder*="localidad" i]').first();
  await locInput.fill('Madrid').catch(() => {});
  await page.waitForTimeout(1500);
  const sug2 = await page.locator('[role="option"]').all();
  if (sug2.length) await sug2[0].click().catch(() => {});
  await page.waitForTimeout(800);

  await page.locator('button:has-text("Conseguir trabajos")').first().click().catch(() => {});
  await page.waitForTimeout(4000);

  // Paso 2 — rellenar con IDs exactos
  await page.waitForSelector('#company-name', { timeout: 8000 }).catch(() => {});
  const step2State = await fullDOMState(page);
  console.log('Paso 2 inputs:', JSON.stringify(step2State.inputs.map(i => ({ id: i.id, label: i.label }))));

  await page.locator('#company-name').fill(BIZ.name).catch(() => {});
  await page.locator('#name').fill('Resistone').catch(() => {});
  // Email tiene ID dinámico — usar name="email"
  await page.locator('input[name="email"]').fill(BIZ.email).catch(() => {});
  await page.locator('#phone').fill(BIZ.phone).catch(() => {});
  await page.locator('#password').fill(BIZ.password).catch(() => {});
  await page.locator('#third-party').check().catch(() => {});

  await page.screenshot({ path: path.join(SCREENSHOTS, 'debug-habitissimo-filled.png') });
  const habFilledState = await fullDOMState(page);
  console.log('Campos rellenos:', JSON.stringify(habFilledState.inputs.map(i => ({ id: i.id, value: i.value }))));
  console.log('Submit btns:', JSON.stringify(habFilledState.submitBtns));

  // Submit
  await page.locator('button[type="submit"]').first().click().catch(() => {});
  await Promise.race([
    page.waitForNavigation({ timeout: 8000 }).catch(() => {}),
    page.waitForTimeout(8000),
  ]);

  await page.screenshot({ path: path.join(SCREENSHOTS, 'debug-habitissimo-after.png') });
  const habAfterState = await fullDOMState(page);
  console.log('URL después:', habAfterState.url);
  console.log('Errores:', habAfterState.errors);
  console.log('Texto página:', habAfterState.bodyText.substring(0, 500));

  await browser.close();
  console.log('\nCapturas: backlink-bot/screenshots/debug-*.png');
})();
