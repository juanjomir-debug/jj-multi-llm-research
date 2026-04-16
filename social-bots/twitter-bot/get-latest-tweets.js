#!/usr/bin/env node
/**
 * Obtiene los últimos tweets del perfil para encontrar los IDs
 */

const { chromium } = require('playwright');

const ACCOUNT = {
  name: 'juanjomir',
  auth_token: '7d03ee0fecd4c19cff2c4bf6c12c233683858dad',
  ct0: '',
};

(async () => {
  console.log('\n🔍 Getting latest tweets from @' + ACCOUNT.name + '...\n');
  
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
  
  await page.goto(`https://x.com/${ACCOUNT.name}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  // Get all tweet links
  const tweets = await page.evaluate(() => {
    const articles = Array.from(document.querySelectorAll('article'));
    return articles.slice(0, 5).map(article => {
      const link = article.querySelector('a[href*="/status/"]');
      const text = article.querySelector('[data-testid="tweetText"]');
      
      if (link && text) {
        const href = link.getAttribute('href');
        const match = href.match(/status\/(\d+)/);
        return {
          id: match ? match[1] : null,
          text: text.innerText.substring(0, 100),
          url: `https://x.com${href}`
        };
      }
      return null;
    }).filter(t => t && t.id);
  });
  
  console.log('📊 Latest tweets:\n');
  tweets.forEach((tweet, i) => {
    console.log(`${i + 1}. ID: ${tweet.id}`);
    console.log(`   Text: ${tweet.text}...`);
    console.log(`   URL: ${tweet.url}\n`);
  });
  
  await browser.close();
})();
