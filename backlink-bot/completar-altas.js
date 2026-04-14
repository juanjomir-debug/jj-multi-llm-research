#!/usr/bin/env node
/**
 * completar-altas.js — Script final con todas las correcciones aplicadas
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

// ═══════════════════════════════════════════════════════════════════════════
// DIRECTORIOS CORREGIDOS
// ═══════════════════════════════════════════════════════════════════════════

const DIRECTORIOS = [
  
  // --- CERTICALIA (Resistone) — Con verificación automática de email ---
  {
    id: 'certicalia',
    name: 'Certicalia.com',
    url: 'https://www.certicalia.com/usuarios/registro-profesional',
    emailDomain: 'certicalia.com', // Para verificación de email
    negocio: RESISTONE,
    async submit(bot, biz) {
      const { page, log, goto, screenshot } = bot;
      
      log(`\n[START] ${this.name}`);
      
      try {
        await goto(this.url, 'fast');
        await page.waitForTimeout(3000);
        
        log(`[dni] Usando DNI del administrador: ${biz.nif}`);
        
        await screenshot(`${this.id}-1-initial`);
        
        log('[filling] Rellenando formulario...');
        
        await page.locator('#nombre-input').fill(biz.admin_nombre || 'Juan Jose');
        await page.locator('#apellidos-input').fill(biz.admin_apellidos || 'Mir Bermejo');
        await page.locator('#one_step_email').fill(biz.email);
        await page.locator('#telefono-input').fill(biz.phone);
        await page.locator('#password-input').fill(biz.password);
        await page.locator('#documentacion-input').fill(biz.nif); // DNI real del administrador
        await page.locator('#codigo-postal-input').fill(biz.zip);
        
        // Esperar a que razon-social se habilite
        log('[waiting] Esperando razon-social...');
        
        await page.waitForFunction(() => {
          const input = document.querySelector('#razon-social-input');
          return input && !input.disabled;
        }, { timeout: 15000 }).catch(() => {});
        
        await page.waitForTimeout(2000);
        
        // Intentar rellenar razon-social
        try {
          await page.locator('#razon-social-input').fill(biz.razonSocial, { timeout: 5000 });
          log('[success] Razón social rellenada');
        } catch (err) {
          log('[warn] No se pudo rellenar razon-social');
        }
        
        // Tamaño de empresa
        const sizeSelect = await page.locator('#select-company-size').first();
        if (await sizeSelect.isVisible({ timeout: 2000 })) {
          await sizeSelect.selectOption({ index: 1 });
          log('[success] Tamaño seleccionado');
        }
        
        // Checkbox de términos
        const termsCheckbox = await page.locator('#aceptar-condiciones').first();
        if (await termsCheckbox.isVisible({ timeout: 2000 })) {
          await termsCheckbox.check();
          log('[success] Términos aceptados');
        }
        
        await screenshot(`${this.id}-2-filled`, true, `${this.name} formulario completo`);
        
        // Submit
        await page.locator('button[type="submit"]').first().click();
        await page.waitForTimeout(5000);
        
        const result = await screenshot(`${this.id}-3-result`, true, `${this.name} resultado`);
        
        // Verificar email automáticamente
        log('[email] Iniciando verificación automática...');
        
        const emailVerified = await verificarEmail(
          bot,
          biz.email_verificacion || biz.email, // Usar email_verificacion si existe
          this.emailDomain,
          10, // 10 intentos
          10  // 10s entre intentos
        );
        
        if (emailVerified) {
          log('[email] ✅ Email verificado automáticamente');
          await screenshot(`${this.id}-4-verified`);
          
          return logResult(this, 'completado', {
            cuenta_creada: true,
            backlink_activo: true,
            email_verificado: true,
            notas: 'Registro completado y email verificado automáticamente',
          });
        }
        
        // Si no se verificó automáticamente
        if (result.analysis) {
          if (result.analysis.state === 'success' || result.analysis.successMessage) {
            return logResult(this, 'pendiente_verificacion', {
              cuenta_creada: true,
              backlink_activo: false,
              email_verificado: false,
              notas: result.analysis.successMessage || 'Registro completado, verificar email manualmente',
            });
          } else if (result.analysis.errors.length) {
            return logResult(this, 'error', { notas: result.analysis.errors.join(' | ') });
          }
        }
        
        return logResult(this, 'pendiente_verificacion', {
          cuenta_creada: true,
          email_verificado: false,
          notas: 'Formulario enviado, verificar email manualmente',
        });
        
      } catch (err) {
        log(`[ERROR] ${err.message}`);
        return logResult(this, 'error', { notas: err.message });
      }
    }
  },
  
  // --- TOOLIFY (ReliableAI) — Scroll manual corregido ---
  {
    id: 'toolify',
    name: 'Toolify.ai',
    url: 'https://www.toolify.ai/submit',
    negocio: RELIABLEAI,
    async submit(bot, biz) {
      const { page, log, goto, screenshot } = bot;
      
      log(`\n[START] ${this.name}`);
      
      try {
        await goto(this.url, 'spa');
        await page.waitForTimeout(3000);
        
        // Scroll manual al formulario
        log('[scroll] Buscando formulario...');
        await page.evaluate(() => {
          const form = document.querySelector('form');
          const input = document.querySelector('input[type="text"]');
          const target = form || input;
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
        
        await page.waitForTimeout(2000);
        await screenshot(`${this.id}-1-initial`);
        
        // Buscar inputs visibles
        const inputs = await page.$$('input[type="text"]:visible');
        log(`[inspect] ${inputs.length} campos encontrados`);
        
        if (inputs.length >= 2) {
          await inputs[0].fill(biz.name);
          await inputs[1].fill(biz.url);
          log('[success] Name y URL rellenados');
          
          await screenshot(`${this.id}-2-filled`, true, `${this.name} formulario`);
          
          // Verificar si requiere pago
          const payButton = await page.locator('button:has-text("Pay"), button:has-text("$")').first().isVisible({ timeout: 2000 }).catch(() => false);
          
          if (payButton) {
            return logResult(this, 'requiere_pago', {
              notas: 'Directorio requiere pago ($99)',
            });
          }
          
          // Buscar botón submit
          const submitBtn = await page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Send")').first();
          if (await submitBtn.isVisible({ timeout: 2000 })) {
            await submitBtn.click();
            await page.waitForTimeout(5000);
            
            const result = await screenshot(`${this.id}-3-result`, true, `${this.name} resultado`);
            
            if (result.analysis?.state === 'success' || result.analysis?.successMessage) {
              return logResult(this, 'completado', {
                cuenta_creada: true,
                backlink_activo: true,
                notas: result.analysis.successMessage || 'Formulario enviado',
              });
            }
            
            return logResult(this, 'pendiente_aprobacion', {
              cuenta_creada: true,
              notas: 'Formulario enviado, pendiente revisión',
            });
          }
          
          return logResult(this, 'error', { notas: 'No se encontró botón submit' });
        }
        
        return logResult(this, 'error', { notas: 'No se encontraron campos suficientes' });
        
      } catch (err) {
        log(`[ERROR] ${err.message}`);
        return logResult(this, 'error', { notas: err.message });
      }
    }
  },
  
  // --- AI VALLEY (ReliableAI) — Directorio gratuito ---
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
        
        // Buscar campos comunes
        await fillField(['Tool Name', 'Name', 'name', 'input[name="name"]'], biz.name);
        await fillField(['Website', 'URL', 'url', 'input[name="url"]'], biz.url);
        await fillField(['Email', 'email', 'input[type="email"]'], biz.email);
        await fillField(['Description', 'About', 'description', 'textarea'], biz.description_short);
        await fillField(['Category', 'category', 'select[name="category"]'], biz.category);
        
        await screenshot(`${this.id}-2-filled`, true, `${this.name} formulario`);
        
        // Submit
        const submitted = await clickBtn(['Submit', 'Send', 'Add Tool', 'button[type="submit"]']);
        
        if (submitted) {
          await page.waitForTimeout(5000);
          const result = await screenshot(`${this.id}-3-result`, true, `${this.name} resultado`);
          
          // Verificar email si configurado
          if (this.emailDomain) {
            log('[email] Iniciando verificación automática...');
            const { verificarEmail } = require('./email-verifier');
            const emailVerified = await verificarEmail(bot, biz.email_verificacion || biz.email, this.emailDomain, 10, 10);
            
            if (emailVerified) {
              return logResult(this, 'completado', {
                cuenta_creada: true,
                backlink_activo: true,
                email_verificado: true,
                notas: 'Registro completado y email verificado',
              });
            }
          }
          
          if (result.analysis?.state === 'success') {
            return logResult(this, 'completado', { cuenta_creada: true, backlink_activo: true });
          }
          
          return logResult(this, 'pendiente_aprobacion', { cuenta_creada: true });
        }
        
        return logResult(this, 'error', { notas: 'No se pudo enviar formulario' });
        
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
          
          // Verificar email
          if (this.emailDomain) {
            log('[email] Iniciando verificación automática...');
            const { verificarEmail } = require('./email-verifier');
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
  
  // --- HABITISSIMO (Resistone) — Categoría corregida ---
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
        
        // Paso 1: Categoría (usar "Reformas" genérica)
        await fillField(['¿A qué te dedicas?', 'categoria', 'input[placeholder*="dedicas"]'], 'Reformas');
        await page.waitForTimeout(1000);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        
        // Ubicación
        await fillField(['¿Dónde trabajas?', 'ubicacion', 'input[placeholder*="trabajas"]'], biz.city);
        await page.waitForTimeout(1000);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        
        await clickBtn(['Conseguir trabajos', 'Continuar', 'Siguiente']);
        await page.waitForTimeout(3000);
        
        await screenshot(`${this.id}-2-step1`);
        
        log('[filling] Paso 2: Datos de empresa...');
        
        // Esperar a que aparezcan los campos del paso 2
        await page.waitForSelector('#company-name, input[name="company"]', { timeout: 10000 });
        
        await fillField(['Nombre de empresa', '#company-name', 'input[name="company"]'], biz.razonSocial);
        await fillField(['Nombre', '#name', 'input[name="name"]'], biz.admin_nombre);
        await fillField(['Email', 'input[name="email"]', 'input[type="email"]'], biz.email);
        await fillField(['Teléfono', '#phone', 'input[name="phone"]'], biz.phone);
        await fillField(['Contraseña', '#password', 'input[type="password"]'], biz.password);
        
        // Tamaño de empresa
        await selectOption(['select[name="size"]', '#company-size'], biz.companySize);
        
        // Términos
        await page.locator('#third-party, input[name="terms"]').check();
        
        await screenshot(`${this.id}-3-filled`, true, `${this.name} formulario completo`);
        
        // Submit
        await clickBtn(['Regístrate ahora', 'Registrar', 'button[type="submit"]']);
        await page.waitForTimeout(5000);
        
        const result = await screenshot(`${this.id}-4-result`, true, `${this.name} resultado`);
        
        // Verificar email
        if (this.emailDomain) {
          log('[email] Iniciando verificación automática...');
          const { verificarEmail } = require('./email-verifier');
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
          
          // Verificar email
          if (this.emailDomain) {
            log('[email] Iniciando verificación automática...');
            const { verificarEmail } = require('./email-verifier');
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
  
  // --- DIRECTORIOS ADICIONALES GRATUITOS ---
  
  {
    id: 'theresanaiforthat',
    name: "There's An AI For That",
    url: 'https://theresanaiforthat.com',
    negocio: RELIABLEAI,
    async submit(bot, biz) {
      const { page, log, goto, screenshot, clickBtn } = bot;
      
      log(`\n[START] ${this.name}`);
      
      try {
        await goto(this.url, 'fast');
        await screenshot(`${this.id}-1-home`);
        
        // Buscar link de submit (suele estar en footer o menú)
        const submitLink = await page.locator('a:has-text("Submit"), a:has-text("Add"), a[href*="submit"]').first();
        
        if (await submitLink.isVisible({ timeout: 5000 })) {
          await submitLink.click();
          await page.waitForTimeout(3000);
          
          await screenshot(`${this.id}-2-form`);
          
          // Rellenar campos
          const inputs = await page.$$('input:visible, textarea:visible');
          log(`[inspect] ${inputs.length} campos encontrados`);
          
          if (inputs.length > 0) {
            const values = [biz.name, biz.url, biz.email, biz.tagline, biz.description_long];
            
            for (let i = 0; i < Math.min(inputs.length, values.length); i++) {
              if (values[i]) {
                await inputs[i].fill(values[i]);
              }
            }
            
            await screenshot(`${this.id}-3-filled`, true, `${this.name} formulario`);
            
            await clickBtn(['Submit', 'Send', 'button[type="submit"]']);
            await page.waitForTimeout(5000);
            
            const result = await screenshot(`${this.id}-4-result`, true, `${this.name} resultado`);
            
            if (result.analysis?.state === 'success') {
              return logResult(this, 'completado', { cuenta_creada: true });
            }
            
            return logResult(this, 'pendiente_aprobacion', { cuenta_creada: true });
          }
          
          return logResult(this, 'error', { notas: 'No se encontraron campos' });
        }
        
        return logResult(this, 'error', { notas: 'No se encontró link de submit' });
        
      } catch (err) {
        log(`[ERROR] ${err.message}`);
        return logResult(this, 'error', { notas: err.message });
      }
    }
  },
  
  {
    id: 'crunchbase',
    name: 'Crunchbase',
    url: 'https://www.crunchbase.com',
    negocio: RELIABLEAI,
    async submit(bot, biz) {
      const { page, log, goto, screenshot } = bot;
      
      log(`\n[START] ${this.name}`);
      
      try {
        await goto(this.url, 'fast');
        await screenshot(`${this.id}-1-home`);
        
        // Buscar "Add Company" o similar
        const addLink = await page.locator('a:has-text("Add"), a:has-text("Claim"), button:has-text("Add")').first();
        
        if (await addLink.isVisible({ timeout: 5000 })) {
          await addLink.click();
          await page.waitForTimeout(3000);
          
          await screenshot(`${this.id}-2-form`, true, `${this.name} formulario`);
          
          return logResult(this, 'requiere_cuenta', {
            notas: 'Crunchbase requiere cuenta para añadir empresa',
          });
        }
        
        return logResult(this, 'error', { notas: 'No se encontró opción para añadir empresa' });
        
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
  console.log('  COMPLETAR ALTAS — Método v2.0 con correcciones');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const bot = await createBot({
    headless: false,
    screenshotsDir: path.join(__dirname, 'screenshots'),
    logFile: path.join(__dirname, 'completar-altas.log'),
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
  
  console.log('Backlinks activos:');
  const activos = results.filter(r => r.backlink_activo);
  if (activos.length > 0) {
    activos.forEach(r => console.log(`  ✅ ${r.nombre}: ${r.backlink_url || 'pendiente URL'}`));
  } else {
    console.log('  (ninguno aún — pendientes de verificación/aprobación)');
  }
  
  // Guardar resultados
  const yaml = results.map(r => `
- url: "${r.url}"
  nombre: "${r.nombre}"
  timestamp: "${r.timestamp}"
  estado: "${r.estado}"
  cuenta_creada: ${r.cuenta_creada || false}
  backlink_activo: ${r.backlink_activo || false}
  notas: "${r.notas || ''}"
`).join('');
  
  fs.writeFileSync(path.join(__dirname, 'resultados-finales.yaml'), yaml);
  
  console.log('\n✅ Resultados guardados en resultados-finales.yaml');
  console.log('✅ Capturas en screenshots/');
  console.log('✅ Log en completar-altas.log\n');
})();
