#!/usr/bin/env node
/**
 * Publica el tweet 10 usando API v2
 */

const { TwitterApi } = require('twitter-api-v2');
require('dotenv').config();

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

const rwClient = client.readWrite;

const TWEET_9_ID = '2044516220364300652';
const TWEET_10_TEXT = `10/ Read the full analysis with data, charts, and insights:

https://blog.reliableai.net/ai-won-t-kill-jobs-it-will-kill-your-job/

Research by @AiReliable using 5 AI models.

#AI #FutureOfWork #Employment`;

(async () => {
  console.log('\n📤 Publishing tweet 10 (API v2)...\n');
  
  try {
    // Usar API v2
    const result = await rwClient.v2.tweet({
      text: TWEET_10_TEXT,
      reply: {
        in_reply_to_tweet_id: TWEET_9_ID
      }
    });
    
    console.log('✅ Tweet 10 published successfully!');
    console.log(`🆔 Tweet ID: ${result.data.id}`);
    console.log(`🔗 URL: https://x.com/i/status/${result.data.id}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.data) {
      console.error('Details:', JSON.stringify(error.data, null, 2));
    }
  }
})();
