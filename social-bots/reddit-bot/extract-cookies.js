#!/usr/bin/env node
/**
 * extract-cookies.js — Extrae cookies de Chrome para usarlas en Playwright
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const COOKIES_FILE = path.join(__dirname, 'reddit-cookies.json');

async function extractCookies() {
  console.log('Abriendo navegador para extraer cookies...');
  console.log('Por favor, asegúrate de estar logueado en Reddit en Chrome.');
  console.log('');
  
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome', // Usar Chrome en lugar de Chromium
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('Navegando a Reddit...');
  await page.goto('https://www.reddit.com');
  await page.waitForTimeout(3000);
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  INSTRUCCIONES');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('1. Si NO estás logueado, haz login ahora en la ventana del navegador');
  console.log('2. Una vez logueado, presiona ENTER aquí en la terminal');
  console.log('');
  console.log('Esperando...');
  
  // Esperar a que el usuario presione Enter
  await new Promise(resolve => {
    process.stdin.once('data', () => resolve());
  });
  
  console.log('');
  console.log('Extrayendo cookies...');
  
  const cookies = await context.cookies();
  
  fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
  
  console.log(`✅ Cookies guardadas en: ${COOKIES_FILE}`);
  console.log(`✅ Total de cookies: ${cookies.length}`);
  
  await browser.close();
  
  console.log('');
  console.log('✅ Proceso completado');
  console.log('');
  console.log('Ahora puedes ejecutar el bot:');
  console.log('  node reddit-bot/reddit-playwright.js');
}

extractCookies().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
