#!/usr/bin/env node
/**
 * setup-wizard.js — Asistente de configuración para verificación de email
 */

const fs = require('fs');
const path = require('path');

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

console.log('═══════════════════════════════════════════════════════════');
console.log('  ASISTENTE DE CONFIGURACIÓN — Verificación de Email');
console.log('═══════════════════════════════════════════════════════════\n');

// Verificar estado actual
const hasCredentials = fs.existsSync(CREDENTIALS_PATH);
const hasToken = fs.existsSync(TOKEN_PATH);

console.log('Estado actual:\n');
console.log(`${hasCredentials ? '✅' : '❌'} credentials.json`);
console.log(`${hasToken ? '✅' : '❌'} token.json\n`);

if (hasCredentials && hasToken) {
  console.log('✅ ¡Configuración completa!\n');
  console.log('Ya puedes usar la verificación automática de email.\n');
  console.log('Prueba con:');
  console.log('  node backlink-bot/test-email-verifier.js');
  console.log('  node backlink-bot/completar-altas.js\n');
  process.exit(0);
}

if (!hasCredentials) {
  console.log('❌ Falta credentials.json\n');
  console.log('Sigue estos pasos:\n');
  console.log('1. Ve a: https://console.cloud.google.com');
  console.log('2. Crea un proyecto nuevo: "ReliableAI Backlinks"');
  console.log('3. Habilita Gmail API: https://console.cloud.google.com/apis/library/gmail.googleapis.com');
  console.log('4. Ve a: https://console.cloud.google.com/apis/credentials');
  console.log('5. Click "Crear credenciales" → "ID de cliente de OAuth"');
  console.log('6. Si te pide configurar pantalla de consentimiento:');
  console.log('   - Selecciona "Externo"');
  console.log('   - Rellena solo campos obligatorios');
  console.log('   - Nombre: "ReliableAI Backlinks"');
  console.log('   - Email: tu email');
  console.log('7. Tipo de aplicación: "Aplicación de escritorio"');
  console.log('8. Descarga el JSON');
  console.log('9. Guárdalo como: backlink-bot/credentials.json\n');
  console.log('Guía completa: backlink-bot/SETUP-GMAIL-API.md\n');
  console.log('Una vez tengas credentials.json, vuelve a ejecutar este script.\n');
  process.exit(1);
}

if (!hasToken) {
  console.log('✅ credentials.json encontrado\n');
  console.log('❌ Falta token.json\n');
  console.log('Ejecuta el siguiente comando para autorizar la aplicación:\n');
  console.log('  node backlink-bot/authorize-gmail.js\n');
  console.log('Esto:');
  console.log('1. Abrirá tu navegador');
  console.log('2. Te pedirá que inicies sesión con Gmail');
  console.log('3. Te pedirá que autorices la aplicación');
  console.log('4. Te dará un código para pegar en la terminal');
  console.log('5. Creará token.json automáticamente\n');
  process.exit(1);
}
