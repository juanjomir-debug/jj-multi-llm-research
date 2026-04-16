#!/usr/bin/env node
/**
 * final-reliableai.js — Inscripción final ReliableAI
 */

const { createBot } = require('./bot-engine');
const path = require('path');

const BIZ = {
  name: 'ReliableAI',
  url: 'https://www.reliableai.co',
  email: 'contact@reliableai.co',
  tagline: 'Multi-LLM research platform for reliable AI insights',
  description: 'ReliableAI is a multi-LLM research platform that queries multiple AI models simultaneously, compares responses in real-time, and synthesizes results for more reliable insights. Compare Claude, GPT, Gemini, Grok and more.',
  category: 'AI Tools',
  pricing: 'Freemium',
  tags: 'AI, LLM, research, comparison, multi-model',
  twitter: '@reliableai',
};

(async () => {
  console.log('=== INSCRIPCIÓN FINAL RELIABLEAI ===\n');
  
  const bot = await createBot({
    headless: false,
    screenshotsDir: path.join(__dirname, 'screenshots'),
    logFile: path.join(__dirname, 'final-reliableai.log'),
  });
  
  const { page, log, goto, screenshot } = bot;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // AI TOOLS DIRECTORY
  // ═══════════════════════════════════════════════════════════════════════════
  
  try {
    log('\n[START] AI Tools Directory');
    
    await goto('https://aitoolsdirectory.com/submit-tool', 'spa');
    await page.waitForTimeout(3000);
    
    await screenshot('aitoolsdir-1-initial');
    
    // Inspeccionar campos
    const fields = await page.$$eval('input:visible, textarea:visible, select:visible', els =>
      els.map(el => ({
        tag: el.tagName,
        type: el.type,
        name: el.name,
        id: el.id,
        placeholder: el.placeholder,
      }))
    );
    
    log(`[inspect] Campos visibles (${fields.length}): ${JSON.stringify(fields, null, 2)}`);
    
    if (fields.length === 0) {
      log('[ERROR] No se encontraron campos — formulario no cargó');
      await screenshot('aitoolsdir-error', true, 'Sin campos visibles');
    } else {
      // Rellenar campos por orden de aparición
      const inputs = await page.$$('input:visible, textarea:visible, select:visible');
      
      const values = [BIZ.name, BIZ.url, BIZ.email, BIZ.tagline, BIZ.description, BIZ.category, BIZ.tags, BIZ.pricing];
      
      for (let i = 0; i < Math.min(inputs.length, values.length); i++) {
        try {
          const input = inputs[i];
          const tagName = await input.evaluate(el => el.tagName);
          
          if (tagName === 'SELECT') {
            await input.selectOption({ index: 1 });
          } else {
            await input.fill(values[i]);
          }
          
          log(`[filled] Campo ${i+1}: ${values[i].substring(0, 30)}...`);
        } catch (err) {
          log(`[warn] No se pudo rellenar campo ${i+1}: ${err.message}`);
        }
      }
      
      await screenshot('aitoolsdir-2-filled', true, 'AI Tools Directory formulario');
      
      // Submit
      const submitBtn = await page.locator('button[type="submit"], button:has-text("Submit"), input[type="submit"]').first();
      if (await submitBtn.isVisible({ timeout: 2000 })) {
        await submitBtn.click();
        await page.waitForTimeout(5000);
        
        const result = await screenshot('aitoolsdir-3-result', true, 'AI Tools Directory resultado');
        
        if (result.analysis) {
          log(`[RESULT] AI Tools Directory: ${result.analysis.state}`);
          if (result.analysis.successMessage) {
            log(`[SUCCESS] ${result.analysis.successMessage}`);
          }
          if (result.analysis.errors.length) {
            log(`[ERRORS] ${result.analysis.errors.join(' | ')}`);
          }
        }
      } else {
        log('[ERROR] No se encontró botón de submit');
      }
    }
    
  } catch (err) {
    log(`[ERROR] AI Tools Directory: ${err.message}`);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TOOLIFY
  // ═══════════════════════════════════════════════════════════════════════════
  
  try {
    log('\n[START] Toolify.ai');
    
    await goto('https://www.toolify.ai/submit', 'spa');
    await page.waitForTimeout(3000);
    
    await screenshot('toolify-1-initial');
    
    // Inspeccionar campos
    const fields = await page.$$eval('input:visible, textarea:visible', els =>
      els.map(el => ({
        tag: el.tagName,
        type: el.type,
        placeholder: el.placeholder,
      }))
    );
    
    log(`[inspect] Campos visibles: ${JSON.stringify(fields, null, 2)}`);
    
    // Rellenar campos visibles (Name + URL)
    const inputs = await page.$$('input[type="text"]:visible');
    
    if (inputs.length >= 2) {
      await inputs[0].fill(BIZ.name);
      await inputs[1].fill(BIZ.url);
      log('[filled] Name y URL rellenados');
      
      await screenshot('toolify-2-step1', true, 'Toolify paso 1');
      
      // Buscar botón Next/Continue
      const nextBtn = await page.locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Submit")').first();
      if (await nextBtn.isVisible({ timeout: 2000 })) {
        const btnText = await nextBtn.textContent();
        log(`[click] Botón: ${btnText}`);
        
        await nextBtn.click();
        await page.waitForTimeout(3000);
        
        // Si hay más campos, rellenarlos
        const moreFields = await page.$$('input:visible, textarea:visible, select:visible');
        log(`[inspect] Campos tras click: ${moreFields.length}`);
        
        if (moreFields.length > 2) {
          log('[step:2] Rellenando campos adicionales...');
          
          // Email
          const emailInput = await page.locator('input[type="email"]').first();
          if (await emailInput.isVisible({ timeout: 2000 })) {
            await emailInput.fill(BIZ.email);
          }
          
          // Description
          const descTextarea = await page.locator('textarea').first();
          if (await descTextarea.isVisible({ timeout: 2000 })) {
            await descTextarea.fill(BIZ.description);
          }
          
          await screenshot('toolify-3-step2', true, 'Toolify paso 2');
          
          // Submit final
          const submitBtn = await page.locator('button[type="submit"], button:has-text("Submit")').first();
          if (await submitBtn.isVisible({ timeout: 2000 })) {
            await submitBtn.click();
            await page.waitForTimeout(5000);
          }
        }
        
        const result = await screenshot('toolify-4-result', true, 'Toolify resultado');
        
        if (result.analysis) {
          log(`[RESULT] Toolify: ${result.analysis.state}`);
          if (result.analysis.successMessage) {
            log(`[SUCCESS] ${result.analysis.successMessage}`);
          }
          if (result.analysis.errors.length) {
            log(`[ERRORS] ${result.analysis.errors.join(' | ')}`);
          }
        }
      } else {
        log('[warn] No se encontró botón Next/Continue');
      }
    } else {
      log('[ERROR] No se encontraron suficientes campos');
    }
    
  } catch (err) {
    log(`[ERROR] Toolify: ${err.message}`);
  }
  
  await bot.browser.close();
  
  console.log('\n✅ Proceso completado. Revisar capturas y log.');
})();
