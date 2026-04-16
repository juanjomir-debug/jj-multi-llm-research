#!/usr/bin/env node
/**
 * Publica hilos usando la API de Twitter (v2)
 * Requiere: npm install twitter-api-v2
 */

const { TwitterApi } = require('twitter-api-v2');
const fs = require('fs');

require('dotenv').config();

// Credenciales de la API de Twitter
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

const rwClient = client.readWrite;

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

async function publishThread(tweets) {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  🧵 Twitter Thread Publisher (API)                            ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`📊 Tweets to publish: ${tweets.length}\n`);
  
  let lastTweetId = null;
  
  for (let i = 0; i < tweets.length; i++) {
    const tweet = tweets[i];
    
    console.log(`\n━━━ Tweet ${i + 1}/${tweets.length} ━━━`);
    console.log(`💬 ${tweet.substring(0, 60)}...`);
    console.log(`📏 Length: ${tweet.length} chars`);
    
    try {
      const params = { text: tweet };
      
      if (lastTweetId) {
        params.reply = { in_reply_to_tweet_id: lastTweetId };
        console.log(`   🔗 Replying to: ${lastTweetId}`);
      }
      
      const result = await rwClient.v2.tweet(params);
      lastTweetId = result.data.id;
      
      console.log(`   ✅ Published successfully`);
      console.log(`   🆔 Tweet ID: ${lastTweetId}`);
      console.log(`   🔗 URL: https://x.com/i/status/${lastTweetId}`);
      
      // Wait between tweets
      if (i < tweets.length - 1) {
        console.log(`   ⏳ Waiting 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      if (error.data) {
        console.error(`   📄 Details:`, JSON.stringify(error.data, null, 2));
      }
      throw error;
    }
  }
  
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ Thread Published Successfully                             ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`🔗 View thread: https://x.com/i/status/${lastTweetId}\n`);
}

// Check if API credentials are configured
if (!process.env.TWITTER_API_KEY) {
  console.error('\n❌ Twitter API credentials not found in .env file!');
  console.error('\nMake sure you have these variables in your .env:');
  console.error('   - TWITTER_API_KEY');
  console.error('   - TWITTER_API_SECRET');
  console.error('   - TWITTER_ACCESS_TOKEN');
  console.error('   - TWITTER_ACCESS_SECRET\n');
  process.exit(1);
}

console.log('✅ API credentials loaded from .env\n');

publishThread(TWEETS).catch(console.error);
