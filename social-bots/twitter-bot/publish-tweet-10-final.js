#!/usr/bin/env node
/**
 * Publicar tweet 10 como respuesta al tweet 9 recién publicado
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
  console.log('║  📤 Publicando Tweet 10 (Final del Hilo)                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // ID del tweet 9 recién publicado
  const tweet9Id = '2044522455679578215';
  
  // Contenido del tweet 10
  const tweet10Text = `10/ Full article with all the data, charts, and blind spots:

https://blog.reliableai.net/ai-won-t-kill-jobs-it-will-kill-your-job/

Produced using @AiReliable — 5 AI models researching independently.

#AI #FutureOfWork #Employment`;

  console.log('📝 Tweet 10 (Final):');
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
    console.log(`   URL: https://x.com/juanjomir/status/${result.data.id}\n`);
    
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  🎉 HILO COMPLETO (1-10)                                      ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    
    console.log('📋 Estructura del hilo:\n');
    console.log('   1. 2044460978327244866 (Tweet inicial)');
    console.log('   2. 2044522352721944623');
    console.log('   3. 2044522367037096299');
    console.log('   4. 2044522381721366766');
    console.log('   5. 2044522396460130716');
    console.log('   6. 2044522411471589439');
    console.log('   7. 2044522425941962839');
    console.log('   8. 2044522440970105337');
    console.log('   9. 2044522455679578215');
    console.log(`  10. ${result.data.id} ✨\n`);
    
    console.log('🔗 Ver hilo completo:');
    console.log('   https://x.com/juanjomir/status/2044460978327244866\n');
    
  } catch (error) {
    console.error('❌ Error al publicar tweet 10:\n');
    console.error(`   Mensaje: ${error.message}`);
    console.error(`   Código: ${error.code || 'N/A'}\n`);
    
    if (error.code === 429) {
      console.error('⚠️  Rate limit alcanzado. Espera 15-30 minutos.\n');
    } else if (error.code === 187) {
      console.error('⚠️  Tweet duplicado. Puede que ya esté publicado.\n');
    }
  }
}

publishTweet10().catch(console.error);
