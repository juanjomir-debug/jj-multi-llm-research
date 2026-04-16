#!/usr/bin/env node
/**
 * Test completo de acceso a la API de X (Twitter)
 * Prueba búsqueda, lectura de tweets y publicación
 */

const { TwitterApi } = require('twitter-api-v2');
require('dotenv').config();

// Configurar cliente con OAuth 1.0a
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

async function testAPIAccess() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  🧪 Test de Acceso a API de X (Twitter)                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // Test 1: Verificar credenciales
  console.log('📋 Test 1: Verificar credenciales');
  console.log('─────────────────────────────────────────────────────────────────');
  try {
    const me = await client.v2.me();
    console.log(`✅ Autenticado como: @${me.data.username}`);
    console.log(`   ID: ${me.data.id}`);
    console.log(`   Nombre: ${me.data.name}\n`);
  } catch (error) {
    console.error(`❌ Error de autenticación: ${error.message}`);
    console.error(`   Código: ${error.code || 'N/A'}\n`);
    return;
  }

  // Test 2: Buscar tweets (API v2)
  console.log('📋 Test 2: Buscar tweets sobre AI');
  console.log('─────────────────────────────────────────────────────────────────');
  try {
    const searchResults = await client.v2.search('AI models', {
      max_results: 5,
      'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
      'user.fields': ['username'],
      expansions: ['author_id']
    });

    console.log(`✅ Búsqueda exitosa. Encontrados: ${searchResults.data.data?.length || 0} tweets\n`);
    
    if (searchResults.data.data && searchResults.data.data.length > 0) {
      for (const tweet of searchResults.data.data.slice(0, 3)) {
        const author = searchResults.includes.users?.find(u => u.id === tweet.author_id);
        console.log(`   📝 @${author?.username || 'unknown'}`);
        console.log(`      ${tweet.text.substring(0, 80)}...`);
        console.log(`      ❤️  ${tweet.public_metrics.like_count} | 💬 ${tweet.public_metrics.reply_count}\n`);
      }
    }
  } catch (error) {
    console.error(`❌ Error en búsqueda: ${error.message}`);
    console.error(`   Código: ${error.code || 'N/A'}\n`);
  }

  // Test 3: Leer timeline propio
  console.log('📋 Test 3: Leer timeline propio');
  console.log('─────────────────────────────────────────────────────────────────');
  try {
    const timeline = await client.v2.userTimeline(
      (await client.v2.me()).data.id,
      { max_results: 5 }
    );

    console.log(`✅ Timeline leído. Tweets: ${timeline.data.data?.length || 0}\n`);
    
    if (timeline.data.data && timeline.data.data.length > 0) {
      for (const tweet of timeline.data.data.slice(0, 3)) {
        console.log(`   📝 ${tweet.text.substring(0, 80)}...`);
        console.log(`      ID: ${tweet.id}\n`);
      }
    }
  } catch (error) {
    console.error(`❌ Error leyendo timeline: ${error.message}`);
    console.error(`   Código: ${error.code || 'N/A'}\n`);
  }

  // Test 4: Publicar y borrar tweet de prueba
  console.log('📋 Test 4: Publicar tweet de prueba');
  console.log('─────────────────────────────────────────────────────────────────');
  try {
    const testTweet = await client.v2.tweet('🧪 Test de API - Este tweet se borrará automáticamente');
    console.log(`✅ Tweet publicado exitosamente`);
    console.log(`   ID: ${testTweet.data.id}`);
    console.log(`   Texto: ${testTweet.data.text}\n`);

    // Esperar 2 segundos
    console.log('   ⏳ Esperando 2 segundos antes de borrar...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Borrar el tweet
    await client.v2.deleteTweet(testTweet.data.id);
    console.log(`✅ Tweet borrado exitosamente\n`);
  } catch (error) {
    console.error(`❌ Error publicando/borrando: ${error.message}`);
    console.error(`   Código: ${error.code || 'N/A'}`);
    
    if (error.code === 453) {
      console.error(`\n⚠️  Error 453: Tu cuenta tiene acceso limitado (Free/Basic tier)`);
      console.error(`   Solución: Actualizar a Elevated access en developer.twitter.com\n`);
    }
  }

  // Test 5: Responder a un tweet propio
  console.log('📋 Test 5: Responder a tweet propio');
  console.log('─────────────────────────────────────────────────────────────────');
  try {
    // Primero publicar un tweet
    const parentTweet = await client.v2.tweet('🧪 Tweet padre para test de respuesta');
    console.log(`✅ Tweet padre publicado: ${parentTweet.data.id}\n`);

    // Esperar 1 segundo
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Responder al tweet
    const replyTweet = await client.v2.reply(
      '🧪 Esta es una respuesta de prueba',
      parentTweet.data.id
    );
    console.log(`✅ Respuesta publicada: ${replyTweet.data.id}\n`);

    // Esperar 2 segundos
    console.log('   ⏳ Esperando 2 segundos antes de limpiar...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Borrar ambos tweets
    await client.v2.deleteTweet(replyTweet.data.id);
    await client.v2.deleteTweet(parentTweet.data.id);
    console.log(`✅ Tweets de prueba borrados\n`);
  } catch (error) {
    console.error(`❌ Error en test de respuesta: ${error.message}`);
    console.error(`   Código: ${error.code || 'N/A'}\n`);
  }

  // Resumen final
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ Tests Completados                                         ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log('📊 Resumen:');
  console.log('   ✓ Autenticación: Verificar resultado arriba');
  console.log('   ✓ Búsqueda: Verificar resultado arriba');
  console.log('   ✓ Lectura: Verificar resultado arriba');
  console.log('   ✓ Publicación: Verificar resultado arriba');
  console.log('   ✓ Respuestas: Verificar resultado arriba\n');
  console.log('💡 Si todos los tests pasaron, la API está completamente funcional.\n');
}

testAPIAccess().catch(error => {
  console.error('\n❌ Error fatal:', error.message);
  console.error(error);
});
