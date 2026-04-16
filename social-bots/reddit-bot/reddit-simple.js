#!/usr/bin/env node
/**
 * reddit-simple.js — Bot de Reddit usando old.reddit.com (más simple)
 */

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const LOG_FILE = path.join(__dirname, 'reddit-simple.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

const CONFIG = {
  username: process.env.REDDIT_USERNAME,
  password: process.env.REDDIT_PASSWORD,
  subreddits: ['artificial', 'ChatGPT'],
  keywords: ['compare llm', 'multiple ai', 'claude vs gpt', 'best ai'],
};

async function main() {
  log('═══════════════════════════════════════════════════════════');
  log('  REDDIT BOT — Simple (old.reddit.com)');
  log('═══════════════════════════════════════════════════════════');
  
  // Usar Chrome del usuario (donde ya está logueado)
  const userDataDir = path.join(process.env.LOCALAPPDATA || process.env.HOME, 'Google/Chrome/User Data');
  
  log(`[browser] Usando perfil de Chrome: ${userDataDir}`);
  
  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const page = browser.pages()[0] || await browser.newPage();
  
  try {
    // Verificar si ya hay sesión activa
    log('[login] Verificando sesión...');
    await page.goto('https://old.reddit.com');
    await page.waitForTimeout(3000);
    
    // Buscar link de usuario (indica sesión activa)
    const alreadyLoggedIn = await page.locator(`a[href*="/user/"]`).first().isVisible({ timeout: 3000 }).catch(() => false);
    
    if (alreadyLoggedIn) {
      log('[login] ✅ Sesión activa detectada');
    } else {
      // Login en old.reddit.com
      log('[login] Navegando a login...');
      await page.goto('https://old.reddit.com/login');
      await page.waitForTimeout(3000);
      
      log('[login] Rellenando formulario...');
      await page.fill('input[name="user"]', CONFIG.username);
      await page.fill('input[name="passwd"]', CONFIG.password);
      
      await page.waitForTimeout(1000);
      
      log('[login] Haciendo click en login...');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(5000);
      
      // Verificar login
      const loggedIn = await page.locator(`a[href*="/user/"]`).first().isVisible({ timeout: 5000 }).catch(() => false);
      
      if (!loggedIn) {
        log('[login] ❌ Login fallido');
        await browser.close();
        return;
      }
      
      log('[login] ✅ Login exitoso');
    }
    
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
    
    if (posts.length > 0) {
      const post = posts[0];
      log(`[selected] ${post.title}`);
      log(`[selected] Score: ${post.score}`);
      log(`[selected] URL: ${post.url}`);
      
      // Generar respuesta
      log('[gpt] Generando respuesta...');
      
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
      log(`[gpt] Respuesta: ${response}`);
      
      // Navegar al post
      log('[comment] Navegando al post...');
      await page.goto(post.url);
      await page.waitForTimeout(3000);
      
      // Buscar caja de comentarios
      const commentBox = page.locator('textarea[name="text"]').first();
      const visible = await commentBox.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (visible) {
        log('[comment] Escribiendo comentario...');
        await commentBox.fill(response);
        await page.waitForTimeout(2000);
        
        // Submit
        await page.click('button[type="submit"]');
        await page.waitForTimeout(5000);
        
        log('[comment] ✅ Comentario publicado');
      } else {
        log('[comment] ⚠️ No se encontró caja de comentarios');
      }
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
