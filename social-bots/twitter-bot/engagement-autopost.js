#!/usr/bin/env node
/**
 * Auto-post engagement responses without manual review
 * Finds candidates, analyzes, and publishes automatically
 */

const { chromium } = require('playwright');
const fs = require('fs');
const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CONFIG = {
  account: 'juanjomir',
  auth_token: '7d03ee0fecd4c19cff2c4bf6c12c233683858dad',
  ct0: '',
  
  keywords: [
    'ChatGPT vs Claude',
    'GPT-4 vs Claude',
    'Gemini vs ChatGPT',
    'LLM comparison',
    'AI hallucination',
    'AI reliability',
    'prompt engineering',
    'AI models',
    'enterprise AI'
  ],
  
  minLikes: 5,  // Más permisivo para encontrar más candidatos
  minRelevanceScore: 6,
  maxRepliesPerRun: 5,
  delayBetweenReplies: 3 * 60 * 1000,
};

// Buscar tweets
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
      return articles.slice(0, 10).map(article => {
        try {
          const textEl = article.querySelector('[data-testid="tweetText"]');
          const text = textEl ? textEl.innerText : '';
          
          const authorEl = article.querySelector('[data-testid="User-Name"] a');
          const authorHandle = authorEl ? authorEl.href.split('/').pop() : '';
          
          const linkEl = article.querySelector('a[href*="/status/"]');
          const tweetUrl = linkEl ? linkEl.href : '';
          const tweetId = tweetUrl.split('/status/')[1]?.split('?')[0];
          
          const metricsEls = article.querySelectorAll('[role="group"] [data-testid]');
          let likes = 0;
          
          metricsEls.forEach(el => {
            const text = el.innerText;
            const num = parseInt(text.replace(/[^0-9]/g, '')) || 0;
            if (el.getAttribute('data-testid')?.includes('like')) likes = num;
          });
          
          return { id: tweetId, url: tweetUrl, author: authorHandle, text: text.substring(0, 500), likes };
        } catch (e) {
          return null;
        }
      }).filter(t => t && t.id);
    });
    
    await browser.close();
    return tweets;
    
  } catch (error) {
    console.error('❌ Error searching:', error.message);
    await browser.close();
    return [];
  }
}

// Analizar relevancia
async function analyzeTweetRelevance(tweet) {
  const prompt = `Analyze this tweet and determine:
1. Is it relevant for someone working with multiple AI models?
2. What type of response would be most appropriate?

Tweet:
Author: @${tweet.author}
Text: ${tweet.text}
Engagement: ${tweet.likes} likes

Respond in JSON:
{
  "relevant": true/false,
  "relevanceScore": 0-10,
  "reason": "brief explanation",
  "responseType": "value" | "philosophy" | "mention" | "link",
  "suggestedAngle": "what angle to use",
  "shouldEngage": true/false
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
    console.error('❌ Error analyzing:', error.message);
    return { relevant: false, shouldEngage: false, relevanceScore: 0 };
  }
}

// Generar respuesta
async function generateResponse(tweet, analysis) {
  const philosophyMessages = [
    "Model disagreement is signal, not noise",
    "It depends on which model you ask",
    "AI needs an epistemic layer",
    "Single-model = hidden risk",
    "Consensus can be misleading"
  ];
  
  const randomPhilosophy = philosophyMessages[Math.floor(Math.random() * philosophyMessages.length)];
  
  let systemPrompt = `You are @juanjomir, an AI expert who works with multiple models.

Style:
- Conversational and genuine
- Provide value with concrete data
- Don't use promotional language
- Maximum 280 characters
- Use emojis sparingly (max 1-2)
- ALWAYS respond in English

Response type: ${analysis.responseType}
Suggested angle: ${analysis.suggestedAngle}`;

  if (analysis.responseType === 'philosophy') {
    systemPrompt += `\n\nNaturally incorporate: "${randomPhilosophy}"`;
  }
  
  if (analysis.responseType === 'mention') {
    systemPrompt += `\n\nYou can mention @AiReliable if it adds real value.`;
  }
  
  if (analysis.responseType === 'link') {
    systemPrompt += `\n\nInclude https://reliableai.app if appropriate. Mention @AiReliable.`;
  }

  const userPrompt = `Original tweet:
@${tweet.author}: ${tweet.text}

Generate a response that provides value and sparks conversation.
IMPORTANT: Response must be in English.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 100
    });
    
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('❌ Error generating response:', error.message);
    return null;
  }
}

// Publicar respuesta
async function publishReply(page, tweetId, text) {
  try {
    await page.goto(`https://x.com/i/status/${tweetId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForTimeout(1000);
    
    const replyBtn = page.locator('[data-testid="reply"]').first();
    await replyBtn.click();
    await page.waitForTimeout(2000);
    
    const textbox = page.locator('[data-testid="tweetTextarea_0"]').first();
    await textbox.click();
    await page.waitForTimeout(500);
    
    await textbox.type(text, { delay: 50 });
    await page.waitForTimeout(1500);
    
    await page.waitForSelector('[data-testid="tweetButtonInline"]:not([disabled])', { timeout: 10000 });
    
    const submitBtn = page.locator('[data-testid="tweetButtonInline"]').first();
    await submitBtn.click();
    await page.waitForTimeout(4000);
    
    return true;
  } catch (error) {
    console.error('❌ Error publishing:', error.message);
    return false;
  }
}

// Main
async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  🤖 Twitter Engagement Auto-Post                             ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  const allCandidates = [];
  
  // Buscar por keywords
  for (const keyword of CONFIG.keywords.slice(0, 4)) { // Buscar en 4 keywords para tener más candidatos
    const tweets = await searchTweets(keyword);
    console.log(`   Found: ${tweets.length} tweets\n`);
    
    const filtered = tweets.filter(t => 
      t.likes >= CONFIG.minLikes &&
      t.author !== CONFIG.account &&
      t.text.length > 50 // Asegurar que tenga contenido sustancial
    );
    
    console.log(`   Filtered: ${filtered.length} quality tweets\n`);
    
    for (const tweet of filtered.slice(0, 5)) { // Analizar hasta 5 por keyword
      console.log(`   📊 Analyzing: @${tweet.author}`);
      
      const analysis = await analyzeTweetRelevance(tweet);
      
      if (analysis.shouldEngage && analysis.relevanceScore >= CONFIG.minRelevanceScore) {
        console.log(`      ✅ Relevant (${analysis.relevanceScore}/10): ${analysis.reason}`);
        
        const draft = await generateResponse(tweet, analysis);
        
        if (draft) {
          allCandidates.push({ tweet, analysis, draft, timestamp: new Date().toISOString() });
          console.log(`      💬 Draft: ${draft.substring(0, 80)}...\n`);
        }
      } else {
        console.log(`      ⏭️  Skipped (${analysis.relevanceScore}/10)\n`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Ordenar por relevancia
  allCandidates.sort((a, b) => b.analysis.relevanceScore - a.analysis.relevanceScore);
  
  const toPublish = allCandidates.slice(0, CONFIG.maxRepliesPerRun);
  
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  📤 Publishing Responses                                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`📊 Total candidates: ${allCandidates.length}`);
  console.log(`🎯 Publishing top ${toPublish.length}\n`);
  
  if (toPublish.length === 0) {
    console.log('⚠️  No candidates meet quality threshold (score >= 7)\n');
    return;
  }
  
  // Iniciar navegador
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1280, height: 800 }
  });
  
  await context.addCookies([
    { name: 'auth_token', value: CONFIG.auth_token, domain: '.x.com', path: '/', secure: true, httpOnly: true }
  ]);
  
  const page = await context.newPage();
  const log = [];
  let published = 0;
  
  try {
    for (let i = 0; i < toPublish.length; i++) {
      const candidate = toPublish[i];
      
      console.log(`\n━━━ RESPONSE ${i + 1}/${toPublish.length} ━━━`);
      console.log(`👤 Author: @${candidate.tweet.author}`);
      console.log(`📊 Score: ${candidate.analysis.relevanceScore}/10`);
      console.log(`🎯 Type: ${candidate.analysis.responseType}`);
      console.log(`💬 Tweet: ${candidate.tweet.text.substring(0, 100)}...`);
      console.log(`📝 Response: ${candidate.draft}`);
      console.log(`🔗 URL: ${candidate.tweet.url}\n`);
      
      console.log('📤 Publishing...');
      
      const success = await publishReply(page, candidate.tweet.id, candidate.draft);
      
      if (success) {
        published++;
        log.push({
          action: 'reply',
          tweet: candidate.tweet.url,
          author: candidate.tweet.author,
          text: candidate.draft,
          type: candidate.analysis.responseType,
          score: candidate.analysis.relevanceScore,
          timestamp: new Date().toISOString()
        });
        console.log('✅ Published successfully\n');
        
        if (i < toPublish.length - 1) {
          const delayMin = CONFIG.delayBetweenReplies / 60000;
          console.log(`⏳ Waiting ${delayMin} minutes...\n`);
          await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenReplies));
        }
      } else {
        console.log('❌ Failed to publish\n');
      }
    }
  } finally {
    await browser.close();
  }
  
  // Guardar log
  const logFile = `engagement-autopost-log-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
  
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ Auto-Post Completed                                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`📊 Statistics:`);
  console.log(`   • Responses published: ${published}/${toPublish.length}`);
  console.log(`   • Log saved: ${logFile}\n`);
  
  if (published > 0) {
    console.log('🎉 Success! Responses are live on Twitter.\n');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
