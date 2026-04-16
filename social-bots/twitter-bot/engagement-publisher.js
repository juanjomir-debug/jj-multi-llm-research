#!/usr/bin/env node
/**
 * Publica las respuestas de engagement de forma controlada
 * Lee el archivo de candidatos y permite revisar antes de publicar
 */

const fs = require('fs');
const { chromium } = require('playwright');
const readline = require('readline');

const CONFIG = {
  account: 'juanjomir',
  auth_token: '7d03ee0fecd4c19cff2c4bf6c12c233683858dad',
  ct0: '',
  delayBetweenReplies: 10 * 60 * 1000, // 10 minutos entre respuestas
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

// Publicar respuesta
async function publishReply(page, tweetId, text) {
  try {
    // Navegar al tweet
    await page.goto(`https://x.com/i/status/${tweetId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Hacer scroll
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForTimeout(1000);
    
    // Clicar en reply
    const replyBtn = page.locator('[data-testid="reply"]').first();
    await replyBtn.click();
    await page.waitForTimeout(2000);
    
    // Escribir texto
    const textbox = page.locator('[data-testid="tweetTextarea_0"]').first();
    await textbox.click();
    await page.waitForTimeout(500);
    
    // Escribir caracter por caracter
    await textbox.type(text, { delay: 50 });
    await page.waitForTimeout(1500);
    
    // Esperar a que el botón se habilite
    await page.waitForSelector('[data-testid="tweetButtonInline"]:not([disabled])', { timeout: 10000 });
    
    // Publicar
    const submitBtn = page.locator('[data-testid="tweetButtonInline"]').first();
    await submitBtn.click();
    await page.waitForTimeout(4000);
    
    return true;
  } catch (error) {
    console.error('❌ Error publicando:', error.message);
    return false;
  }
}

// Dar like
async function likeTweet(page, tweetId) {
  try {
    await page.goto(`https://x.com/i/status/${tweetId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    const likeBtn = page.locator('[data-testid="like"]').first();
    await likeBtn.click();
    await page.waitForTimeout(1000);
    
    return true;
  } catch (error) {
    console.error('❌ Error dando like:', error.message);
    return false;
  }
}

// Main
async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  📤 Twitter Engagement Publisher                              ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  // Buscar archivo de candidatos más reciente
  const files = fs.readdirSync('.').filter(f => f.startsWith('engagement-candidates-'));
  
  if (files.length === 0) {
    console.error('❌ No se encontraron archivos de candidatos');
    console.log('   Ejecuta primero: node engagement-finder.js\n');
    process.exit(1);
  }
  
  const latestFile = files.sort().reverse()[0];
  console.log(`📂 Usando: ${latestFile}\n`);
  
  const candidates = JSON.parse(fs.readFileSync(latestFile, 'utf-8'));
  
  console.log(`📊 Total candidatos: ${candidates.length}\n`);
  
  // Iniciar navegador
  const browser = await chromium.launch({ 
    headless: false, // Visible para supervisión
    slowMo: 100 
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1280, height: 800 }
  });
  
  // Inyectar cookies
  await context.addCookies([
    { name: 'auth_token', value: CONFIG.auth_token, domain: '.x.com', path: '/', secure: true, httpOnly: true }
  ]);
  
  const page = await context.newPage();
  
  let published = 0;
  let liked = 0;
  const log = [];
  
  try {
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const num = i + 1;
      
      console.log(`\n━━━ CANDIDATO ${num}/${candidates.length} ━━━`);
      console.log(`👤 Autor: @${candidate.tweet.author}`);
      console.log(`📊 Score: ${candidate.analysis.relevanceScore}/10`);
      console.log(`🎯 Tipo: ${candidate.analysis.responseType}`);
      console.log(`💬 Tweet: ${candidate.tweet.text.substring(0, 150)}...`);
      console.log(`🔗 URL: ${candidate.tweet.url}`);
      console.log(`\n📝 Borrador de respuesta:`);
      console.log(`   ${candidate.draft}\n`);
      
      const action = await question('Acción? [p]ublicar / [e]ditar / [l]ike / [s]kip / [q]uit: ');
      
      if (action === 'q') {
        console.log('\n⏹️  Deteniendo...');
        break;
      }
      
      if (action === 's') {
        console.log('⏭️  Omitido\n');
        continue;
      }
      
      if (action === 'l') {
        console.log('👍 Dando like...');
        const success = await likeTweet(page, candidate.tweet.id);
        if (success) {
          liked++;
          log.push({ action: 'like', tweet: candidate.tweet.url, timestamp: new Date().toISOString() });
          console.log('✅ Like dado\n');
        }
        continue;
      }
      
      let finalText = candidate.draft;
      
      if (action === 'e') {
        finalText = await question('Nuevo texto: ');
      }
      
      if (action === 'p' || action === 'e') {
        console.log(`\n📤 Publicando respuesta...`);
        
        const success = await publishReply(page, candidate.tweet.id, finalText);
        
        if (success) {
          published++;
          log.push({ 
            action: 'reply', 
            tweet: candidate.tweet.url, 
            text: finalText,
            type: candidate.analysis.responseType,
            timestamp: new Date().toISOString() 
          });
          console.log('✅ Respuesta publicada\n');
          
          // Delay entre respuestas
          if (i < candidates.length - 1) {
            const delayMinutes = CONFIG.delayBetweenReplies / 60000;
            console.log(`⏳ Esperando ${delayMinutes} minutos antes de la siguiente...\n`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenReplies));
          }
        } else {
          console.log('❌ Error publicando, continuando...\n');
        }
      }
    }
    
  } finally {
    await browser.close();
    rl.close();
  }
  
  // Guardar log
  const logFile = `engagement-log-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
  
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ Sesión completada                                         ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`📊 Estadísticas:`);
  console.log(`   • Respuestas publicadas: ${published}`);
  console.log(`   • Likes dados: ${liked}`);
  console.log(`   • Log guardado en: ${logFile}\n`);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { publishReply, likeTweet };
