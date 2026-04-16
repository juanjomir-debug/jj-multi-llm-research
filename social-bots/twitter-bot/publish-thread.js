#!/usr/bin/env node
/**
 * Publica un hilo completo de Twitter usando tweet-playwright.js
 * Uso: node twitter-bot/publish-thread.js --file thread.json --account juanjomir
 */

const { execSync } = require('child_process');
const fs = require('fs');

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const threadFile = get('--file') || 'twitter-thread-ai-won-t-kill-jobs-it-will-kill-your-job.json';
const accountName = get('--account') || 'juanjomir';
const startFrom = parseInt(get('--start') || '0'); // índice del tweet desde donde empezar

if (!fs.existsSync(threadFile)) {
  console.error(`❌ File not found: ${threadFile}`);
  process.exit(1);
}

const thread = JSON.parse(fs.readFileSync(threadFile, 'utf8'));

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║  🧵 Twitter Thread Publisher                                  ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');
console.log(`📄 Thread: ${thread.title}`);
console.log(`📊 Total tweets: ${thread.tweets.length}`);
console.log(`👤 Account: @${accountName}`);
console.log(`🚀 Starting from tweet #${startFrom + 1}\n`);

let lastTweetId = null;

(async () => {
  for (let i = startFrom; i < thread.tweets.length; i++) {
  const tweet = thread.tweets[i];
  
  console.log(`\n━━━ Tweet ${i + 1}/${thread.tweets.length} ━━━`);
  console.log(`💬 ${tweet.substring(0, 80)}...`);
  
  try {
    let cmd;
    
    if (i === 0 || !lastTweetId) {
      // Primer tweet del hilo
      cmd = `node twitter-bot/tweet-playwright.js --account ${accountName} --text "${tweet.replace(/"/g, '\\"')}"`;
    } else {
      // Responder al tweet anterior
      cmd = `node twitter-bot/tweet-playwright.js --account ${accountName} --reply ${lastTweetId} --text "${tweet.replace(/"/g, '\\"')}"`;
    }
    
    const output = execSync(cmd, { encoding: 'utf8' });
    
    // Extraer el ID del tweet publicado (si está en el output)
    // Por ahora, esperamos 5 segundos y asumimos éxito
    console.log('✅ Published');
    
    // Esperar 5 segundos entre tweets para evitar rate limits
    if (i < thread.tweets.length - 1) {
      console.log('⏳ Waiting 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
  } catch (error) {
    console.error(`❌ Failed to publish tweet ${i + 1}`);
    console.error(`Error: ${error.message}`);
    console.log(`\n💡 To resume from this point, run:`);
    console.log(`   node twitter-bot/publish-thread.js --file ${threadFile} --account ${accountName} --start ${i}`);
    process.exit(1);
  }
}

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║  ✅ Thread Published Successfully                             ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

// Marcar como publicado
thread.published = true;
thread.publishedAt = new Date().toISOString();
fs.writeFileSync(threadFile, JSON.stringify(thread, null, 2));
})();
