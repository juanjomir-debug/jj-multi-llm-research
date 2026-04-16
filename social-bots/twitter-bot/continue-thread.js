#!/usr/bin/env node
/**
 * Continúa un hilo existente desde un tweet específico
 */

const { chromium } = require('playwright');

const ACCOUNT = {
  name: 'juanjomir',
  auth_token: '7d03ee0fecd4c19cff2c4bf6c12c233683858dad',
  ct0: '',
};

// ID del tweet 9 (último del hilo actual)
const TWEET_9_ID = '2044516220364300652';

// Tweet faltante: el 10
const TWEETS = [
  `10/ Full article with all the data, charts, and blind spots:

https://blog.reliableai.net/ai-won-t-kill-jobs-it-will-kill-your-job/

Produced using @AiReliable — 5 AI models researching independently.

#AI #FutureOfWork #Employment`
];

async function publishReply(page, text, replyToId) {
  try {
    console.log(`   📍 Opening tweet ${replyToId}...`);
    await page.goto(`https://x.com/i/status/${replyToId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Click reply button
    console.log(`   💬 Clicking reply...`);
    const replyBtn = page.locator('[data-testid="reply"]').first();
    await replyBtn.click();
    await page.waitForTimeout(2000);
    
    // Write text
    console.log(`   ✍️  Writing ${text.length} characters...`);
    const textbox = page.locator('[data-testid="tweetTextarea_0"]').first();
    await textbox.click();
    await textbox.fill(text);
    await page.waitForTimeout(1500);
    
    // Publish
    console.log(`   📤 Publishing...`);
    const submitBtn = page.locator('[data-testid="tweetButton"]').first();
    await submitBtn.click({ force: true });
    await page.waitForTimeout(5000);
    
    // Go to profile to find the new tweet
    console.log(`   🔍 Getting new tweet ID...`);
    await page.goto(`https://x.com/${ACCOUNT.name}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Get the first tweet link
    const firstTweetLink = page.locator('article a[href*="/status/"]').first();
    const href = await firstTweetLink.getAttribute('href');
    const match = href.match(/status\/(\d+)/);
    
    if (match) {
      const tweetId = match[1];
      console.log(`   ✅ Published!`);
      console.log(`   🆔 Tweet ID: ${tweetId}`);
      return tweetId;
    }
    
    throw new Error('Could not find tweet in profile');
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    const screenshot = `tweet-error-${Date.now()}.png`;
    await page.screenshot({ path: screenshot });
    console.error(`   📸 Screenshot: ${screenshot}`);
    throw error;
  }
}

(async () => {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  🧵 Continue Thread                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`📊 Tweets to add: ${TWEETS.length}`);
  console.log(`👤 Account: @${ACCOUNT.name}`);
  console.log(`🔗 Continuing from: ${TWEET_9_ID}\n`);
  
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
  
  let lastTweetId = TWEET_9_ID;
  const publishedIds = [lastTweetId];
  
  for (let i = 0; i < TWEETS.length; i++) {
    console.log(`\n━━━ Tweet 10/10 ━━━`);
    console.log(`💬 ${TWEETS[i].substring(0, 60)}...`);
    
    try {
      lastTweetId = await publishReply(page, TWEETS[i], lastTweetId);
      publishedIds.push(lastTweetId);
      
      if (i < TWEETS.length - 1) {
        console.log(`   ⏳ Waiting 3 seconds...`);
        await page.waitForTimeout(3000);
      }
    } catch (error) {
      console.error(`\n❌ Failed at tweet ${i + 3}`);
      console.error(`Published so far: ${publishedIds.length}/10`);
      break;
    }
  }
  
  await browser.close();
  
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ Completed                                                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`📊 Tweets added: ${TWEETS.length}`);
  console.log(`\n🔗 Thread URL: https://x.com/${ACCOUNT.name}/status/${publishedIds[0]}\n`);
})();
