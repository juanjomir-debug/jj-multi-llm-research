#!/usr/bin/env node
/**
 * Enhanced engagement system for @juanjomir
 * - Prioritizes replies to our tweets
 * - Uses 25,000 character limit (Basic account)
 * - Always responds in English
 * - Adds viewpoints and insists in conversations
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
  
  // Character limits for Basic account
  maxCharsPerTweet: 25000,
  
  // Prioritization
  priorityTypes: {
    replyToOurTweet: 10,      // Highest priority
    mentionUs: 8,
    relevantConversation: 6,
    keywordMatch: 4
  },
  
  keywords: [
    'ChatGPT vs Claude',
    'GPT-4 vs Claude',
    'Gemini vs ChatGPT',
    'LLM comparison',
    'AI hallucination',
    'AI reliability',
    'prompt engineering',
    'AI models comparison',
    'enterprise AI',
    'multi-model AI'
  ],
  
  minLikes: 3,
  minRelevanceScore: 6,
  maxRepliesPerRun: 8,
  delayBetweenReplies: 2 * 60 * 1000, // 2 minutes
};

// Get our recent tweets to find replies
async function getOurRecentTweets(page) {
  console.log('📥 Fetching our recent tweets...');
  
  try {
    await page.goto(`https://x.com/${CONFIG.account}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    const tweets = await page.evaluate(() => {
      const articles = Array.from(document.querySelectorAll('article'));
      return articles.slice(0, 10).map(article => {
        try {
          const linkEl = article.querySelector('a[href*="/status/"]');
          const tweetUrl = linkEl ? linkEl.href : '';
          const tweetId = tweetUrl.split('/status/')[1]?.split('?')[0];
          
          return tweetId;
        } catch (e) {
          return null;
        }
      }).filter(id => id);
    });
    
    console.log(`   Found ${tweets.length} recent tweets\n`);
    return tweets;
  } catch (error) {
    console.error('❌ Error fetching our tweets:', error.message);
    return [];
  }
}

// Get replies to a specific tweet
async function getReplies(page, tweetId) {
  console.log(`   🔍 Checking replies to tweet ${tweetId}...`);
  
  try {
    await page.goto(`https://x.com/i/status/${tweetId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Scroll to load replies
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(2000);
    
    const replies = await page.evaluate((ourAccount) => {
      const articles = Array.from(document.querySelectorAll('article'));
      return articles.slice(1, 11).map(article => { // Skip first (original tweet)
        try {
          const textEl = article.querySelector('[data-testid="tweetText"]');
          const text = textEl ? textEl.innerText : '';
          
          const authorEl = article.querySelector('[data-testid="User-Name"] a');
          const authorHandle = authorEl ? authorEl.href.split('/').pop() : '';
          
          const linkEl = article.querySelector('a[href*="/status/"]');
          const tweetUrl = linkEl ? linkEl.href : '';
          const replyId = tweetUrl.split('/status/')[1]?.split('?')[0];
          
          // Skip our own replies
          if (authorHandle === ourAccount) return null;
          
          const metricsEls = article.querySelectorAll('[role="group"] [data-testid]');
          let likes = 0;
          
          metricsEls.forEach(el => {
            const text = el.innerText;
            const num = parseInt(text.replace(/[^0-9]/g, '')) || 0;
            if (el.getAttribute('data-testid')?.includes('like')) likes = num;
          });
          
          return { 
            id: replyId, 
            url: tweetUrl, 
            author: authorHandle, 
            text: text.substring(0, 1000), 
            likes,
            isReplyToUs: true,
            originalTweetId: tweetUrl.split('/status/')[0].split('/').pop()
          };
        } catch (e) {
          return null;
        }
      }).filter(t => t && t.id);
    }, CONFIG.account);
    
    console.log(`      Found ${replies.length} replies\n`);
    return replies;
  } catch (error) {
    console.error('❌ Error getting replies:', error.message);
    return [];
  }
}

// Search for keyword mentions
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
    
    const tweets = await page.evaluate((ourAccount) => {
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
          
          const mentionsUs = text.toLowerCase().includes('@juanjomir') || text.toLowerCase().includes('@aiReliable');
          
          return { 
            id: tweetId, 
            url: tweetUrl, 
            author: authorHandle, 
            text: text.substring(0, 1000), 
            likes,
            mentionsUs,
            isReplyToUs: false
          };
        } catch (e) {
          return null;
        }
      }).filter(t => t && t.id && t.author !== ourAccount);
    }, CONFIG.account);
    
    await browser.close();
    return tweets;
    
  } catch (error) {
    console.error('❌ Error searching:', error.message);
    await browser.close();
    return [];
  }
}

// Analyze tweet and determine response strategy
async function analyzeTweetRelevance(tweet) {
  const prompt = `Analyze this tweet for engagement potential.

Tweet:
Author: @${tweet.author}
Text: ${tweet.text}
Engagement: ${tweet.likes} likes
${tweet.isReplyToUs ? 'NOTE: This is a REPLY to one of our tweets' : ''}
${tweet.mentionsUs ? 'NOTE: This tweet MENTIONS us' : ''}

Determine:
1. Relevance to multi-model AI, LLM comparison, AI reliability
2. Best response strategy
3. Whether we should engage

Respond in JSON:
{
  "relevant": true/false,
  "relevanceScore": 0-10,
  "reason": "brief explanation",
  "responseStrategy": "agree_and_expand" | "add_perspective" | "challenge_politely" | "provide_data" | "ask_question" | "share_experience",
  "suggestedAngle": "what angle to use in response",
  "shouldEngage": true/false,
  "conversationPotential": 0-10,
  "keyPoints": ["point1", "point2"]
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

// Generate response using 25k character limit
async function generateResponse(tweet, analysis) {
  const maxLength = tweet.isReplyToUs ? 2000 : 800; // Longer for replies to us
  
  let systemPrompt = `You are @juanjomir, an AI expert who works with multiple LLM models daily.

CRITICAL RULES:
- ALWAYS respond in English (never Spanish or other languages)
- Be conversational and genuine
- Provide concrete insights from multi-model experience
- Use data and specific examples when possible
- Don't be promotional
- Maximum ${maxLength} characters (you have 25,000 limit but keep it readable)
- Use emojis sparingly (max 2-3)

${tweet.isReplyToUs ? 'IMPORTANT: This person replied to OUR tweet. Show appreciation and continue the conversation with substance.' : ''}

Response strategy: ${analysis.responseStrategy}
Suggested angle: ${analysis.suggestedAngle}
Key points to address: ${analysis.keyPoints?.join(', ')}

Style examples:
- "I've run this exact comparison 100+ times. Claude wins on reasoning, GPT on speed. But the gap narrows when you..."
- "Interesting take. In my experience with enterprise deployments, the real issue is..."
- "This is why I always run queries through 3+ models. Last week I caught a hallucination that..."
- "Great point. Adding to this: when you compare model outputs side-by-side..."`;

  const userPrompt = `Original tweet:
@${tweet.author}: ${tweet.text}

Generate a thoughtful response that:
1. ${analysis.responseStrategy === 'agree_and_expand' ? 'Agrees and adds new perspective' : ''}
${analysis.responseStrategy === 'add_perspective' ? 'Adds a different viewpoint' : ''}
${analysis.responseStrategy === 'challenge_politely' ? 'Politely challenges with data' : ''}
${analysis.responseStrategy === 'provide_data' ? 'Provides concrete data/examples' : ''}
${analysis.responseStrategy === 'ask_question' ? 'Asks insightful follow-up question' : ''}
${analysis.responseStrategy === 'share_experience' ? 'Shares relevant experience' : ''}
2. Invites further discussion
3. Shows expertise without being preachy

CRITICAL: Response MUST be in English.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: Math.floor(maxLength / 2)
    });
    
    let text = response.choices[0].message.content.trim();
    
    // Ensure it's in English (basic check)
    if (text.match(/[áéíóúñ¿¡]/i)) {
      console.log('⚠️  Response contains Spanish characters, regenerating...');
      return generateResponse(tweet, analysis); // Retry
    }
    
    return text;
  } catch (error) {
    console.error('❌ Error generating response:', error.message);
    return null;
  }
}

// Publish reply
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
    
    // Type text in chunks for long responses
    const chunkSize = 500;
    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.substring(i, i + chunkSize);
      await textbox.type(chunk, { delay: 30 });
      await page.waitForTimeout(300);
    }
    
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
  console.log('║  🤖 Enhanced Twitter Engagement (@juanjomir)                  ║');
  console.log('║     • Prioritizes replies to our tweets                      ║');
  console.log('║     • Uses 25,000 character limit                            ║');
  console.log('║     • Always responds in English                             ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  const allCandidates = [];
  
  // Initialize browser for fetching our tweets
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  
  await context.addCookies([
    { name: 'auth_token', value: CONFIG.auth_token, domain: '.x.com', path: '/', secure: true, httpOnly: true }
  ]);
  
  const page = await context.newPage();
  
  // PRIORITY 1: Get replies to our tweets
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  🎯 PRIORITY 1: Replies to Our Tweets                        ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  const ourTweets = await getOurRecentTweets(page);
  
  for (const tweetId of ourTweets.slice(0, 5)) { // Check last 5 tweets
    const replies = await getReplies(page, tweetId);
    
    for (const reply of replies) {
      console.log(`   📊 Analyzing reply from @${reply.author}`);
      
      const analysis = await analyzeTweetRelevance(reply);
      
      if (analysis.shouldEngage) {
        const draft = await generateResponse(reply, analysis);
        
        if (draft) {
          allCandidates.push({ 
            tweet: reply, 
            analysis, 
            draft, 
            priority: CONFIG.priorityTypes.replyToOurTweet,
            timestamp: new Date().toISOString() 
          });
          console.log(`      ✅ Added (Priority: ${CONFIG.priorityTypes.replyToOurTweet})\n`);
        }
      } else {
        console.log(`      ⏭️  Skipped\n`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  await browser.close();
  
  // PRIORITY 2: Mentions
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  🎯 PRIORITY 2: Mentions                                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  const mentionTweets = await searchTweets('@juanjomir OR @AiReliable');
  
  for (const tweet of mentionTweets.slice(0, 5)) {
    if (tweet.mentionsUs) {
      console.log(`   📊 Analyzing mention from @${tweet.author}`);
      
      const analysis = await analyzeTweetRelevance(tweet);
      
      if (analysis.shouldEngage) {
        const draft = await generateResponse(tweet, analysis);
        
        if (draft) {
          allCandidates.push({ 
            tweet, 
            analysis, 
            draft, 
            priority: CONFIG.priorityTypes.mentionUs,
            timestamp: new Date().toISOString() 
          });
          console.log(`      ✅ Added (Priority: ${CONFIG.priorityTypes.mentionUs})\n`);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // PRIORITY 3: Keyword matches
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  🎯 PRIORITY 3: Keyword Matches                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  for (const keyword of CONFIG.keywords.slice(0, 3)) {
    const tweets = await searchTweets(keyword);
    console.log(`   Found: ${tweets.length} tweets\n`);
    
    const filtered = tweets.filter(t => 
      t.likes >= CONFIG.minLikes &&
      t.text.length > 50
    );
    
    for (const tweet of filtered.slice(0, 3)) {
      console.log(`   📊 Analyzing: @${tweet.author}`);
      
      const analysis = await analyzeTweetRelevance(tweet);
      
      if (analysis.shouldEngage && analysis.relevanceScore >= CONFIG.minRelevanceScore) {
        const draft = await generateResponse(tweet, analysis);
        
        if (draft) {
          allCandidates.push({ 
            tweet, 
            analysis, 
            draft, 
            priority: CONFIG.priorityTypes.keywordMatch,
            timestamp: new Date().toISOString() 
          });
          console.log(`      ✅ Added (Priority: ${CONFIG.priorityTypes.keywordMatch})\n`);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Sort by priority and relevance
  allCandidates.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.analysis.relevanceScore - a.analysis.relevanceScore;
  });
  
  const toPublish = allCandidates.slice(0, CONFIG.maxRepliesPerRun);
  
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  📤 Publishing Responses                                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`📊 Total candidates: ${allCandidates.length}`);
  console.log(`🎯 Publishing top ${toPublish.length}\n`);
  
  if (toPublish.length === 0) {
    console.log('⚠️  No candidates found\n');
    return;
  }
  
  // Publish responses
  const browser2 = await chromium.launch({ headless: false, slowMo: 100 });
  const context2 = await browser2.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1280, height: 800 }
  });
  
  await context2.addCookies([
    { name: 'auth_token', value: CONFIG.auth_token, domain: '.x.com', path: '/', secure: true, httpOnly: true }
  ]);
  
  const page2 = await context2.newPage();
  const log = [];
  let published = 0;
  
  try {
    for (let i = 0; i < toPublish.length; i++) {
      const candidate = toPublish[i];
      
      console.log(`\n━━━ RESPONSE ${i + 1}/${toPublish.length} ━━━`);
      console.log(`🎯 Priority: ${candidate.priority}/10`);
      console.log(`👤 Author: @${candidate.tweet.author}`);
      console.log(`📊 Score: ${candidate.analysis.relevanceScore}/10`);
      console.log(`💡 Strategy: ${candidate.analysis.responseStrategy}`);
      console.log(`${candidate.tweet.isReplyToUs ? '🔥 REPLY TO OUR TWEET' : ''}`);
      console.log(`💬 Tweet: ${candidate.tweet.text.substring(0, 100)}...`);
      console.log(`📝 Response (${candidate.draft.length} chars): ${candidate.draft.substring(0, 150)}...`);
      console.log(`🔗 URL: ${candidate.tweet.url}\n`);
      
      console.log('📤 Publishing...');
      
      const success = await publishReply(page2, candidate.tweet.id, candidate.draft);
      
      if (success) {
        published++;
        log.push({
          action: 'reply',
          priority: candidate.priority,
          tweet: candidate.tweet.url,
          author: candidate.tweet.author,
          text: candidate.draft,
          strategy: candidate.analysis.responseStrategy,
          score: candidate.analysis.relevanceScore,
          isReplyToUs: candidate.tweet.isReplyToUs,
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
    await browser2.close();
  }
  
  // Save log
  const logFile = `social-bots/engagement-enhanced-log-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
  
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ Enhanced Engagement Completed                             ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`📊 Statistics:`);
  console.log(`   • Responses published: ${published}/${toPublish.length}`);
  console.log(`   • Replies to our tweets: ${log.filter(l => l.isReplyToUs).length}`);
  console.log(`   • Log saved: ${logFile}\n`);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
