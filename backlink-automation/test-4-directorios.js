#!/usr/bin/env node
/**
 * test-4-directorios.js — Test con 4 directorios nuevos (2 ReliableAI + 2 Resistone)
 */

const { createBot, STATE } = require('./bot-engine');
const { RESISTONE, RELIABLEAI } = require('./business-data');
const { verificarEmail } = require('./email-verifier');
const path = require('path');
const fs = require('fs');

const results = [];

function logResult(directorio, estado, detalles = {}) {
  const result = {
    url: directorio.url,
    nombre: directorio.name,
    timestamp: new Date().toISOString(),
    estado,
    ...detalles,
  };
  results.push(result);
  console.log(`\n${estado === 'completado' ? '✅' : estado.includes('pendiente') ? '⏳' : '❌'} ${directorio.name}: ${estado}`);
  if (detalles.notas) console.log(`   └─ ${detalles.notas}`);
  return result;
}

const DIRECTORIOS = [
  
  // --- AI VALLEY (ReliableAI) ---
  {
    id: 'aivalley',
    name: 'AI Valley',
    url: 'https://aivalley.ai/submit',
    emailDomain: 'aivalley.ai',
    negocio: RELIABLEAI,
    async submit(bot, biz) {
      const { page, log, goto, screenshot, fillField, clickBtn } = bot;
      
      log(`\n[START] ${this.name}`);
      
      try {
        await goto(this.url, 'spa');
        await page.waitForTimeout(3000);
        
        await screenshot(`${this.id}-1-initial`);
        
        log('[filling] Rellenando formulario...');
        
        await fillField(['Tool Name', 'Name', 'name', 'input[name="name"]'], biz.name);
        await fillField(['Website', 'URL', 'url', 'input[name="url"]'], biz.url);
        await fillField(['Email', 'email', 'input[type="email"]'], biz.email);
        await fillField(['Description', 'About', 'description', 'textarea'], biz.description_short);
        await fillField(['Category', 'category', 'select[name="category"]'], biz.category);
        
        await screenshot(`${this.id}-2-filled`, true, `${this.name} formulario`);
        
        const submitted = await clickBtn(['Submit', 'Send', 'Add Tool', 'button[type="submit"]']);
        
        if (submitted) {
          await page.waitForTimeout(5000);
          const result = await screenshot(`${this.id}-3-result`, true, `${this.name} resultado`);
          
          if (this.emailDomain) {
            log('[email] Iniciando verificación automática...');
            const emailVerified = await verificarEmail(bot, biz.email_verificacion || biz.email, this.emailDomain, 10, 10);
            
            if (emailVerified) {
              return logResult(this, 'completado', {
                cuenta_creada: true,
                backlink_activo: true,
                email_verificado: true,
              });
            }
          }
          
          if (result.analysis?.state === 'success') {
            return logResult(this, 'completado', { cuenta_creada: true });
          }
          
          return logResult(this, 'pendiente_aprobacion', { cuenta_creada: true });
        }
        
        return logResult(this, 'error', { notas: 'No se pudo enviar' });
        
      } catch (err) {
        log(`[ERROR] ${err.message}`);
        return logResult(this, 'error', { notas: err.message });
      }
    }
  },
  
  // --- FUTURE TOOLS (ReliableAI) ---
  {
    id: 'futuretools',
    name: 'Future Tools',
    url: 'https://www.futuretools.io/submit-a-tool',
    emailDomain: 'futuretools.io',
    negocio: RELIABLEAI,
    async submit(bot, biz) {
      const { page, log, goto, screenshot, fillField, clickBtn } = bot;
      
      log(`\n[START] ${this.name}`);
      
      try {
        await goto(this.url, 'fast');
        await page.waitForTimeout(3000);
        
        await screenshot(`${this.id}-1-initial`);
        
        log('[filling] Rellenando formulario...');
        
        await fillField(['Tool Name', 'name'], biz.name);
        await fillField(['Website', 'URL', 'url'], biz.url);
        await fillField(['Email', 'email'], biz.email);
        await fillField(['Short Description', 'tagline', 'description'], biz.tagline);
        await fillField(['Long Description', 'about'], biz.description_long);
        await fillField(['Category', 'category'], biz.category);
        await fillField(['Pricing', 'pricing'], biz.pricing);
        
        await screenshot(`${this.id}-2-filled`, true, `${this.name} formulario`);
        
        const submitted = await clickBtn(['Submit', 'Send', 'button[type="submit"]']);
        
        if (submitted) {
          await page.waitForTimeout(5000);
          const result = await screenshot(`${this.id}-3-result`, true, `${this.name} resultado`);
          
          if (this.emailDomain) {
            log('[email] Iniciando verificación automática...');
            const emailVerified = await verificarEmail(bot, biz.email_verificacion || biz.email, this.emailDomain, 10, 10);
            
            if (emailVerified) {
              return logResult(this, 'completado', {
                cuenta_creada: true,
                backlink_activo: true,
                email_verificado: true,
              });
            }
          }
          
          if (result.analysis?.state === 'success') {
            return logResult(this, 'completado', { cuenta_creada: true });
          }
          
          return logResult(this, 'pendiente_aprobacion', { cuenta_creada: true });
        }
        
        return logResult(this, 'error', { notas: 'No se pudo enviar' });
        
      } catch (err) {
        log(`[ERROR] ${err.message}`);
        return logResult(this, 'error', { notas: err.message });
      }
    }
  },
  
  // --- HABITISSIMO (Resistone) ---
  {
    id: 'habitissimo',
    name: 'Habitissimo',
    url: 'https://www.habitissimo.es/registrar/empresa',
    emailDomain: 'habitissimo.es',
    negocio: RESISTONE,
    async submit(bot, biz) {
      const { page, log, goto, screenshot, fillField, selectOption, clickBtn } = bot;
      
      log(`\n[START] ${this.name}`);
      
      try {
        await goto(this.url, 'fast');
        await page.waitForTimeout(3000);
        
        await screenshot(`${this.id}-1-initial`);
        
        log('[filling] Paso 1: Categoría y ubicación...');
        
        await fillField(['¿A qué te dedicas?', 'categoria', 'input[placeholder*="dedicas"]'], 'Reformas');
        await page.waitForTimeout(1000);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        
        await fillField(['¿Dónde trabajas?', 'ubicacion', 'input[placeholder*="trabajas"]'], biz.city);
        await page.waitForTimeout(1000);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        
        await clickBtn(['Conseguir trabajos', 'Continuar', 'Siguiente']);
        await page.waitForTimeout(3000);
        
        await screenshot(`${this.id}-2-step1`);
        
        log('[filling] Paso 2: Datos de empresa...');
        
        await page.waitForSelector('#company-name, input[name="company"]', { timeout: 10000 });
        
        await fillField(['Nombre de empresa', '#company-name', 'input[name="company"]'], biz.razonSocial);
        await fillField(['Nombre', '#name', 'input[name="name"]'], biz.admin_nombre);
        await fillField(['Email', 'input[name="email"]', 'input[type="email"]'], biz.email);
        await fillField(['Teléfono', '#phone', 'input[name="phone"]'], biz.phone);
        await fillField(['Contraseña', '#password', 'input[type="password"]'], biz.password);
        
        await selectOption(['select[name="size"]', '#company-size'], biz.companySize);
        
        await page.locator('#third-party, input[name="terms"]').check();
        
        await screenshot(`${this.id}-3-filled`, true, `${this.name} formulario completo`);
        
        await clickBtn(['Regístrate ahora', 'Registrar', 'button[type="submit"]']);
        await page.waitForTimeout(5000);
        
        const result = await screenshot(`${this.id}-4-result`, true, `${this.name} resultado`);
        
        if (this.emailDomain) {
          log('[email] Iniciando verificación automática...');
          const emailVerified = await verificarEmail(bot, biz.email_verificacion || biz.email, this.emailDomain, 10, 10);
          
          if (emailVerified) {
            return logResult(this, 'completado', {
              cuenta_creada: true,
              backlink_activo: true,
              email_verificado: true,
            });
          }
        }
        
        if (result.analysis?.state === 'success') {
          return logResult(this, 'completado', { cuenta_creada: true });
        }
        
        return logResult(this, 'pendiente_verificacion', { cuenta_creada: true });
        
      } catch (err) {
        log(`[ERROR] ${err.message}`);
        return logResult(this, 'error', { notas: err.message });
      }
    }
  },
  
  // --- PÁGINAS AMARILLAS (Resistone) ---
  {
    id: 'paginasamarillas',
    name: 'Páginas Amarillas',
    url: 'https://www.paginasamarillas.es/profesionales/alta',
    emailDomain: 'paginasamarillas.es',
    negocio: RESISTONE,
    async submit(bot, biz) {
      const { page, log, goto, screenshot, fillField, clickBtn } = bot;
      
      log(`\n[START] ${this.name}`);
      
      try {
        await goto(this.url, 'fast');
        await page.waitForTimeout(3000);
        
        await screenshot(`${this.id}-1-initial`);
        
        log('[filling] Rellenando formulario...');
        
        await fillField(['Nombre de empresa', 'razon social', 'input[name="company"]'], biz.razonSocial);
        await fillField(['CIF', 'NIF', 'input[name="cif"]'], biz.cif);
        await fillField(['Dirección', 'input[name="address"]'], biz.address);
        await fillField(['Ciudad', 'input[name="city"]'], biz.city);
        await fillField(['Código Postal', 'input[name="zip"]'], biz.zip);
        await fillField(['Teléfono', 'input[name="phone"]'], biz.phone);
        await fillField(['Email', 'input[type="email"]'], biz.email);
        await fillField(['Web', 'URL', 'input[name="website"]'], biz.url);
        await fillField(['Descripción', 'textarea'], biz.description_long);
        await fillField(['Categoría', 'input[name="category"]'], biz.category);
        
        await screenshot(`${this.id}-2-filled`, true, `${this.name} formulario`);
        
        const submitted = await clickBtn(['Enviar', 'Registrar', 'Alta', 'button[type="submit"]']);
        
        if (submitted) {
          await page.waitForTimeout(5000);
          const result = await screenshot(`${this.id}-3-result`, true, `${this.name} resultado`);
          
          if (this.emailDomain) {
            log('[email] Iniciando verificación automática...');
            const emailVerified = await verificarEmail(bot, biz.email_verificacion || biz.email, this.emailDomain, 10, 10);
            
            if (emailVerified) {
              return logResult(this, 'completado', {
                cuenta_creada: true,
                backlink_activo: true,
                email_verificado: true,
              });
            }
          }
          
          if (result.analysis?.state === 'success') {
            return logResult(this, 'completado', { cuenta_creada: true });
          }
          
          return logResult(this, 'pendiente_aprobacion', { cuenta_creada: true });
        }
        
        return logResult(this, 'error', { notas: 'No se pudo enviar' });
        
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
  console.log('  TEST 4 DIRECTORIOS — 2 ReliableAI + 2 Resistone');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const bot = await createBot({
    headless: false,
    screenshotsDir: path.join(__dirname, 'screenshots'),
    logFile: path.join(__dirname, 'test-4-directorios.log'),
  });
  
  for (const dir of DIRECTORIOS) {
    console.log(`\n[${DIRECTORIOS.indexOf(dir) + 1}/${DIRECTORIOS.length}] Procesando: ${dir.name}`);
    
    try {
      await dir.submit(bot, dir.negocio);
    } catch (err) {
      bot.log(`[ERROR] ${dir.name}: ${err.message}`);
      logResult(dir, 'error', { notas: err.message });
    }
    
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
  const requieren = results.filter(r => r.estado.includes('requiere')).length;
  
  console.log(`Total procesados: ${results.length}`);
  console.log(`✅ Completados: ${completados}`);
  console.log(`⏳ Pendientes: ${pendientes}`);
  console.log(`⚠️  Requieren acción: ${requieren}`);
  console.log(`❌ Errores: ${errores}\n`);
  
  console.log('Resultados detallados:');
  results.forEach(r => {
    const icon = r.estado === 'completado' ? '✅' : r.estado.includes('pendiente') ? '⏳' : '❌';
    console.log(`  ${icon} ${r.nombre}: ${r.estado}`);
    if (r.notas) console.log(`     └─ ${r.notas}`);
  });
  
  const yaml = results.map(r => `
- url: "${r.url}"
  nombre: "${r.nombre}"
  timestamp: "${r.timestamp}"
  estado: "${r.estado}"
  cuenta_creada: ${r.cuenta_creada || false}
  backlink_activo: ${r.backlink_activo || false}
  email_verificado: ${r.email_verificado || false}
  notas: "${r.notas || ''}"
`).join('');
  
  fs.writeFileSync(path.join(__dirname, 'test-4-directorios-results.yaml'), yaml);
  
  console.log('\n✅ Resultados guardados en test-4-directorios-results.yaml');
  console.log('✅ Capturas en screenshots/');
  console.log('✅ Log en test-4-directorios.log\n');
})();
