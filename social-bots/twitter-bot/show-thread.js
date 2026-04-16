#!/usr/bin/env node
/**
 * Muestra el thread formateado para copiar y pegar manualmente en Twitter
 * Uso: node show-thread.js <thread-file.json>
 */

const fs = require('fs');
const path = require('path');

function showThread(threadFile) {
  if (!fs.existsSync(threadFile)) {
    console.error(`❌ Archivo no encontrado: ${threadFile}`);
    process.exit(1);
  }
  
  const threadData = JSON.parse(fs.readFileSync(threadFile, 'utf-8'));
  const { tweets, title, blogUrl, heroImage } = threadData;
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  THREAD PARA TWITTER - @juanjomir`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`📄 Título: ${title}`);
  console.log(`🔗 Blog: ${blogUrl}`);
  if (heroImage) console.log(`🖼️  Hero Image: ${heroImage}`);
  console.log(`📊 Total tweets: ${tweets.length}`);
  console.log('\n═══════════════════════════════════════════════════════════════\n');
  
  tweets.forEach((tweet, i) => {
    const num = i + 1;
    const chars = tweet.length;
    const status = chars <= 280 ? '✅' : '⚠️ ';
    
    console.log(`┌─ TWEET ${num}/${tweets.length} ${status} (${chars}/280 chars) ─────────────────────────`);
    console.log('│');
    
    // Mostrar el tweet con líneas
    tweet.split('\n').forEach(line => {
      console.log(`│ ${line}`);
    });
    
    console.log('│');
    console.log('└────────────────────────────────────────────────────────────────\n');
  });
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  INSTRUCCIONES PARA PUBLICAR');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('1. Ve a https://twitter.com/compose/tweet');
  console.log('2. Copia y pega el TWEET 1');
  console.log('3. Publica');
  console.log('4. Haz clic en "Reply" a tu propio tweet');
  console.log('5. Copia y pega el TWEET 2');
  console.log('6. Repite hasta completar el thread\n');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Guardar en archivo de texto para fácil copia
  const txtFile = threadFile.replace('.json', '.txt');
  const txtContent = tweets.map((t, i) => `━━━ TWEET ${i + 1}/${tweets.length} ━━━\n\n${t}\n\n`).join('\n');
  fs.writeFileSync(txtFile, txtContent, 'utf-8');
  console.log(`💾 Thread guardado en formato texto: ${txtFile}\n`);
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Uso: node show-thread.js <thread-file.json>');
    console.log('\nEjemplo:');
    console.log('  node show-thread.js ../twitter-thread-ai-won-t-kill-jobs-it-will-kill-your-job.json');
    process.exit(1);
  }
  
  showThread(args[0]);
}

module.exports = { showThread };
