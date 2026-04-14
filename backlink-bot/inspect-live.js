#!/usr/bin/env node
// inspect-live.js — Inspecciona el DOM real tras aceptar cookies
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS = path.join(__dirname, 'screenshots');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'es-ES',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  const COOKIE_PATTERNS = [
    'button:has-text("Aceptar todo")', 'button:has-text("Aceptar todas")',
    'button:has-text("Aceptar cookies")', 'button:has-text("Aceptar")',
    'a:has-text("Aceptar todo")', 'a:has-text("Aceptar")',
    'button:has-text("Accept all")', 'button:has-text("Accept")',
    '#onetrust-accept-btn-handler', '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  ];

  async function acceptCookies() {
    for (const sel of COOKIE_PATTERNS) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1200 })) { await btn.click(); await page.waitForTimeout(1200); return sel; }
      } catch {}
    }
    return null;
  }

  const targets = [
    { id: 'habitissimo', url: 'https://www.habitissimo.es/registrar/empresa', strategy: 'domcontentloaded' },
    { id: 'certicalia',  url: 'https://www.certicalia.com/usuarios/registro-profesional', strategy: 'networkidle' },
  ];

  for (const { id, url, strategy } of targets) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`INSPECCIONANDO: ${id}`);
    console.log(`URL: ${url}`);

    await page.goto(url, { waitUntil: strategy, timeout: 45000 });
    await page.waitForTimeout(3000);
    const cookieSel = await acceptCookies();
    console.log(`Cookies: ${cookieSel || 'no encontrado'}`);
    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(SCREENSHOTS, `live-${id}.png`), fullPage: true });

    // URL actual
    console.log(`URL actual: ${page.url()}`);

    // Texto visible en la página (primeros 500 chars)
    const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
    console.log(`Texto visible:\n${bodyText}`);

    // Todos los inputs/textareas/selects
    const fields = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input, textarea, select'))
        .filter(el => {
          const s = getComputedStyle(el);
          return s.display !== 'none' && s.visibility !== 'hidden';
        })
        .map(el => ({
          tag: el.tagName,
          type: el.getAttribute('type') || '',
          name: el.getAttribute('name') || '',
          id: el.id || '',
          placeholder: el.placeholder || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          label: (() => {
            if (el.id) {
              const lbl = document.querySelector(`label[for="${el.id}"]`);
              return lbl?.innerText?.trim() || '';
            }
            const parent = el.closest('label');
            return parent?.innerText?.trim().substring(0, 50) || '';
          })(),
          visible: el.offsetParent !== null,
        }))
    );
    console.log(`\nCampos encontrados (${fields.length}):`);
    console.log(JSON.stringify(fields, null, 2));

    // Botones de submit
    const buttons = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button, input[type="submit"], a[href*="register"], a[href*="registro"]'))
        .filter(el => getComputedStyle(el).display !== 'none')
        .map(el => ({ tag: el.tagName, type: el.getAttribute('type') || '', text: el.innerText?.trim().substring(0, 60) || '', href: el.href || '' }))
        .slice(0, 15)
    );
    console.log(`\nBotones (${buttons.length}):`);
    console.log(JSON.stringify(buttons, null, 2));
  }

  await browser.close();
  console.log('\nCapturas guardadas en backlink-bot/screenshots/live-*.png');
})();
