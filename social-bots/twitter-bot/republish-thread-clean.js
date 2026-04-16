#!/usr/bin/env node
/**
 * Borra el hilo actual y lo republica correctamente ordenado
 */

const { chromium } = require('playwright');

const ACCOUNT = {
  name: 'juanjomir',
  auth_token: '7d03ee0fecd4c19cff2c4bf6c12c233683858dad',
  ct0: '',
};

// IDs de los tweets a borrar (del hilo desordenado)
const TWEETS_TO_DELETE = [
  '2044460978327244866', // Tweet 1
  '2044507707688841395', // Tweet 2
  '2044508792662958350', // Tweet 5
  '2044508870173724672', // Tweet 6
  '2044508947583762889', // Tweet 7
  '2044509025031585817', // Tweet 8
  '2044509102596899238', // Tweet 9
  '2044509733093011528', // Tweet 3
  '2044509812046651511', // Tweet 4
  '2044510593046896479', // Tweet 10
];

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

async function deleteTweet(page, tweetId) {
  try {
    await page.goto(`https://x.com/i/status/${tweetId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    const moreBtn = page.locator('[data-testid="caret"]').first();
    await moreBtn.click();
    await page.waitForTimeout(1000);
    
    const deleteBtn = page.locator('[data-testid="Dropdown"] [role="menuitem"]').filter({ hasText: /Delete/i }).first();
    await deleteBtn.click();
    await page.waitForTimeout(1000);
    
    const confirmBtn = page.locator('[data-testid="confirmationSheetConfirm"]').first();
    await confirmBtn.click();
    await page.waitForTimeout(2000);
    
    return true;
  } catch (error) {
    return false;
  }
}

async function publishTweet(page, text, replyToId = null) {
  try {
    if (replyToId) {
      await page.goto(`https://x.com/i/status/${replyToId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      
      const replyBtn = page.locator('[data-testid="reply"]').first();
      await replyBtn.click();
      await page.waitForTimeout(2000);
    } else {
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      
      const composeBtn = page.locator('[data-testid="SideNav_NewTweet_Button"]').first();
      await composeBtn.click();
      await page.waitForTimeout(2000);
    }
    
    const textbox = page.locator('[data-testid="tweetTextarea_0"]').first();
    await textbox.click();
    await textbox.fill(text);
    await page.waitForTimeout(1500);
    
    const submitBtn = page.locator('[data-testid="tweetButton"]').first();
    await submitBtn.click({ force: true });
    await page.waitForTimeout(5000);
    
    await page.goto(`https://x.com/${ACCOUNT.name}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    const firstTweetLink = page.locator('article a[href*="/status/"]').first();
    const href = await firstTweetLink.getAttribute('href');
    const match = href.match(/status\/(\d+)/);
    
    if (match) {
      return match[1];
    }
    
    throw new Error('Could not find tweet in profile');
  } catch (error) {
    throw error;
  }
}

(async () => {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  🔄 Republish Thread (Clean)                                  ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
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
  
  // Step 1: Delete old tweets
  console.log('🗑️  Step 1: Deleting old tweets...\n');
  let deleted = 0;
  for (const tweetId of TWEETS_TO_DELETE) {
    process.stdout.write(`   Deleting ${tweetId}... `);
    const success = await deleteTweet(page, tweetId);
    if (success) {
      console.log('✅');
      deleted++;
    } else {
      console.log('⚠️  (may not exist)');
    }
    await page.waitForTimeout(1000);
  }
  console.log(`\n   Deleted: ${deleted}/${TWEETS_TO_DELETE.length}\n`);
  
  // Step 2: Publish new thread
  console.log('📝 Step 2: Publishing new thread...\n');
  let lastTweetId = null;
  const publishedIds = [];
  
  for (let i = 0; i < TWEETS.length; i++) {
    console.log(`━━━ Tweet ${i + 1}/${TWEETS.length} ━━━`);
    console.log(`💬 ${TWEETS[i].substring(0, 60)}...`);
    
    try {
      lastTweetId = await publishTweet(page, TWEETS[i], lastTweetId);
      publishedIds.push(lastTweetId);
      console.log(`✅ Published (ID: ${lastTweetId})\n`);
      
      if (i < TWEETS.length - 1) {
        await page.waitForTimeout(3000);
      }
    } catch (error) {
      console.error(`❌ Failed: ${error.message}\n`);
      break;
    }
  }
  
  await browser.close();
  
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ Completed                                                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`📊 Published: ${publishedIds.length}/10`);
  if (publishedIds.length > 0) {
    console.log(`🔗 Thread: https://x.com/${ACCOUNT.name}/status/${publishedIds[0]}\n`);
  }
})();
