#!/usr/bin/env node
/**
 * test-reliableai.js — Test del método con 2 directorios de ReliableAI
 */

const { createBot, STATE } = require('./bot-engine');
const path = require('path');

const BIZ = {
  name: 'ReliableAI',
  url: 'https://www.reliableai.co',
  email: 'contact@reliableai.co',
  tagline: 'Multi-LLM research platform for reliable AI insights',
  description: 'ReliableAI is a multi-LLM research platform that queries multiple AI models simultaneously, compares responses in real-time, and synthesizes results for more reliable insights. Compare Claude, GPT, Gemini, Grok and more.',
  category: 'AI Tools',
  subcategory: 'Research & Analysis',
  pricing: 'Freemium',
  tags: 'AI, LLM, research, comparison, multi-model, Claude, GPT, Gemini',
  twitter: '@reliableai',
  github: 'https://github.com/reliableai',
  password: 'ReliableAI2024!',
};

const DIRECTORIES = [
  {
    id: 'aitoolsdirectory',
    name: 'AI Tools Directory',
    url: 'https://aitoolsdirectory.com/submit-tool', // URL correcta (no /submit)
    async submit(bot) {
      const { page, log, goto, fillField, selectOption, clickBtn, checkProgress, screenshot } = bot;
      
      log(`[start] ${this.name}`);
      
      await goto(this.url, 'spa'); // JS asíncrono
      await screenshot('aitoolsdir-initial');
      
      // Esperar a que el formulario cargue (puede tardar)
      log('[waiting] Esperando formulario JS...');
      await page.waitForSelector('form, input[type="text"], input[name], textarea', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2000);
      
      // Verificar que no sea 404
      const is404 = await page.evaluate(() => {
        return document.body.textContent.toLowerCase().includes('404') || 
               document.body.textContent.toLowerCase().includes("doesn't exist");
      });
      
      if (is404) {
        log('[error] Página 404 detectada');
        await screenshot('aitoolsdir-404', true, 'Página 404');
        return 'error — URL incorrecta (404)';
      }
      
      // Esperar formulario
      await page.waitForSelector('form input, input[type="text"]', { timeout: 10000 }).catch(() => {});
      
      log('[filling] Rellenando formulario');
      
      await fillField(['Tool name', 'Name', 'name', 'input[name="name"]'], BIZ.name);
      await fillField(['Website', 'URL', 'url', 'input[name="url"]', 'input[type="url"]'], BIZ.url);
      await fillField(['Email', 'Contact email', 'email', 'input[name="email"]', 'input[type="email"]'], BIZ.email);
      await fillField(['Tagline', 'Short description', 'tagline', 'input[name="tagline"]'], BIZ.tagline);
      await fillField(['Description', 'Long description', 'description', 'textarea[name="description"]'], BIZ.description);
      
      // Categoría
      const categoryFilled = await selectOption(
        ['select[name="category"]', '#category'],
        BIZ.category
      );
      if (!categoryFilled) {
        await fillField(['Category', 'categoria', 'input[name="category"]'], BIZ.category);
      }
      
      // Tags
      await fillField(['Tags', 'Keywords', 'tags', 'input[name="tags"]'], BIZ.tags);
      
      // Pricing
      const pricingFilled = await selectOption(
        ['select[name="pricing"]', '#pricing'],
        BIZ.pricing
      );
      if (!pricingFilled) {
        await fillField(['Pricing', 'Price', 'input[name="pricing"]'], BIZ.pricing);
      }
      
      await screenshot('aitoolsdir-filled', true, 'AI Tools Directory formulario relleno');
      
      const prevUrl = page.url();
      await clickBtn(['Submit', 'Send', 'Submit tool', 'button[type="submit"]']);
      await page.waitForTimeout(4000);
      
      const result = await screenshot('aitoolsdir-after', true, 'AI Tools Directory tras submit');
      const progress = await checkProgress(prevUrl);
      
      log(`[result] ${this.name} — ${progress}`);
      
      if (result.analysis) {
        log(`[vision] state=${result.analysis.state}, errors=${result.analysis.errors.length}`);
        if (result.analysis.errors.length) {
          log(`[vision:errors] ${result.analysis.errors.join(' | ')}`);
        }
      }
      
      return progress;
    }
  },
  
  {
    id: 'toolify',
    name: 'Toolify.ai',
    url: 'https://www.toolify.ai/submit',
    async submit(bot) {
      const { page, log, goto, fillField, selectOption, clickBtn, checkProgress, screenshot } = bot;
      
      log(`[start] ${this.name}`);
      
      await goto(this.url, 'spa'); // Toolify usa JS asíncrono
      await screenshot('toolify-initial');
      
      // Esperar formulario (puede tardar en cargar)
      log('[waiting] Esperando formulario wizard...');
      await page.waitForSelector('form, input[type="text"], input[name="name"]', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);
      
      log('[step:1] Rellenando campos iniciales (Name + URL)');
      
      // Paso 1: Name y URL (únicos campos visibles inicialmente)
      const nameFilled = await fillField(
        ['Tool Name', 'Name', 'name', 'input[placeholder*="Copy" i]', 'input[type="text"]'],
        BIZ.name
      );
      
      const urlFilled = await fillField(
        ['Website URL', 'URL', 'Website', 'url', 'input[placeholder*="url" i]', 'input[type="text"]:not(:first-child)'],
        BIZ.url
      );
      
      if (!nameFilled || !urlFilled) {
        log('[warn] No se pudieron rellenar campos iniciales');
      }
      
      await screenshot('toolify-step1', true, 'Toolify paso 1 rellenado');
      
      // Buscar botón "Next" o "Continue" para avanzar al siguiente paso
      log('[step:2] Buscando botón para continuar...');
      const nextClicked = await clickBtn([
        'Next', 'Continue', 'Siguiente', 'Continuar',
        'button[type="button"]', 'button:has-text("Next")',
        'button:has-text("Continue")', 'a:has-text("Next")'
      ]);
      
      if (nextClicked) {
        log('[step:2] Avanzando al siguiente paso...');
        await page.waitForTimeout(3000);
        
        // Esperar a que aparezcan más campos
        await page.waitForSelector('textarea, input[type="email"], select', { timeout: 10000 }).catch(() => {});
        
        log('[step:2] Rellenando campos adicionales');
        
        await fillField(['Email', 'Contact', 'email', 'input[name="email"]', 'input[type="email"]'], BIZ.email);
        await fillField(['Short Description', 'Tagline', 'tagline', 'input[name="tagline"]'], BIZ.tagline);
        await fillField(['Description', 'Long Description', 'description', 'textarea[name="description"]', 'textarea'], BIZ.description);
        
        // Categoría
        const categoryFilled = await selectOption(
          ['select[name="category"]', 'select[id*="category" i]'],
          BIZ.category
        );
        if (!categoryFilled) {
          await fillField(['Category', 'categoria', 'input[name="category"]'], BIZ.category);
        }
        
        // Tags/Keywords
        await fillField(['Tags', 'Keywords', 'tags', 'keywords', 'input[name="tags"]', 'input[name="keywords"]'], BIZ.tags);
        
        // Pricing model
        const pricingFilled = await selectOption(
          ['select[name="pricing"]', 'select[id*="pricing" i]'],
          BIZ.pricing
        );
        if (!pricingFilled) {
          await fillField(['Pricing', 'Price Model', 'pricing', 'input[name="pricing"]'], BIZ.pricing);
        }
        
        // Social (opcional)
        await fillField(['Twitter', 'twitter', 'input[name="twitter"]'], BIZ.twitter);
        
        await screenshot('toolify-step2', true, 'Toolify paso 2 rellenado');
      } else {
        log('[warn] No se encontró botón Next — puede ser formulario de 1 paso');
      }
      
      await screenshot('toolify-filled', true, 'Toolify formulario relleno');
      
      const prevUrl = page.url();
      await clickBtn(['Submit', 'Submit Tool', 'Send', 'button[type="submit"]']);
      await page.waitForTimeout(4000);
      
      const result = await screenshot('toolify-after', true, 'Toolify tras submit');
      const progress = await checkProgress(prevUrl);
      
      log(`[result] ${this.name} — ${progress}`);
      
      if (result.analysis) {
        log(`[vision] state=${result.analysis.state}, errors=${result.analysis.errors.length}`);
        if (result.analysis.errors.length) {
          log(`[vision:errors] ${result.analysis.errors.join(' | ')}`);
        }
      }
      
      return progress;
    }
  },
];

(async () => {
  console.log('=== TEST RELIABLEAI — 2 DIRECTORIOS ===\n');
  
  const bot = await createBot({
    headless: false, // Visible para debugging
    screenshotsDir: path.join(__dirname, 'screenshots'),
    logFile: path.join(__dirname, 'test-reliableai.log'),
  });
  
  const results = [];
  
  for (const dir of DIRECTORIES) {
    try {
      const result = await bot.withRetry(dir.id, async () => {
        return await dir.submit(bot);
      }, 2);
      
      results.push({ id: dir.id, name: dir.name, result });
      
      // Pausa entre directorios
      await bot.page.waitForTimeout(3000);
    } catch (err) {
      bot.log(`[error] ${dir.name} — ${err.message}`);
      results.push({ id: dir.id, name: dir.name, result: `error — ${err.message}` });
    }
  }
  
  await bot.browser.close();
  
  console.log('\n=== RESULTADOS ===\n');
  for (const r of results) {
    console.log(`${r.name}: ${r.result}`);
  }
  
  console.log('\n✅ Test completado. Revisar capturas en screenshots/ y log en test-reliableai.log');
})();
