#!/usr/bin/env node
/**
 * Bot de engagement híbrido:
 * - API de Twitter para buscar tweets (rápido y confiable)
 * - Playwright para publicar respuestas (funciona sin Elevated access)
 */

const { TwitterApi } = require('twitter-api-v2');
const { chromium } = require('playwright');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
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
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ACCOUNT = {
  name: 'juanjomir',
  auth_token: '7d03ee0fecd4c19cff2c4bf6c12c233683858dad',
};

const CONFIG = {
  keywords: [
    'AI models comparison',
    'ChatGPT vs Claude',
    'LLM reliability',
    'prompt engineering'
  ],
  maxRepliesPerRun: 5,
  minRelevanceScore: 7,
};

async function searchTweetsAPI(keyword) {
  console.log(`🔍 Searching via API: "${keyword}"`);
  
  try {
    const result = await twitterClient.v2.search(keyword, {
      max_results: 10,
      'tweet.fields': ['public_metrics', 'created_at', 'author_id'],
      'user.fields': ['username'],
      expansions: ['author_id']
    });
    
    const tweets = [];
    for await (const tweet of result) {
      const author = result.includes.users.find(u => u.id === tweet.author_id);
      tweets.push({
        id: tweet.id,
        text: tweet.text,
        author: author?.username || 'unknown',
        likes: tweet.public_metrics.like_count,
        replies: tweet.public_metrics.reply_count,
        url: `https://x.com/${author?.username}/status/${tweet.id}`
      });
    }
    
    console.log(`   ✅ Found ${tweets.length} tweets via API\n`);
    return tweets;
    
  } catch (error) {
    console.error(`   ❌ API Error: ${error.message}\n`);
    return [];
  }
}

async function analyzeTweetRelevance(tweet) {
  const prompt = `Analyze this tweet for AI/LLM discussion relevance:

Author: @${tweet.author}
Text: ${tweet.text}
Engagement: ${tweet.likes} likes, ${tweet.replies} replies

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
    return { relevant: false, shouldEngage: false, relevanceScore: 0, isCurrentEvent: false, topicCategory: 'general' };
  }
}

async function generateResponse(tweet, analysis) {
  const philosophyMessages = [
    "Model disagreement is signal, not noise",
    "It depends on which model you ask",
    "AI needs an epistemic layer",
    "Single-model = hidden risk"
  ];
  
  const randomPhilosophy = philosophyMessages[Math.floor(Math.random() * philosophyMessages.length)];
  
  let systemPrompt = `You are @juanjomir, an AI expert with strong opinions.

CRITICAL: Generate HIGH-ENGAGEMENT responses that provoke likes/replies.
Be POLARIZING and PROVOCATIVE to generate discussion.

Style: Bold, data-driven, provocative, opinionated
Max 280 chars, English only

Response type: ${analysis.responseType}
Angle: ${analysis.suggestedAngle}`;

  if (analysis.responseType === 'philosophy') {
    systemPrompt += `\n\nIncorporate: "${randomPhilosophy}" with a concrete example.`;
  }
  
  if (analysis.responseType === 'mention') {
    systemPrompt += `\n\nMention @AiReliable naturally if it adds value.`;
  }
  
  if (analysis.responseType === 'link') {
    systemPrompt += `\n\nInclude https://reliableai.net and @AiReliable as a solution.`;
  }

  try {
    // Use Grok for current events/news (has real-time X access)
    // Use GPT-4o for technical/philosophical discussions
    let response;
    
    if (analysis.isCurrentEvent || analysis.topicCategory === 'news') {
      console.log('      🤖 Using Grok (real-time X access)');
      response = await grok.chat.completions.create({
        model: 'grok-2-1212',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Tweet: @${tweet.author}: ${tweet.text}\n\nGenerate engaging response with current context.` }
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
          { role: 'user', content: `Tweet: @${tweet.author}: ${tweet.text}\n\nGenerate engaging response.` }
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
  console.log('║  🤖 Hybrid Engagement Bot (API + Playwright)                  ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  const allCandidates = [];
  
  // Step 1: Search via API (fast)
  for (const keyword of CONFIG.keywords) {
    const tweets = await searchTweetsAPI(keyword);
    
    const filtered = tweets.filter(t => 
      t.likes >= 2 &&
      t.author !== ACCOUNT.name &&
      t.text.length > 50
    );
    
    console.log(`   Filtered: ${filtered.length} quality tweets\n`);
    
    for (const tweet of filtered.slice(0, 3)) {
      console.log(`   📊 Analyzing: @${tweet.author}`);
      
      const analysis = await analyzeTweetRelevance(tweet);
      
      if (analysis.shouldEngage && analysis.relevanceScore >= CONFIG.minRelevanceScore) {
        console.log(`      ✅ Relevant (${analysis.relevanceScore}/10)`);
        
        const draft = await generateResponse(tweet, analysis);
        
        if (draft) {
          allCandidates.push({ tweet, analysis, draft });
          console.log(`      💬 ${draft.substring(0, 60)}...\n`);
        }
      } else {
        console.log(`      ⏭️  Skipped (${analysis.relevanceScore}/10)\n`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  allCandidates.sort((a, b) => {
    const scoreA = a.analysis.relevanceScore + (a.tweet.replies * 0.5);
    const scoreB = b.analysis.relevanceScore + (b.tweet.replies * 0.5);
    return scoreB - scoreA;
  });
  
  const toPublish = allCandidates.slice(0, CONFIG.maxRepliesPerRun);
  
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  📤 Publishing Responses (Playwright)                         ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`📊 Publishing ${toPublish.length} responses\n`);
  
  // Step 2: Publish via Playwright
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  });
  
  await context.addCookies([
    { name: 'auth_token', value: ACCOUNT.auth_token, domain: '.x.com', path: '/', secure: true, httpOnly: true }
  ]);
  
  const page = await context.newPage();
  
  let published = 0;
  
  for (let i = 0; i < toPublish.length; i++) {
    const c = toPublish[i];
    
    console.log(`\n━━━ ${i + 1}/${toPublish.length} ━━━`);
    console.log(`👤 @${c.tweet.author} (${c.analysis.relevanceScore}/10)`);
    console.log(`📊 ${c.tweet.likes} likes, ${c.tweet.replies} replies`);
    console.log(`💬 ${c.draft}`);
    console.log(`🔗 ${c.tweet.url}\n`);
    
    const success = await publishReplyPlaywright(page, c.tweet.id, c.draft);
    
    if (success) {
      published++;
      console.log('✅ Published\n');
      
      if (i < toPublish.length - 1) {
        console.log(`⏳ Waiting 3 minutes...\n`);
        await new Promise(resolve => setTimeout(resolve, 3 * 60 * 1000));
      }
    } else {
      console.log('❌ Failed\n');
    }
  }
  
  await browser.close();
  
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ Completed                                                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`📊 Published: ${published}/${toPublish.length}\n`);
}

main().catch(console.error);
