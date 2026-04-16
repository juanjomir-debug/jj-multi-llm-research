#!/usr/bin/env node
/**
 * Script completo: Publica artículo en WordPress + genera thread para Twitter
 * Uso: node publish-article-complete.js
 */

const fs = require('fs');
const { execSync } = require('child_process');
const Database = require('better-sqlite3');
const path = require('path');

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║  ReliableAI — Publicador de Artículos                        ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

// 1. Buscar el último artículo en la DB local
console.log('📊 Buscando último artículo en la base de datos...\n');

const possiblePaths = ['./data/data.db', './data.db'];
let db;
let dbPath;

for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    dbPath = p;
    db = new Database(p);
    break;
  }
}

if (!db) {
  console.error('❌ No se encontró la base de datos local');
  process.exit(1);
}

const user = db.prepare('SELECT id, email, username FROM users WHERE email = ?').get('juanjomir@gmail.com');

if (!user) {
  console.error('❌ Usuario juanjomir@gmail.com no encontrado');
  db.close();
  process.exit(1);
}

console.log(`✅ Usuario encontrado: ${user.username} (${user.email})`);

const article = db.prepare(`
  SELECT * FROM history 
  WHERE user_id = ? 
    AND prompt LIKE '%employment%'
  ORDER BY created_at DESC 
  LIMIT 1
`).get(user.id);

db.close();

if (!article) {
  console.error('❌ No se encontró el artículo sobre employment');
  process.exit(1);
}

console.log(`✅ Artículo encontrado: ${article.session_id}`);
console.log(`   Modelo: ${article.model_id}`);
console.log(`   Fecha: ${article.created_at}`);
console.log(`   Longitud: ${article.response.length} chars\n`);

// Guardar artículo temporalmente
fs.writeFileSync('article-temp.json', JSON.stringify(article, null, 2));

// 2. Generar hero image y preparar contenido
console.log('═══════════════════════════════════════════════════════════════\n');
console.log('🎨 Generando hero image y preparando contenido...\n');

try {
  execSync('node publish-article.js', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Error generando contenido:', error.message);
  process.exit(1);
}

// 3. Publicar en WordPress
console.log('\n═══════════════════════════════════════════════════════════════\n');
console.log('📝 Publicando en WordPress...\n');

const hasWpConfig = process.env.WP_APP_PASSWORD || fs.existsSync('.env');

if (!hasWpConfig) {
  console.log('⚠️  No se encontró configuración de WordPress');
  console.log('   Para publicar automáticamente, configura en .env:');
  console.log('   - WP_URL=https://blog.reliableai.net');
  console.log('   - WP_USER=admin');
  console.log('   - WP_APP_PASSWORD=xxxx xxxx xxxx xxxx\n');
  console.log('   Saltando publicación en WordPress...\n');
} else {
  try {
    execSync('node publish-to-wordpress.js article-temp.json', { stdio: 'inherit' });
  } catch (error) {
    console.error('⚠️  Error publicando en WordPress:', error.message);
    console.log('   Continuando con el thread de Twitter...\n');
  }
}

// 4. Mostrar thread de Twitter
console.log('\n═══════════════════════════════════════════════════════════════\n');
console.log('🐦 Thread para Twitter\n');

const threadFile = 'twitter-thread-ai-won-t-kill-jobs-it-will-kill-your-job.json';

if (fs.existsSync(threadFile)) {
  execSync(`node twitter-bot/show-thread.js ${threadFile}`, { stdio: 'inherit' });
} else {
  console.error('❌ No se encontró el archivo del thread');
}

// Limpiar archivo temporal
fs.unlinkSync('article-temp.json');

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║  ✅ Proceso completado                                        ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

console.log('📋 Próximos pasos:\n');
console.log('1. Verifica el artículo en WordPress: https://blog.reliableai.net');
console.log('2. Publica el thread en Twitter copiando los tweets del archivo .txt');
console.log('3. O usa el script automático:');
console.log('   cd twitter-bot');
console.log('   node publish-thread-simple.js ../twitter-thread-ai-won-t-kill-jobs-it-will-kill-your-job.json\n');
