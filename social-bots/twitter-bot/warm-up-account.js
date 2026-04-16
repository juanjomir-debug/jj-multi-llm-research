#!/usr/bin/env node
/**
 * warm-up-account.js — Calienta cuentas nuevas de Twitter con actividad orgánica
 * 
 * Simula comportamiento humano durante 2-4 semanas para evitar error 226:
 * - Scroll timeline
 * - Likes aleatorios (5-10/día)
 * - Retweets ocasionales (2-3/día)
 * - Comentarios simples cada 2-3 días
 * - Delays aleatorios entre acciones
 * 
 * Uso: node warm-up-account.js --account martinkarsel
 *      node warm-up-account.js --account reliableai
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ── Configuración ─────────────────────────────────────────────────────────────
const ACCOUNTS = {
  martinkarsel: {
    auth_token: 'f3076850ae503c6f68ba70c78158bc83d6c30553',
    ct0: 'faf6f09dfa26f8e0e806515db7ea242ce9b258132835202f5674fc0d68ff52614ba2c9d6bc6e935602729103a0d15ecbecdf3ed956aefa9c43ddd2d2ef2189c8b62fbf4a3c6ce61a814b1a5586f0d024',
  },
  reliableai: {
    auth_token: '2cf5beff434fe792b8f540380daa628742c426d0',
    ct0: '8a04959a72368239d03e0413f89c34913d77b23fcf5196ad894f001351c3121a03f6ebdb3f9a8342f53953b134a5e06d9039359d5e2396da3a0dd2a79f2478c1eab251e513cf1b60c1260e5b538d4eb0',
  },
};

const LOG_FILE = path.join(__dirname, 'warm-up.log');
const STATE_FILE = path.join(__dirname, 'warm-up-state.json');

// ── Helpers ───────────────────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return { martinkarsel: { day: 0, likes: 0, retweets: 0, comments: 0 }, reliableai: { day: 0, likes: 0, retweets: 0, comments: 0 } };
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function warmUp(accountName) {
  log('═══════════════════════════════════════════════════════════');
  log(`  WARM-UP: @${accountName}`);
  log('═══════════════════════════════════════════════════════════');
  
  const account = ACCOUNTS[accountName];
  if (!account) {
    log(`[error] Unknown account: ${accountName}`);
    process.exit(1);
  }
  
  const state = loadState();
  const accountState = state[accountName];
  
  log(`[state] Day ${accountState.day} | Likes: ${accountState.likes} | RTs: ${accountState.retweets} | Comments: ${accountState.comments}`);
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });
  
  // Inyectar cookies
  const cookies = [
    { name: 'auth_token', value: account.auth_token, domain: '.x.com', path: '/', secure: true, httpOnly: true },
  ];
  if (account.ct0) {
    cookies.push({ name: 'ct0', value: account.ct0, domain: '.x.com', path: '/', secure: true });
  }
  await context.addCookies(cookies);
  
  const page = await context.newPage();
  
  try {
    // 1. Navegar a home
    log('[1/5] Navegando a home...');
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(randomDelay(3000, 5000));
    
    // 2. Scroll timeline (simular lectura)
    log('[2/5] Scrolling timeline...');
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 400));
      await page.waitForTimeout(randomDelay(2000, 4000));
    }
    
    // 3. Dar likes (5-10 tweets)
    const likesToGive = randomDelay(5, 10);
    log(`[3/5] Dando ${likesToGive} likes...`);
    
    const likeButtons = await page.locator('[data-testid="like"]').all();
    const availableLikes = Math.min(likesToGive, likeButtons.length);
    
    for (let i = 0; i < availableLikes; i++) {
      try {
        await likeButtons[i].click();
        accountState.likes++;
        log(`[like] ${accountState.likes} total`);
        await page.waitForTimeout(randomDelay(3000, 8000));
      } catch (err) {
        log(`[like] Error: ${err.message}`);
      }
    }
    
    // 4. Retweets (2-3 tweets)
    const retweetsToGive = randomDelay(2, 3);
    log(`[4/5] Haciendo ${retweetsToGive} retweets...`);
    
    // Scroll un poco más para encontrar nuevos tweets
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(2000);
    
    const retweetButtons = await page.locator('[data-testid="retweet"]').all();
    const availableRetweets = Math.min(retweetsToGive, retweetButtons.length);
    
    for (let i = 0; i < availableRetweets; i++) {
      try {
        await retweetButtons[i].click();
        await page.waitForTimeout(1000);
        
        // Confirmar retweet
        const confirmBtn = page.locator('[data-testid="retweetConfirm"]').first();
        await confirmBtn.click();
        accountState.retweets++;
        log(`[retweet] ${accountState.retweets} total`);
        await page.waitForTimeout(randomDelay(4000, 10000));
      } catch (err) {
        log(`[retweet] Error: ${err.message}`);
      }
    }
    
    // 5. Comentario simple (solo cada 2-3 días)
    const shouldComment = accountState.day % 2 === 0 && accountState.comments < 10;
    
    if (shouldComment) {
      log('[5/5] Intentando comentar...');
      
      // Buscar un tweet para comentar
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(2000);
      
      const replyButtons = await page.locator('[data-testid="reply"]').all();
      
      if (replyButtons.length > 0) {
        try {
          await replyButtons[0].click();
          await page.waitForTimeout(2000);
          
          // Comentarios genéricos y seguros
          const comments = [
            'Interesting perspective!',
            'Thanks for sharing this.',
            'Great point.',
            'This is helpful.',
            'Good to know.',
            'Appreciate the insight.',
          ];
          
          const comment = comments[Math.floor(Math.random() * comments.length)];
          
          const textbox = page.locator('[data-testid="tweetTextarea_0"]').first();
          await textbox.click();
          await textbox.fill(comment);
          await page.waitForTimeout(2000);
          
          const submitBtn = page.locator('[data-testid="tweetButton"]').first();
          await submitBtn.click();
          await page.waitForTimeout(3000);
          
          accountState.comments++;
          log(`[comment] "${comment}" | ${accountState.comments} total`);
        } catch (err) {
          log(`[comment] Error: ${err.message}`);
        }
      }
    } else {
      log('[5/5] Saltando comentario (solo cada 2-3 días)');
    }
    
    // Incrementar día
    accountState.day++;
    
    // Guardar estado
    state[accountName] = accountState;
    saveState(state);
    
    log('═══════════════════════════════════════════════════════════');
    log(`✅ Warm-up completado para @${accountName}`);
    log(`📊 Stats: Day ${accountState.day} | Likes: ${accountState.likes} | RTs: ${accountState.retweets} | Comments: ${accountState.comments}`);
    log('═══════════════════════════════════════════════════════════');
    
    // Recomendación
    if (accountState.day < 14) {
      log(`⏳ Ejecuta este script diariamente durante ${14 - accountState.day} días más`);
    } else {
      log(`✅ Cuenta lista! Puedes empezar a usar el bot de publicación`);
    }
    
  } catch (err) {
    log(`[error] ${err.message}`);
    
    // Captura de pantalla
    const screenshotPath = path.join(__dirname, `warm-up-error-${accountName}-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath });
    log(`[error] Screenshot: ${screenshotPath}`);
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const accountName = args[args.indexOf('--account') + 1];

if (!accountName || !ACCOUNTS[accountName]) {
  console.error('Usage: node warm-up-account.js --account [martinkarsel|reliableai]');
  process.exit(1);
}

warmUp(accountName);
