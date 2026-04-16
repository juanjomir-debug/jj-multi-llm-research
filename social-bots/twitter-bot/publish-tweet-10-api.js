#!/usr/bin/env node
/**
 * Publicar tweet 10 del hilo usando API de X
 */

const { TwitterApi } = require('twitter-api-v2');
require('dotenv').config();

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

async function publishTweet10() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  📤 Publicando Tweet 10 del Hilo                              ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // ID del tweet 9 (último tweet publicado del hilo)
  const tweet9Id = '2044516220364300652';
  
  // Contenido del tweet 10
  const tweet10Text = `10/ Full article with all the data, charts, and blind spots:

https://blog.reliableai.net/ai-won-t-kill-jobs-it-will-kill-your-job/

Produced using @AiReliable — 5 AI models researching independently.

#AI #FutureOfWork #Employment`;

  console.log('📝 Contenido del tweet 10:');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(tweet10Text);
  console.log('─────────────────────────────────────────────────────────────────\n');
  
  console.log(`🔗 Respondiendo al tweet 9: ${tweet9Id}\n`);
  console.log('⏳ Publicando...\n');

  try {
    const result = await client.v2.reply(tweet10Text, tweet9Id);
    
    console.log('✅ ¡Tweet 10 publicado exitosamente!\n');
    console.log(`📊 Detalles:`);
    console.log(`   ID: ${result.data.id}`);
    console.log(`   Texto: ${result.data.text.substring(0, 80)}...`);
    console.log(`   URL: https://x.com/juanjomir/status/${result.data.id}\n`);
    
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ Hilo Completo (1-10)                                      ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    console.log('🎉 El hilo está ahora completo con todos los 10 tweets.\n');
    console.log('🔗 Ver hilo completo:');
    console.log('   https://x.com/juanjomir/status/2044460978327244866\n');
    
  } catch (error) {
    console.error('❌ Error al publicar tweet 10:\n');
    console.error(`   Mensaje: ${error.message}`);
    console.error(`   Código: ${error.code || 'N/A'}\n`);
    
    if (error.code === 429) {
      console.error('⚠️  Rate limit alcanzado. Espera 15-30 minutos e intenta de nuevo.\n');
    } else if (error.code === 187) {
      console.error('⚠️  Tweet duplicado. Es posible que ya se haya publicado.\n');
    }
  }
}

publishTweet10().catch(console.error);
