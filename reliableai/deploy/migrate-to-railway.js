'use strict';
// Run once: node migrate-to-railway.js
// Exports local SQLite data and imports it into Railway via HTTP
const https = require('https');
const db    = require('./db');

const RAILWAY_URL = 'https://jj-multi-llm-research-production.up.railway.app';
const TOKEN       = 'mig_7x9kQpL2wNzR4vT8sY1uJ3bX';

function post(url, data, token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'x-migrate-token': token },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve(d); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  console.log('📦 Reading local database...');
  const users            = db.prepare('SELECT * FROM users').all();
  const history          = db.prepare('SELECT * FROM history').all();
  const debate_responses = db.prepare('SELECT * FROM debate_responses').all();
  const debate_votes     = db.prepare('SELECT * FROM debate_votes').all();
  const projects         = db.prepare('SELECT * FROM projects').all();
  const project_sessions = db.prepare('SELECT * FROM project_sessions').all();

  console.log(`   users: ${users.length}, history: ${history.length}, debates: ${debate_responses.length}, votes: ${debate_votes.length}, projects: ${projects.length}`);
  console.log('🚀 Sending to Railway...');

  const result = await post(`${RAILWAY_URL}/api/migrate-import`, {
    users, history, debate_responses, debate_votes, projects, project_sessions,
  }, TOKEN);

  if (result.ok) {
    console.log('✅ Migration complete!');
    console.log('   Inserted:', JSON.stringify(result.inserted));
    console.log('   User ID map:', JSON.stringify(result.userIdMap));
  } else {
    console.error('❌ Error:', JSON.stringify(result));
  }
})();
