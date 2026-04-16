#!/usr/bin/env node
/**
 * Test de búsqueda simple en API de X
 */

const { TwitterApi } = require('twitter-api-v2');
require('dotenv').config();

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

async function testSearch() {
  console.log('\n🔍 Test de búsqueda en API de X\n');

  // Test 1: Búsqueda básica sin parámetros extra
  console.log('Test 1: Búsqueda básica');
  try {
    const result = await client.v2.search('AI models', { max_results: 10 });
    console.log(`✅ Búsqueda básica: ${result.data.data?.length || 0} tweets\n`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(`   Código: ${error.code}\n`);
  }

  // Test 2: Búsqueda reciente (recent search)
  console.log('Test 2: Recent search');
  try {
    const result = await client.v2.search('ChatGPT', {
      max_results: 10,
    });
    console.log(`✅ Recent search: ${result.data.data?.length || 0} tweets`);
    
    if (result.data.data && result.data.data.length > 0) {
      console.log('\nPrimeros 3 resultados:');
      for (const tweet of result.data.data.slice(0, 3)) {
        console.log(`   📝 ${tweet.text.substring(0, 80)}...`);
      }
    }
    console.log();
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(`   Código: ${error.code}\n`);
  }

  // Test 3: Verificar límites de la cuenta
  console.log('Test 3: Verificar límites de rate limit');
  try {
    const rateLimits = await client.v2.rateLimitStatuses();
    console.log('✅ Rate limits obtenidos');
    console.log(`   Endpoints disponibles: ${Object.keys(rateLimits).length}\n`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}\n`);
  }
}

testSearch().catch(console.error);
