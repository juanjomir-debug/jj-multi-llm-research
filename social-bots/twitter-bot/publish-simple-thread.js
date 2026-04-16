#!/usr/bin/env node
/**
 * Publica un hilo simple de 3 tweets para probar
 */

const { chromium } = require('playwright');

const ACCOUNT = {
  name: 'juanjomir',
  auth_token: '7d03ee0fecd4c19cff2c4bf6c12c233683858dad',
  ct0: '',
};

const TWEETS = [
  `AI Won't Kill Jobs. It Will Kill *Your* Job.

The macro numbers look fine. The micro reality is brutal.

🧵 Thread on what 5 AI models agree (and violently disagree) about employment 👇`,

  `2/ Where ALL models agree:

• Net +78M jobs by 2030 (WEF)
• Middle-skill workers crushed
• AI skills = 23-56% salary premium

But here's where it gets interesting...`,

  `3/ The models split into 2 camps:

Camp 1 (GPT, Qwen, Grok): "Manageable disruption"
→ Temporary 0.3-0.6% unemployment bump

Camp 2 (Claude, Gemini): "Structural fracture"
→ The junior-to-senior pipeline is collapsing`
];

async function publishTweet(page, text, replyToUrl = null, lastUrl = null) {
  try {
    if (replyToUrl) {
      console.log(`   📍 Navigating to: ${replyToUrl}`);
      await page.goto(replyToUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      
      // Click reply button
      const replyBtn = page.locator('[data-testid="reply"]').first();
      await replyBtn.click();
      await page.waitForTimeout(2000);
    } else {
      console.log(`   📍 Navigating to home`);
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      
      // Click compose button
      const composeBtn = page.locator('[data-testid="SideNav_NewTweet_Button"]').first();
      await composeBtn.click();
      await page.waitForTimeout(2000);
    }
    
    // Write text
    console.log(`   ✍️  Writing text (${text.length} chars)...`);
    const textbox = page.locator('[data-testid="tweetTextarea_0"]').first();
    await textbox.click();
    await textbox.fill(text);
    await page.waitForTimeout(1500);
    
    // Publish
    console.log(`   📤 Publishing...`);
    const submitBtn = page.locator('[data-testid="tweetButtonInline"], [data-testid="tweetButton"]').first();
    await submitBtn.click({ force: true });
    await page.waitForTimeout(5000);
    
    // Navigate to profile to get the latest tweet URL
    console.log(`   🔍 Getting tweet URL from profile...`);
    
    let tweetUrl = null;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      await page.goto(`https://x.com/${ACCOUNT.name}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      
      // Get the first tweet (most recent)
      const firstTweet = page.locator('article a[href*="/status/"]').first();
      const href = await firstTweet.getAttribute('href');
      const newUrl = `https://x.com${href}`;
      
      // Check if it's a new tweet (different from last one)
      if (!lastUrl || newUrl !== lastUrl) {
        tweetUrl = newUrl;
        console.log(`   🔗 Tweet URL: ${tweetUrl}`);
        break;
      }
      
      attempts++;
      console.log(`   ⏳ Waiting for profile to update (attempt ${attempts}/${maxAttempts})...`);
      await page.waitForTimeout(3000);
    }
    
    if (!tweetUrl) {
      throw new Error('Could not get tweet URL after multiple attempts');
    }
    
    return tweetUrl;
    
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
  console.log('║  🧵 Simple Thread Publisher (3 tweets)                        ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  const browser = await chromium.launch({ headless: false }); // headless: false para ver qué pasa
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
  
  let lastUrl = null;
  
  for (let i = 0; i < TWEETS.length; i++) {
    console.log(`\n━━━ Tweet ${i + 1}/${TWEETS.length} ━━━`);
    console.log(`💬 ${TWEETS[i].substring(0, 60)}...`);
    
    try {
      lastUrl = await publishTweet(page, TWEETS[i], lastUrl, lastUrl);
      console.log(`   ✅ Published successfully`);
      
      if (i < TWEETS.length - 1) {
        console.log(`   ⏳ Waiting 3 seconds...`);
        await page.waitForTimeout(3000);
      }
    } catch (error) {
      console.error(`\n❌ Failed at tweet ${i + 1}`);
      break;
    }
  }
  
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ Thread Published                                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  await browser.close();
})();
