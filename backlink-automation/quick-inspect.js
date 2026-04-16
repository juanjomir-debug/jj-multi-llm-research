#!/usr/bin/env node
/**
 * quick-inspect.js — Inspección rápida de formularios para descubrir selectores
 */

const { createBot } = require('./bot-engine');

const URLS = [
  'https://aitoolsdirectory.com',
  'https://www.toolify.ai',
];

(async () => {
  const bot = await createBot({ headless: false });
  const { page, log } = bot;
  
  for (const url of URLS) {
    log(`\n=== Inspeccionando: ${url} ===`);
    
    try {
      await bot.goto(url, 'spa');
      
      // Buscar link de submit
      const submitLinks = await page.$$eval('a[href*="submit"], a:has-text("Submit"), a:has-text("Add"), button:has-text("Submit")', els => 
        els.map(el => ({ text: el.textContent.trim(), href: el.href }))
      );
      
      log(`Links de submit encontrados: ${JSON.stringify(submitLinks, null, 2)}`);
      
      // Si hay un link, seguirlo
      if (submitLinks.length > 0) {
        const submitUrl = submitLinks[0].href;
        log(`Navegando a: ${submitUrl}`);
        await bot.goto(submitUrl, 'spa');
        await page.waitForTimeout(3000);
      }
      
      // Extraer todos los inputs visibles
      const inputs = await page.$$eval('input:visible, textarea:visible, select:visible', els =>
        els.map(el => ({
          tag: el.tagName.toLowerCase(),
          type: el.type,
          name: el.name,
          id: el.id,
          placeholder: el.placeholder,
          label: el.labels?.[0]?.textContent?.trim(),
          required: el.required,
        }))
      );
      
      log(`\nCampos encontrados (${inputs.length}):`);
      inputs.forEach((inp, i) => {
        log(`  ${i+1}. ${inp.tag}[type="${inp.type}"] name="${inp.name}" id="${inp.id}" placeholder="${inp.placeholder}" label="${inp.label}" ${inp.required ? 'REQUIRED' : ''}`);
      });
      
      await bot.screenshot(`inspect-${url.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '-')}`);
      
    } catch (err) {
      log(`Error: ${err.message}`);
    }
  }
  
  await bot.browser.close();
  log('\n✅ Inspección completada');
})();
