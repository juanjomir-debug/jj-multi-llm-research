#!/usr/bin/env node
// test-vision.js — Prueba el analizador de visión con las capturas existentes

require('dotenv').config();
const path = require('path');
const { analyzeSequence } = require('./vision-analyzer');

(async () => {
  console.log('=== TEST DE VISIÓN CON GPT-4o ===\n');

  const screenshots = [
    {
      path: path.join(__dirname, 'screenshots/debug3-hab-filled.png'),
      context: 'Habitissimo paso 2 — formulario relleno antes del submit',
    },
    {
      path: path.join(__dirname, 'screenshots/debug3-hab-after.png'),
      context: 'Habitissimo — página tras hacer click en submit',
    },
    {
      path: path.join(__dirname, 'screenshots/debug3-cert-filled.png'),
      context: 'Certicalia — formulario relleno antes del submit',
    },
    {
      path: path.join(__dirname, 'screenshots/debug3-cert-after.png'),
      context: 'Certicalia — página tras hacer click en submit',
    },
  ];

  try {
    const results = await analyzeSequence(screenshots);
    
    console.log('\n\n=== RESUMEN ===');
    for (const r of results) {
      console.log(`\n${r.path.split('/').pop()}:`);
      console.log(`  Estado: ${r.state}`);
      console.log(`  Errores: ${r.errors.length ? r.errors.join(', ') : 'ninguno'}`);
      console.log(`  Diagnóstico: ${r.diagnosis.substring(0, 200)}...`);
      console.log(`  Siguiente acción: ${r.nextAction}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
    if (err.message.includes('GOOGLE_API_KEY')) {
      console.log('\nConfigura GOOGLE_API_KEY en tu .env');
    }
    process.exit(1);
  }
})();
