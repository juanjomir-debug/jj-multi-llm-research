#!/usr/bin/env node
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Buscar la DB local
const possiblePaths = [
  './data/data.db',
  './data.db',
  path.join(__dirname, 'data', 'data.db'),
  path.join(__dirname, 'data.db')
];

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
  console.log('Rutas buscadas:', possiblePaths);
  process.exit(1);
}

console.log(`✅ Usando DB: ${dbPath}\n`);

// Ver todos los usuarios
const users = db.prepare('SELECT id, email, username FROM users ORDER BY created_at DESC').all();
console.log('=== USUARIOS ===');
console.log(JSON.stringify(users, null, 2));

if (users.length === 0) {
  console.log('\n❌ No hay usuarios en la base de datos');
  db.close();
  process.exit(0);
}

// Buscar por email o username que contenga "juanjo"
const user = db.prepare('SELECT id, email, username FROM users WHERE email LIKE ? OR username LIKE ?').get('%juanjo%', '%juanjo%');

if (!user) {
  console.log('\n⚠️ Usuario Juanjo no encontrado, usando el primer usuario disponible');
  const firstUser = users[0];
  console.log('Usuario seleccionado:', firstUser);
  
  // Buscar el último artículo de este usuario
  const article = db.prepare(`
    SELECT session_id, question, response, model_id, created_at 
    FROM history 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 1
  `).get(firstUser.id);
  
  if (article) {
    console.log('\n=== ÚLTIMO ARTÍCULO ===');
    console.log('Session ID:', article.session_id);
    console.log('Model:', article.model_id);
    console.log('Created:', article.created_at);
    console.log('Question:', article.question);
    console.log('Response length:', article.response.length, 'chars');
    
    fs.writeFileSync('article-full.json', JSON.stringify(article, null, 2));
    console.log('\n✅ Artículo completo guardado en article-full.json');
  } else {
    console.log('\n❌ No hay artículos para este usuario');
  }
  
  db.close();
  process.exit(0);
}

console.log(`\n=== USUARIO ENCONTRADO ===`);
console.log(JSON.stringify(user, null, 2));

// Buscar el último artículo con el prompt sobre employment
console.log('\n=== BUSCANDO ARTÍCULO SOBRE AI EMPLOYMENT ===');
const article = db.prepare(`
  SELECT session_id, question, response, model_id, created_at 
  FROM history 
  WHERE user_id = ? 
    AND (question LIKE '%employment%' OR question LIKE '%AI%')
  ORDER BY created_at DESC 
  LIMIT 1
`).get(user.id);

if (article) {
  console.log('\n=== ARTÍCULO ENCONTRADO ===');
  console.log('Session ID:', article.session_id);
  console.log('Model:', article.model_id);
  console.log('Created:', article.created_at);
  console.log('Question:', article.question);
  console.log('Response length:', article.response.length, 'chars');
  console.log('Response preview:', article.response.substring(0, 300) + '...');
  
  fs.writeFileSync('article-full.json', JSON.stringify(article, null, 2));
  console.log('\n✅ Artículo completo guardado en article-full.json');
} else {
  console.log('\n❌ No se encontró artículo sobre employment/AI');
  
  // Mostrar las últimas 5 sesiones
  console.log('\n=== ÚLTIMAS 5 SESIONES ===');
  const recent = db.prepare(`
    SELECT session_id, question, model_id, created_at 
    FROM history 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 5
  `).all(user.id);
  
  recent.forEach((r, i) => {
    console.log(`\n${i + 1}. ${r.created_at}`);
    console.log(`   Model: ${r.model_id}`);
    console.log(`   Question: ${r.question.substring(0, 100)}...`);
  });
}

db.close();
