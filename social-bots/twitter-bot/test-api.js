#!/usr/bin/env node
/**
 * Test de la API de Twitter
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

(async () => {
  console.log('\n🔍 Testing Twitter API...\n');
  
  try {
    // Test 1: Verify credentials
    console.log('1️⃣ Verifying credentials...');
    const me = await rwClient.v2.me();
    console.log(`   ✅ Authenticated as: @${me.data.username}`);
    console.log(`   📊 User ID: ${me.data.id}\n`);
    
    // Test 2: Post a test tweet
    console.log('2️⃣ Posting test tweet...');
    const tweet = await rwClient.v2.tweet('🧪 API test - please ignore');
    console.log(`   ✅ Tweet posted!`);
    console.log(`   🆔 Tweet ID: ${tweet.data.id}`);
    console.log(`   🔗 URL: https://x.com/i/status/${tweet.data.id}\n`);
    
    // Test 3: Delete the test tweet
    console.log('3️⃣ Deleting test tweet...');
    await rwClient.v2.deleteTweet(tweet.data.id);
    console.log(`   ✅ Tweet deleted\n`);
    
    console.log('✅ All tests passed! API is working correctly.\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.data) {
      console.error('Details:', JSON.stringify(error.data, null, 2));
    }
    process.exit(1);
  }
})();
