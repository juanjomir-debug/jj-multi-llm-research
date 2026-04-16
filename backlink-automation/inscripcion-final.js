#!/usr/bin/env node
/**
 * inscripcion-final.js — Inscripción completa con método v2.0
 * Integra todas las mejoras: inspección en vivo, visión, manejo de obstáculos
 */

const { createBot, STATE } = require('./bot-engine');
const { RESISTONE, RELIABLEAI } = require('./business-data');
const path = require('path');
const fs = require('fs');

// Resultados
const results = [];

// Helper para registrar resultado
function logResult(directorio, estado, detalles = {}) {
  const result = {
    url: directorio.url,
    nombre: directorio.name,
    timestamp: new Date().toISOString(),
    estado,
    ...detalles,
  };
  results.push(result);
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIRECTORIOS A PROCESAR
// ═══════════════════════════════════════════════════════════════════════════

const DIRECTORIOS = [
  // --- RELIABLEAI (directorios gratuitos) ---
  {
    id: 'producthunt',
    name: 'Product Hunt',
    url: 'https://www.producthunt.com',
    negocio: RELIABLEAI,
    tipo: 'directorio_productos',
    async submit(bot, biz) {
      const { page, log, goto, screenshot, clickBtn } = bot;
      
      log(`\n[START] ${this.name}`);
      
      try {
        await goto(this.url, 'fast');
        await screenshot(`${this.id}-1-home`);
        
        // Buscar botón "Submit" o "Post"
        const submitBtn = await page.locator('a:has-text("Submit"), button:has-text("Submit"), a:has-text("Post")').first();
        if (await submitBtn.isVisible({ timeout: 5000 })) {
          await submitBtn.click();
          await page.waitForTimeout(3000);
          
          await screenshot(`${this.id}-2-form`, true, `${this.name} formulario`);
          
          return logResult(this, 'requiere_cuenta', {
            notas: 'Requiere cuenta de Product Hunt para lanzar producto',
          });
        }
        
        return logResult(this, 'error', { notas: 'No se encontró botón de submit' });
        
      } catch (err) {
        log(`[ERROR] ${err.message}`);
        return logResult(this, 'error', { notas: err.message });
      }
    }
  },
  
  // --- RESISTONE (directorios gratuitos) ---
  {
    id: 'certicalia',
    name: 'Certicalia.com',
    url: 'https://www.certicalia.com/usuarios/registro-profesional',
    negocio: RESISTONE,
    tipo: 'directorio_servicios',
    async submit(bot, biz) {
      const { page, log, goto, screenshot, selectOption } = bot;
      
      log(`\n[START] ${this.name}`);
      
      try {
        await goto(this.url, 'fast');
        await page.waitForTimeout(3000);
        
        await screenshot(`${this.id}-1-initial`);
        
        // Rellenar por IDs directos
        log('[filling] Rellenando formulario...');
        
        await page.locator('#nombre-input').fill('Resistone');
        await page.locator('#apellidos-input').fill('Microcemento');
        await page.locator('#one_step_email').fill(biz.email);
        await page.locator('#telefono-input').fill(biz.phone);
        await page.locator('#password-input').fill(biz.password);
        await page.locator('#documentacion-input').fill(biz.nif);
        await page.locator('#codigo-postal-input').fill(biz.zip);
        
        // Esperar a que razon-social se habilite
        log('[waiting] Esperando razon-social...');
        await page.waitForFunction(() => {
          const input = document.querySelector('#razon-social-input');
          return input && !input.disabled;
        }, { timeout: 10000 }).catch(() => {});
        
        await page.waitForTimeout(2000);
        
        const razonEnabled = await page.locator('#razon-social-input').isEnabled().catch(() => false);
        if (razonEnabled) {
          await page.locator('#razon-social-input').fill(biz.razonSocial);
          log('[success] Razón social rellenada');
        } else {
          log('[warn] razon-social sigue disabled');
        }
        
        // Tamaño de empresa
        const sizeSelect = await page.locator('#select-company-size').first();
        if (await sizeSelect.isVisible({ timeout: 2000 })) {
          await sizeSelect.selectOption({ index: 1 });
          log('[success] Tamaño seleccionado');
        }
        
        // CRÍTICO: Checkbox de términos (detectado por visión)
        log('[checkbox] Aceptando términos...');
        const termsCheckbox = await page.locator('#aceptar-condiciones, input[type="checkbox"][name*="condiciones"]').first();
        if (await termsCheckbox.isVisible({ timeout: 2000 })) {
          await termsCheckbox.check();
          log('[success] Términos aceptados');
        } else {
          log('[warn] Checkbox de términos no encontrado');
        }
        
        await screenshot(`${this.id}-2-filled`, true, `${this.name} formulario`);
        
        // Submit
        await page.locator('button[type="submit"]').first().click();
        await page.waitForTimeout(5000);
        
        const result = await screenshot(`${this.id}-3-result`, true, `${this.name} resultado`);
        
        if (result.analysis) {
          if (result.analysis.state === 'success') {
            return logResult(this, 'pendiente_verificacion', { cuenta_creada: true });
          } else if (result.analysis.errors.length) {
            return logResult(this, 'error', { notas: result.analysis.errors.join(' | ') });
          }
        }
        
        return logResult(this, 'pendiente_verificacion', { cuenta_creada: true });
        
      } catch (err) {
        log(`[ERROR] ${err.message}`);
        return logResult(this, 'error', { notas: err.message });
      }
    }
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

(async () => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  INSCRIPCIÓN AUTOMÁTICA EN DIRECTORIOS — Método v2.0');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const bot = await createBot({
    headless: false,
    screenshotsDir: path.join(__dirname, 'screenshots'),
    logFile: path.join(__dirname, 'inscripcion-final.log'),
  });
  
  for (const dir of DIRECTORIOS) {
    console.log(`\n[${DIRECTORIOS.indexOf(dir) + 1}/${DIRECTORIOS.length}] Procesando: ${dir.name}`);
    
    try {
      await dir.submit(bot, dir.negocio);
    } catch (err) {
      bot.log(`[ERROR] ${dir.name}: ${err.message}`);
      logResult(dir, 'error', { notas: err.message });
    }
    
    // Pausa entre directorios
    await bot.page.waitForTimeout(3000);
  }
  
  await bot.browser.close();
  
  // ═══════════════════════════════════════════════════════════════════════════
  // INFORME FINAL
  // ═══════════════════════════════════════════════════════════════════════════
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  INFORME FINAL');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const completados = results.filter(r => r.estado === 'completado').length;
  const pendientes = results.filter(r => r.estado.includes('pendiente')).length;
  const errores = results.filter(r => r.estado === 'error').length;
  
  console.log(`Total procesados: ${results.length}`);
  console.log(`✅ Completados: ${completados}`);
  console.log(`⏳ Pendientes: ${pendientes}`);
  console.log(`❌ Errores: ${errores}\n`);
  
  console.log('Detalle por directorio:\n');
  for (const r of results) {
    const icon = r.estado === 'completado' ? '✅' : r.estado.includes('pendiente') ? '⏳' : '❌';
    console.log(`${icon} ${r.nombre}: ${r.estado}`);
    if (r.notas) console.log(`   └─ ${r.notas}`);
  }
  
  // Guardar resultados en YAML
  const yaml = results.map(r => `
- url: "${r.url}"
  nombre: "${r.nombre}"
  timestamp: "${r.timestamp}"
  estado: "${r.estado}"
  cuenta_creada: ${r.cuenta_creada || false}
  backlink_activo: ${r.backlink_activo || false}
  notas: "${r.notas || ''}"
`).join('');
  
  fs.writeFileSync(path.join(__dirname, 'resultados.yaml'), yaml);
  
  console.log('\n✅ Resultados guardados en resultados.yaml');
  console.log('✅ Capturas guardadas en screenshots/');
  console.log('✅ Log completo en inscripcion-final.log\n');
})();
