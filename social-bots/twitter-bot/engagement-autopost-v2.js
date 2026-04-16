#!/usr/bin/env node
/**
 * Auto-post v2 - Usa tweet-playwright.js que ya funciona
 */

const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const grok = new OpenAI({ 
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1'
});
const gemini = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const CONFIG = {
  account: 'juanjomir',
  auth_token: '7d03ee0fecd4c19cff2c4bf6c12c233683858dad',
  
  keywords: [
    'AI models comparison',
    'ChatGPT vs Claude', 
    'GPT-4 Claude Gemini',
    'LLM hallucination',
    'AI reliability',
    'prompt engineering tips',
    'enterprise AI',
    'AI benchmarks',
    'multi-agent AI',
    'AI fact checking'
  ],
  
  minLikes: 2,
  minRelevanceScore: 6,
  maxRepliesPerRun: 5,
  delayBetweenReplies: 3 * 60 * 1000,
};

async function searchTweets(keyword) {
  console.log(`🔍 Searching: "${keyword}"`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  
  await context.addCookies([
    { name: 'auth_token', value: CONFIG.auth_token, domain: '.x.com', path: '/', secure: true, httpOnly: true }
  ]);
  
  const page = await context.newPage();
  
  try {
    const searchUrl = `https://x.com/search?q=${encodeURIComponent(keyword)}&src=typed_query&f=live`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    const tweets = await page.evaluate(() => {
      const articles = Array.from(document.querySelectorAll('article'));
      return articles.slice(0, 15).map(article => {
        try {
          const textEl = article.querySelector('[data-testid="tweetText"]');
          const text = textEl ? textEl.innerText : '';
          
          const authorEl = article.querySelector('[data-testid="User-Name"] a');
          const authorHandle = authorEl ? authorEl.href.split('/').pop() : '';
          
          const linkEl = article.querySelector('a[href*="/status/"]');
          const tweetUrl = linkEl ? linkEl.href : '';
          const tweetId = tweetUrl.split('/status/')[1]?.split('?')[0];
          
          const metricsEls = article.querySelectorAll('[role="group"] [data-testid]');
          let likes = 0, replies = 0;
          
          metricsEls.forEach(el => {
            const text = el.innerText;
            const num = parseInt(text.replace(/[^0-9]/g, '')) || 0;
            if (el.getAttribute('data-testid')?.includes('like')) likes = num;
            if (el.getAttribute('data-testid')?.includes('reply')) replies = num;
          });
          
          // Extraer respuestas previas del hilo
          const threadContext = [];
          const parentArticles = article.querySelectorAll('article');
          parentArticles.forEach(a => {
            const t = a.querySelector('[data-testid="tweetText"]');
            if (t && t.innerText) threadContext.push(t.innerText);
          });
          
          return { 
            id: tweetId, 
            url: tweetUrl, 
            author: authorHandle, 
            text: text.substring(0, 500), 
            likes, 
            replies,
            threadContext: threadContext.slice(0, 3) // últimas 3 respuestas
          };
        } catch (e) {
          return null;
        }
      }).filter(t => t && t.id);
    });
    
    await browser.close();
    return tweets;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await browser.close();
    return [];
  }
}

async function analyzeTweetRelevance(tweet) {
  const threadInfo = tweet.threadContext.length > 0 
    ? `\n\nThread context (previous replies):\n${tweet.threadContext.join('\n---\n')}`
    : '';
    
  const prompt = `Analyze this tweet:
Author: @${tweet.author}
Text: ${tweet.text}
Likes: ${tweet.likes} | Replies: ${tweet.replies}${threadInfo}

Is it relevant for AI/LLM discussion? Score 0-10.

Determine if this is about CURRENT EVENTS (news, recent developments, breaking stories) or TECHNICAL/PHILOSOPHICAL discussion.

Respond in JSON: {
  "relevant": true/false, 
  "relevanceScore": 0-10, 
  "reason": "...", 
  "responseType": "value"|"philosophy"|"mention"|"link", 
  "suggestedAngle": "...", 
  "shouldEngage": true/false,
  "isCurrentEvent": true/false,
  "needsRealTimeData": true/false
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
    return { relevant: false, shouldEngage: false, relevanceScore: 0, isCurrentEvent: false };
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
  
  const threadInfo = tweet.threadContext.length > 0 
    ? `\n\nPrevious replies in thread:\n${tweet.threadContext.join('\n---\n')}\n\nYour response should BUILD ON this conversation, not repeat what's already said.`
    : '';
  
  let systemPrompt = `You are @juanjomir, an AI expert with strong opinions and real experience.

CRITICAL: Your response MUST generate engagement (likes/replies). Use these tactics:
- Share a SPECIFIC personal experience or concrete data point
- Ask a thought-provoking question
- Challenge conventional wisdom boldly
- Use a surprising statistic or insight
- Create a mini-story or scenario
- End with an open question when appropriate
- Take a clear stance - polarizing opinions get more engagement

Style: Conversational, bold, data-driven, provocative, opinionated
Max 280 chars, English only

Response type: ${analysis.responseType}
Angle: ${analysis.suggestedAngle}${threadInfo}

EXAMPLES OF HIGH-ENGAGEMENT RESPONSES:
❌ BAD: "I agree, AI models are getting better"
✅ GOOD: "Ran the same legal query through 4 models last week. GPT-4 said 'low risk', Claude said 'high risk'. The clause GPT missed? $50K liability. Which one would you trust?"

❌ BAD: "Model comparison is important"
✅ GOOD: "Hot take: comparing models manually is like checking your math by doing it twice the same way. You need different approaches, not just different models. What's your verification strategy?"

❌ BAD: "Interesting point about AI reliability"
✅ GOOD: "This. I've seen 3 companies get burned by single-model decisions this quarter. The pattern? They all trusted the most confident answer. Confidence ≠ correctness. How do you validate?"

Don't be afraid to disagree or challenge the original tweet if you have a strong counterpoint.`;

  if (analysis.responseType === 'philosophy') {
    systemPrompt += `\n\nIncorporate this philosophy: "${randomPhilosophy}" - but make it concrete with an example.`;
  }
  
  if (analysis.responseType === 'mention') {
    systemPrompt += `\n\nMention @AiReliable naturally if it adds value to the story.`;
  }
  
  if (analysis.responseType === 'link') {
    systemPrompt += `\n\nInclude https://reliableai.net and @AiReliable but frame it as a solution to a real problem you're describing.`;
  }

  const userPrompt = `Tweet: @${tweet.author}: ${tweet.text}

Generate a HIGH-ENGAGEMENT response in English that:
1. Builds on the conversation naturally
2. Adds unique value (data, experience, or insight)
3. Invites further discussion
4. Makes people want to like or reply`;

  try {
    let response;
    
    // Usar Grok o Gemini para temas de actualidad
    if (analysis.isCurrentEvent || analysis.needsRealTimeData) {
      console.log(`      🌐 Using Grok (current event)`);
      
      response = await grok.chat.completions.create({
        model: 'grok-2-1212',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 120
      });
      
      return response.choices[0].message.content.trim();
    } else {
      // Usar GPT-4o para temas técnicos/filosóficos
      response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 120
      });
      
      return response.choices[0].message.content.trim();
    }
  } catch (error) {
    console.error(`      ⚠️  Error generating response: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  🤖 Twitter Auto-Post v2                                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  const allCandidates = [];
  
  for (const keyword of CONFIG.keywords) {
    const tweets = await searchTweets(keyword);
    console.log(`   Found: ${tweets.length} tweets\n`);
    
    const filtered = tweets.filter(t => 
      t.likes >= CONFIG.minLikes &&
      t.author !== CONFIG.account &&
      !t.author.includes('bot') &&
      t.text.length > 50 &&
      t.text.length < 1000
    );
    
    console.log(`   Filtered: ${filtered.length} quality tweets\n`);
    
    for (const tweet of filtered.slice(0, 5)) {
      console.log(`   📊 Analyzing: @${tweet.author}`);
      
      const analysis = await analyzeTweetRelevance(tweet);
      
      if (analysis.shouldEngage && analysis.relevanceScore >= CONFIG.minRelevanceScore) {
        console.log(`      ✅ Relevant (${analysis.relevanceScore}/10)${analysis.isCurrentEvent ? ' [CURRENT EVENT]' : ''}`);
        
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
    // Priorizar por potencial de engagement
    const scoreA = a.analysis.relevanceScore + (a.tweet.replies * 0.5) + (a.tweet.likes * 0.1);
    const scoreB = b.analysis.relevanceScore + (b.tweet.replies * 0.5) + (b.tweet.likes * 0.1);
    return scoreB - scoreA;
  });
  
  const toPublish = allCandidates.slice(0, CONFIG.maxRepliesPerRun);
  
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  📤 Publishing Responses                                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`📊 Publishing ${toPublish.length} responses\n`);
  
  const log = [];
  let published = 0;
  
  for (let i = 0; i < toPublish.length; i++) {
    const c = toPublish[i];
    
    console.log(`\n━━━ ${i + 1}/${toPublish.length} ━━━`);
    console.log(`👤 @${c.tweet.author} (${c.analysis.relevanceScore}/10)`);
    console.log(`📊 ${c.tweet.likes} likes, ${c.tweet.replies} replies`);
    console.log(`💬 ${c.draft}`);
    console.log(`🔗 ${c.tweet.url}\n`);
    
    try {
      // Usar tweet-playwright.js que ya funciona
      const cmd = `node twitter-bot/tweet-playwright.js --account ${CONFIG.account} --reply ${c.tweet.id} --text "${c.draft.replace(/"/g, '\\"')}"`;
      execSync(cmd, { stdio: 'inherit' });
      
      published++;
      log.push({
        tweet: c.tweet.url,
        author: c.tweet.author,
        originalText: c.tweet.text.substring(0, 200),
        responseText: c.draft,
        type: c.analysis.responseType,
        score: c.analysis.relevanceScore,
        isCurrentEvent: c.analysis.isCurrentEvent || false,
        modelUsed: (c.analysis.isCurrentEvent || c.analysis.needsRealTimeData) ? 'grok' : 'gpt-4o',
        timestamp: new Date().toISOString()
      });
      
      console.log('✅ Published\n');
      
      if (i < toPublish.length - 1) {
        console.log(`⏳ Waiting 3 minutes...\n`);
        await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenReplies));
      }
    } catch (error) {
      console.error('❌ Failed\n');
    }
  }
  
  const logFile = `engagement-log-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
  
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ Completed                                                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`📊 Published: ${published}/${toPublish.length}`);
  console.log(`📄 Log: ${logFile}\n`);
}

main().catch(console.error);
