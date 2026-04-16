#!/usr/bin/env node
/**
 * final-resistone.js — Versión final con inspección en vivo
 */

const { createBot, STATE } = require('./bot-engine');
const path = require('path');

const BIZ = {
  name: 'Resistone Microcemento',
  razonSocial: 'Ipetel Adquisiciones S.L.',
  url: 'https://www.microcemento.org',
  email: 'info@resistone.es',
  phone: '917528727',
  address: 'C/ Carabaña, 32-3',
  city: 'Alcorcón',
  province: 'Madrid',
  zip: '28925',
  cif: 'B85123040',
  nif: '12345678Z',
  category: 'Reformas',
  companySize: 'De 1 a 10 empleados',
  password: 'Resistone2024!',
};

(async () => {
  console.log('=== INSCRIPCIÓN FINAL RESISTONE ===\n');
  
  const bot = await createBot({
    headless: false,
    screenshotsDir: path.join(__dirname, 'screenshots'),
    logFile: path.join(__dirname, 'final-resistone.log'),
  });
  
  const { page, log, goto, screenshot } = bot;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // HABITISSIMO
  // ═══════════════════════════════════════════════════════════════════════════
  
  try {
    log('\n[START] Habitissimo.es');
    
    await goto('https://www.habitissimo.es/registrar/empresa', 'spa');
    
    // CRÍTICO: Cerrar modal Didomi (CMP) que bloquea clicks
    log('[cookies] Cerrando modal Didomi...');
    
    // Esperar a que aparezca el modal
    await page.waitForSelector('#didomi-popup, #didomi-host', { timeout: 5000 }).catch(() => {});
    
    // Intentar aceptar cookies con Didomi
    const didomiAccepted = await page.locator('#didomi-notice-agree-button').click().catch(() => false);
    if (didomiAccepted) {
      log('[cookies] Didomi aceptado');
    } else {
      // Forzar con ESC
      await page.keyboard.press('Escape');
    }
    
    await page.waitForTimeout(2000);
    
    // Verificar que el modal desapareció
    const modalGone = await page.evaluate(() => {
      const didomi = document.querySelector('#didomi-popup');
      return !didomi || !didomi.offsetParent;
    });
    
    if (!modalGone) {
      log('[warn] Modal Didomi puede seguir visible');
    }
    
    await screenshot('hab-1-initial');
    
    // Inspeccionar campos visibles
    const fields = await page.$$eval('input:visible, select:visible, textarea:visible', els =>
      els.map(el => ({
        tag: el.tagName,
        type: el.type,
        name: el.name,
        id: el.id,
        placeholder: el.placeholder,
      }))
    );
    
    log(`[inspect] Campos visibles: ${JSON.stringify(fields, null, 2)}`);
    
    // Rellenar por IDs/names reales
    log('[step:1] Rellenando paso 1...');
    
    // Categoría (buscar input de autocomplete)
    const categoryInput = await page.locator('input[placeholder*="dedicas" i], input[name*="category" i], input[id*="category" i]').first();
    if (await categoryInput.isVisible({ timeout: 2000 })) {
      await categoryInput.fill(BIZ.category);
      await page.waitForTimeout(1000);
      // Seleccionar primera opción del autocomplete
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      log('[success] Categoría rellenada');
    }
    
    // Ubicación
    const locationInput = await page.locator('input[placeholder*="trabajas" i], input[name*="location" i], input[id*="location" i]').first();
    if (await locationInput.isVisible({ timeout: 2000 })) {
      await locationInput.fill(`${BIZ.city}, ${BIZ.province}`);
      await page.waitForTimeout(1000);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      log('[success] Ubicación rellenada');
    }
    
    await screenshot('hab-2-step1');
    
    // Click continuar
    await page.getByRole('button', { name: /continuar|siguiente|conseguir/i }).first().click();
    await page.waitForTimeout(3000);
    
    log('[step:2] Rellenando paso 2...');
    
    // Esperar campos del paso 2
    await page.waitForSelector('input[type="email"], input[name*="email"]', { timeout: 10000 });
    
    // Rellenar paso 2
    await page.locator('input[name*="company" i], input[id*="company" i]').first().fill(BIZ.name);
    await page.locator('input[name*="name" i]:not([name*="company"])').first().fill('Resistone');
    await page.locator('input[type="email"]').first().fill(BIZ.email);
    await page.locator('input[type="tel"], input[name*="phone"]').first().fill(BIZ.phone);
    await page.locator('input[type="password"]').first().fill(BIZ.password);
    
    // Tamaño de empresa (select)
    const sizeSelect = await page.locator('select[name*="size" i], select[id*="size" i]').first();
    if (await sizeSelect.isVisible({ timeout: 2000 })) {
      await sizeSelect.selectOption({ label: BIZ.companySize });
      log('[success] Tamaño de empresa seleccionado');
    }
    
    // Checkbox términos
    await page.locator('input[type="checkbox"]').first().check();
    
    await screenshot('hab-3-filled', true, 'Habitissimo formulario completo');
    
    // Submit
    await page.getByRole('button', { name: /registr|crear cuenta/i }).first().click();
    await page.waitForTimeout(5000);
    
    const result = await screenshot('hab-4-result', true, 'Habitissimo resultado');
    
    if (result.analysis) {
      log(`[RESULT] Habitissimo: ${result.analysis.state}`);
      if (result.analysis.errors.length) {
        log(`[ERRORS] ${result.analysis.errors.join(' | ')}`);
      }
    }
    
  } catch (err) {
    log(`[ERROR] Habitissimo: ${err.message}`);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CERTICALIA
  // ═══════════════════════════════════════════════════════════════════════════
  
  try {
    log('\n[START] Certicalia.com');
    
    await goto('https://www.certicalia.com/usuarios/registro-profesional', 'fast');
    await page.waitForTimeout(3000);
    
    await screenshot('cert-1-initial');
    
    // Inspeccionar campos
    const fields = await page.$$eval('input:visible, select:visible', els =>
      els.map(el => ({
        tag: el.tagName,
        type: el.type,
        name: el.name,
        id: el.id,
      }))
    );
    
    log(`[inspect] Campos visibles: ${JSON.stringify(fields, null, 2)}`);
    
    // Rellenar por IDs directos
    await page.locator('#nombre-input').fill('Resistone');
    await page.locator('#apellidos-input').fill('Microcemento');
    await page.locator('#one_step_email').fill(BIZ.email);
    await page.locator('#telefono-input').fill(BIZ.phone);
    await page.locator('#password-input').fill(BIZ.password);
    await page.locator('#documentacion-input').fill(BIZ.nif);
    await page.locator('#codigo-postal-input').fill(BIZ.zip);
    
    // CRÍTICO: Esperar a que razon-social se habilite (está disabled hasta rellenar CP)
    log('[waiting] Esperando a que razon-social se habilite...');
    await page.waitForTimeout(3000);
    
    // Verificar que se habilitó
    const razonEnabled = await page.locator('#razon-social-input').isEnabled({ timeout: 5000 }).catch(() => false);
    if (!razonEnabled) {
      log('[warn] razon-social sigue disabled');
    }
    
    await page.waitForTimeout(1500);
    
    // Razon social (se habilita tras CP)
    const razonSocial = await page.locator('#razon-social-input').first();
    if (await razonSocial.isVisible({ timeout: 2000 })) {
      await razonSocial.fill(BIZ.name);
      log('[success] Razón social rellenada');
    }
    
    // Tamaño de empresa (buscar select)
    const sizeSelect = await page.locator('#select-company-size').first();
    if (await sizeSelect.isVisible({ timeout: 2000 })) {
      const options = await sizeSelect.$$eval('option', opts => opts.map(o => ({ value: o.value, text: o.textContent })));
      log(`[inspect] Opciones de tamaño: ${JSON.stringify(options)}`);
      
      // Seleccionar primera opción válida (index 1, porque 0 suele ser placeholder)
      await sizeSelect.selectOption({ index: 1 });
      log('[success] Tamaño de empresa seleccionado');
    } else {
      log('[warn] Select de tamaño no encontrado');
    }
    
    await screenshot('cert-2-filled', true, 'Certicalia formulario completo');
    
    // Submit
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(5000);
    
    const result = await screenshot('cert-3-result', true, 'Certicalia resultado');
    
    if (result.analysis) {
      log(`[RESULT] Certicalia: ${result.analysis.state}`);
      if (result.analysis.errors.length) {
        log(`[ERRORS] ${result.analysis.errors.join(' | ')}`);
      }
    }
    
  } catch (err) {
    log(`[ERROR] Certicalia: ${err.message}`);
  }
  
  await bot.browser.close();
  
  console.log('\n✅ Proceso completado. Revisar capturas y log.');
})();
