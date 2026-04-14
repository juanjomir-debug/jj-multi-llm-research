#!/usr/bin/env node
// debug2.js — Captura el error exacto de validación en ambos formularios

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

  // Interceptar respuestas de red para ver qué devuelve el servidor
  const networkLog = [];
  page.on('response', r => {
    if (r.url().includes('certicalia') || r.url().includes('habitissimo')) {
      networkLog.push({ url: r.url(), status: r.status(), method: r.request().method() });
    }
  });

  // ══ CERTICALIA ══
  console.log('\n=== CERTICALIA ===');
  await page.goto('https://www.certicalia.com/usuarios/registro-profesional', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await acceptCookies(page);
  await page.waitForTimeout(1500);
  await page.waitForSelector('#nombre-input', { timeout: 8000 }).catch(() => {});

  // Inspeccionar el formulario real — qué campos son visibles y cuáles hidden
  const formInfo = await page.evaluate(() => {
    const form = document.querySelector('form');
    if (!form) return { error: 'no form found' };
    return {
      action: form.action,
      method: form.method,
      fields: Array.from(form.querySelectorAll('input, textarea, select')).map(el => ({
        id: el.id, name: el.name, type: el.type, required: el.required,
        visible: el.offsetParent !== null, value: el.value?.substring(0, 20)
      }))
    };
  });
  console.log('Form info:', JSON.stringify(formInfo, null, 2));

  // Rellenar
  await page.locator('#nombre-input').fill('Resistone').catch(() => {});
  await page.locator('#apellidos-input').fill('Microcemento').catch(() => {});
  await page.locator('input[name="one_step[email]"]').fill(BIZ.email).catch(() => {});
  await page.locator('#telefono-input').fill(BIZ.phone).catch(() => {});
  await page.locator('#password-input').fill(BIZ.password).catch(() => {});
  await page.locator('#codigo-postal-input').fill(BIZ.zip).catch(() => {});
  // Razón social — buscar por name exacto
  await page.locator('input[name="one_step[business_name]"]').fill(BIZ.name).catch(e => console.log('razon err:', e.message));
  await page.locator('#aceptar-condiciones').check().catch(() => {});

  await page.screenshot({ path: path.join(SCREENSHOTS, 'debug2-certicalia-filled.png') });

  // Verificar qué campos tienen valor
  const filledCheck = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input[name^="one_step"]')).map(el => ({ name: el.name, value: el.value, required: el.required }))
  );
  console.log('Campos one_step:', JSON.stringify(filledCheck));

  // Submit y capturar respuesta de red
  networkLog.length = 0;
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(SCREENSHOTS, 'debug2-certicalia-after.png') });

  console.log('Respuestas de red tras submit:', JSON.stringify(networkLog.filter(r => r.method === 'POST' || r.status >= 300)));

  // Capturar TODOS los textos visibles que puedan ser errores
  const allText = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const texts = [];
    let node;
    while (node = walker.nextNode()) {
      const txt = node.textContent.trim();
      if (txt.length > 3 && txt.length < 150 && node.parentElement?.offsetParent !== null) {
        texts.push(txt);
      }
    }
    return [...new Set(texts)].slice(0, 50);
  });
  console.log('Textos visibles tras submit:', allText.join(' | '));

  // ══ HABITISSIMO ══
  console.log('\n=== HABITISSIMO ===');
  await page.goto('https://www.habitissimo.es/registrar/empresa', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await acceptCookies(page);
  await page.waitForTimeout(1500);

  // Paso 1
  await page.locator('input[placeholder*="Fontanero" i]').first().fill('Microcemento').catch(() => {});
  await page.waitForTimeout(1500);
  const sug1 = await page.locator('[role="option"]').all();
  if (sug1.length) await sug1[0].click().catch(() => {});
  await page.waitForTimeout(800);
  await page.locator('input[placeholder*="Madrid" i]').first().fill('Madrid').catch(() => {});
  await page.waitForTimeout(1500);
  const sug2 = await page.locator('[role="option"]').all();
  if (sug2.length) await sug2[0].click().catch(() => {});
  await page.waitForTimeout(800);
  await page.locator('button:has-text("Conseguir trabajos")').first().click().catch(() => {});
  await page.waitForTimeout(4000);

  // Paso 2 — rellenar
  await page.waitForSelector('#company-name', { timeout: 8000 }).catch(() => {});
  await page.locator('#company-name').fill(BIZ.name).catch(() => {});
  await page.locator('#name').fill('Resistone').catch(() => {});
  await page.locator('input[name="email"]').fill(BIZ.email).catch(() => {});
  await page.locator('#phone').fill(BIZ.phone).catch(() => {});
  await page.locator('#password').fill(BIZ.password).catch(() => {});
  await page.locator('#third-party').check().catch(() => {});

  await page.screenshot({ path: path.join(SCREENSHOTS, 'debug2-habitissimo-filled.png') });

  // Submit
  networkLog.length = 0;
  await page.locator('button:has-text("Regístrate ahora"), button[type="submit"]').first().click().catch(() => {});
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(SCREENSHOTS, 'debug2-habitissimo-after.png') });

  console.log('Red tras submit:', JSON.stringify(networkLog.filter(r => r.method === 'POST' || r.status >= 300)));

  const habTexts = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const texts = [];
    let node;
    while (node = walker.nextNode()) {
      const txt = node.textContent.trim();
      if (txt.length > 3 && txt.length < 150 && node.parentElement?.offsetParent !== null) texts.push(txt);
    }
    return [...new Set(texts)].slice(0, 60);
  });
  console.log('URL:', page.url());
  console.log('Textos visibles:', habTexts.join(' | '));

  await browser.close();
})();
