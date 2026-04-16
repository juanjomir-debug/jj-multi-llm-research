#!/usr/bin/env node
/**
 * reddit-with-cookies.js — Bot de Reddit usando cookies manuales
 * 
 * INSTRUCCIONES:
 * 1. Abre Chrome y ve a old.reddit.com (logueado)
 * 2. Abre DevTools (F12) → Application → Cookies → https://old.reddit.com
 * 3. Copia las cookies y pégalas en reddit-cookies-manual.json:
 * 
 * [
 *   { "name": "reddit_session", "value": "...", "domain": ".reddit.com", "path": "/" },
 *   { "name": "token_v2", "value": "...", "domain": ".reddit.com", "path": "/" },
 *   { "name": "edgebucket", "value": "...", "domain": ".reddit.com", "path": "/" }
 * ]
 */

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const LOG_FILE = path.join(__dirname, 'reddit-with-cookies.log');
const COOKIES_FILE = path.join(__dirname, 'reddit-cookies-manual.json');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

const CONFIG = {
  subreddits: ['artificial', 'ChatGPT'],
  keywords: ['compare llm', 'multiple ai', 'claude vs gpt', 'best ai'],
};

async function main() {
  log('═══════════════════════════════════════════════════════════');
  log('  REDDIT BOT — Con cookies manuales');
  log('═══════════════════════════════════════════════════════════');
  
  // Verificar que existen las cookies
  if (!fs.existsSync(COOKIES_FILE)) {
    log('[error] ❌ No se encontró reddit-cookies-manual.json');
    log('[error] Sigue las instrucciones en el archivo para crear el JSON de cookies');
    return;
  }
  
  const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
  log(`[cookies] Cargadas ${cookies.length} cookies`);
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  
  // Inyectar cookies
  await context.addCookies(cookies);
  log('[cookies] ✅ Cookies inyectadas');
  
  const page = await context.newPage();
  
  try {
    // Verificar sesión
    log('[login] Verificando sesión...');
    await page.goto('https://old.reddit.com');
    await page.waitForTimeout(3000);
    
    const loggedIn = await page.locator('a[href*="/user/"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    
    if (!loggedIn) {
      log('[login] ❌ Sesión no válida - las cookies expiraron o son incorrectas');
      await browser.close();
      return;
    }
    
    log('[login] ✅ Sesión activa');
    
    // Buscar posts en r/artificial
    log('[search] Buscando posts en r/artificial...');
    await page.goto('https://old.reddit.com/r/artificial/new');
    await page.waitForTimeout(3000);
    
    // Extraer posts
    const posts = await page.evaluate(() => {
      const results = [];
      const things = document.querySelectorAll('.thing');
      
      for (const thing of things) {
        const titleEl = thing.querySelector('.title a');
        const scoreEl = thing.querySelector('.score');
        
        if (!titleEl) continue;
        
        const title = titleEl.textContent;
        const url = titleEl.href;
        const score = scoreEl ? parseInt(scoreEl.textContent) || 0 : 0;
        
        results.push({ title, url, score });
      }
      
      return results;
    });
    
    log(`[search] Encontrados ${posts.length} posts`);
    
    // Intentar con varios posts hasta encontrar uno donde se pueda comentar
    let commented = false;
    
    for (let i = 0; i < Math.min(5, posts.length) && !commented; i++) {
      const post = posts[i];
      log(`\n[post ${i+1}] ${post.title}`);
      log(`[post ${i+1}] Score: ${post.score}`);
      log(`[post ${i+1}] URL: ${post.url}`);
      
      // Navegar al post
      log(`[post ${i+1}] Navegando...`);
      await page.goto(post.url);
      await page.waitForTimeout(3000);
      
      // Scroll down para cargar la sección de comentarios
      await page.evaluate(() => window.scrollTo(0, 500));
      await page.waitForTimeout(1000);
      
      // Buscar caja de comentarios (varios selectores posibles)
      let commentBox = page.locator('textarea[name="text"]').first();
      let visible = await commentBox.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (!visible) {
        // Intentar con otro selector
        commentBox = page.locator('textarea.usertext-edit').first();
        visible = await commentBox.isVisible({ timeout: 2000 }).catch(() => false);
      }
      
      if (!visible) {
        // Intentar hacer click en "add a comment" si existe
        const addCommentLink = page.locator('a:has-text("add a comment")').first();
        const linkVisible = await addCommentLink.isVisible({ timeout: 2000 }).catch(() => false);
        
        if (linkVisible) {
          await addCommentLink.click();
          await page.waitForTimeout(1000);
          commentBox = page.locator('textarea[name="text"]').first();
          visible = await commentBox.isVisible({ timeout: 2000 }).catch(() => false);
        }
      }
      
      if (!visible) {
        log(`[post ${i+1}] ⚠️ No se puede comentar aquí`);
        
        // Extraer HTML para debug
        const html = await page.content();
        const hasCommentForm = html.includes('usertext-edit') || html.includes('name="text"');
        const hasLoginPrompt = html.includes('login') || html.includes('sign in');
        
        log(`[post ${i+1}] Debug: hasCommentForm=${hasCommentForm}, hasLoginPrompt=${hasLoginPrompt}`);
        
        if (hasLoginPrompt) {
          log(`[post ${i+1}] ❌ Sesión expiró - necesitas volver a exportar cookies`);
          break;
        }
        
        log(`[post ${i+1}] Probando siguiente...`);
        continue;
      }
      
      // Generar respuesta
      log(`[post ${i+1}] ✅ Se puede comentar! Generando respuesta...`);
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `Eres un usuario experto de Reddit interesado en IA.

Post: ${post.title}

Genera una respuesta útil de máximo 100 palabras que aporte valor real. NO menciones productos. Escribe en inglés.`
        }],
        temperature: 0.8,
        max_tokens: 150,
      });
      
      const response = completion.choices[0].message.content.trim();
      log(`[post ${i+1}] Respuesta: ${response}`);
      
      // Escribir comentario
      log(`[post ${i+1}] Escribiendo comentario...`);
      await commentBox.fill(response);
      await page.waitForTimeout(2000);
      
      // Submit
      await page.click('button[type="submit"]');
      await page.waitForTimeout(5000);
      
      log(`[post ${i+1}] ✅ Comentario publicado!`);
      commented = true;
    }
    
    if (!commented) {
      log('\n⚠️ No se pudo comentar en ningún post');
    }
    
  } catch (err) {
    log(`[error] ${err.message}`);
  }
  
  await page.waitForTimeout(5000);
  await browser.close();
  
  log('✅ Proceso completado');
}

main().catch(err => {
  log(`[fatal] ${err.message}`);
  process.exit(1);
});
