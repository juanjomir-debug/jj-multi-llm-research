#!/usr/bin/env node
/**
 * extract-cookies-auto.js — Extrae cookies automáticamente después de 10 segundos
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const COOKIES_FILE = path.join(__dirname, 'reddit-cookies.json');

async function extractCookies() {
  console.log('Abriendo navegador...');
  
  const browser = await chromium.launch({
    headless: false,
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('Navegando a Reddit...');
  await page.goto('https://www.reddit.com');
  
  console.log('Esperando 10 segundos para que hagas login si es necesario...');
  await page.waitForTimeout(10000);
  
  console.log('Extrayendo cookies...');
  
  const cookies = await context.cookies();
  
  fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
  
  console.log(`✅ Cookies guardadas: ${cookies.length} cookies`);
  console.log(`✅ Archivo: ${COOKIES_FILE}`);
  
  await browser.close();
  
  console.log('✅ Listo para ejecutar el bot');
}

extractCookies().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
