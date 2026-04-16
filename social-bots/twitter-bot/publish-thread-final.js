#!/usr/bin/env node
/**
 * Solución definitiva para publicar hilos
 * Usa Playwright pero con mejor detección de tweets publicados
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
→ The junior-to-senior pipeline is collapsing`,

  `4/ The pipeline collapse is the scariest prediction:

If AI absorbs entry-level work, you never become a senior professional.

No junior analyst jobs → No senior analysts in 10 years

This isn't automation. It's destroying the apprenticeship ladder.`,

  `5/ The stat that matters:

77% of emerging AI roles require a master's degree or equivalent.

You can't retrain millions of admin workers into ML engineers in 2-3 years.

The math doesn't work.`,

  `6/ What only ONE model mentioned:

79% of employed women in the US work in high-automation-risk positions vs 58% of men.

4.7% of women's jobs face severe AI disruption vs 2.4% for men.

This should have been raised by all of them.`,

  `7/ Winners:
• AI-fluent professionals
• Physical-skill workers (trades, healthcare)
• Early-adopter firms

Losers:
• Entry-level knowledge workers (Gen Z)
• Women in admin/support
• Workers in mid-size cities`,

  `8/ This isn't theoretical:

• Amazon: 30,000+ positions eliminated
• Salesforce: 4,000 support roles cut
• MIT study: 11.7% of jobs could be automated TODAY

The gap between "could be" and "has been" is closing fast.`,

  `9/ What to do:

Stop planning for the average. Plan for the distribution.

Audit every role for AI complementarity in the next 90 days.

Invest in skills at the intersection of AI fluency + human judgment.`,

  `10/ Full article with all the data, charts, and blind spots:

https://blog.reliableai.net/ai-won-t-kill-jobs-it-will-kill-your-job/

Produced using @AiReliable — 5 AI models researching independently.

#AI #FutureOfWork #Employment`
];

async function publishTweet(page, text, replyToId = null) {
  try {
    if (replyToId) {
      console.log(`   📍 Opening reply to tweet ${replyToId}...`);
      await page.goto(`https://x.com/i/status/${replyToId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      
      // Click reply button
      const replyBtn = page.locator('[data-testid="reply"]').first();
      await replyBtn.click();
      await page.waitForTimeout(2000);
    } else {
      console.log(`   📍 Opening compose...`);
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      
      // Click the compose button
      const composeBtn = page.locator('[data-testid="SideNav_NewTweet_Button"]').first();
      await composeBtn.click();
      await page.waitForTimeout(2000);
    }
    
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
    
    // Wait for the modal to close or page to navigate
    console.log(`   ⏳ Waiting for tweet to post...`);
    await page.waitForTimeout(5000);
    
    // Go to profile to find the tweet
    console.log(`   🔍 Checking profile for new tweet...`);
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
  console.log('║  🧵 Thread Publisher - Final Version                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`📊 Tweets: ${TWEETS.length}`);
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
  
  let lastTweetId = null;
  const publishedIds = [];
  
  for (let i = 0; i < TWEETS.length; i++) {
    console.log(`\n━━━ Tweet ${i + 1}/${TWEETS.length} ━━━`);
    console.log(`💬 ${TWEETS[i].substring(0, 60)}...`);
    
    try {
      lastTweetId = await publishTweet(page, TWEETS[i], lastTweetId);
      publishedIds.push(lastTweetId);
      
      if (i < TWEETS.length - 1) {
        console.log(`   ⏳ Waiting 3 seconds before next tweet...`);
        await page.waitForTimeout(3000);
      }
    } catch (error) {
      console.error(`\n❌ Failed at tweet ${i + 1}`);
      console.error(`Published so far: ${publishedIds.length}/${TWEETS.length}`);
      break;
    }
  }
  
  await browser.close();
  
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ Completed                                                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`📊 Published: ${publishedIds.length}/${TWEETS.length}`);
  
  if (publishedIds.length > 0) {
    console.log(`\n🔗 Thread URL: https://x.com/${ACCOUNT.name}/status/${publishedIds[0]}\n`);
    console.log(`Tweet IDs:`);
    publishedIds.forEach((id, i) => {
      console.log(`  ${i + 1}. ${id}`);
    });
  }
  
  console.log();
})();
