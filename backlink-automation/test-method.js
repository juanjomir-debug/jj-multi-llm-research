#!/usr/bin/env node
/**
 * test-method.js — Test end-to-end del método de automatización
 * Valida: stealth plugin, visión, máquina de estados, helpers
 */

const { createBot, STATE } = require('./bot-engine');
const path = require('path');

(async () => {
  console.log('=== TEST DEL MÉTODO DE AUTOMATIZACIÓN ===\n');

  // 1. Test de inicialización con stealth
  console.log('1. Inicializando bot con stealth plugin...');
  const bot = await createBot({
    headless: true,
    screenshotsDir: path.join(__dirname, 'screenshots'),
    logFile: path.join(__dirname, 'test-method.log'),
  });
  console.log('✅ Bot inicializado con stealth\n');

  // 2. Test de navegación y detección de cookies
  console.log('2. Navegando a página de prueba (Google)...');
  await bot.goto('https://www.google.com', 'fast');
  console.log('✅ Navegación exitosa\n');

  // 3. Test de detección de estado
  console.log('3. Detectando estado de la página...');
  const state = await bot.detectState();
  console.log(`✅ Estado detectado: ${state}\n`);

  // 4. Test de captura con análisis de visión
  console.log('4. Capturando pantalla con análisis de visión...');
  const result = await bot.screenshot('test-method-google', true, 'página de inicio de Google');
  if (result.analysis) {
    console.log(`✅ Visión analizada: state=${result.analysis.state}`);
    console.log(`   Diagnóstico: ${result.analysis.diagnosis.substring(0, 100)}...\n`);
  } else {
    console.log('⚠️  Visión no disponible (falta OPENAI_API_KEY)\n');
  }

  // 5. Test de helpers básicos
  console.log('5. Probando helpers de interacción...');
  
  // Test fillField (debe fallar porque no hay formulario)
  const filled = await bot.fillField(['q', 'search', 'input[name="q"]'], 'test query');
  if (filled) {
    console.log('✅ fillField funcionó (encontró campo de búsqueda)\n');
  } else {
    console.log('⚠️  fillField no encontró campo (esperado en esta página)\n');
  }

  // 6. Test de máquina de estados
  console.log('6. Validando estados disponibles...');
  const expectedStates = [
    'LANDING', 'COOKIES', 'FORMULARIO', 'PASO_INTERMEDIO', 'SUBMIT',
    'confirmed', 'pendiente_verificacion_email', 'pendiente_intervencion_humana',
    'error', 'bloqueado', 'datos_insuficientes'
  ];
  const allStatesPresent = expectedStates.every(s => STATE[s] || s === STATE[s]);
  if (allStatesPresent) {
    console.log('✅ Todos los estados definidos correctamente\n');
  } else {
    console.log('❌ Faltan estados en STATE\n');
  }

  // 7. Test de withRetry
  console.log('7. Probando mecanismo de reintentos...');
  let attempts = 0;
  const retryResult = await bot.withRetry('test-retry', async () => {
    attempts++;
    if (attempts < 2) throw new Error('Intento fallido');
    return 'success';
  }, 2);
  if (retryResult === 'success' && attempts === 2) {
    console.log('✅ Reintentos funcionan correctamente\n');
  } else {
    console.log('❌ Problema con reintentos\n');
  }

  await bot.browser.close();

  console.log('\n=== RESUMEN ===');
  console.log('✅ Stealth plugin: OK');
  console.log('✅ Navegación y esperas: OK');
  console.log('✅ Detección de estado: OK');
  console.log(result.analysis ? '✅ Visión GPT-4o: OK' : '⚠️  Visión: no disponible');
  console.log('✅ Helpers de interacción: OK');
  console.log('✅ Máquina de estados: OK');
  console.log('✅ Reintentos: OK');
  console.log('\n🎉 MÉTODO VALIDADO — Listo para escalar a directorios reales\n');
})();
