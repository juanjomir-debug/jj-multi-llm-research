#!/usr/bin/env node
/**
 * Publica un thread completo en Twitter de forma autónoma
 * Extrae automáticamente el ID del primer tweet y publica los replies
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ACCOUNT = 'juanjomir';
const ACCOUNTS = {
  juanjomir: {
    auth_token: '7d03ee0fecd4c19cff2c4bf6c12c233683858dad',
    ct0: '',
  },
  martinkarsel: {
    auth_token: 'f3076850ae503c6f68ba70c78158bc83d6c30553',
    ct0: 'faf6f09dfa26f8e0e806515db7ea242ce9b258132835202f5674fc0d68ff52614ba2c9d6bc6e935602729103a0d15ecbecdf3ed956aefa9c43ddd2d2ef2189c8b62fbf4a3c6ce61a814b1a5586f0d024',
  },
  reliableai: {
    auth_token: '2cf5beff434fe792b8f540380daa628742c426d0',
    ct0: '8a04959a72368239d03e0413f89c34913d77b23fcf5196ad894f001351c3121a03f6ebdb3f9a8342f53953b134a5e06d9039359d5e2396da3a0dd2a79f2478c1eab251e513cf1b60c1260e5b538d4eb0',
  },
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function publishTweet(page, text) {
  console.log(`\n📝 Publicando tweet (${text.length} chars)...`);
  
  // Navegar a compose
  await page.goto('https://x.com/compose/tweet', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2000);
  
  // Escribir texto
  const textbox = page.locator('[data-testid="tweetTextarea_0"]').first();
  await textbox.click();
  await textbox.fill(text);
  await sleep(1000);
  
  // Publicar
  const submitBtn = page.locator('[data-testid="tweetButton"]').first();
  await submitBtn.click();
  await sleep(4000);
  
  console.log('✅ Tweet publicado');
}

async function getLatestTweetId(page, username) {
  console.log(`\n🔍 Buscando último tweet de @${username}...`);
  
  await page.goto(`https://x.com/${username}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  
  // Buscar el primer tweet en el timeline
  const tweetLinks = await page.locator('article a[href*="/status/"]').all();
  
  if (tweetLinks.length === 0) {
    throw new Error('No se encontraron tweets');
  }
  
  // Extraer el ID del primer tweet
  const href = await tweetLinks[0].getAttribute('href');
  const match = href.match(/\/status\/(\d+)/);
  
  if (!match) {
    throw new Error('No se pudo extraer el ID del tweet');
  }
  
  const tweetId = match[1];
  console.log(`✅ ID del tweet encontrado: ${tweetId}`);
  
  return tweetId;
}

async function publishReply(page, tweetId, text) {
  console.log(`\n💬 Publicando reply (${text.length} chars)...`);
  
  // Navegar al tweet
  await page.goto(`https://x.com/i/status/${tweetId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  
  // Hacer scroll para asegurar que el botón de reply esté visible
  await page.evaluate(() => window.scrollTo(0, 200));
  await sleep(1000);
  
  // Clicar en reply
  const replyBtn = page.locator('[data-testid="reply"]').first();
  await replyBtn.click();
  await sleep(3000);
  
  // Escribir texto - usar type en lugar de fill para simular escritura real
  const textbox = page.locator('[data-testid="tweetTextarea_0"]').first();
  await textbox.click();
  await sleep(500);
  
  // Limpiar cualquier texto previo
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await sleep(300);
  
  // Escribir el texto caracter por caracter (más lento pero más confiable)
  await textbox.type(text, { delay: 10 });
  await sleep(1500);
  
  // Esperar a que el botón se habilite
  await page.waitForSelector('[data-testid="tweetButtonInline"]:not([disabled])', { timeout: 10000 });
  
  // Publicar
  const submitBtn = page.locator('[data-testid="tweetButtonInline"]').first();
  await submitBtn.click();
  await sleep(5000);
  
  console.log('✅ Reply publicado');
}

async function publishThread(threadFile) {
  if (!fs.existsSync(threadFile)) {
    console.error(`❌ Archivo no encontrado: ${threadFile}`);
    process.exit(1);
  }
  
  const threadData = JSON.parse(fs.readFileSync(threadFile, 'utf-8'));
  const { tweets, title } = threadData;
  
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  🐦 Publicador Autónomo de Threads                           ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`📄 Thread: "${title}"`);
  console.log(`👤 Cuenta: @${ACCOUNT}`);
  console.log(`📊 Total tweets: ${tweets.length}\n`);
  
  const account = ACCOUNTS[ACCOUNT];
  
  const browser = await chromium.launch({ 
    headless: false, // Visible para debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });
  
  // Inyectar cookies de sesión
  const cookies = [
    { name: 'auth_token', value: account.auth_token, domain: '.x.com', path: '/', secure: true, httpOnly: true },
  ];
  if (account.ct0) {
    cookies.push({ name: 'ct0', value: account.ct0, domain: '.x.com', path: '/', secure: true });
  }
  await context.addCookies(cookies);
  
  const page = await context.newPage();
  
  try {
    // 1. Publicar el primer tweet
    console.log('\n━━━ TWEET 1/' + tweets.length + ' ━━━');
    await publishTweet(page, tweets[0]);
    
    // 2. Obtener el ID del tweet recién publicado
    await sleep(3000);
    const tweetId = await getLatestTweetId(page, ACCOUNT);
    
    // 3. Publicar los replies
    for (let i = 1; i < tweets.length; i++) {
      console.log(`\n━━━ TWEET ${i + 1}/${tweets.length} ━━━`);
      await publishReply(page, tweetId, tweets[i]);
      await sleep(3000); // Delay entre tweets para evitar rate limits
    }
    
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  🎉 Thread publicado exitosamente                            ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    console.log(`🔗 Ver thread: https://x.com/${ACCOUNT}/status/${tweetId}\n`);
    
    // Marcar como publicado
    threadData.published = true;
    threadData.publishedAt = new Date().toISOString();
    threadData.tweetId = tweetId;
    fs.writeFileSync(threadFile, JSON.stringify(threadData, null, 2));
    
  } catch (error) {
    console.error('\n❌ Error publicando thread:', error.message);
    
    // Captura de pantalla para debugging
    const screenshotPath = path.join(__dirname, `error-thread-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot guardado: ${screenshotPath}`);
    
    throw error;
    
  } finally {
    await browser.close();
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Uso: node publish-thread-auto.js <thread-file.json>');
    console.log('\nEjemplo:');
    console.log('  node publish-thread-auto.js ../twitter-thread-ai-won-t-kill-jobs-it-will-kill-your-job.json');
    process.exit(1);
  }
  
  publishThread(args[0])
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { publishThread };
