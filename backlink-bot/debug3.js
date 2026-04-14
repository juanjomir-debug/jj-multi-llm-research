#!/usr/bin/env node
// debug3.js — Captura pantallazos fullPage tras submit real y extrae texto de errores

const { chromium } = require('playwright');
const path = require('path');
const SCREENSHOTS = path.join(__dirname, 'screenshots');
const BIZ = { name: 'Resistone Microcemento', email: 'info@resistone.es', phone: '917528727', zip: '28925', password: 'Resistone2024!' };

async function acceptCookies(page) {
  for (const sel of ['button:has-text("Aceptar")', 'a:has-text("Aceptar")', '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll']) {
    try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 1000 })) { await b.click(); await page.waitForTimeout(1000); return; } } catch {}
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', locale: 'es-ES', viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // ══ HABITISSIMO — capturar error exacto ══
  console.log('=== HABITISSIMO ===');
  await page.goto('https://www.habitissimo.es/registrar/empresa', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await acceptCookies(page);
  await page.waitForTimeout(1500);

  // Paso 1
  await page.locator('input[placeholder*="Fontanero" i]').first().fill('Microcemento');
  await page.waitForTimeout(1500);
  const s1 = await page.locator('[role="option"]').all();
  if (s1.length) await s1[0].click();
  await page.waitForTimeout(800);
  await page.locator('input[placeholder*="Madrid" i]').first().fill('Madrid');
  await page.waitForTimeout(1500);
  const s2 = await page.locator('[role="option"]').all();
  if (s2.length) await s2[0].click();
  await page.waitForTimeout(800);
  await page.locator('button:has-text("Conseguir trabajos")').first().click();
  await page.waitForSelector('#company-name', { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // Paso 2
  await page.locator('#company-name').fill(BIZ.name).catch(() => {});
  await page.locator('#name').fill('Resistone').catch(() => {});
  await page.locator('input[name="email"]').fill(BIZ.email).catch(() => {});
  await page.locator('#phone').fill(BIZ.phone).catch(() => {});
  await page.locator('#password').fill(BIZ.password).catch(() => {});
  await page.locator('#third-party').check().catch(() => {});
  await page.screenshot({ path: path.join(SCREENSHOTS, 'debug3-hab-filled.png'), fullPage: true });

  // Submit
  await page.locator('button:has-text("Regístrate ahora"), button[type="submit"]').first().click().catch(() => {});
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(SCREENSHOTS, 'debug3-hab-after.png'), fullPage: true });

  // Extraer TODOS los textos visibles incluyendo errores inline
  const habResult = await page.evaluate(() => {
    const url = location.href;
    // Buscar mensajes de error inline (debajo de campos)
    const errorEls = Array.from(document.querySelectorAll('p, span, div, small'))
      .filter(el => {
        const txt = el.innerText?.trim();
        const cls = (el.className || '').toString().toLowerCase();
        return txt && txt.length < 200 && el.children.length === 0 && el.offsetParent !== null &&
          (cls.includes('error') || cls.includes('invalid') || cls.includes('help') || cls.includes('message') || cls.includes('feedback'));
      })
      .map(el => ({ text: el.innerText.trim(), class: el.className?.toString().substring(0, 60) }));

    // Texto completo de la página
    const bodyText = document.body?.innerText?.substring(0, 1000) || '';
    return { url, errorEls, bodyText };
  });
  console.log('URL:', habResult.url);
  console.log('Error elements:', JSON.stringify(habResult.errorEls));
  console.log('Body (primeros 600):', habResult.bodyText.substring(0, 600));

  // ══ CERTICALIA — capturar qué pasa tras submit ══
  console.log('\n=== CERTICALIA ===');
  await page.goto('https://www.certicalia.com/usuarios/registro-profesional', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await acceptCookies(page);
  await page.waitForTimeout(1500);
  await page.waitForSelector('#nombre-input', { timeout: 8000 }).catch(() => {});

  await page.locator('#nombre-input').fill('Resistone').catch(() => {});
  await page.locator('#apellidos-input').fill('Microcemento').catch(() => {});
  await page.locator('input[name="one_step[email]"]').fill(BIZ.email).catch(() => {});
  await page.locator('#telefono-input').fill(BIZ.phone).catch(() => {});
  await page.locator('#password-input').fill(BIZ.password).catch(() => {});
  await page.locator('#documentacion-input').fill('12345678Z').catch(() => {});
  await page.locator('#codigo-postal-input').fill(BIZ.zip).catch(() => {});
  await page.locator('#aceptar-condiciones').check().catch(() => {});
  await page.screenshot({ path: path.join(SCREENSHOTS, 'debug3-cert-filled.png'), fullPage: true });

  // Interceptar XHR/fetch
  const xhrLog = [];
  page.on('request', r => { if (r.method() === 'POST') xhrLog.push({ url: r.url(), method: r.method() }); });
  page.on('response', r => { if (r.request().method() === 'POST') xhrLog.push({ url: r.url(), status: r.status() }); });

  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(8000);
  await page.screenshot({ path: path.join(SCREENSHOTS, 'debug3-cert-after.png'), fullPage: true });

  console.log('XHR POST requests:', JSON.stringify(xhrLog.filter(x => x.url.includes('certicalia'))));

  const certResult = await page.evaluate(() => {
    const errorEls = Array.from(document.querySelectorAll('p, span, div, small, li'))
      .filter(el => {
        const txt = el.innerText?.trim();
        const cls = (el.className || '').toString().toLowerCase();
        return txt && txt.length < 200 && el.children.length === 0 && el.offsetParent !== null &&
          (cls.includes('error') || cls.includes('invalid') || cls.includes('help') || cls.includes('danger') || cls.includes('warning'));
      })
      .map(el => ({ text: el.innerText.trim(), class: el.className?.toString().substring(0, 60) }));
    return { url: location.href, errorEls, bodyText: document.body?.innerText?.substring(0, 600) || '' };
  });
  console.log('URL:', certResult.url);
  console.log('Errores:', JSON.stringify(certResult.errorEls));
  console.log('Body:', certResult.bodyText.substring(0, 400));

  await browser.close();
  console.log('\nCapturas fullPage: debug3-*.png');
})();
