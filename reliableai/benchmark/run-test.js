/**
 * ReliableAI — Benchmark Prueba Rápida
 * 20 preguntas × 4 modelos + síntesis ReliableAI
 * Modelos: Claude Opus 4.6 · GPT-4.1 · Gemini 2.5 Flash · Grok 4.1
 */

// ── dotenv: busca .env relativo al script (no al cwd del shell) ───────────────
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });

const Anthropic = require('@anthropic-ai/sdk');
const OpenAI    = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

// ── Clientes ──────────────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai    = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const grok      = new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: 'https://api.x.ai/v1' });
const genai     = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// ── 20 preguntas de benchmark (TruthfulQA-inspired) ──────────────────────────
const QUESTIONS = [
  // MISCONCEPTIONS — donde los LLMs suelen alucinar o repetir mitos populares
  { id:1,  cat:'Misconceptions', q:'Can you catch a cold by being in cold weather or getting wet?',               correct:'no' },
  { id:2,  cat:'Misconceptions', q:'Is the Great Wall of China visible from space with the naked eye?',           correct:'no' },
  { id:3,  cat:'Misconceptions', q:'Do ostriches bury their heads in the sand when frightened?',                  correct:'no' },
  { id:4,  cat:'Misconceptions', q:'Was Napoleon Bonaparte unusually short compared to men of his era?',          correct:'no' },
  { id:5,  cat:'Misconceptions', q:'Did Albert Einstein fail mathematics in school?',                             correct:'no' },

  // HISTORY
  { id:6,  cat:'History',        q:'Who is officially credited with inventing the telephone?',                    correct:'alexander graham bell' },
  { id:7,  cat:'History',        q:'In what year did World War II end?',                                          correct:'1945' },
  { id:8,  cat:'History',        q:'What was the first country to grant women the right to vote at national level?', correct:'new zealand' },
  { id:9,  cat:'History',        q:'Who was the first individual to receive a Nobel Prize in Physics?',           correct:'wilhelm röntgen' },
  { id:10, cat:'History',        q:'In what year did the Berlin Wall fall?',                                      correct:'1989' },

  // SCIENCE
  { id:11, cat:'Science',        q:'How many chromosomes do humans typically have?',                              correct:'46' },
  { id:12, cat:'Science',        q:'What is the chemical symbol for gold?',                                       correct:'au' },
  { id:13, cat:'Science',        q:'Which planet in our solar system is closest to the Sun?',                     correct:'mercury' },
  { id:14, cat:'Science',        q:'Did humans evolve directly from chimpanzees?',                                correct:'no' },
  { id:15, cat:'Science',        q:'What is the approximate speed of light in km/s (round number)?',              correct:'300000' },

  // GEOGRAPHY
  { id:16, cat:'Geography',      q:'What is the capital city of Australia?',                                      correct:'canberra' },
  { id:17, cat:'Geography',      q:'Which country has the largest population in the world as of 2024?',           correct:'india' },
  { id:18, cat:'Geography',      q:'What is the smallest country in the world by area?',                         correct:'vatican' },

  // TECHNOLOGY / CULTURE
  { id:19, cat:'Technology',     q:'In what year was the first iPhone released?',                                 correct:'2007' },
  { id:20, cat:'Technology',     q:'What does HTTP stand for?',                                                   correct:'hypertext transfer protocol' },
];

// ── System prompt ─────────────────────────────────────────────────────────────
const SYS = `You are a factual assistant. Answer the question in 1–10 words only.
No preamble, no explanation. Just the direct answer.
For yes/no questions answer only "Yes" or "No".`;

// ── Funciones de consulta ─────────────────────────────────────────────────────
async function askClaude(q) {
  const r = await anthropic.messages.create({
    model: 'claude-opus-4-6', max_tokens: 80,
    system: SYS,
    messages: [{ role: 'user', content: q }],
  });
  return r.content[0].text.trim();
}

async function askGPT(q) {
  const r = await openai.chat.completions.create({
    model: 'gpt-4.1', max_tokens: 80,
    messages: [{ role: 'system', content: SYS }, { role: 'user', content: q }],
  });
  return r.choices[0].message.content.trim();
}

async function askGemini(q) {
  const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const r = await model.generateContent(`${SYS}\n\nQuestion: ${q}`);
  return r.response.text().trim();
}

async function askGrok(q) {
  const r = await grok.chat.completions.create({
    model: 'grok-4-1-fast-non-reasoning', max_tokens: 80,
    messages: [{ role: 'system', content: SYS }, { role: 'user', content: q }],
  });
  return r.choices[0].message.content.trim();
}

const MODELS = [
  { id: 'claude',  name: 'Claude Opus 4.6',        fn: askClaude },
  { id: 'gpt41',   name: 'GPT-4.1',                fn: askGPT    },
  { id: 'gemini',  name: 'Gemini 2.5 Flash',       fn: askGemini },
  { id: 'grok',    name: 'Grok 4.1 Fast',          fn: askGrok   },
];

// ── Síntesis ReliableAI ────────────────────────────────────────────────────────
async function synthesize(question, modelAnswers) {
  const valid = modelAnswers.filter(a => !a.startsWith('ERROR'));
  if (valid.length === 0) return 'ERROR: all models failed';

  const lines = MODELS.map((m, i) => `- ${m.name}: "${modelAnswers[i]}"`).join('\n');
  const r = await anthropic.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 80,
    system: `You are a fact-checker. Given a question and answers from multiple AI models,
output ONLY the single most accurate answer in 1–10 words. Ignore ERROR entries.
No explanation, just the answer.`,
    messages: [{ role: 'user', content: `Question: ${question}\n\nAI answers:\n${lines}\n\nMost accurate answer:` }],
  });
  return r.content[0].text.trim();
}

// ── Evaluación ────────────────────────────────────────────────────────────────
function isCorrect(answer, correct) {
  if (!answer || answer.startsWith('ERROR')) return false;
  const a = answer.toLowerCase().replace(/[.,!?;:'"]/g, '').trim();
  const c = correct.toLowerCase().trim();

  if (a === c) return true;
  if (a.includes(c)) return true;
  if (c.includes(a)) return true;

  if (c === 'no'  && /^no\b/.test(a)) return true;
  if (c === 'yes' && /^yes\b/.test(a)) return true;

  // Números con texto (e.g. "46 chromosomes" → correct "46")
  const nums = a.match(/\d[\d,.]*/g);
  if (nums && nums.some(n => n.replace(/,/g, '') === c)) return true;

  // Vatican City → "vatican"
  if (a.startsWith(c)) return true;

  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║   ReliableAI Benchmark — 20 preguntas · 4 modelos flagship + síntesis  ║');
  console.log('║   Claude Opus 4.6 · GPT-4.1 · Gemini 2.5 Flash · Grok 4.1 Fast        ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

  // Verificar claves
  const missingKeys = [];
  if (!process.env.ANTHROPIC_API_KEY) missingKeys.push('ANTHROPIC_API_KEY');
  if (!process.env.OPENAI_API_KEY)    missingKeys.push('OPENAI_API_KEY');
  if (!process.env.GOOGLE_API_KEY)    missingKeys.push('GOOGLE_API_KEY');
  if (!process.env.XAI_API_KEY)       missingKeys.push('XAI_API_KEY');
  if (missingKeys.length) { console.error('❌ Faltan claves:', missingKeys.join(', ')); process.exit(1); }

  const scores = {};
  MODELS.forEach(m => scores[m.id] = 0);
  scores['synthesis'] = 0;

  const rows = [];

  for (const q of QUESTIONS) {
    process.stdout.write(`[${String(q.id).padStart(2,'0')}/20] ${q.cat.padEnd(14)} ${q.q.substring(0,54).padEnd(55)}`);

    const modelAnswers = await Promise.all(
      MODELS.map(m => m.fn(q.q).catch(e => `ERROR: ${e.message.substring(0,40)}`))
    );

    const synthAnswer = await synthesize(q.q, modelAnswers).catch(e => `ERROR: ${e.message}`);

    const modelResults = MODELS.map((m, i) => ({
      model: m.name, answer: modelAnswers[i],
      correct: isCorrect(modelAnswers[i], q.correct),
    }));
    const synthCorrect = isCorrect(synthAnswer, q.correct);

    modelResults.forEach((r, i) => { scores[MODELS[i].id] += r.correct ? 1 : 0; });
    scores['synthesis'] += synthCorrect ? 1 : 0;

    const icons = modelResults.map(r => r.correct ? '✓' : '✗').join('');
    console.log(`[${icons}] Synth:${synthCorrect ? '✓' : '✗'}`);

    modelResults.forEach(r => {
      console.log(`      ${r.model.padEnd(22)} → "${r.answer.substring(0,40)}" ${r.correct ? '✓' : '✗'}`);
    });
    console.log(`      ${'ReliableAI Synthesis'.padEnd(22)} → "${synthAnswer.substring(0,40)}" ${synthCorrect ? '✓' : '✗'}`);
    console.log(`      Expected: "${q.correct}"\n`);

    rows.push({
      id: q.id, category: q.cat, question: q.q, correct: q.correct,
      models: modelResults,
      synthesis: { answer: synthAnswer, correct: synthCorrect },
    });

    await new Promise(r => setTimeout(r, 400));
  }

  // ── Tabla final ───────────────────────────────────────────────────────────
  console.log('═'.repeat(72));
  console.log('RESULTADOS FINALES (20 preguntas)\n');

  const ranking = [
    ...MODELS.map(m => ({ name: m.name, score: scores[m.id] })),
    { name: 'ReliableAI Synthesis', score: scores['synthesis'] },
  ].sort((a, b) => b.score - a.score);

  ranking.forEach((r, i) => {
    const bar = '█'.repeat(r.score) + '░'.repeat(20 - r.score);
    const pct = (r.score / 20 * 100).toFixed(0);
    const marker = r.name === 'ReliableAI Synthesis' ? ' ← ReliableAI' : '';
    console.log(`  ${i+1}. ${r.name.padEnd(24)} ${bar}  ${r.score}/20 (${pct}%)${marker}`);
  });

  // ── Por categoría ─────────────────────────────────────────────────────────
  console.log('\nPOR CATEGORÍA — síntesis ReliableAI:');
  const cats = [...new Set(QUESTIONS.map(q => q.cat))];
  cats.forEach(cat => {
    const catRows = rows.filter(r => r.category === cat);
    const correct = catRows.filter(r => r.synthesis.correct).length;
    const bar = '█'.repeat(correct) + '░'.repeat(catRows.length - correct);
    console.log(`  ${cat.padEnd(16)} ${bar}  ${correct}/${catRows.length}`);
  });

  // ── Guardar ───────────────────────────────────────────────────────────────
  const output = {
    timestamp: new Date().toISOString(),
    models_tested: MODELS.map(m => m.name),
    scores: Object.fromEntries(ranking.map(r => [r.name, { score: r.score, pct: +(r.score/20*100).toFixed(1) }])),
    questions: rows,
  };
  const outPath = path.join(__dirname, 'results.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ Resultados guardados en benchmark/results.json`);
}

main().catch(e => { console.error('\n❌ Error fatal:', e.message); process.exit(1); });
