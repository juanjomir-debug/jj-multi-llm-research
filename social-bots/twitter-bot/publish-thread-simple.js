#!/usr/bin/env node
/**
 * Publica un thread completo en Twitter usando tweet-playwright.js
 * Uso: node publish-thread-simple.js <thread-file.json>
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ACCOUNT = 'juanjomir';
const DELAY_BETWEEN_TWEETS = 5000; // 5 segundos entre tweets

function execTweet(text, replyTo = null) {
  return new Promise((resolve, reject) => {
    const args = [
      path.join(__dirname, 'tweet-playwright.js'),
      '--account', ACCOUNT,
      '--text', text
    ];
    
    if (replyTo) {
      args.push('--reply', replyTo);
    }
    
    console.log(`\n📝 Publicando tweet (${text.length} chars)...`);
    if (replyTo) console.log(`   └─ Reply to: ${replyTo}`);
    
    const proc = spawn('node', args, { stdio: 'inherit' });
    
    proc.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Tweet publicado');
        resolve();
      } else {
        reject(new Error(`Tweet failed with code ${code}`));
      }
    });
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function publishThread(threadFile) {
  if (!fs.existsSync(threadFile)) {
    console.error(`❌ Archivo no encontrado: ${threadFile}`);
    process.exit(1);
  }
  
  const threadData = JSON.parse(fs.readFileSync(threadFile, 'utf-8'));
  const { tweets, title } = threadData;
  
  console.log(`\n🐦 Publicando thread en @${ACCOUNT}`);
  console.log(`   Título: "${title}"`);
  console.log(`   Total tweets: ${tweets.length}\n`);
  
  try {
    // Publicar primer tweet
    console.log(`\n━━━ Tweet 1/${tweets.length} ━━━`);
    await execTweet(tweets[0]);
    
    // IMPORTANTE: Necesitamos el ID del primer tweet para hacer replies
    // Como tweet-playwright.js no devuelve el ID, tenemos 2 opciones:
    // 1. Modificar tweet-playwright.js para que devuelva el ID
    // 2. Usar un delay y buscar el último tweet del usuario
    
    console.log('\n⚠️  NOTA: Para publicar el thread completo, necesitamos el ID del primer tweet.');
    console.log('    Opciones:');
    console.log('    1. Ir a Twitter y copiar el ID del tweet que acabas de publicar');
    console.log('    2. Modificar tweet-playwright.js para que devuelva el ID automáticamente');
    console.log('\n    Por ahora, solo se publicó el primer tweet.');
    console.log('    Para continuar manualmente, usa:');
    console.log(`\n    node tweet-playwright.js --account ${ACCOUNT} --reply TWEET_ID --text "tweet 2"`);
    
    // Guardar estado
    threadData.published = 'partial';
    threadData.publishedTweets = 1;
    threadData.publishedAt = new Date().toISOString();
    fs.writeFileSync(threadFile, JSON.stringify(threadData, null, 2));
    
  } catch (error) {
    console.error('\n❌ Error publicando thread:', error.message);
    process.exit(1);
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Uso: node publish-thread-simple.js <thread-file.json>');
    console.log('\nEjemplo:');
    console.log('  node publish-thread-simple.js ../twitter-thread-ai-won-t-kill-jobs-it-will-kill-your-job.json');
    process.exit(1);
  }
  
  publishThread(args[0]).catch(console.error);
}
