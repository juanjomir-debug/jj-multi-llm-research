#!/usr/bin/env node
/**
 * vision-analyzer.js — Analiza capturas con GPT-4o (visión)
 */

require('dotenv').config();
const fs = require('fs');

async function analyzeScreenshot(screenshotPath, context = '') {
  const OpenAI = require('openai');
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY no está configurada en .env');

  const imageBuffer = fs.readFileSync(screenshotPath);
  const base64Image = imageBuffer.toString('base64');

  const openai = new OpenAI({ apiKey });

  const prompt = `Analiza esta captura de pantalla de un formulario web.

Contexto: ${context}

Describe:
1. ¿Qué se ve? (URL, título, formulario, confirmación)
2. ¿Hay errores visibles? Transcríbelos exactamente.
3. ¿Campos marcados en rojo?
4. ¿Modal/overlay bloqueando?
5. ¿Estado: inicial, relleno, o tras submit?
6. ¿Mensaje de éxito?

Devuelve JSON:
{
  "state": "initial|filled|submitted|error|success|blocked",
  "errors": ["errores visibles"],
  "fieldsWithErrors": ["IDs de campos con error"],
  "successMessage": "mensaje si existe",
  "diagnosis": "descripción detallada",
  "nextAction": "qué hacer"
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Image}` } },
      ],
    }],
    max_tokens: 1000,
  });

  const responseText = response.choices[0].message.content;
  
  let parsed;
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {
      state: 'unknown', errors: [], fieldsWithErrors: [],
      successMessage: '', diagnosis: responseText, nextAction: 'revisar manualmente',
    };
  } catch (e) {
    parsed = {
      state: 'unknown', errors: [], fieldsWithErrors: [],
      successMessage: '', diagnosis: responseText, nextAction: 'revisar manualmente',
    };
  }

  return parsed;
}

async function analyzeSequence(screenshots) {
  const results = [];
  for (const { path: imgPath, context } of screenshots) {
    console.log(`\nAnalizando: ${imgPath}`);
    const result = await analyzeScreenshot(imgPath, context);
    results.push({ path: imgPath, ...result });
    console.log(`Estado: ${result.state}`);
    if (result.errors.length) console.log(`Errores: ${result.errors.join(', ')}`);
  }
  return results;
}

module.exports = { analyzeScreenshot, analyzeSequence };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.log('Uso: node vision-analyzer.js <screenshot.png> [contexto]');
    process.exit(1);
  }

  analyzeScreenshot(args[0], args[1] || '')
    .then(r => console.log('\n=== ANÁLISIS ===\n', JSON.stringify(r, null, 2)))
    .catch(e => { console.error('Error:', e.message); process.exit(1); });
}
