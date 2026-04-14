#!/usr/bin/env node
/**
 * test-email-verifier.js — Test del módulo de verificación de email
 */

const { getVerificationEmail, getVerificationCode } = require('./email-verifier');

(async () => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  TEST EMAIL VERIFIER');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Test 1: Buscar email de verificación
  console.log('[TEST 1] Buscando email de verificación...\n');
  
  const emailAddress = 'info@resistone.es'; // Cambiar por tu email
  const fromDomain = 'certicalia.com';      // Cambiar por el dominio que quieras probar
  
  console.log(`Email: ${emailAddress}`);
  console.log(`Dominio: ${fromDomain}`);
  console.log('Buscando emails de la última hora...\n');
  
  try {
    const link = await getVerificationEmail(emailAddress, fromDomain, 60);
    
    if (link) {
      console.log('✅ Enlace de verificación encontrado:');
      console.log(link);
    } else {
      console.log('⚠️ No se encontró email de verificación');
      console.log('\nPosibles causas:');
      console.log('- No hay emails recientes de ese dominio');
      console.log('- El email no contiene enlace de verificación');
      console.log('- El token de Gmail API expiró (ejecuta: node authorize-gmail.js)');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    
    if (err.message.includes('credentials.json')) {
      console.error('\n⚠️ Falta configuración:');
      console.error('1. Sigue la guía: backlink-bot/SETUP-GMAIL-API.md');
      console.error('2. Ejecuta: node authorize-gmail.js');
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  
  // Test 2: Buscar código de verificación
  console.log('\n[TEST 2] Buscando código de verificación...\n');
  
  try {
    const code = await getVerificationCode(emailAddress, fromDomain);
    
    if (code) {
      console.log('✅ Código encontrado:', code);
    } else {
      console.log('⚠️ No se encontró código de verificación');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  TEST COMPLETADO');
  console.log('═══════════════════════════════════════════════════════════\n');
})();
