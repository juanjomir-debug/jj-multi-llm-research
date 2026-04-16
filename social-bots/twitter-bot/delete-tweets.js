#!/usr/bin/env node
/**
 * Borra tweets específicos usando Playwright
 */

const { chromium } = require('playwright');

const ACCOUNT = {
  name: 'juanjomir',
  auth_token: '7d03ee0fecd4c19cff2c4bf6c12c233683858dad',
  ct0: '',
};

// IDs de los tweets a borrar
const TWEET_IDS = [
  '2044503001696489679',
  '2044503079316254889',
  '2044503157913370969',
  '2044503235654783244',
  '2044503315103265003',
  '2044503393020850579',
  '2044503469407514800',
  '2044503549296410648',
  '2044503629437014126',
  '2044502914253660515', // tweet de prueba
];

async function deleteTweet(page, tweetId) {
  try {
    console.log(`\n🗑️  Deleting tweet ${tweetId}...`);
    
    // Navegar al tweet
    await page.goto(`https://x.com/i/status/${tweetId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Buscar el menú de opciones (tres puntos)
    const moreBtn = page.locator('[data-testid="caret"]').first();
    await moreBtn.click();
    await page.waitForTimeout(1000);
    
    // Buscar la opción "Delete"
    const deleteBtn = page.locator('[data-testid="Dropdown"] [role="menuitem"]').filter({ hasText: /Delete/i }).first();
    await deleteBtn.click();
    await page.waitForTimeout(1000);
    
    // Confirmar eliminación
    const confirmBtn = page.locator('[data-testid="confirmationSheetConfirm"]').first();
    await confirmBtn.click();
    await page.waitForTimeout(2000);
    
    console.log(`   ✅ Deleted`);
    return true;
    
  } catch (error) {
    console.log(`   ⚠️  Could not delete (may not exist): ${error.message}`);
    return false;
  }
}

(async () => {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  🗑️  Tweet Deleter                                            ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`📊 Tweets to delete: ${TWEET_IDS.length}`);
  console.log(`👤 Account: @${ACCOUNT.name}\n`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1280, height: 800 },
  });

  const cookies = [
    { name: 'auth_token', value: ACCOUNT.auth_token, domain: '.x.com', path: '/', secure: true, httpOnly: true },
  ];
  if (ACCOUNT.ct0) {
    cookies.push({ name: 'ct0', value: ACCOUNT.ct0, domain: '.x.com', path: '/', secure: true });
  }
  await context.addCookies(cookies);

  const page = await context.newPage();
  
  let deleted = 0;
  
  for (const tweetId of TWEET_IDS) {
    const success = await deleteTweet(page, tweetId);
    if (success) deleted++;
    await page.waitForTimeout(1000);
  }
  
  await browser.close();
  
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ Completed                                                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`📊 Deleted: ${deleted}/${TWEET_IDS.length}\n`);
})();
