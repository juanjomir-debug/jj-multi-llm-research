#!/usr/bin/env node
/**
 * test-manual-comment.js — Abre Reddit para que comentes manualmente
 * Esto nos ayuda a verificar si tu cuenta puede comentar
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const COOKIES_FILE = path.join(__dirname, 'reddit-cookies-manual.json');

async function test() {
  console.log('🧪 Test manual de comentarios en Reddit\n');
  
  if (!fs.existsSync(COOKIES_FILE)) {
    console.log('❌ No se encontró reddit-cookies-manual.json');
    return;
  }
  
  const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  await context.addCookies(cookies);
  
  const page = await context.newPage();
  
  console.log('📋 INSTRUCCIONES:');
  console.log('1. Voy a abrir un post de r/artificial');
  console.log('2. Intenta comentar MANUALMENTE');
  console.log('3. Si puedes comentar → tu cuenta funciona');
  console.log('4. Si NO puedes → tu cuenta tiene restricciones\n');
  
  await page.goto('https://old.reddit.com/r/artificial/new');
  await page.waitForTimeout(3000);
  
  // Extraer primer post
  const posts = await page.evaluate(() => {
    const things = document.querySelectorAll('.thing');
    const results = [];
    
    for (const thing of things) {
      const titleEl = thing.querySelector('.title a');
      if (!titleEl) continue;
      
      const title = titleEl.textContent;
      const url = titleEl.href;
      
      results.push({ title, url });
      if (results.length >= 3) break;
    }
    
    return results;
  });
  
  if (posts.length > 0) {
    console.log(`\n✅ Encontrados ${posts.length} posts\n`);
    console.log('📌 Abriendo el primer post...\n');
    console.log(`   ${posts[0].title}\n`);
    
    await page.goto(posts[0].url);
    await page.waitForTimeout(3000);
    
    console.log('👉 Ahora intenta comentar MANUALMENTE en el navegador');
    console.log('👉 Si ves "you are doing that too much" → cuenta nueva con límites');
    console.log('👉 Si ves "you must verify your email" → verifica tu email');
    console.log('👉 Si puedes comentar → ¡perfecto!\n');
    console.log('⏳ Esperando... (presiona Ctrl+C cuando termines)\n');
    
    // Esperar indefinidamente
    await new Promise(() => {});
  }
}

test();
