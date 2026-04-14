#!/usr/bin/env node
// inspect-forms.js — Inspecciona los campos reales de cada formulario
const { chromium } = require('playwright');

const URLS = [
  { id: 'aitoolsdirectory', url: 'https://aitoolsdirectory.com/submit-tool' },
  { id: 'habitissimo', url: 'https://www.habitissimo.es/pro/registro' },
  { id: 'certicalia', url: 'https://www.certicalia.com/registro-empresa' },
  { id: 'europages', url: 'https://www.europages.es/registro-empresa' },
  { id: 'infobel', url: 'https://www.infobel.com/es/spain/add_company' },
];

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    locale: 'es-ES',
  });
  const page = await context.newPage();

  for (const { id, url } of URLS) {
    console.log(`\n=== ${id} ===`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(4000);
      await page.screenshot({ path: `/tmp/inspect-${id}.png` });

      const fields = await page.evaluate(() =>
        Array.from(document.querySelectorAll('input, textarea, select, button[type="submit"]'))
          .map(el => ({
            tag: el.tagName,
            type: el.type || '',
            name: el.name || '',
            id: el.id || '',
            placeholder: el.placeholder || '',
            'aria-label': el.getAttribute('aria-label') || '',
            class: el.className?.toString().substring(0, 60) || '',
          }))
      );
      console.log(JSON.stringify(fields, null, 2));
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
    }
  }

  await browser.close();
})();
