#!/usr/bin/env node
/**
 * ejemplo-con-verificacion.js — Ejemplo de cómo integrar verificación de email
 */

const { createBot, STATE } = require('./bot-engine');
const { verificarEmail } = require('./email-verifier');
const { RESISTONE } = require('./business-data');
const path = require('path');

(async () => {
  const bot = await createBot({
    headless: false,
    screenshotsDir: path.join(__dirname, 'screenshots'),
    logFile: path.join(__dirname, 'ejemplo-verificacion.log'),
  });

  const { page, log, goto, fillField, clickBtn, screenshot } = bot;

  // ═══════════════════════════════════════════════════════════════════════════
  // EJEMPLO: Certicalia con verificación automática
  // ═══════════════════════════════════════════════════════════════════════════

  const directorio = {
    name: 'Certicalia',
    url: 'https://www.certicalia.com/usuarios/registro-profesional',
    emailDomain: 'certicalia.com', // Dominio del remitente de emails
  };

  try {
    log(`\n[START] ${directorio.name}`);
    
    // 1. Navegar y rellenar formulario
    await goto(directorio.url, 'fast');
    await screenshot(`${directorio.name}-1-initial`);
    
    log('[filling] Rellenando formulario...');
    
    await fillField(['nombre', '#nombre-input'], RESISTONE.admin_nombre);
    await fillField(['apellidos', '#apellidos-input'], RESISTONE.admin_apellidos);
    await fillField(['email', '#one_step_email'], RESISTONE.email);
    await fillField(['telefono', '#telefono-input'], RESISTONE.phone);
    await fillField(['password', '#password-input'], RESISTONE.password);
    await fillField(['documentacion', '#documentacion-input'], RESISTONE.nif);
    await fillField(['codigo postal', '#codigo-postal-input'], RESISTONE.zip);
    
    await page.waitForTimeout(2000);
    
    // Razón social (esperar a que se habilite)
    await page.waitForFunction(() => {
      const input = document.querySelector('#razon-social-input');
      return input && !input.disabled;
    }, { timeout: 10000 }).catch(() => {});
    
    await fillField(['razon social', '#razon-social-input'], RESISTONE.razonSocial);
    
    // Términos
    await page.locator('#aceptar-condiciones').check();
    
    await screenshot(`${directorio.name}-2-filled`);
    
    // 2. Submit
    log('[submit] Enviando formulario...');
    await clickBtn(['Registrarme', 'button[type="submit"]']);
    await page.waitForTimeout(5000);
    
    await screenshot(`${directorio.name}-3-after-submit`, true, 'tras submit');
    
    // 3. Verificar email automáticamente
    log('[email] Iniciando verificación automática...');
    
    const emailVerified = await verificarEmail(
      bot,
      RESISTONE.email_verificacion || RESISTONE.email, // Usar email_verificacion si existe
      directorio.emailDomain,    // Dominio del remitente
      10,                        // Max 10 intentos
      10                         // Esperar 10s entre intentos
    );
    
    if (emailVerified) {
      log('✅ Email verificado automáticamente');
      await screenshot(`${directorio.name}-4-verified`);
      
      // Verificar que el perfil está activo
      // (navegar al perfil público si conoces la URL)
      
      console.log('\n✅ COMPLETADO: Cuenta creada y verificada');
      
    } else {
      log('⚠️ No se pudo verificar automáticamente');
      console.log('\n⏳ PENDIENTE: Verifica el email manualmente');
      console.log(`   Email: ${RESISTONE.email}`);
      console.log(`   Busca email de: ${directorio.emailDomain}`);
    }
    
  } catch (err) {
    log(`[ERROR] ${err.message}`);
    console.error('❌ Error:', err.message);
  }

  await bot.browser.close();
  
  console.log('\n✅ Proceso completado');
  console.log('📸 Capturas en: backlink-bot/screenshots/');
  console.log('📝 Log en: backlink-bot/ejemplo-verificacion.log');
})();
