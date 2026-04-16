#!/usr/bin/env node
/**
 * Test del bot de engagement - publica solo 1 respuesta
 */

const { TwitterApi } = require('twitter-api-v2');
const { chromium } = require('playwright');
const OpenAI = require('openai');
require('dotenv').config();

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const grok = new OpenAI({ 
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1'
});

const ACCOUNT = {
  name: 'juanjomir',
  auth_token: '7d03ee0fecd4c19cff2c4bf6c12c233683858dad',
};

async function searchTweetsAPI(keyword) {
  console.log(`🔍 Searching: "${keyword}"`);
  
  try {
    const result = await twitterClient.v2.search(keyword, { max_results: 10 });
    
    const tweets = [];
    for await (const tweet of result) {
      tweets.push({
        id: tweet.id,
        text: tweet.text,
        author: tweet.author_id,
        url: `https://x.com/i/status/${tweet.id}`
      });
    }
    
    console.log(`   ✅ Found ${tweets.length} tweets\n`);
    return tweets;
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}\n`);
    return [];
  }
}

async function analyzeTweetRelevance(tweet) {
  const prompt = `Analyze this tweet for AI/LLM discussion relevance:

Text: ${tweet.text}

Score 0-10 for relevance. Respond in JSON:
{
  "relevant": true/false,
  "relevanceScore": 0-10,
  "reason": "...",
  "responseType": "value"|"philosophy"|"mention"|"link",
  "suggestedAngle": "...",
  "shouldEngage": true/false,
  "isCurrentEvent": true/false,
  "topicCategory": "news"|"technical"|"philosophical"|"general"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });
    
    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    return { relevant: false, shouldEngage: false, relevanceScore: 0 };
  }
}

async function generateResponse(tweet, analysis) {
  const systemPrompt = `You are @juanjomir, an AI expert with strong opinions.

CRITICAL: Generate HIGH-ENGAGEMENT responses that provoke likes/replies.
Be POLARIZING and PROVOCATIVE to generate discussion.

Style: Bold, data-driven, provocative, opinionated
Max 280 chars, English only

Response type: ${analysis.responseType}
Angle: ${analysis.suggestedAngle}`;

  try {
    let response;
    
    if (analysis.isCurrentEvent || analysis.topicCategory === 'news') {
      console.log('      🤖 Using Grok (real-time X access)');
      response = await grok.chat.completions.create({
        model: 'grok-2-1212',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Tweet: ${tweet.text}\n\nGenerate engaging response.` }
        ],
        temperature: 0.8,
        max_tokens: 120
      });
    } else {
      console.log('      🤖 Using GPT-4o (technical/philosophical)');
      response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Tweet: ${tweet.text}\n\nGenerate engaging response.` }
        ],
        temperature: 0.8,
        max_tokens: 120
      });
    }
    
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error(`      ⚠️  Generation error: ${error.message}`);
    return null;
  }
}

async function publishReplyPlaywright(page, tweetId, text) {
  try {
    await page.goto(`https://x.com/i/status/${tweetId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    const replyBtn = page.locator('[data-testid="reply"]').first();
    await replyBtn.click();
    await page.waitForTimeout(2000);
    
    const textbox = page.locator('[data-testid="tweetTextarea_0"]').first();
    await textbox.click();
    await textbox.fill(text);
    await page.waitForTimeout(1500);
    
    const submitBtn = page.locator('[data-testid="tweetButton"]').first();
    await submitBtn.click({ force: true });
    await page.waitForTimeout(5000);
    
    return true;
  } catch (error) {
    console.error(`      ⚠️  Playwright error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  🧪 Test Engagement Bot (1 respuesta)                        ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  // Buscar tweets
  const tweets = await searchTweetsAPI('ChatGPT vs Claude');
  
  if (tweets.length === 0) {
    console.log('❌ No se encontraron tweets\n');
    return;
  }
  
  // Analizar primer tweet
  console.log('📊 Analizando primer tweet...\n');
  const tweet = tweets[0];
  const analysis = await analyzeTweetRelevance(tweet);
  
  console.log(`   Relevancia: ${analysis.relevanceScore}/10`);
  console.log(`   Categoría: ${analysis.topicCategory}`);
  console.log(`   Current event: ${analysis.isCurrentEvent}`);
  console.log(`   Should engage: ${analysis.shouldEngage}\n`);
  
  if (!analysis.shouldEngage || analysis.relevanceScore < 7) {
    console.log('⏭️  Tweet no relevante, buscando otro...\n');
    return;
  }
  
  // Generar respuesta
  console.log('💬 Generando respuesta...\n');
  const draft = await generateResponse(tweet, analysis);
  
  if (!draft) {
    console.log('❌ No se pudo generar respuesta\n');
    return;
  }
  
  console.log('📝 Respuesta generada:');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(draft);
  console.log('─────────────────────────────────────────────────────────────────\n');
  console.log(`🔗 Tweet original: ${tweet.url}\n`);
  
  // Publicar con Playwright
  console.log('📤 Publicando respuesta...\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  });
  
  await context.addCookies([
    { name: 'auth_token', value: ACCOUNT.auth_token, domain: '.x.com', path: '/', secure: true, httpOnly: true }
  ]);
  
  const page = await context.newPage();
  
  const success = await publishReplyPlaywright(page, tweet.id, draft);
  
  await browser.close();
  
  if (success) {
    console.log('✅ Respuesta publicada exitosamente!\n');
  } else {
    console.log('❌ Error al publicar respuesta\n');
  }
}

main().catch(console.error);
