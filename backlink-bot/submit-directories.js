#!/usr/bin/env node
// submit-directories.js — Envía reliableai.net a directorios de herramientas IA
// Uso: node submit-directories.js [--dry-run] [--only aitoolsdirectory]

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ── Datos de ReliableAI ───────────────────────────────────────────────────────
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

const LOG_FILE = path.join(__dirname, 'submissions.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

const isDryRun = process.argv.includes('--dry-run');
const onlyTarget = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

// ── Directorios ───────────────────────────────────────────────────────────────
const DIRECTORIES = [

  {
    id: 'aitoolsdirectory',
    name: 'AI Tools Directory',
    submitUrl: 'https://aitoolsdirectory.com/submit-tool',
    async submit(page) {
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      // Rellenar campos comunes
      await page.fill('input[name*="name"], input[placeholder*="name" i], input[id*="name" i]', TOOL.name).catch(() => {});
      await page.fill('input[name*="url"], input[placeholder*="url" i], input[type="url"]', TOOL.url).catch(() => {});
      await page.fill('input[name*="email"], input[type="email"]', TOOL.email).catch(() => {});
      await page.fill('textarea[name*="desc"], textarea[placeholder*="desc" i], textarea', TOOL.description).catch(() => {});
      await page.screenshot({ path: `/tmp/submit-aitoolsdirectory.png` });
      if (!isDryRun) {
        await page.click('button[type="submit"], input[type="submit"]').catch(() => {});
        await page.waitForTimeout(3000);
      }
      return 'submitted';
    }
  },

  {
    id: 'aitools_inc',
    name: 'AI Tools Inc',
    submitUrl: 'https://aitools.inc/submit',
    async submit(page) {
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      // Clicar Free Listing
      await page.click('a:has-text("Submit Now"), button:has-text("Submit Now")').catch(() => {});
      await page.waitForTimeout(2000);
      await page.fill('input[name*="name"], input[placeholder*="tool name" i]', TOOL.name).catch(() => {});
      await page.fill('input[name*="url"], input[type="url"]', TOOL.url).catch(() => {});
      await page.fill('input[name*="email"], input[type="email"]', TOOL.email).catch(() => {});
      await page.fill('textarea', TOOL.description).catch(() => {});
      await page.screenshot({ path: `/tmp/submit-aitools_inc.png` });
      if (!isDryRun) {
        await page.click('button[type="submit"], input[type="submit"]').catch(() => {});
        await page.waitForTimeout(3000);
      }
      return 'submitted';
    }
  },

  {
    id: 'aivalley',
    name: 'AI Valley',
    submitUrl: 'https://aivalley.ai/submit-tool/',
    async submit(page) {
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      await page.fill('input[name*="name"], input[placeholder*="name" i]', TOOL.name).catch(() => {});
      await page.fill('input[name*="url"], input[type="url"]', TOOL.url).catch(() => {});
      await page.fill('input[name*="email"], input[type="email"]', TOOL.email).catch(() => {});
      await page.fill('textarea', TOOL.description).catch(() => {});
      await page.screenshot({ path: `/tmp/submit-aivalley.png` });
      if (!isDryRun) {
        await page.click('button[type="submit"], input[type="submit"]').catch(() => {});
        await page.waitForTimeout(3000);
      }
      return 'submitted';
    }
  },

  {
    id: 'toolify',
    name: 'Toolify.ai',
    submitUrl: 'https://www.toolify.ai/submit',
    async submit(page) {
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      await page.fill('input[placeholder*="url" i], input[type="url"]', TOOL.url).catch(() => {});
      await page.fill('input[placeholder*="email" i], input[type="email"]', TOOL.email).catch(() => {});
      await page.screenshot({ path: `/tmp/submit-toolify.png` });
      if (!isDryRun) {
        await page.click('button[type="submit"], button:has-text("Submit")').catch(() => {});
        await page.waitForTimeout(3000);
      }
      return 'submitted';
    }
  },

  {
    id: 'theresanaiforthat',
    name: "There's An AI For That",
    submitUrl: 'https://theresanaiforthat.com/get-featured/',
    async submit(page) {
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      // TAAFT tiene un formulario de pago — solo captura de pantalla para revisión manual
      await page.screenshot({ path: `/tmp/submit-taaft.png` });
      return 'screenshot_only (requires payment review)';
    }
  },

];

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const submitted = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf-8') : '';
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  const targets = DIRECTORIES.filter(d => !onlyTarget || d.id === onlyTarget);

  for (const dir of targets) {
    // Skip if already submitted
    if (submitted.includes(`DONE:${dir.id}`)) {
      log(`[skip] ${dir.name} — already submitted`);
      continue;
    }

    log(`[start] ${dir.name} — ${dir.submitUrl}`);
    try {
      const result = await dir.submit(page);
      log(`[DONE:${dir.id}] ${dir.name} — ${result}`);
    } catch (err) {
      log(`[error] ${dir.name} — ${err.message}`);
      await page.screenshot({ path: `/tmp/error-${dir.id}.png` }).catch(() => {});
    }

    // Pausa entre envíos
    await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
  }

  await browser.close();
  log('[done] All directories processed');
})();
