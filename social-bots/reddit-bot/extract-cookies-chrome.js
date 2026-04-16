#!/usr/bin/env node
/**
 * extract-cookies-chrome.js — Extrae cookies de Chrome donde ya estás logueado
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function extractCookies() {
  console.log('🔍 Extrayendo cookies de Reddit desde Chrome...\n');
  
  // Conectar a Chrome existente
  const userDataDir = path.join(process.env.LOCALAPPDATA || process.env.HOME, 'Google/Chrome/User Data');
  
  console.log(`📂 Perfil de Chrome: ${userDataDir}\n`);
  console.log('⚠️  IMPORTANTE: Cierra Chrome completamente antes de continuar');
  console.log('⚠️  Presiona Ctrl+C si Chrome está abierto\n');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      channel: 'chrome'
    });
    
    const page = context.pages()[0] || await context.newPage();
    
    console.log('🌐 Navegando a old.reddit.com...');
    await page.goto('https://old.reddit.com');
    await page.waitForTimeout(3000);
    
    // Extraer cookies
    const cookies = await context.cookies('https://old.reddit.com');
    
    console.log(`\n✅ Extraídas ${cookies.length} cookies\n`);
    
    // Filtrar las importantes
    const importantCookies = cookies.filter(c => 
      ['reddit_session', 'token_v2', 'edgebucket', 'session_tracker'].includes(c.name)
    );
    
    console.log('📋 Cookies importantes:');
    importantCookies.forEach(c => {
      console.log(`   - ${c.name}: ${c.value.substring(0, 20)}...`);
    });
    
    // Guardar todas las cookies
    const outputFile = path.join(__dirname, 'reddit-cookies-manual.json');
    fs.writeFileSync(outputFile, JSON.stringify(cookies, null, 2));
    
    console.log(`\n💾 Guardadas en: ${outputFile}`);
    console.log('\n✅ Listo! Ahora puedes ejecutar:');
    console.log('   node reddit-bot/reddit-with-cookies.js\n');
    
    await context.close();
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    console.error('\n💡 Solución: Cierra Chrome completamente y vuelve a ejecutar este script');
  }
}

extractCookies();
