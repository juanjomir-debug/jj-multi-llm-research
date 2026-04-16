#!/usr/bin/env node
// submit-directories.js — Envía reliableai.net a directorios de herramientas IA
// Uso: node submit-directories.js [--dry-run] [--only aitoolsdirectory]

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TOOL = {
  name: 'ReliableAI',
  url: 'https://reliableai.net',
  tagline: 'Multi-model AI research platform — run any question through Claude, GPT, Gemini, Grok and more simultaneously',
  description: `ReliableAI runs your question simultaneously through multiple leading AI models (Claude, GPT-5, Gemini, Grok, Qwen) and compares their answers in real time. It detects contradictions between models, flags hallucinations, scores confidence, and synthesizes a reliable final answer. Features include parallel and cascade analysis, model debate mode, hallucination audit with web search, research planning, and export to Word. Free plan available.`,
  category: 'Research / Productivity / AI Comparison',
  tags: ['AI research', 'LLM comparison', 'hallucination detection', 'multi-model AI', 'Claude', 'GPT', 'Gemini'],
  email: 'info@reliableai.net',
  twitter: '@reliableai_net',
  pricing: 'Freemium',
  logo: 'https://reliableai.net/og-image.png',
};

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const LOG_FILE = path.join(__dirname, 'submissions.log');

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

const isDryRun = process.argv.includes('--dry-run');
const onlyTarget = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Acepta cookie banners comunes — intenta múltiples patrones */
async function acceptCookies(page) {
  const patterns = [
    'button:has-text("Accept all")',
    'button:has-text("Accept All")',
    'button:has-text("Aceptar todo")',
    'button:has-text("Aceptar todas")',
    'button:has-text("Aceptar")',
    'button:has-text("Accept")',
    'button:has-text("OK")',
    'button:has-text("Got it")',
    'button:has-text("I agree")',
    'button[id*="accept" i]',
    'button[class*="accept" i]',
    'a:has-text("Accept all")',
    '[aria-label*="accept" i]',
    '[data-testid*="accept" i]',
  ];
  for (const sel of patterns) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click();
        await page.waitForTimeout(1000);
        log(`[cookies] accepted via: ${sel}`);
        return true;
      }
    } catch {}
  }
  return false;
}

/** Espera a que desaparezcan loaders/overlays y la página esté estable */
async function waitReady(page, timeout = 15000) {
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
  // Espera a que no haya spinners visibles
  await page.waitForFunction(() => {
    const spinners = document.querySelectorAll('[class*="spinner"], [class*="loader"], [class*="loading"]');
    return [...spinners].every(el => getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden');
  }, { timeout: 5000 }).catch(() => {});
}

/** Rellena un campo buscando por label, placeholder, name, id — en ese orden de preferencia */
async function fillField(page, hints, value) {
  // Por label (más robusto)
  for (const hint of hints) {
    try {
      const byLabel = page.getByLabel(hint, { exact: false });
      if (await byLabel.first().isVisible({ timeout: 1500 })) {
        await byLabel.first().fill(value);
        return true;
      }
    } catch {}
  }
  // Por placeholder
  for (const hint of hints) {
    try {
      const byPlaceholder = page.getByPlaceholder(hint, { exact: false });
      if (await byPlaceholder.first().isVisible({ timeout: 1500 })) {
        await byPlaceholder.first().fill(value);
        return true;
      }
    } catch {}
  }
  // Por selector CSS como fallback
  for (const hint of hints) {
    if (!hint.includes('[') && !hint.includes('#')) continue; // solo selectores CSS
    try {
      const el = page.locator(hint).first();
      if (await el.isVisible({ timeout: 1500 })) {
        await el.fill(value);
        return true;
      }
    } catch {}
  }
  return false;
}

/** Hace click buscando por texto visible, role o selector */
async function clickBtn(page, hints) {
  for (const hint of hints) {
    try {
      // Intenta como texto de botón
      const byText = page.getByRole('button', { name: hint, exact: false });
      if (await byText.first().isVisible({ timeout: 1500 })) {
        await byText.first().click();
        return true;
      }
    } catch {}
    try {
      const el = page.locator(hint).first();
      if (await el.isVisible({ timeout: 1500 })) {
        await el.click();
        return true;
      }
    } catch {}
  }
  return false;
}

// ── Directorios ───────────────────────────────────────────────────────────────
const DIRECTORIES = [

  {
    id: 'aitoolsdirectory',
    name: 'AI Tools Directory',
    submitUrl: 'https://aitoolsdirectory.com/submit-tool',
    async submit(page) {
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitReady(page);
      await acceptCookies(page);

      // Espera a que el formulario sea interactuable
      await page.waitForSelector('form', { timeout: 10000 }).catch(() => {});

      await fillField(page, ['Tool Name', 'name', 'tool name', 'input[name*="name"]'], TOOL.name);
      await fillField(page, ['URL', 'Website', 'url', 'input[type="url"]', 'input[name*="url"]'], TOOL.url);
      await fillField(page, ['Email', 'email', 'input[type="email"]'], TOOL.email);
      await fillField(page, ['Description', 'description', 'textarea'], TOOL.description);

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'submit-aitoolsdirectory.png') });

      if (!isDryRun) {
        await clickBtn(page, ['Submit', 'Submit Tool', 'button[type="submit"]', 'input[type="submit"]']);
        await page.waitForTimeout(4000);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'submit-aitoolsdirectory-after.png') });
        const url = page.url();
        const content = await page.content();
        if (content.includes('thank') || content.includes('success') || content.includes('gracias') || content.includes('submitted')) {
          return 'confirmed';
        }
        return `submitted (url: ${url})`;
      }
      return 'dry-run';
    }
  },

  {
    id: 'aitools_inc',
    name: 'AI Tools Inc',
    submitUrl: 'https://aitools.inc/submit',
    async submit(page) {
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitReady(page);
      await acceptCookies(page);

      // Buscar y clicar el botón "Submit Now" / "Free Listing"
      const clicked = await clickBtn(page, ['Submit Now', 'Free Listing', 'Submit a Tool', 'a:has-text("Submit Now")']);
      if (clicked) await waitReady(page, 8000);

      await fillField(page, ['Tool Name', 'name', 'input[name*="name"]', 'input[placeholder*="tool" i]'], TOOL.name);
      await fillField(page, ['URL', 'Website', 'input[type="url"]', 'input[name*="url"]'], TOOL.url);
      await fillField(page, ['Email', 'input[type="email"]'], TOOL.email);
      await fillField(page, ['Description', 'textarea'], TOOL.description);

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'submit-aitools_inc.png') });

      if (!isDryRun) {
        await clickBtn(page, ['Submit', 'button[type="submit"]']);
        await page.waitForTimeout(4000);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'submit-aitools_inc-after.png') });
        const content = await page.content();
        if (content.includes('thank') || content.includes('success') || content.includes('submitted')) return 'confirmed';
        return `submitted (url: ${page.url()})`;
      }
      return 'dry-run';
    }
  },

  {
    id: 'aivalley',
    name: 'AI Valley',
    submitUrl: 'https://aivalley.ai/submit-tool/',
    async submit(page) {
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitReady(page);
      await acceptCookies(page);

      // AI Valley usa dark mode — esperar a que el formulario cargue completamente
      await page.waitForSelector('input, textarea', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2000);

      // Usar getByRole y getByLabel para evitar depender de clases dinámicas del dark mode
      await fillField(page, ['Tool Name', 'Name', 'name', 'input[name="tool_name"]', 'input[name="name"]'], TOOL.name);
      await fillField(page, ['Tool URL', 'URL', 'Website URL', 'input[type="url"]', 'input[name="url"]'], TOOL.url);
      await fillField(page, ['Email', 'Your Email', 'input[type="email"]'], TOOL.email);
      await fillField(page, ['Short Description', 'Description', 'textarea[name="description"]', 'textarea'], TOOL.description);
      await fillField(page, ['Tagline', 'Short tagline', 'input[name="tagline"]'], TOOL.tagline);

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'submit-aivalley.png') });

      if (!isDryRun) {
        await clickBtn(page, ['Submit Tool', 'Submit', 'button[type="submit"]']);
        await page.waitForTimeout(4000);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'submit-aivalley-after.png') });
        const content = await page.content();
        if (content.includes('thank') || content.includes('success') || content.includes('submitted')) return 'confirmed';
        return `submitted (url: ${page.url()})`;
      }
      return 'dry-run';
    }
  },

  {
    id: 'toolify',
    name: 'Toolify.ai',
    submitUrl: 'https://www.toolify.ai/submit',
    async submit(page) {
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitReady(page);
      await acceptCookies(page);

      await page.waitForSelector('input', { timeout: 10000 }).catch(() => {});

      await fillField(page, ['URL', 'Tool URL', 'Website', 'input[type="url"]', 'input[placeholder*="url" i]'], TOOL.url);
      await fillField(page, ['Email', 'input[type="email"]', 'input[placeholder*="email" i]'], TOOL.email);

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'submit-toolify.png') });

      if (!isDryRun) {
        await clickBtn(page, ['Submit', 'button[type="submit"]', 'button:has-text("Submit")']);
        await page.waitForTimeout(4000);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'submit-toolify-after.png') });
        const content = await page.content();
        if (content.includes('thank') || content.includes('success') || content.includes('submitted')) return 'confirmed';
        return `submitted (url: ${page.url()})`;
      }
      return 'dry-run';
    }
  },

  {
    id: 'theresanaiforthat',
    name: "There's An AI For That",
    submitUrl: 'https://theresanaiforthat.com/get-featured/',
    async submit(page) {
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitReady(page);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'submit-taaft.png') });
      return 'screenshot_only — requires manual payment review';
    }
  },

];

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const submitted = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf-8') : '';
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  const targets = DIRECTORIES.filter(d => !onlyTarget || d.id === onlyTarget);

  for (const dir of targets) {
    if (submitted.includes(`DONE:${dir.id}`)) {
      log(`[skip] ${dir.name} — already submitted`);
      continue;
    }

    log(`[start] ${dir.name} — ${dir.submitUrl}`);
    let retries = 0;
    while (retries < 2) {
      try {
        const result = await dir.submit(page);
        log(`[DONE:${dir.id}] ${dir.name} — ${result}`);
        break;
      } catch (err) {
        retries++;
        log(`[error:attempt${retries}] ${dir.name} — ${err.message}`);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `error-${dir.id}-attempt${retries}.png`) }).catch(() => {});
        if (retries < 2) await page.waitForTimeout(3000);
      }
    }

    await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
  }

  await browser.close();
  log('[done] All directories processed');
})();
