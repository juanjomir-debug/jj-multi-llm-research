#!/usr/bin/env node
/**
 * reddit-bot.js — Bot de Reddit para engagement y backlinks
 * Usa Reddit API oficial (no scraping)
 */

const snoowrap = require('snoowrap');
const { ACCOUNTS, STRATEGIES, RULES, TEMPLATES } = require('./reddit-config');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'reddit-bot.log');
const STATE_FILE = path.join(__dirname, 'reddit-state.json');

// Cargar estado persistente
let state = {
  lastActionTime: {},
  dailyStats: {},
  karma: {},
  processedPosts: [],
};

if (fs.existsSync(STATE_FILE)) {
  state = JSON.parse(fs.readFileSync(STATE_FILE));
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Crear cliente de Reddit
function createRedditClient(account) {
  return new snoowrap({
    userAgent: `nodejs:reliableai-bot:v1.0.0 (by /u/${account.username})`,
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    username: account.username,
    password: account.password,
  });
}

// Esperar tiempo aleatorio (humanizar)
async function randomDelay() {
  const min = RULES.minDelayBetweenActions;
  const max = RULES.maxDelayBetweenActions;
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  log(`[delay] Esperando ${Math.floor(delay / 1000)}s...`);
  await new Promise(r => setTimeout(r, delay));
}

// Verificar si podemos actuar (límites diarios)
function canAct(accountName, actionType) {
  const today = new Date().toISOString().split('T')[0];
  
  if (!state.dailyStats[accountName]) {
    state.dailyStats[accountName] = {};
  }
  
  if (!state.dailyStats[accountName][today]) {
    state.dailyStats[accountName][today] = { comments: 0, posts: 0 };
  }
  
  const stats = state.dailyStats[accountName][today];
  
  if (actionType === 'comment' && stats.comments >= RULES.maxCommentsPerDay) {
    return false;
  }
  
  if (actionType === 'post' && stats.posts >= RULES.maxPostsPerDay) {
    return false;
  }
  
  return true;
}

// Registrar acción
function recordAction(accountName, actionType) {
  const today = new Date().toISOString().split('T')[0];
  
  if (!state.dailyStats[accountName][today]) {
    state.dailyStats[accountName][today] = { comments: 0, posts: 0 };
  }
  
  if (actionType === 'comment') {
    state.dailyStats[accountName][today].comments++;
  } else if (actionType === 'post') {
    state.dailyStats[accountName][today].posts++;
  }
  
  state.lastActionTime[accountName] = Date.now();
  saveState();
}

// Buscar posts relevantes
async function findRelevantPosts(reddit, subreddit, keywords) {
  log(`[search] Buscando en r/${subreddit}...`);
  
  const posts = await reddit.getSubreddit(subreddit).getNew({ limit: 50 });
  const relevant = [];
  
  for (const post of posts) {
    // Saltar si ya procesamos este post
    if (state.processedPosts.includes(post.id)) {
      continue;
    }
    
    // Buscar keywords en título o texto
    const text = `${post.title} ${post.selftext}`.toLowerCase();
    const matches = keywords.filter(kw => text.includes(kw.toLowerCase()));
    
    if (matches.length > 0 && post.score >= STRATEGIES.ANSWER_QUESTIONS.minKarma) {
      relevant.push({
        post,
        matches,
        score: post.score,
        numComments: post.num_comments,
      });
    }
  }
  
  // Ordenar por score (más populares primero)
  relevant.sort((a, b) => b.score - a.score);
  
  return relevant.slice(0, 5); // Top 5
}

// Generar respuesta con GPT-4
async function generateResponse(post, matches, accountConfig) {
  // Aquí integrarías GPT-4 para generar respuestas naturales
  // Por ahora, usar templates
  
  const templates = TEMPLATES[accountConfig.username.split('_')[0]];
  if (!templates) return null;
  
  const template = templates.helpful[Math.floor(Math.random() * templates.helpful.length)];
  
  // Reemplazar placeholders
  let response = template
    .replace('{tool}', accountConfig.website)
    .replace('{use_case}', matches[0])
    .replace('{solution}', 'the approach we use')
    .replace('{tips}', 'proper preparation and application')
    .replace('{advice}', 'quality matters more than price');
  
  return response;
}

// Responder a un post
async function respondToPost(reddit, accountName, postData, accountConfig) {
  if (!canAct(accountName, 'comment')) {
    log(`[limit] ${accountName} alcanzó límite diario de comentarios`);
    return false;
  }
  
  try {
    const response = await generateResponse(postData.post, postData.matches, accountConfig);
    
    if (!response) {
      log(`[skip] No se pudo generar respuesta para ${postData.post.id}`);
      return false;
    }
    
    log(`[comment] Respondiendo a: ${postData.post.title.substring(0, 50)}...`);
    log(`[comment] Respuesta: ${response.substring(0, 100)}...`);
    
    // Comentar
    await postData.post.reply(response);
    
    // Registrar
    state.processedPosts.push(postData.post.id);
    recordAction(accountName, 'comment');
    
    log(`[success] Comentario publicado en r/${postData.post.subreddit.display_name}`);
    
    return true;
    
  } catch (err) {
    log(`[error] ${err.message}`);
    return false;
  }
}

// Proceso principal
async function main() {
  log('═══════════════════════════════════════════════════════════');
  log('  REDDIT BOT — Engagement y Backlinks');
  log('═══════════════════════════════════════════════════════════');
  
  for (const [accountName, accountConfig] of Object.entries(ACCOUNTS)) {
    log(`\n[account] Procesando: ${accountName}`);
    
    try {
      const reddit = createRedditClient(accountConfig);
      
      // Obtener karma actual
      const me = await reddit.getMe();
      state.karma[accountName] = me.link_karma + me.comment_karma;
      log(`[karma] ${accountName}: ${state.karma[accountName]}`);
      
      // Verificar si cumple requisitos para promocionar
      if (state.karma[accountName] < RULES.minKarmaToPromote) {
        log(`[skip] Karma insuficiente (${state.karma[accountName]} < ${RULES.minKarmaToPromote})`);
        continue;
      }
      
      // Buscar posts relevantes en cada subreddit
      for (const subreddit of accountConfig.subreddits) {
        const relevantPosts = await findRelevantPosts(reddit, subreddit, accountConfig.keywords);
        
        log(`[found] ${relevantPosts.length} posts relevantes en r/${subreddit}`);
        
        // Responder al más relevante
        if (relevantPosts.length > 0) {
          const success = await respondToPost(reddit, accountName, relevantPosts[0], accountConfig);
          
          if (success) {
            await randomDelay();
          }
        }
        
        // Esperar entre subreddits
        await randomDelay();
      }
      
    } catch (err) {
      log(`[error] ${accountName}: ${err.message}`);
    }
  }
  
  saveState();
  
  log('\n═══════════════════════════════════════════════════════════');
  log('  RESUMEN');
  log('═══════════════════════════════════════════════════════════');
  
  const today = new Date().toISOString().split('T')[0];
  
  for (const [accountName, stats] of Object.entries(state.dailyStats)) {
    if (stats[today]) {
      log(`${accountName}: ${stats[today].comments} comentarios, ${stats[today].posts} posts`);
    }
  }
  
  log('\n✅ Proceso completado');
}

// Ejecutar
if (require.main === module) {
  main().catch(err => {
    log(`[fatal] ${err.message}`);
    process.exit(1);
  });
}

module.exports = { main };
