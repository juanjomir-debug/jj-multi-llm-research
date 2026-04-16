#!/usr/bin/env node
/**
 * Publica un hilo completo de Twitter usando tweet-playwright.js
 * Versión 2: Captura IDs correctamente y encadena tweets
 */

const { spawn } = require('child_process');
const fs = require('fs');

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const threadFile = get('--file') || 'twitter-thread-ai-won-t-kill-jobs-it-will-kill-your-job.json';
const accountName = get('--account') || 'juanjomir';
const startFrom = parseInt(get('--start') || '0');

if (!fs.existsSync(threadFile)) {
  console.error(`❌ File not found: ${threadFile}`);
  process.exit(1);
}

const thread = JSON.parse(fs.readFileSync(threadFile, 'utf8'));

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║  🧵 Twitter Thread Publisher v2                               ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');
console.log(`📄 Thread: ${thread.title}`);
console.log(`📊 Total tweets: ${thread.tweets.length}`);
console.log(`👤 Account: @${accountName}`);
console.log(`🚀 Starting from tweet #${startFrom + 1}\n`);

function publishTweet(accountName, text, replyTo = null) {
  return new Promise((resolve, reject) => {
    const args = ['twitter-bot/tweet-playwright.js', '--account', accountName, '--text', text];
    
    if (replyTo) {
      args.push('--reply', replyTo);
    }
    
    console.log(`[DEBUG] Args:`, args.slice(2).join(' '));
    
    const child = spawn('node', args, { 
      stdio: ['inherit', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    child.stdout.on('data', (data) => {
      const str = data.toString();
      output += str;
      process.stdout.write(str);
    });
    
    child.stderr.on('data', (data) => {
      const str = data.toString();
      errorOutput += str;
      process.stderr.write(str);
    });
    
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}\n${errorOutput}`));
      } else {
        // Intentar extraer el ID del tweet del output
        const match = output.match(/Tweet ID: (\d+)/);
        const tweetId = match ? match[1] : null;
        resolve(tweetId);
      }
    });
  });
}

async function main() {
  let lastTweetId = null;
  
  for (let i = startFrom; i < thread.tweets.length; i++) {
    const tweet = thread.tweets[i];
    
    console.log(`\n━━━ Tweet ${i + 1}/${thread.tweets.length} ━━━`);
    console.log(`💬 ${tweet.substring(0, 80)}...`);
    console.log(`📏 Length: ${tweet.length} chars\n`);
    
    try {
      const tweetId = await publishTweet(accountName, tweet, lastTweetId);
      
      if (tweetId) {
        console.log(`✅ Published (ID: ${tweetId})`);
        lastTweetId = tweetId;
      } else {
        console.log(`✅ Published (ID not captured)`);
        // Si no capturamos el ID, no podemos encadenar el siguiente
        // Esperamos más tiempo para intentar capturarlo manualmente
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // Esperar entre tweets
      if (i < thread.tweets.length - 1) {
        console.log('⏳ Waiting 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
    } catch (error) {
      console.error(`❌ Failed to publish tweet ${i + 1}`);
      console.error(`Error: ${error.message}`);
      console.log(`\n💡 To resume from this point, run:`);
      console.log(`   node twitter-bot/publish-thread-v2.js --file ${threadFile} --account ${accountName} --start ${i}`);
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
}

main().catch(console.error);
