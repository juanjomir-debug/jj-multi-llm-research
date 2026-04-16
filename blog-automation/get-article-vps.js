#!/usr/bin/env node
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || '/var/www/reliableai/data/data.db';
const db = new Database(DB_PATH);

console.log(`Usando DB: ${DB_PATH}\n`);

// Ver todos los usuarios
const users = db.prepare('SELECT id, email, username FROM users ORDER BY created_at DESC LIMIT 10').all();
console.log('=== USUARIOS ===');
console.log(JSON.stringify(users, null, 2));

// Buscar por email o username que contenga "juanjo"
const user = db.prepare('SELECT id, email, username FROM users WHERE email LIKE ? OR username LIKE ?').get('%juanjo%', '%juanjo%');

if (!user) {
  console.log('\nUsuario Juanjo no encontrado');
  process.exit(0);
}

console.log(`\n=== USUARIO ENCONTRADO ===`);
console.log(JSON.stringify(user, null, 2));

// Buscar el último artículo con el prompt específico
console.log('\n=== BUSCANDO ARTÍCULO SOBRE AI EMPLOYMENT ===');
const article = db.prepare(`
  SELECT session_id, question, response, model_id, created_at 
  FROM history 
  WHERE user_id = ? 
    AND question LIKE '%employment%'
  ORDER BY created_at DESC 
  LIMIT 1
`).get(user.id);

if (article) {
  console.log('\n=== ARTÍCULO ENCONTRADO ===');
  console.log(JSON.stringify({
    session_id: article.session_id,
    model_id: article.model_id,
    created_at: article.created_at,
    question: article.question,
    response_length: article.response.length,
    response_preview: article.response.substring(0, 500) + '...'
  }, null, 2));
  
  // Guardar el artículo completo en un archivo
  const fs = require('fs');
  fs.writeFileSync('/tmp/article-full.json', JSON.stringify(article, null, 2));
  console.log('\n✅ Artículo completo guardado en /tmp/article-full.json');
} else {
  console.log('\n❌ No se encontró artículo sobre employment');
  
  // Mostrar las últimas 5 sesiones
  console.log('\n=== ÚLTIMAS 5 SESIONES ===');
  const recent = db.prepare(`
    SELECT session_id, LEFT(question, 100) as question_preview, model_id, created_at 
    FROM history 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 5
  `).all(user.id);
  console.log(JSON.stringify(recent, null, 2));
}

db.close();
