#!/usr/bin/env node
/**
 * Verifica si un tweet tiene respuestas (es un hilo)
 */

const { chromium } = require('playwright');

const ACCOUNT = {
  name: 'juanjomir',
  auth_token: '7d03ee0fecd4c19cff2c4bf6c12c233683858dad',
  ct0: '',
};

const TWEET_ID = '2044460978327244866'; // Tweet 1

(async () => {
  console.log('\n🔍 Checking thread for tweet ' + TWEET_ID + '...\n');
  
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
  
  await page.goto(`https://x.com/i/status/${TWEET_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  // Get all tweets in the thread
  const tweets = await page.evaluate(() => {
    const articles = Array.from(document.querySelectorAll('article'));
    return articles.map((article, i) => {
      const link = article.querySelector('a[href*="/status/"]');
      const text = article.querySelector('[data-testid="tweetText"]');
      
      if (link && text) {
        const href = link.getAttribute('href');
        const match = href.match(/status\/(\d+)/);
        return {
          position: i + 1,
          id: match ? match[1] : null,
          text: text.innerText.substring(0, 80)
        };
      }
      return null;
    }).filter(t => t && t.id);
  });
  
  console.log(`📊 Tweets in thread: ${tweets.length}\n`);
  tweets.forEach(tweet => {
    console.log(`${tweet.position}. ID: ${tweet.id}`);
    console.log(`   Text: ${tweet.text}...\n`);
  });
  
  if (tweets.length > 1) {
    console.log(`✅ This is a thread with ${tweets.length} tweets`);
    console.log(`\n🔗 Last tweet ID: ${tweets[tweets.length - 1].id}`);
  } else {
    console.log(`⚠️  This tweet has no replies (not a thread)`);
  }
  
  await browser.close();
})();
