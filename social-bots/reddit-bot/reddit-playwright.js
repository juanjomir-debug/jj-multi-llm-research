#!/usr/bin/env node
/**
 * reddit-playwright.js — Bot de Reddit con Playwright (sin API)
 * Similar al bot de Twitter, usa navegador real
 */

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const LOG_FILE = path.join(__dirname, 'reddit-playwright.log');
const STATE_FILE = path.join(__dirname, 'reddit-state.json');
const COOKIES_FILE = path.join(__dirname, 'reddit-cookies.json');

// Estado persistente
let state = {
  processedPosts: [],
  dailyComments: {},
  lastActionTime: 0,
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

// Configuración
const CONFIG = {
  username: process.env.REDDIT_USERNAME || 'reliableai_official',
  password: process.env.REDDIT_PASSWORD,
  
  // Modo: 'karma' (sin mencionar producto) o 'promote' (con menciones)
  mode: process.env.REDDIT_MODE || 'karma',
  
  subreddits: [
    'artificial',
    'ChatGPT',
    'OpenAI',
    'ClaudeAI',
    'LocalLLaMA',
  ],
  
  keywords: [
    'compare llm',
    'multiple ai models',
    'claude vs gpt',
    'best ai tool',
    'ai comparison',
    'which ai is better',
    'llm benchmark',
    'how to use',
    'what is the best',
    'recommendations',
  ],
  
  maxCommentsPerDay: 5,
  minDelayMinutes: 10,
  maxDelayMinutes: 30,
};

// Verificar límites diarios
function canComment() {
  const today = new Date().toISOString().split('T')[0];
  
  if (!state.dailyComments[today]) {
    state.dailyComments[today] = 0;
  }
  
  if (state.dailyComments[today] >= CONFIG.maxCommentsPerDay) {
    log(`[limit] Límite diario alcanzado (${CONFIG.maxCommentsPerDay})`);
    return false;
  }
  
  // Verificar delay mínimo
  const now = Date.now();
  const minDelay = CONFIG.minDelayMinutes * 60 * 1000;
  
  if (now - state.lastActionTime < minDelay) {
    log(`[delay] Esperando delay mínimo`);
    return false;
  }
  
  return true;
}

// Registrar comentario
function recordComment() {
  const today = new Date().toISOString().split('T')[0];
  
  if (!state.dailyComments[today]) {
    state.dailyComments[today] = 0;
  }
  
  state.dailyComments[today]++;
  state.lastActionTime = Date.now();
  saveState();
}

// Login en Reddit
async function loginReddit(page) {
  log('[login] Iniciando sesión en Reddit...');
  
  // Intentar cargar cookies guardadas
  if (fs.existsSync(COOKIES_FILE)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE));
    await page.context().addCookies(cookies);
    log('[login] Cookies cargadas');
    
    // Verificar si sigue logueado
    await page.goto('https://www.reddit.com', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    const loggedIn = await page.locator(`a[href="/user/${CONFIG.username}"]`).isVisible({ timeout: 5000 }).catch(() => false);
    
    if (loggedIn) {
      log('[login] ✅ Ya logueado con cookies');
      return true;
    }
    
    log('[login] Cookies expiradas, haciendo login...');
  }
  
  // Login manual
  await page.goto('https://www.reddit.com/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  
  // Buscar formulario de login (puede estar en iframe o modal)
  const usernameInput = page.locator('input[name="username"], input[id="loginUsername"]').first();
  const passwordInput = page.locator('input[name="password"], input[id="loginPassword"]').first();
  
  const usernameVisible = await usernameInput.isVisible({ timeout: 10000 }).catch(() => false);
  
  if (!usernameVisible) {
    log('[login] ❌ No se encontró formulario de login');
    return false;
  }
  
  // Rellenar formulario
  await usernameInput.fill(CONFIG.username);
  await page.waitForTimeout(1000);
  await passwordInput.fill(CONFIG.password);
  await page.waitForTimeout(1000);
  
  // Buscar botón de login (varios selectores posibles)
  const loginBtn = page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Log In")').first();
  
  const btnVisible = await loginBtn.isVisible({ timeout: 5000 }).catch(() => false);
  
  if (!btnVisible) {
    log('[login] ❌ No se encontró botón de login');
    return false;
  }
  
  // Click login
  await loginBtn.click();
  await page.waitForTimeout(10000); // Esperar más tiempo para el login
  
  // Verificar login exitoso
  const loggedIn = await page.locator(`a[href="/user/${CONFIG.username}"]`).isVisible({ timeout: 10000 }).catch(() => false);
  
  if (loggedIn) {
    log('[login] ✅ Login exitoso');
    
    // Guardar cookies
    const cookies = await page.context().cookies();
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
    log('[login] Cookies guardadas');
    
    return true;
  }
  
  log('[login] ❌ Login fallido - verificar credenciales');
  return false;
}

// Buscar posts relevantes
async function findRelevantPosts(page, subreddit) {
  log(`[search] Buscando en r/${subreddit}...`);
  
  await page.goto(`https://www.reddit.com/r/${subreddit}/new`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  // Scroll para cargar más posts
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);
  
  // Extraer posts
  const posts = await page.evaluate((keywords) => {
    const postElements = document.querySelectorAll('[data-testid="post-container"]');
    const results = [];
    
    for (const el of postElements) {
      const titleEl = el.querySelector('h3');
      const linkEl = el.querySelector('a[data-click-id="body"]');
      const scoreEl = el.querySelector('[data-testid="vote-count"]');
      const commentsEl = el.querySelector('a[href*="/comments/"]');
      
      if (!titleEl || !linkEl) continue;
      
      const title = titleEl.textContent;
      const url = linkEl.href;
      const score = scoreEl ? parseInt(scoreEl.textContent) || 0 : 0;
      const numComments = commentsEl ? parseInt(commentsEl.textContent) || 0 : 0;
      
      // Buscar keywords
      const text = title.toLowerCase();
      const matches = keywords.filter(kw => text.includes(kw.toLowerCase()));
      
      if (matches.length > 0 && score >= 5) {
        results.push({
          title,
          url,
          score,
          numComments,
          matches,
        });
      }
    }
    
    return results;
  }, CONFIG.keywords);
  
  log(`[search] Encontrados ${posts.length} posts relevantes`);
  
  // Filtrar ya procesados
  const newPosts = posts.filter(p => !state.processedPosts.includes(p.url));
  
  log(`[search] ${newPosts.length} posts nuevos`);
  
  // Ordenar por score
  newPosts.sort((a, b) => b.score - a.score);
  
  return newPosts;
}

// Generar respuesta con GPT-4
async function generateResponse(post) {
  log('[gpt] Generando respuesta...');
  
  let prompt;
  
  if (CONFIG.mode === 'karma') {
    // Modo construcción de karma: SIN mencionar producto
    prompt = `Eres un usuario experto de Reddit interesado en IA y LLMs.

Post de Reddit:
Título: ${post.title}
Keywords relevantes: ${post.matches.join(', ')}

Genera una respuesta útil y natural que:
1. Responda a la pregunta o aporte valor real
2. NO menciones ningún producto o herramienta específica
3. Comparte conocimiento técnico o experiencia personal
4. Sea conversacional y amigable
5. Máximo 150 palabras
6. No uses emojis
7. Escribe en el idioma del post (inglés si es en inglés)

Respuesta:`;
  } else {
    // Modo promoción: puede mencionar ReliableAI si es relevante
    prompt = `Eres un usuario de Reddit que usa ReliableAI (https://www.reliableai.net), una plataforma para comparar respuestas de múltiples LLMs.

Post de Reddit:
Título: ${post.title}
Keywords relevantes: ${post.matches.join(', ')}

Genera una respuesta útil y natural que:
1. Responda a la pregunta o aporte valor
2. Mencione ReliableAI de forma natural (solo si es relevante)
3. Sea conversacional, no promocional
4. Máximo 150 palabras
5. No uses emojis
6. Escribe en el idioma del post (inglés si es en inglés)

Respuesta:`;
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    max_tokens: 200,
  });
  
  const response = completion.choices[0].message.content.trim();
  
  log(`[gpt] Respuesta generada (${CONFIG.mode} mode): ${response.substring(0, 100)}...`);
  
  return response;
}

// Comentar en un post
async function commentOnPost(page, post, response) {
  log(`[comment] Navegando a: ${post.title.substring(0, 50)}...`);
  
  await page.goto(post.url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  // Buscar caja de comentarios
  const commentBox = page.locator('textarea[placeholder*="What are your thoughts"]').first();
  
  const visible = await commentBox.isVisible({ timeout: 5000 }).catch(() => false);
  
  if (!visible) {
    log('[comment] ⚠️ No se encontró caja de comentarios');
    return false;
  }
  
  // Escribir comentario
  await commentBox.click();
  await page.waitForTimeout(1000);
  
  await commentBox.fill(response);
  await page.waitForTimeout(2000);
  
  // Buscar botón de comentar
  const submitBtn = page.locator('button:has-text("Comment")').first();
  
  const btnVisible = await submitBtn.isVisible({ timeout: 5000 }).catch(() => false);
  
  if (!btnVisible) {
    log('[comment] ⚠️ No se encontró botón Comment');
    return false;
  }
  
  // Click comentar
  await submitBtn.click();
  await page.waitForTimeout(5000);
  
  // Verificar que se publicó
  const success = await page.locator('text="Comment"').count() > 0;
  
  if (success) {
    log('[comment] ✅ Comentario publicado');
    state.processedPosts.push(post.url);
    recordComment();
    return true;
  }
  
  log('[comment] ❌ Error al publicar');
  return false;
}

// Delay aleatorio
async function randomDelay() {
  const min = CONFIG.minDelayMinutes * 60 * 1000;
  const max = CONFIG.maxDelayMinutes * 60 * 1000;
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  
  log(`[delay] Esperando ${Math.floor(delay / 60000)} minutos...`);
  await new Promise(r => setTimeout(r, delay));
}

// Main
async function main() {
  log('═══════════════════════════════════════════════════════════');
  log('  REDDIT BOT — Playwright');
  log('═══════════════════════════════════════════════════════════');
  
  if (!CONFIG.password) {
    log('[error] Falta REDDIT_PASSWORD en .env');
    process.exit(1);
  }
  
  const browser = await chromium.launch({
    headless: false, // Cambiar a true en producción
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  
  const page = await context.newPage();
  
  try {
    // Login
    const loggedIn = await loginReddit(page);
    
    if (!loggedIn) {
      log('[error] No se pudo hacer login');
      await browser.close();
      return;
    }
    
    // Procesar subreddits
    for (const subreddit of CONFIG.subreddits) {
      if (!canComment()) {
        log('[limit] Límite alcanzado, terminando');
        break;
      }
      
      const posts = await findRelevantPosts(page, subreddit);
      
      if (posts.length === 0) {
        log(`[skip] No hay posts relevantes en r/${subreddit}`);
        continue;
      }
      
      // Comentar en el más relevante
      const post = posts[0];
      
      log(`[selected] ${post.title}`);
      log(`[selected] Score: ${post.score}, Comments: ${post.numComments}`);
      
      const response = await generateResponse(post);
      
      const success = await commentOnPost(page, post, response);
      
      if (success) {
        log('[success] ✅ Comentario publicado en r/' + subreddit);
        
        // Delay antes del siguiente
        if (canComment()) {
          await randomDelay();
        }
      }
    }
    
  } catch (err) {
    log(`[error] ${err.message}`);
  }
  
  await browser.close();
  
  saveState();
  
  log('═══════════════════════════════════════════════════════════');
  log('  RESUMEN');
  log('═══════════════════════════════════════════════════════════');
  
  const today = new Date().toISOString().split('T')[0];
  log(`Comentarios hoy: ${state.dailyComments[today] || 0}/${CONFIG.maxCommentsPerDay}`);
  log(`Posts procesados total: ${state.processedPosts.length}`);
  
  log('\n✅ Proceso completado');
}

if (require.main === module) {
  main().catch(err => {
    log(`[fatal] ${err.message}`);
    process.exit(1);
  });
}

module.exports = { main };
