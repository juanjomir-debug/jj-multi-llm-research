#!/usr/bin/env node
const db = require('./db');

// Primero ver todos los usuarios
const users = db.prepare('SELECT id, email, username FROM users ORDER BY created_at DESC LIMIT 10').all();
console.log('=== USUARIOS ===');
console.log(JSON.stringify(users, null, 2));

// Buscar por email o username
const user = db.prepare('SELECT id FROM users WHERE email LIKE ? OR username LIKE ?').get('%juanjo%', '%juanjo%');

if (!user) {
  console.log('\nUsuario Juanjo no encontrado');
  process.exit(0);
}

console.log('\n=== ÚLTIMAS SESIONES ===');
const sessions = db.prepare(`
  SELECT session_id, question, response, model_id, created_at 
  FROM history 
  WHERE user_id = ? 
  ORDER BY created_at DESC 
  LIMIT 5
`).all(user.id);

console.log(JSON.stringify(sessions, null, 2));
