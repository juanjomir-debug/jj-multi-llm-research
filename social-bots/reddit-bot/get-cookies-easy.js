#!/usr/bin/env node
/**
 * get-cookies-easy.js — Abre Chrome y muestra cómo copiar cookies
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function getCookies() {
  console.log('🚀 Abriendo Chrome para extraer cookies...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--start-maximized']
  });
  
  const context = await browser.newContext({
    viewport: null
  });
  
  const page = await context.newPage();
  
  console.log('📋 INSTRUCCIONES:');
  console.log('1. Voy a abrir old.reddit.com');
  console.log('2. Loguéate si no lo estás');
  console.log('3. Presiona F12 para abrir DevTools');
  console.log('4. Ve a la pestaña "Console"');
  console.log('5. Pega este código y presiona Enter:\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`
copy(JSON.stringify(
  document.cookie.split('; ').map(c => {
    const [name, value] = c.split('=');
    return { name, value, domain: '.reddit.com', path: '/' };
  }),
  null,
  2
));
console.log('✅ Cookies copiadas al portapapeles!');
  `);
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('6. Las cookies se copiarán al portapapeles');
  console.log('7. Pégalas en el chat y yo crearé el archivo\n');
  console.log('⏳ Esperando... (presiona Ctrl+C cuando termines)\n');
  
  await page.goto('https://old.reddit.com');
  
  // Esperar indefinidamente
  await new Promise(() => {});
}

getCookies();
