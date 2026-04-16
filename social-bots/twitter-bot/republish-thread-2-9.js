#!/usr/bin/env node
/**
 * Republicar tweets 2-9 del hilo usando API de X
 */

const { TwitterApi } = require('twitter-api-v2');
require('dotenv').config();

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

// ID del tweet 1 (el tweet inicial del hilo)
const TWEET_1_ID = '2044460978327244866';

// Contenido de los tweets 2-9
const tweets = [
  "2/ Where ALL models agree:\n\n• Net +78M jobs by 2030 (WEF)\n• Middle-skill workers crushed\n• AI skills = 23-56% salary premium\n\nBut here's where it gets interesting...",
  
  "3/ The models split into 2 camps:\n\nCamp 1 (GPT, Qwen, Grok): \"Manageable disruption\"\n→ Temporary 0.3-0.6% unemployment bump\n\nCamp 2 (Claude, Gemini): \"Structural fracture\"\n→ The junior-to-senior pipeline is collapsing",
  
  "4/ The pipeline collapse is the scariest prediction:\n\nIf AI absorbs entry-level work, you never become a senior professional.\n\nNo junior analyst jobs → No senior analysts in 10 years\n\nThis isn't automation. It's destroying the apprenticeship ladder.",
  
  "5/ The stat that matters:\n\n77% of emerging AI roles require a master's degree or equivalent.\n\nYou can't retrain millions of admin workers into ML engineers in 2-3 years.\n\nThe math doesn't work.",
  
  "6/ What only ONE model mentioned:\n\n79% of employed women in the US work in high-automation-risk positions vs 58% of men.\n\n4.7% of women's jobs face severe AI disruption vs 2.4% for men.\n\nThis should have been raised by all of them.",
  
  "7/ Winners:\n• AI-fluent professionals\n• Physical-skill workers (trades, healthcare)\n• Early-adopter firms\n\nLosers:\n• Entry-level knowledge workers (Gen Z)\n• Women in admin/support\n• Workers in mid-size cities",
  
  "8/ This isn't theoretical:\n\n• Amazon: 30,000+ positions eliminated\n• Salesforce: 4,000 support roles cut\n• MIT study: 11.7% of jobs could be automated TODAY\n\nThe gap between \"could be\" and \"has been\" is closing fast.",
  
  "9/ What to do:\n\nStop planning for the average. Plan for the distribution.\n\nAudit every role for AI complementarity in the next 90 days.\n\nInvest in skills at the intersection of AI fluency + human judgment."
];

async function publishThread() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  📤 Republicando Tweets 2-9 del Hilo                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  console.log(`🔗 Tweet 1 (raíz del hilo): ${TWEET_1_ID}\n`);
  console.log(`📊 Total de tweets a publicar: ${tweets.length}\n`);
  console.log('─────────────────────────────────────────────────────────────────\n');

  let previousTweetId = TWEET_1_ID;
  const publishedTweets = [];

  for (let i = 0; i < tweets.length; i++) {
    const tweetNumber = i + 2; // Empezamos en el tweet 2
    const tweetText = tweets[i];
    
    console.log(`📝 Tweet ${tweetNumber}/${tweets.length + 1}`);
    console.log(`   Respondiendo a: ${previousTweetId}`);
    console.log(`   Contenido: ${tweetText.substring(0, 60)}...`);
    
    try {
      const result = await client.v2.reply(tweetText, previousTweetId);
      
      console.log(`   ✅ Publicado: ${result.data.id}`);
      console.log(`   🔗 https://x.com/juanjomir/status/${result.data.id}\n`);
      
      publishedTweets.push({
        number: tweetNumber,
        id: result.data.id,
        text: tweetText.substring(0, 80)
      });
      
      previousTweetId = result.data.id;
      
      // Esperar 3 segundos entre tweets para evitar rate limits
      if (i < tweets.length - 1) {
        console.log('   ⏳ Esperando 3 segundos...\n');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      console.error(`   Código: ${error.code || 'N/A'}\n`);
      
      if (error.code === 429) {
        console.error('⚠️  Rate limit alcanzado. Esperando 60 segundos...\n');
        await new Promise(resolve => setTimeout(resolve, 60000));
        i--; // Reintentar este tweet
        continue;
      } else if (error.code === 187) {
        console.error('⚠️  Tweet duplicado. Continuando...\n');
        continue;
      } else {
        console.error('⚠️  Error crítico. Deteniendo publicación.\n');
        break;
      }
    }
  }

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ Publicación Completada                                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  console.log(`📊 Tweets publicados: ${publishedTweets.length}/${tweets.length}\n`);
  
  if (publishedTweets.length > 0) {
    console.log('📋 Resumen de tweets publicados:\n');
    for (const tweet of publishedTweets) {
      console.log(`   ${tweet.number}. ${tweet.id}`);
      console.log(`      ${tweet.text}...\n`);
    }
    
    console.log('🔗 Ver hilo completo:');
    console.log(`   https://x.com/juanjomir/status/${TWEET_1_ID}\n`);
    
    console.log('📝 Último tweet publicado (Tweet 9):');
    console.log(`   ID: ${previousTweetId}`);
    console.log(`   Usa este ID para publicar el tweet 10\n`);
  }
}

publishThread().catch(console.error);
