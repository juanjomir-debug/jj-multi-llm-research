#!/usr/bin/env node
/**
 * Busca tweets relevantes para engagement según la estrategia
 * Usa la API de Twitter/X para encontrar conversaciones de calidad
 */

const { chromium } = require('playwright');
const fs = require('fs');
const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configuración
const CONFIG = {
  account: 'juanjomir',
  auth_token: '7d03ee0fecd4c19cff2c4bf6c12c233683858dad',
  ct0: '',
  
  // Criterios de búsqueda
  keywords: [
    'ChatGPT vs Claude',
    'GPT-4 vs Claude',
    'Gemini vs ChatGPT',
    'Grok AI',
    'LLM comparison',
    'AI hallucination',
    'AI reliability',
    'prompt engineering',
    'enterprise AI',
    'multi-agent AI',
    'AI benchmarks',
    'model disagreement'
  ],
  
  // Filtros de calidad
  minLikes: 50,
  minViews: 10000,
  minFollowers: 5000,
  maxAge: 24, // horas
  
  // Límites
  tweetsPerDay: 10,
  maxTweetsPerSearch: 5
};

// Buscar tweets relevantes
async function searchTweets(keyword) {
  console.log(`\n🔍 Buscando: "${keyword}"`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  
  // Inyectar cookies de sesión
  await context.addCookies([
    { name: 'auth_token', value: CONFIG.auth_token, domain: '.x.com', path: '/', secure: true, httpOnly: true }
  ]);
  
  const page = await context.newPage();
  
  try {
    // Buscar en Twitter
    const searchUrl = `https://x.com/search?q=${encodeURIComponent(keyword)}&src=typed_query&f=live`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Extraer tweets
    const tweets = await page.evaluate(() => {
      const articles = Array.from(document.querySelectorAll('article'));
      return articles.slice(0, 10).map(article => {
        try {
          // Extraer datos del tweet
          const textEl = article.querySelector('[data-testid="tweetText"]');
          const text = textEl ? textEl.innerText : '';
          
          const authorEl = article.querySelector('[data-testid="User-Name"] a');
          const authorHandle = authorEl ? authorEl.href.split('/').pop() : '';
          
          const linkEl = article.querySelector('a[href*="/status/"]');
          const tweetUrl = linkEl ? linkEl.href : '';
          const tweetId = tweetUrl.split('/status/')[1]?.split('?')[0];
          
          // Métricas (aproximadas del DOM)
          const metricsEls = article.querySelectorAll('[role="group"] [data-testid]');
          let likes = 0, replies = 0, retweets = 0;
          
          metricsEls.forEach(el => {
            const text = el.innerText;
            const num = parseInt(text.replace(/[^0-9]/g, '')) || 0;
            if (el.getAttribute('data-testid')?.includes('like')) likes = num;
            if (el.getAttribute('data-testid')?.includes('reply')) replies = num;
            if (el.getAttribute('data-testid')?.includes('retweet')) retweets = num;
          });
          
          return {
            id: tweetId,
            url: tweetUrl,
            author: authorHandle,
            text: text.substring(0, 500),
            likes,
            replies,
            retweets,
            engagement: likes + replies + retweets
          };
        } catch (e) {
          return null;
        }
      }).filter(t => t && t.id);
    });
    
    await browser.close();
    return tweets;
    
  } catch (error) {
    console.error('❌ Error buscando tweets:', error.message);
    await browser.close();
    return [];
  }
}

// Analizar relevancia del tweet con AI
async function analyzeTweetRelevance(tweet) {
  const prompt = `Analyze this tweet and determine:
1. Is it relevant for someone working with multiple AI models?
2. What type of response would be most appropriate?
3. Should it mention ReliableAI?

Tweet:
Author: @${tweet.author}
Text: ${tweet.text}
Engagement: ${tweet.likes} likes, ${tweet.replies} replies

Respond in JSON:
{
  "relevant": true/false,
  "relevanceScore": 0-10,
  "reason": "brief explanation",
  "responseType": "value" | "philosophy" | "mention" | "link",
  "suggestedAngle": "what angle to use in the response",
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
    console.error('❌ Error analizando relevancia:', error.message);
    return { relevant: false, shouldEngage: false };
  }
}

// Generar borrador de respuesta
async function generateResponseDraft(tweet, analysis) {
  const philosophyMessages = [
    "Model disagreement is signal, not noise",
    "It depends on which model you ask",
    "AI needs an epistemic layer",
    "Single-model = hidden risk",
    "Consensus can be misleading",
    "4 models, 1 question, 3 contradictions"
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
    systemPrompt += `\n\nNaturally incorporate this concept: "${randomPhilosophy}"`;
  }
  
  if (analysis.responseType === 'mention') {
    systemPrompt += `\n\nYou can mention @ReliableAI_app if relevant, but only if it adds real value.`;
  }
  
  if (analysis.responseType === 'link') {
    systemPrompt += `\n\nInclude https://reliableai.app if appropriate.`;
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
    console.error('❌ Error generando respuesta:', error.message);
    return null;
  }
}

// Main
async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  🎯 Twitter Engagement Finder                                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  const allCandidates = [];
  
  // Buscar por cada keyword
  for (const keyword of CONFIG.keywords.slice(0, 3)) { // Limitar a 3 keywords por ejecución
    const tweets = await searchTweets(keyword);
    
    console.log(`   Encontrados: ${tweets.length} tweets`);
    
    // Filtrar por calidad
    const filtered = tweets.filter(t => 
      t.likes >= CONFIG.minLikes &&
      t.author !== CONFIG.account // No responder a uno mismo
    );
    
    console.log(`   Filtrados: ${filtered.length} tweets de calidad\n`);
    
    // Analizar relevancia con AI
    for (const tweet of filtered.slice(0, CONFIG.maxTweetsPerSearch)) {
      console.log(`   📊 Analizando: @${tweet.author}`);
      
      const analysis = await analyzeTweetRelevance(tweet);
      
      if (analysis.shouldEngage && analysis.relevanceScore >= 6) {
        console.log(`      ✅ Relevante (${analysis.relevanceScore}/10): ${analysis.reason}`);
        
        // Generar borrador de respuesta
        const draft = await generateResponseDraft(tweet, analysis);
        
        if (draft) {
          allCandidates.push({
            tweet,
            analysis,
            draft,
            timestamp: new Date().toISOString()
          });
          
          console.log(`      💬 Borrador: ${draft.substring(0, 80)}...\n`);
        }
      } else {
        console.log(`      ⏭️  Omitido (${analysis.relevanceScore}/10)\n`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limit
    }
  }
  
  // Ordenar por relevancia
  allCandidates.sort((a, b) => b.analysis.relevanceScore - a.analysis.relevanceScore);
  
  // Guardar top 10
  const top10 = allCandidates.slice(0, CONFIG.tweetsPerDay);
  
  const outputFile = `engagement-candidates-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(outputFile, JSON.stringify(top10, null, 2));
  
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ Búsqueda completada                                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`📊 Total candidatos: ${allCandidates.length}`);
  console.log(`🎯 Top 10 guardados en: ${outputFile}\n`);
  
  // Mostrar resumen
  console.log('📋 Top 5 oportunidades:\n');
  top10.slice(0, 5).forEach((c, i) => {
    console.log(`${i + 1}. @${c.tweet.author} (${c.analysis.relevanceScore}/10)`);
    console.log(`   Tweet: ${c.tweet.text.substring(0, 100)}...`);
    console.log(`   Tipo: ${c.analysis.responseType}`);
    console.log(`   Borrador: ${c.draft}`);
    console.log(`   URL: ${c.tweet.url}\n`);
  });
  
  console.log('💡 Próximo paso: Revisar y publicar con engagement-publisher.js\n');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { searchTweets, analyzeTweetRelevance, generateResponseDraft };
