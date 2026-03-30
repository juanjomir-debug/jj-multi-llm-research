// En producción (NODE_ENV=production) no cargar .env — las vars vienen de Railway.
// En local sí se carga para desarrollo.
if (process.env.NODE_ENV !== 'production') {
  // override:true para que las vars del .env sobreescriban variables de entorno
  // del sistema Windows que puedan tener valores vacíos/incorrectos
  require('dotenv').config({ path: require('path').join(__dirname, '.env'), override: true });
}
const crypto        = require('crypto');
const express       = require('express');
const path          = require('path');
const fs            = require('fs');

// ── Prompts — loaded from ./prompts/ (or PROMPTS_DIR env var in production) ───
const PROMPTS_DIR = process.env.PROMPTS_DIR
  ? path.resolve(process.env.PROMPTS_DIR)
  : path.join(__dirname, 'prompts');
function loadPrompt(filename) {
  return fs.readFileSync(path.join(PROMPTS_DIR, filename), 'utf-8');
}
const PLANNING_PROMPT           = loadPrompt('planning.md');
const INTEGRATOR_PROMPT         = loadPrompt('integrator.md');
const DEBATE_PROMPT             = loadPrompt('debate.md').trim();
const DEBATE_VOTE_PROMPT        = loadPrompt('debate-vote.md').trim();
const HIDDEN_INSTRUCTIONS       = loadPrompt('instrucciones-ocultas.md').trim();
const CONFIDENCE_INSTRUCTION    = '\n\n' + loadPrompt('confidence-instruction.md').trim();
const DEBATE_USER_MSG_TPL       = loadPrompt('debate-user-message.md').trim();
const DEBATE_VOTE_MSG_TPL       = loadPrompt('debate-vote-user-message.md').trim();
const HALLUCINATION_DETECTOR    = loadPrompt('hallucination-detector.md').trim();
const AMPLITUDE_INSTRUCTIONS    = JSON.parse(fs.readFileSync(path.join(PROMPTS_DIR, 'amplitude.json'), 'utf-8'));

// Helper: aplica {{placeholders}} en templates
function tpl(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}
const Anthropic     = require('@anthropic-ai/sdk');
const OpenAI        = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdfParse      = require('pdf-parse');
const bcrypt        = require('bcryptjs');
const session       = require('express-session');
const connectSQLite3= require('connect-sqlite3');
const rateLimit     = require('express-rate-limit');
const helmet        = require('helmet');
const Stripe        = require('stripe');
const db            = require('./db');

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const SQLiteStore = connectSQLite3(session);

const app = express();

// ── Trust proxy (required for Railway / any reverse proxy) ────────────────────
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // disabled because inline scripts are used
  crossOriginEmbedderPolicy: false,
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts, try again later.' } });
const apiLimiter  = rateLimit({ windowMs: 60 * 1000, max: 60,  standardHeaders: true, legacyHeaders: false, message: { error: 'Rate limit exceeded.' } });

app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

app.use(express.json({ limit: '25mb' }));

// ── Health check — ANTES de session para responder siempre ────────────────────
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'landing.html')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  store: new SQLiteStore({ db: 'sessions.db', dir: process.env.DB_PATH ? require('path').dirname(process.env.DB_PATH) : __dirname }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
}));

// ── Plan definitions (mirror of DB) ──────────────────────────────────────────
const PLANS = {
  free:     { name: 'Free',     price: 0,     budget: 9999, maxModels: 99, webSearch: true,  projects: true,  historyDays: 365 },
  starter:  { name: 'Starter',  price: 9.99,  budget: 25,  maxModels: 4,  webSearch: true,  projects: true,  historyDays: 30  },
  pro:      { name: 'Pro',      price: 29.99, budget: 100, maxModels: 99, webSearch: true,  projects: true,  historyDays: 90  },
  business: { name: 'Business', price: 99.00, budget: 500, maxModels: 99, webSearch: true,  projects: true,  historyDays: 365 },
};

// ── Quota middleware ──────────────────────────────────────────────────────────
function currentPeriodStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function resetMonthlyIfNeeded(user) {
  const now = new Date();
  // If no period start stored yet, set it now without resetting costs
  if (!user.billing_period_start) {
    const newPeriod = currentPeriodStart();
    db.prepare('UPDATE users SET billing_period_start = ? WHERE id = ?').run(newPeriod, user.id);
    user.billing_period_start = newPeriod;
    return;
  }
  const periodStart = new Date(user.billing_period_start);
  if (isNaN(periodStart.getTime())) return; // guard against bad values
  const monthsDiff = (now.getFullYear() - periodStart.getFullYear()) * 12 + (now.getMonth() - periodStart.getMonth());
  if (monthsDiff >= 1) {
    const newPeriod = currentPeriodStart();
    db.prepare('UPDATE users SET monthly_cost_usd = 0, billing_period_start = ?, paused = 0 WHERE id = ?').run(newPeriod, user.id);
    user.monthly_cost_usd = 0;
    user.paused = 0;
    user.billing_period_start = newPeriod;
  }
}

function checkQuota(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const user = db.prepare('SELECT id, plan, monthly_cost_usd, billing_period_start, paused FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  resetMonthlyIfNeeded(user);
  if (user.paused) {
    const plan = PLANS[user.plan] || PLANS.free;
    return res.status(402).json({ error: 'quota_exceeded', message: `Monthly API budget of $${plan.budget} reached. Upgrade your plan or wait for next billing cycle.`, plan: user.plan });
  }
  req.userId = user.id;
  req.userPlan = user.plan;
  next();
}

function addMonthlyCost(userId, costUsd) {
  if (!userId || !costUsd) return;
  const user = db.prepare('SELECT plan, monthly_cost_usd, billing_period_start FROM users WHERE id = ?').get(userId);
  if (!user) return;
  resetMonthlyIfNeeded(user);
  const newCost = (user.monthly_cost_usd || 0) + costUsd;
  const plan = PLANS[user.plan] || PLANS.free;
  const paused = newCost >= plan.budget ? 1 : 0;
  db.prepare('UPDATE users SET monthly_cost_usd = ?, paused = ? WHERE id = ?').run(newCost, paused, userId);
  if (paused) {
    db.prepare(`INSERT INTO billing_events (user_id, type, amount_usd, description) VALUES (?,?,?,?)`).run(userId, 'quota_paused', newCost, `Monthly budget $${plan.budget} reached on plan ${user.plan}`);
  }
}

// ─── Pricing (USD per 1M tokens: input / output) ────────────────────────────
// Prices USD per million tokens (input / output) — updated March 2026
const PRICING = {
  // Claude 4.6
  'claude-opus-4-6-thinking':   { input: 15.00, output: 75.00 },
  'claude-opus-4-6':            { input: 15.00, output: 75.00 },
  'claude-sonnet-4-6':          { input:  3.00, output: 15.00 },
  // Claude 4.5
  'claude-opus-4-5':            { input: 15.00, output: 75.00 },
  'claude-sonnet-4-5':          { input:  3.00, output: 15.00 },
  'claude-haiku-4-5-20251001':  { input:  0.80, output:  4.00 },
  // GPT-5
  'gpt-5.4':                    { input:  5.00, output: 20.00 },
  'gpt-5.3':                    { input:  5.00, output: 20.00 },
  'gpt-5':                      { input:  5.00, output: 20.00 },
  'gpt-5-mini':                 { input:  0.15, output:  0.60 },
  // GPT-4.1
  'gpt-4.1':                    { input:  2.00, output:  8.00 },
  'gpt-4.1-mini':               { input:  0.40, output:  1.60 },
  'gpt-4.1-nano':               { input:  0.10, output:  0.40 },
  // OpenAI thinking
  'o4-mini':                    { input:  1.10, output:  4.40 },
  'o3':                         { input: 10.00, output: 40.00 },
  // Gemini 3.x preview
  'models/gemini-3.1-pro-preview':        { input: 1.25,  output:  5.00 },
  'models/gemini-3-flash-preview':        { input: 0.10,  output:  0.40 },
  'models/gemini-3.1-flash-lite-preview': { input: 0.075, output:  0.30 },
  // Gemini 2.5
  'gemini-2.5-pro':                       { input: 1.25,  output: 10.00 },
  'gemini-2.5-flash':                     { input: 0.15,  output:  0.60 },
  'gemini-2.0-flash-thinking-exp':        { input: 0.10,  output:  0.40 },
  // Grok 4.20
  'grok-4.20-0309-reasoning':     { input: 2.00, output:  6.00 },
  'grok-4.20-0309-non-reasoning': { input: 2.00, output:  6.00 },
  // Grok 4.1
  'grok-4-1-fast-reasoning':      { input: 0.20, output:  0.50 },
  'grok-4-1-fast-non-reasoning':  { input: 0.20, output:  0.50 },
  // Kimi (kept for compatibility)
  'kimi-k2-5':        { input: 2.00, output: 8.00 },
  'kimi-latest':      { input: 2.00, output: 6.00 },
  'moonshot-v1-128k': { input: 8.00, output: 8.00 },
  'moonshot-v1-32k':  { input: 2.40, output: 2.40 },
  'moonshot-v1-8k':   { input: 0.80, output: 0.80 },
};

function calcCost(modelId, inputTok, outputTok) {
  const p = PRICING[modelId];
  if (!p) return 0;
  return (inputTok / 1_000_000) * p.input + (outputTok / 1_000_000) * p.output;
}

// ─── PDF text extraction ──────────────────────────────────────────────────────
async function extractPdfText(base64) {
  const buf = Buffer.from(base64, 'base64');
  const { text } = await pdfParse(buf);
  return text.trim();
}

// ─── Universal attachment processor ──────────────────────────────────────────
// Adds .textContent to any attachment the models can't natively read as binary
const TEXT_MIME_PREFIXES = ['text/'];
const TEXT_MIME_EXACT = new Set([
  'application/json','application/javascript','application/typescript',
  'application/xml','application/csv','application/x-yaml','application/yaml',
  'application/x-sh','application/x-python','application/graphql',
  'application/ld+json','application/x-ndjson',
]);
const TEXT_EXTENSIONS = new Set([
  'txt','md','markdown','csv','tsv','json','jsonl','xml','yaml','yml',
  'js','ts','jsx','tsx','py','rb','go','java','cs','cpp','c','h','php',
  'html','htm','css','sql','sh','bash','zsh','env','ini','toml','conf',
  'log','rst','tex','r','swift','kt','rs','dart','vue','svelte',
]);

async function processAttachments(attachments = []) {
  return Promise.all(attachments.map(async (att) => {
    if (att.textContent) return att; // already processed
    if (att.type === 'application/pdf') {
      try { return { ...att, textContent: await extractPdfText(att.content) }; }
      catch { return { ...att, textContent: `[Error al extraer texto de ${att.name}]` }; }
    }
    if (att.type.startsWith('image/')) return att; // handled natively by vision APIs
    // Text-based files: decode base64 → UTF-8
    const ext = (att.name || '').split('.').pop().toLowerCase();
    const isText = TEXT_MIME_PREFIXES.some(p => att.type.startsWith(p))
                || TEXT_MIME_EXACT.has(att.type)
                || TEXT_EXTENSIONS.has(ext);
    if (isText) {
      try {
        const textContent = Buffer.from(att.content, 'base64').toString('utf-8');
        return { ...att, textContent };
      } catch { return att; }
    }
    // Unknown binary — add a note so the model knows a file was attached
    return { ...att, textContent: `[Archivo binario adjunto: ${att.name} (${att.type}) — contenido no legible como texto]` };
  }));
}

// ─── Response cache (improvement #10) ─────────────────────────────────────────
const responseCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 min

function getCacheKey(modelId, question, amplitude) {
  return `${modelId}:${amplitude}:${crypto.createHash('md5').update(question).digest('hex')}`;
}

function getCached(modelId, question, amplitude) {
  const key = getCacheKey(modelId, question, amplitude);
  const entry = responseCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  if (entry) responseCache.delete(key);
  return null;
}

function setCache(modelId, question, amplitude, data) {
  const key = getCacheKey(modelId, question, amplitude);
  responseCache.set(key, { ts: Date.now(), data });
  // Keep cache under 200 entries
  if (responseCache.size > 200) {
    const first = responseCache.keys().next().value;
    responseCache.delete(first);
  }
}

// ─── LLM callers ─────────────────────────────────────────────────────────────

const CLAUDE_THINKING_MODELS = new Set(['claude-3-7-sonnet-20250219', 'claude-opus-4-6-thinking']);
const CLAUDE_THINKING_MODEL_MAP = { 'claude-opus-4-6-thinking': 'claude-opus-4-6' };

const CLAUDE_SEARCH_MODELS    = new Set(['claude-sonnet-4-6-search', 'claude-opus-4-6-search']);
const CLAUDE_SEARCH_MODEL_MAP = { 'claude-sonnet-4-6-search': 'claude-sonnet-4-6', 'claude-opus-4-6-search': 'claude-opus-4-6' };

// Streaming caller for Claude (improvement #1)
async function callClaudeStream(modelId, systemPrompt, userMessage, maxTokens, attachments, history, temperature, onChunk) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const useThinking = CLAUDE_THINKING_MODELS.has(modelId);
  const useSearch   = CLAUDE_SEARCH_MODELS.has(modelId);

  let userContent;
  if (attachments.length > 0) {
    userContent = [];
    for (const att of attachments) {
      if (att.type.startsWith('image/')) {
        userContent.push({ type: 'image', source: { type: 'base64', media_type: att.type, data: att.content } });
      } else if (att.textContent) {
        userContent.push({ type: 'text', text: `[Archivo adjunto: ${att.name}]\n\n${att.textContent}` });
      }
    }
    userContent.push({ type: 'text', text: userMessage });
  } else {
    userContent = userMessage;
  }

  const actualModelId = CLAUDE_THINKING_MODEL_MAP[modelId] || CLAUDE_SEARCH_MODEL_MAP[modelId] || modelId;
  const effectiveMaxTokens = useThinking ? Math.max(maxTokens, 16000) : maxTokens;
  const params = {
    model: actualModelId,
    max_tokens: effectiveMaxTokens,
    messages: [...history, { role: 'user', content: userContent }],
    stream: true,
  };
  if (systemPrompt) params.system = systemPrompt;
  if (useThinking) {
    params.thinking = { type: 'enabled', budget_tokens: Math.min(10000, effectiveMaxTokens - 2000) };
    params.temperature = 1; // required for extended thinking, overrides user setting
  } else if (temperature != null) {
    params.temperature = temperature;
  }
  if (useSearch) {
    params.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
  }

  let text = '', inputTokens = 0, outputTokens = 0;
  const stream = await client.messages.stream(params);
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      text += event.delta.text;
      if (onChunk) onChunk(event.delta.text);
    } else if (event.type === 'message_delta' && event.usage) {
      outputTokens = event.usage.output_tokens;
    } else if (event.type === 'message_start' && event.message?.usage) {
      inputTokens = event.message.usage.input_tokens;
    }
  }
  const final = await stream.finalMessage();
  inputTokens = final.usage?.input_tokens || inputTokens;
  outputTokens = final.usage?.output_tokens || outputTokens;

  return { text, inputTokens, outputTokens };
}

// Streaming caller for OpenAI (improvement #1)
async function callOpenAIStream(modelId, systemPrompt, userMessage, maxTokens, attachments, history, temperature, onChunk) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push(...history);

  if (attachments.length > 0) {
    const userContent = [];
    for (const att of attachments) {
      if (att.type.startsWith('image/')) {
        userContent.push({ type: 'image_url', image_url: { url: `data:${att.type};base64,${att.content}` } });
      } else if (att.textContent) {
        userContent.push({ type: 'text', text: `[Archivo adjunto: ${att.name}]\n\n${att.textContent}` });
      }
    }
    userContent.push({ type: 'text', text: userMessage });
    messages.push({ role: 'user', content: userContent });
  } else {
    messages.push({ role: 'user', content: userMessage });
  }

  const isOSeries = /^o\d/.test(modelId);
  const isGpt5Family = modelId.startsWith('gpt-5') || modelId === 'gpt-5.2';
  const useMaxCompletionTokens = isOSeries || isGpt5Family;
  const effectiveMaxTokens = (isOSeries || isGpt5Family) ? Math.max(maxTokens, 4096) : maxTokens;

  const completionOpts = {
    model: modelId,
    messages,
    stream: true,
    stream_options: { include_usage: true },
    ...(useMaxCompletionTokens
      ? { max_completion_tokens: effectiveMaxTokens }
      : { max_tokens: effectiveMaxTokens }),
    // o-series and gpt-5 family don't support custom temperature
    ...(!isOSeries && !isGpt5Family && temperature != null ? { temperature } : {}),
  };

  let text = '', inputTokens = 0, outputTokens = 0;
  const stream = await client.chat.completions.create(completionOpts);
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) { text += delta; if (onChunk) onChunk(delta); }
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens || 0;
      outputTokens = chunk.usage.completion_tokens || 0;
    }
  }
  if (!text) throw new Error(`Respuesta vacía de ${modelId}. Prueba aumentando Max Tokens o usando otro modelo.`);
  return { text, inputTokens, outputTokens };
}

const GEMINI_SEARCH_SUPPORTED = new Set([
  'gemini-3.1-pro-preview', 'gemini-3-flash-preview', 'gemini-3.1-flash-lite-preview',
  'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash',
  'gemini-1.5-pro', 'gemini-1.5-flash',
]);

// Gemini — with optional streaming via sendMessageStream
async function callGemini(modelId, systemPrompt, userMessage, attachments = [], webSearch = false, history = [], temperature = null, onChunk = null) {
  if (!process.env.GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY not configured');
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  const cleanId = modelId.startsWith('models/') ? modelId.slice(7) : modelId;
  if (webSearch && !GEMINI_SEARCH_SUPPORTED.has(cleanId)) {
    throw new Error(`Google Search grounding not available for "${cleanId}". Use Gemini 2.0 Flash or 2.5 Pro.`);
  }
  const model = genAI.getGenerativeModel({
    model: cleanId,
    ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
    ...(webSearch ? { tools: [{ googleSearch: {} }] } : {}),
    ...(temperature != null ? { generationConfig: { temperature } } : {}),
  });
  const geminiHistory = history.map(h => ({
    role: h.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: h.content }],
  }));
  const parts = [];
  for (const att of attachments) {
    if (att.type.startsWith('image/')) {
      parts.push({ inlineData: { mimeType: att.type, data: att.content } });
    } else if (att.textContent) {
      parts.push({ text: `[Attached file: ${att.name}]\n\n${att.textContent}` });
    }
  }
  parts.push({ text: userMessage });
  const msgArg = parts.length === 1 ? userMessage : parts;
  const chat = model.startChat({ history: geminiHistory });

  if (onChunk) {
    // Streaming mode — with fallback to non-streaming if stream parse fails (preview models)
    try {
      const streamResult = await chat.sendMessageStream(msgArg);
      let fullText = '';
      for await (const chunk of streamResult.stream) {
        const t = chunk.text();
        if (t) { fullText += t; onChunk(t); }
      }
      const resp = await streamResult.response;
      if (!fullText) fullText = resp.text?.() || '';
      return {
        text: fullText,
        inputTokens:  resp.usageMetadata?.promptTokenCount     || 0,
        outputTokens: resp.usageMetadata?.candidatesTokenCount || 0,
      };
    } catch (streamErr) {
      if (!streamErr.message?.includes('parse stream')) throw streamErr;
      // Fallback: non-streaming for models that don't support stream parsing
      const result = await chat.sendMessage(msgArg);
      const resp = result.response;
      const text = resp.text();
      onChunk(text);
      return {
        text,
        inputTokens:  resp.usageMetadata?.promptTokenCount     || 0,
        outputTokens: resp.usageMetadata?.candidatesTokenCount || 0,
      };
    }
  } else {
    // Non-streaming fallback
    const result = await chat.sendMessage(msgArg);
    const resp = result.response;
    return {
      text: resp.text(),
      inputTokens:  resp.usageMetadata?.promptTokenCount     || 0,
      outputTokens: resp.usageMetadata?.candidatesTokenCount || 0,
    };
  }
}

// Grok — with web search via Responses API
async function callGrokStream(modelId, systemPrompt, userMessage, maxTokens, attachments, webSearch, history, temperature, onChunk) {
  if (!process.env.XAI_API_KEY) throw new Error('XAI_API_KEY not configured');
  const client = new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: 'https://api.x.ai/v1' });
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push(...history);

  if (attachments.length > 0) {
    const userContent = [];
    for (const att of attachments) {
      if (att.type.startsWith('image/')) {
        userContent.push({ type: 'image_url', image_url: { url: `data:${att.type};base64,${att.content}` } });
      } else if (att.textContent) {
        userContent.push({ type: 'text', text: `[Archivo adjunto: ${att.name}]\n\n${att.textContent}` });
      }
    }
    userContent.push({ type: 'text', text: userMessage });
    messages.push({ role: 'user', content: userContent });
  } else {
    messages.push({ role: 'user', content: userMessage });
  }

  if (webSearch) {
    // xAI Responses API for web search
    const resp = await fetch('https://api.x.ai/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.XAI_API_KEY}` },
      body: JSON.stringify({ model: modelId, input: messages, tools: [{ type: 'web_search' }], max_output_tokens: maxTokens }),
    });
    if (!resp.ok) { const err = await resp.json().catch(() => ({})); throw new Error(`${resp.status} ${JSON.stringify(err)}`); }
    const data = await resp.json();
    const text = (data.output || []).filter(item => item.type === 'message').flatMap(item => item.content || [])
      .filter(c => c.type === 'output_text').map(c => c.text).join('');
    return { text: text || JSON.stringify(data.output), inputTokens: data.usage?.input_tokens || 0, outputTokens: data.usage?.output_tokens || 0 };
  }

  // Standard streaming
  const grokOpts = { model: modelId, messages, max_tokens: maxTokens, stream: true, stream_options: { include_usage: true },
    ...(temperature != null ? { temperature } : {}) };
  let text = '', inputTokens = 0, outputTokens = 0;
  const stream = await client.chat.completions.create(grokOpts);
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) { text += delta; if (onChunk) onChunk(delta); }
    if (chunk.usage) { inputTokens = chunk.usage.prompt_tokens || 0; outputTokens = chunk.usage.completion_tokens || 0; }
  }
  return { text, inputTokens, outputTokens };
}

// Kimi (no streaming)
async function callKimi(modelId, systemPrompt, userMessage, maxTokens, attachments = [], history = [], temperature = null) {
  if (!process.env.MOONSHOT_API_KEY) throw new Error('MOONSHOT_API_KEY not configured');
  const client = new OpenAI({ apiKey: process.env.MOONSHOT_API_KEY, baseURL: 'https://api.moonshot.ai/v1' });
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push(...history);
  if (attachments.length > 0) {
    const userContent = [];
    for (const att of attachments) {
      if (att.type.startsWith('image/')) userContent.push({ type: 'image_url', image_url: { url: `data:${att.type};base64,${att.content}` } });
      else if (att.textContent) userContent.push({ type: 'text', text: `[Archivo adjunto: ${att.name}]\n\n${att.textContent}` });
    }
    userContent.push({ type: 'text', text: userMessage });
    messages.push({ role: 'user', content: userContent });
  } else {
    messages.push({ role: 'user', content: userMessage });
  }
  const r = await client.chat.completions.create({ model: modelId, messages, max_tokens: maxTokens,
    ...(temperature != null ? { temperature } : {}) });
  return { text: r.choices[0].message.content, inputTokens: r.usage.prompt_tokens, outputTokens: r.usage.completion_tokens };
}

// Streaming dispatcher (improvement #1)
// temperature = null → use API default; pass as last arg to preserve backward compat
async function callModelStream(provider, modelId, systemPrompt, userMessage, maxTokens, attachments, webSearch, history, onChunk, temperature = null) {
  switch (provider) {
    case 'anthropic': return callClaudeStream(modelId, systemPrompt, userMessage, maxTokens, attachments, history, temperature, onChunk);
    case 'openai':    return callOpenAIStream(modelId, systemPrompt, userMessage, maxTokens, attachments, history, temperature, onChunk);
    case 'google':    return callGemini(modelId, systemPrompt, userMessage, attachments, webSearch, history, temperature, onChunk);
    case 'xai':       return callGrokStream(modelId, systemPrompt, userMessage, maxTokens, attachments, webSearch, history, temperature, onChunk);
    case 'moonshot':  return callKimi(modelId, systemPrompt, userMessage, maxTokens, attachments, history, temperature);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

// Non-streaming fallback for integrator/debate
async function callModel(provider, modelId, systemPrompt, userMessage, maxTokens, attachments = [], webSearch = false, history = [], temperature = null) {
  return callModelStream(provider, modelId, systemPrompt, userMessage, maxTokens, attachments, webSearch, history, null, temperature);
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms / 1000}s (${label})`)), ms)),
  ]);
}

// Returns timeout ms based on model — thinking/reasoning/gemini models get more time
function modelTimeout(modelId) {
  const isThinking = CLAUDE_THINKING_MODELS.has(modelId) ||
    /thinking|reasoning|o3|o4/.test(modelId);
  if (isThinking) return 300_000; // 5 min for thinking
  const isGemini = /gemini/.test(modelId);
  if (isGemini) return 240_000; // 4 min for Gemini (web search is slow)
  return 120_000; // 2 min default
}

// Retry con backoff exponencial para errores transitorios (overloaded, 529, 503)
function isRetryableError(err) {
  const msg = err?.message || '';
  return msg.includes('overloaded') || msg.includes('529') || msg.includes('503') ||
         msg.includes('overloaded_error') || msg.includes('rate_limit') || msg.includes('RATE_LIMIT');
}
async function withRetry(fn, maxAttempts = 3, label = '') {
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    try { return await fn(); }
    catch (err) {
      lastErr = err;
      if (!isRetryableError(err) || i === maxAttempts - 1) throw err;
      const wait = (i + 1) * 8000; // 8s, 16s
      console.warn(`[retry] ${label} attempt ${i + 1} failed (${err.message}), retrying in ${wait / 1000}s…`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

// ── Input sanitisation helpers ────────────────────────────────────────────────
function sanitizeStr(s, max = 500) { return typeof s === 'string' ? s.trim().slice(0, max) : ''; }
function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

// ─── Auth ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const username = sanitizeStr(req.body.username, 50);
  const email    = sanitizeStr(req.body.email, 200).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!username || !email || !password) return res.status(400).json({ error: 'Faltan campos obligatorios' });
  if (!validEmail(email)) return res.status(400).json({ error: 'Email inválido' });
  if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  if (username.length < 3) return res.status(400).json({ error: 'El nombre de usuario debe tener al menos 3 caracteres' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)').run(username.trim(), email.trim().toLowerCase(), hash);
    const user = db.prepare('SELECT id, username, email, total_cost_usd, plan, monthly_cost_usd, paused FROM users WHERE id = ?').get(result.lastInsertRowid);
    req.session.userId = user.id;
    const planInfo = PLANS[user.plan] || PLANS.free;
    res.json({ user: { ...user, planName: planInfo.name, budget: planInfo.budget } });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      const field = err.message.includes('username') ? 'nombre de usuario' : 'email';
      return res.status(409).json({ error: `El ${field} ya está en uso` });
    }
    res.status(500).json({ error: 'Error al crear el usuario' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const email    = sanitizeStr(req.body.email, 200).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password) return res.status(400).json({ error: 'Faltan campos' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  // Regenerate session on login to prevent session fixation
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.userId = user.id;
    const planInfo = PLANS[user.plan] || PLANS.free;
    res.json({ user: { id: user.id, username: user.username, email: user.email, total_cost_usd: user.total_cost_usd, plan: user.plan, planName: planInfo.name, monthly_cost_usd: user.monthly_cost_usd || 0, budget: planInfo.budget, paused: !!user.paused } });
  });
});

app.post('/api/auth/logout', (req, res) => { req.session.destroy(() => res.json({ ok: true })); });

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const user = db.prepare('SELECT id, username, email, total_cost_usd, plan, monthly_cost_usd, billing_period_start, paused FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  resetMonthlyIfNeeded(user);
  const planInfo = PLANS[user.plan] || PLANS.free;
  res.json({ user: { ...user, planName: planInfo.name, budget: planInfo.budget, paused: !!user.paused } });
});

// ─── Research Planning ────────────────────────────────────────────────────────
// Helper: return the first provider+model that has a configured API key
function resolveConfiguredProvider(requestedProvider, requestedModelId) {
  const KEY_MAP = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai:    'OPENAI_API_KEY',
    google:    'GOOGLE_API_KEY',
    xai:       'XAI_API_KEY',
    moonshot:  'MOONSHOT_API_KEY',
  };
  const DEFAULT_MODELS = {
    anthropic: 'claude-sonnet-4-6',
    openai:    'gpt-4o-mini',
    google:    'gemini-2.0-flash',
    xai:       'grok-3-mini',
    moonshot:  'moonshot-v1-8k',
  };
  // Try requested provider first, then fall back in order
  const order = [requestedProvider, 'anthropic', 'openai', 'google', 'xai', 'moonshot'].filter(Boolean);
  for (const prov of order) {
    if (process.env[KEY_MAP[prov]]) {
      const modelId = (prov === requestedProvider && requestedModelId) ? requestedModelId : DEFAULT_MODELS[prov];
      return { provider: prov, modelId };
    }
  }
  return null; // no provider configured
}

app.post('/api/plan-research', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const objective = sanitizeStr(req.body.objective, 2000);
  const { provider: reqProvider, modelId: reqModelId, amplitude, attachments = [] } = req.body;
  if (!objective) return res.status(400).json({ error: 'Falta el objetivo de investigación' });

  // Set SSE headers for streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event, data) => { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };

  // Resolve which provider+model to use (auto-fallback if requested key not configured)
  const resolved = resolveConfiguredProvider(reqProvider || 'anthropic', reqModelId);
  if (!resolved) {
    send('plan:error', { error: 'No AI provider API keys are configured on the server. Add at least one key (ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, or XAI_API_KEY) in Railway environment variables.' });
    res.end(); return;
  }
  const { provider, modelId } = resolved;

  try {
    // Process attachments
    let processedAttachments = [];
    try { processedAttachments = await processAttachments(attachments); } catch {}

    // El planning siempre necesita al menos 2048 tokens para generar el JSON completo
    const ampTokens = Math.max(2048, { concise: 1024, normal: 2048, detailed: 4096, exhaustive: 8192 }[amplitude] || 2048);

    // Inyectar roles base de model_strengths.json como contexto para el planner
    let strengthsBlock = '';
    try {
      const { preamble, data: strengths } = loadModelStrengths();
      const labels = { anthropic: 'Claude', openai: 'OpenAI', google: 'Gemini', xai: 'Grok' };
      const rolesLines = Object.entries(strengths).map(([k, v]) => `- ${labels[k] || k}: ${v}`).join('\n');
      strengthsBlock = '\n\nCRITERIOS DE ESPECIALIZACIÓN POR MODELO'
        + (preamble ? ` (contexto: ${preamble})` : '') + ':\n' + rolesLines;
    } catch (_) {}
    const planObjective = objective + strengthsBlock;

    let fullText = '';
    send('plan:start', { provider, modelId, fallback: provider !== (reqProvider || 'anthropic') });

    const result = await withTimeout(
      callModelStream(
        provider,
        modelId,
        PLANNING_PROMPT,
        planObjective,
        ampTokens,
        processedAttachments,
        false,
        [],
        (chunk) => {
          fullText += chunk;
          send('plan:chunk', { chunk });
        }
      ),
      120_000,
      'plan-research'
    );

    fullText = result.text || fullText;
    const cost = calcCost(modelId || 'claude-sonnet-4-6', result.inputTokens, result.outputTokens);

    // Try to parse JSON from the response
    let plan = null;
    try {
      // 1. Strip markdown code fences if present (```json ... ``` or ``` ... ```)
      let cleaned = fullText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      // 2. Try parsing the whole cleaned string first
      try {
        plan = JSON.parse(cleaned);
      } catch (_) {
        // 3. Fall back: extract first {...} block (greedy from first { to last })
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) plan = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      send('plan:parse_error', { error: 'Could not parse plan as JSON. Please review the result manually.' });
    }

    send('plan:done', {
      text: fullText,
      plan,
      cost,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
  } catch (err) {
    send('plan:error', { error: err.message });
  }
  res.end();
});

// ─── History ──────────────────────────────────────────────────────────────────
app.get('/api/history', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const limit  = Math.min(parseInt(req.query.limit)  || 100, 500);
  const offset = parseInt(req.query.offset) || 0;
  const rows  = db.prepare(`SELECT id, session_id, created_at, provider, model_id, model_label,
           prompt, response, input_tokens, output_tokens, cost_usd, duration_ms, is_integrator
    FROM history WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(req.session.userId, limit, offset);
  const total = db.prepare('SELECT COUNT(*) AS n FROM history WHERE user_id = ?').get(req.session.userId).n;
  res.json({ rows, total, limit, offset });
});

app.get('/api/debate/:sessionId', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const { sessionId } = req.params;
  const responses = db.prepare(
    'SELECT round, model_id, provider, response, cost_usd FROM debate_responses WHERE session_id = ? AND user_id = ? ORDER BY round, id'
  ).all(sessionId, req.session.userId);
  const voteRows = db.prepare(
    'SELECT voter_model_id, voted_for_model_id FROM debate_votes WHERE session_id = ? AND user_id = ?'
  ).all(sessionId, req.session.userId);
  // Tally votes
  const votes = {};
  for (const v of voteRows) { votes[v.voted_for_model_id] = (votes[v.voted_for_model_id] || 0) + 1; }
  const maxVotes = Math.max(0, ...Object.values(votes));
  const winner = Object.keys(votes).find(id => votes[id] === maxVotes) || null;
  res.json({ responses, votes, voterLog: voteRows.map(v => ({ voter: v.voter_model_id, votedFor: v.voted_for_model_id })), winner, totalVoters: voteRows.length });
});

app.delete('/api/history/session/:sessionId', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  db.prepare('DELETE FROM history WHERE session_id = ? AND user_id = ?').run(req.params.sessionId, req.session.userId);
  const total = db.prepare('SELECT COALESCE(SUM(cost_usd),0) AS t FROM history WHERE user_id = ?').get(req.session.userId).t;
  db.prepare('UPDATE users SET total_cost_usd = ? WHERE id = ?').run(total, req.session.userId);
  res.json({ ok: true, total_cost_usd: total });
});

app.delete('/api/history/:id', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  db.prepare('DELETE FROM history WHERE id = ? AND user_id = ?').run(req.params.id, req.session.userId);
  const total = db.prepare('SELECT COALESCE(SUM(cost_usd),0) AS t FROM history WHERE user_id = ?').get(req.session.userId).t;
  db.prepare('UPDATE users SET total_cost_usd = ? WHERE id = ?').run(total, req.session.userId);
  res.json({ ok: true, total_cost_usd: total });
});

// ─── Votes (improvement #13) ─────────────────────────────────────────────────
app.post('/api/vote', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const { sessionId, modelId, vote } = req.body; // vote: 'up' | 'down'
  if (!sessionId || !modelId || !['up', 'down'].includes(vote))
    return res.status(400).json({ error: 'Invalid vote' });

  // Create votes table if not exists
  db.prepare(`CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, session_id TEXT NOT NULL, model_id TEXT NOT NULL,
    vote TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, session_id, model_id)
  )`).run();

  db.prepare(`INSERT OR REPLACE INTO votes (user_id, session_id, model_id, vote) VALUES (?, ?, ?, ?)`)
    .run(req.session.userId, sessionId, modelId, vote);
  res.json({ ok: true });
});

app.get('/api/votes/stats', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  db.prepare(`CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, session_id TEXT NOT NULL, model_id TEXT NOT NULL,
    vote TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, session_id, model_id)
  )`).run();
  const stats = db.prepare(`SELECT model_id,
    SUM(CASE WHEN vote='up' THEN 1 ELSE 0 END) AS ups,
    SUM(CASE WHEN vote='down' THEN 1 ELSE 0 END) AS downs
    FROM votes WHERE user_id = ? GROUP BY model_id`).all(req.session.userId);
  res.json({ stats });
});

// ─── Custom domain entry point (reliableai.net/analyze) ──────────────────────
app.get('/analyze', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/analyze/*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ─── Config ──────────────────────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  res.json({
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai:    !!process.env.OPENAI_API_KEY,
    google:    !!process.env.GOOGLE_API_KEY,
    xai:       !!process.env.XAI_API_KEY,
    moonshot:  !!process.env.MOONSHOT_API_KEY,
  });
});

// ─── Model strengths — lee el archivo en cada request (sin cache) ────────────
// El archivo puede tener texto libre ANTES del bloque JSON (contexto/instrucciones para el planner).
// Esta función separa ambas partes.
function loadModelStrengths() {
  const raw = fs.readFileSync(path.join(PROMPTS_DIR, 'model_strengths.json'), 'utf-8');
  const jsonStart = raw.indexOf('{');
  if (jsonStart === -1) throw new Error('No se encontró bloque JSON en model_strengths.json');
  const preamble = raw.slice(0, jsonStart).trim();        // texto libre previo al JSON
  const data     = JSON.parse(raw.slice(jsonStart));       // objeto JSON
  return { preamble, data };
}

// ─── Hallucination detection config ──────────────────────────────────────────
app.get('/api/hallucination-config', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(PROMPTS_DIR, 'hallucination-detection.json'), 'utf-8'));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo leer hallucination-detection.json: ' + e.message });
  }
});

// ─── LLM-based hallucination analysis ────────────────────────────────────────
app.post('/api/analyze-hallucination', async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length < 20) {
    return res.status(400).json({ error: 'text is required (min 20 chars)' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  // Read prompt and config fresh each time (user-editable)
  let analysisPrompt, analysisModel;
  try {
    analysisPrompt = fs.readFileSync(path.join(PROMPTS_DIR, 'hallucination-analysis.md'), 'utf-8').trim();
  } catch (e) {
    return res.status(500).json({ error: 'No se pudo leer hallucination-analysis.md: ' + e.message });
  }
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(PROMPTS_DIR, 'hallucination-detection.json'), 'utf-8'));
    analysisModel = cfg.analysis_model || 'claude-haiku-4-5';
  } catch { analysisModel = 'claude-haiku-4-5'; }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: analysisModel,
      max_tokens: 800,
      system: analysisPrompt,
      messages: [{ role: 'user', content: text.slice(0, 8000) }] // cap to avoid huge tokens
    });
    const raw = msg.content?.[0]?.text || '';
    // Extract JSON (handle cases where model wraps it in ```json ... ```)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(422).json({ error: 'Modelo no devolvió JSON válido', raw: raw.slice(0, 200) });
    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: 'Error en análisis LLM: ' + e.message });
  }
});

// ─── Standalone hallucination check (multi-model, web-search verified) ────────
app.post('/api/hallucination-check', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const { question, results } = req.body;
  if (!question || !Array.isArray(results) || results.length === 0)
    return res.status(400).json({ error: 'question and results[] required' });
  try {
    const result = await withTimeout(runHallucinationCheck(question, results), 180_000, 'hallucination-check');
    res.json({ report: result.report, cost: result.cost, inputTokens: result.inputTokens, outputTokens: result.outputTokens });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/model-strengths', (req, res) => {
  try {
    const { data } = loadModelStrengths();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo leer model_strengths.json: ' + e.message });
  }
});

// ─── Cost estimate ───────────────────────────────────────────────────────────
app.post('/api/estimate', (req, res) => {
  const { question = '', models = [], integrator = {} } = req.body;
  const qTok = Math.ceil(question.length / 4);
  const estOut = 1500;
  const modelBreakdown = models.filter(m => m.enabled).map(m => {
    const inTok = qTok + Math.ceil(((m.customInstructions || '').length) / 4) + 20;
    const cost = calcCost(m.modelId, inTok, estOut);
    return { modelId: m.modelId, provider: m.provider, inTok, outTok: estOut, cost };
  });
  const enabledCount = modelBreakdown.length;
  const intInTok = enabledCount * (estOut + 200) + qTok + Math.ceil(((integrator.customInstructions || '').length) / 4) + 100;
  const intOutTok = 3000;
  const intCost = integrator.modelId ? calcCost(integrator.modelId, intInTok, intOutTok) : 0;
  const total = modelBreakdown.reduce((s, m) => s + m.cost, 0) + intCost;
  res.json({ modelBreakdown, intCost, intInTok, intOutTok, total });
});


// ─── Retry individual model (improvement #14) ─────────────────────────────────
app.post('/api/retry', async (req, res) => {
  const { provider, modelId, question, customInstructions, maxTokens, amplitude, webSearch, conversationHistory, attachments, temperature } = req.body;
  if (!provider || !modelId || !question) return res.status(400).json({ error: 'Missing params' });

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  const send = (event, data) => { if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };

  let processedAttachments = [];
  try { processedAttachments = await processAttachments(attachments || []); } catch {}

  const amplitudeInstr = AMPLITUDE_INSTRUCTIONS[amplitude] || '';
  const sysInstr = [HIDDEN_INSTRUCTIONS, customInstructions, amplitudeInstr, CONFIDENCE_INSTRUCTION].filter(Boolean).join('\n\n');

  send('model:start', { modelId, provider });
  const t0 = Date.now();
  try {
    const r = await withRetry(() => withTimeout(
      callModelStream(provider, modelId, sysInstr || null, question, maxTokens || 2048, processedAttachments, !!webSearch, conversationHistory || [],
        (chunk) => send('model:chunk', { modelId, provider, chunk }),
        temperature ?? null),
      modelTimeout(modelId), modelId
    ), 3, `${provider}:${modelId}`);
    const cost = calcCost(modelId, r.inputTokens, r.outputTokens);
    send('model:done', { modelId, provider, text: r.text, inputTokens: r.inputTokens, outputTokens: r.outputTokens, cost, durationMs: Date.now() - t0 });
  } catch (err) {
    send('model:error', { modelId, provider, error: err.message });
  }
  send('complete', {});
  res.end();
});

// ─── Standalone integrate endpoint ─────────────────────────────────────────
app.post('/api/integrate', async (req, res) => {
  const { question, results = [], integrator = {}, maxTokensIntegrator = 4096,
          attachments = [], conversationHistory = [], debateContext = null } = req.body;
  if (!integrator.modelId || results.length === 0) return res.status(400).json({ error: 'Missing integrator or results' });

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  const send = (event, data) => { if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  const userId = req.session.userId || null;
  const sessionId = req.body.sessionId || crypto.randomUUID();

  let processedAttachments = [];
  try { processedAttachments = await processAttachments(attachments || []); } catch {}

  send('integrator:start', { modelId: integrator.modelId, provider: integrator.provider });

  const modelLabels = {};
  for (const r of results) {
    const provCfg = { anthropic: 'Claude', openai: 'OpenAI', google: 'Gemini', xai: 'Grok', moonshot: 'Kimi' };
    modelLabels[r.modelId] = provCfg[r.provider] || r.modelId;
  }
  const allResponsesBlock = results.map((r, i) => `### Response ${i + 1} — [${modelLabels[r.modelId]}] (${r.modelId})\n\n${r.text}`).join('\n\n---\n\n');

  const defaultSysPrompt = INTEGRATOR_PROMPT + `\nAvailable models: ${Object.values(modelLabels).join(', ')}`;
  const sysPrompt = integrator.customInstructions ? `${integrator.customInstructions}\n\n${defaultSysPrompt}` : defaultSysPrompt;
  const debateSection = debateContext
    ? `\n\n---\n\n## Model Debate Transcript\n\nThe models also engaged in a structured debate. Use this as additional context for your synthesis:\n\n${debateContext}`
    : '';
  const userMsg = `Original question: ${question}\n\nAll model responses:\n\n${allResponsesBlock}${debateSection}`;

  try {
    const t0 = Date.now();
    const r = await withRetry(() => withTimeout(
      callModelStream(integrator.provider, integrator.modelId, sysPrompt, userMsg, maxTokensIntegrator, processedAttachments, false, conversationHistory,
        (chunk) => send('integrator:chunk', { chunk })),
      modelTimeout(integrator.modelId), 'integrator'
    ), 3, `integrator:${integrator.modelId}`);
    const cost = calcCost(integrator.modelId, r.inputTokens, r.outputTokens);
    const durationMs = Date.now() - t0;
    send('integrator:done', { text: r.text, inputTokens: r.inputTokens, outputTokens: r.outputTokens, cost, durationMs });

    if (userId) {
      db.prepare(`INSERT INTO history (user_id, session_id, provider, model_id, prompt, response, input_tokens, output_tokens, cost_usd, duration_ms, is_integrator) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
        .run(userId, sessionId, integrator.provider, integrator.modelId, question, r.text, r.inputTokens, r.outputTokens, cost, durationMs);
    }
  } catch (err) {
    send('integrator:error', { error: err.message });
  }
  send('complete', { sessionId });
  res.end();
});

// ─── Standalone debate endpoint ──────────────────────────────────────────────
app.post('/api/debate-run', async (req, res) => {
  const { question, results = [], debateRounds = 1 } = req.body;
  if (results.length < 2) return res.status(400).json({ error: 'Need at least 2 results for debate' });

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  const send = (event, data) => { if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  const userId = req.session.userId || null;
  const sessionId = req.body.sessionId || crypto.randomUUID();

  send('debate:start', {});
  const allDebateResults = [];
  for (let round = 0; round < Math.min(debateRounds, 3); round++) {
    for (const r of results) {
      const otherResponses = results.filter(o => o.modelId !== r.modelId)
        .map(o => `[${o.modelId}]: ${o.text.slice(0, 1500)}`).join('\n\n');
      const debatePrompt = tpl(DEBATE_USER_MSG_TPL, { question, otherResponses });
      try {
        const dr = await withTimeout(
          callModel(r.provider, r.modelId, DEBATE_PROMPT, debatePrompt, 1024, [], false, []),
          60_000, `debate-${r.modelId}`
        );
        const cost = calcCost(r.modelId, dr.inputTokens, dr.outputTokens);
        const entry = { round, modelId: r.modelId, provider: r.provider, text: dr.text, cost };
        allDebateResults.push(entry);
        send('debate:response', entry);
        if (userId) db.prepare(`INSERT INTO debate_responses (user_id, session_id, round, model_id, provider, response, cost_usd) VALUES (?,?,?,?,?,?,?)`)
          .run(userId, sessionId, round, r.modelId, r.provider, dr.text, cost);
      } catch (err) {
        send('debate:error', { round, modelId: r.modelId, error: err.message });
      }
    }
  }

  // Voting
  if (allDebateResults.length >= 2) {
    send('debate:voting', {});
    const votes = {};
    const voterLog = [];
    const candidateIds = results.map(r => r.modelId);
    await Promise.allSettled(results.map(async (r) => {
      const others = results.filter(o => o.modelId !== r.modelId);
      const candidateBlock = others.map((o, i) => `CANDIDATO ${String.fromCharCode(65 + i)} (${o.modelId}):\n${o.text.slice(0, 900)}`).join('\n\n---\n\n');
      const voteOptions = others.map(o => `VOTE:${o.modelId}`).join(' o ');
      const votePrompt = tpl(DEBATE_VOTE_MSG_TPL, { question, candidateBlock, voteOptions });
      try {
        const vr = await withTimeout(callModel(r.provider, r.modelId, DEBATE_VOTE_PROMPT, votePrompt, 300, [], false, []), 30_000, `vote-${r.modelId}`);
        const match = vr.text.match(/VOTE:([^\s\n,\.]+)/i);
        if (match) {
          const raw = match[1].trim();
          const voted = candidateIds.find(id => id !== r.modelId && (raw === id || raw.includes(id) || id.includes(raw)));
          if (voted) {
            votes[voted] = (votes[voted] || 0) + 1;
            voterLog.push({ voter: r.modelId, votedFor: voted });
            if (userId) db.prepare(`INSERT INTO debate_votes (user_id, session_id, voter_model_id, voter_provider, voted_for_model_id) VALUES (?,?,?,?,?)`)
              .run(userId, sessionId, r.modelId, r.provider, voted);
          }
        }
      } catch {}
    }));
    const maxVotes = Math.max(0, ...Object.values(votes));
    const winners = Object.keys(votes).filter(id => votes[id] === maxVotes);
    send('debate:votes', { votes, voterLog, winner: maxVotes > 0 ? winners[0] : null, totalVoters: results.length });
  }

  send('debate:done', {});
  send('complete', { sessionId });
  res.end();
});

// ─── Hallucination check (batch, multi-model, with web search) ────────────────
async function runHallucinationCheck(question, results) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let userMessage = `PREGUNTA ORIGINAL:\n${question}\n\n`;
  results.forEach(r => {
    userMessage += `RESPUESTA MODELO ${r.modelId}:\n${r.text.slice(0, 3000)}\n\n`;
  });
  userMessage += 'Audita estas respuestas. Busca en la web las afirmaciones sospechosas. Responde SOLO con JSON válido.';

  // Use streaming (same as callClaudeStream) so the SDK handles web_search tool loops properly
  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: HALLUCINATION_DETECTOR,
    messages: [{ role: 'user', content: userMessage }],
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
  });

  let fullText = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      fullText += event.delta.text;
    }
  }

  const finalMsg = await stream.finalMessage();
  const inputTokens  = finalMsg.usage?.input_tokens  || 0;
  const outputTokens = finalMsg.usage?.output_tokens || 0;
  const cost = calcCost('claude-sonnet-4-6', inputTokens, outputTokens);

  const jsonMatch = fullText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in hallucination check response');
  return { report: JSON.parse(jsonMatch[0]), cost, inputTokens, outputTokens };
}

// ─── Main research endpoint (SSE stream) — models only ────────────────────────
app.post('/api/research', async (req, res) => {
  const { question, models = [], integrator = {}, maxTokens = 2048, maxTokensIntegrator = 4096,
          attachments = [], amplitude = 'normal', conversationHistory = [],
          debateEnabled = false, debateRounds = 1 } = req.body;
  const userId = req.session.userId || null;
  const sessionId = crypto.randomUUID();

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  const send = (event, data) => { if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  const ping = setInterval(() => send('ping', {}), 15_000);

  // Process attachments
  let processedAttachments = [];
  try { processedAttachments = await processAttachments(attachments); } catch { processedAttachments = []; }

  const enabledModels = models.filter(m => m.enabled);
  const results = [];
  const amplitudeInstr = AMPLITUDE_INSTRUCTIONS[amplitude] || '';

  // ── Run all models in parallel with streaming (improvement #1) ──
  await Promise.allSettled(
    enabledModels.map(async (m) => {
      // Check cache — skip when attachments present (they change the context)
      const cached = processedAttachments.length === 0 && conversationHistory.length === 0
        ? getCached(m.modelId, question, amplitude) : null;
      if (cached) {
        send('model:start', { modelId: m.modelId, provider: m.provider });
        results.push({ ...cached, cached: true });
        send('model:done', { ...cached, cached: true });
        return;
      }

      send('model:start', { modelId: m.modelId, provider: m.provider });
      const t0 = Date.now();
      try {
        const sysInstr = [HIDDEN_INSTRUCTIONS, m.customInstructions, amplitudeInstr, CONFIDENCE_INSTRUCTION].filter(Boolean).join('\n\n');
        const r = await withTimeout(
          callModelStream(m.provider, m.modelId, sysInstr || null, question, maxTokens,
            processedAttachments, !!m.webSearch, conversationHistory,
            (chunk) => send('model:chunk', { modelId: m.modelId, provider: m.provider, chunk }),
            m.temperature ?? null),
          modelTimeout(m.modelId), m.modelId
        );
        const cost = calcCost(m.modelId, r.inputTokens, r.outputTokens);
        const durationMs = Date.now() - t0;

        // Extract self-score (improvement #5)
        let selfScore = null;
        const scoreMatch = r.text.match(/<!--SELF_SCORE:([^]*?)-->/s);
        if (scoreMatch) {
          try { selfScore = JSON.parse(scoreMatch[1].trim()); } catch {}
        }
        const cleanText = r.text.replace(/<!--SELF_SCORE:[^]*?-->/gs, '').trim() || r.text;

        const payload = { modelId: m.modelId, provider: m.provider, text: cleanText, inputTokens: r.inputTokens, outputTokens: r.outputTokens, cost, durationMs, selfScore };
        results.push(payload);
        send('model:done', payload);

        // Cache the response (improvement #10)
        setCache(m.modelId, question, amplitude, payload);

        // Save to history
        if (userId) {
          db.prepare(`INSERT INTO history (user_id, session_id, provider, model_id, prompt, response, input_tokens, output_tokens, cost_usd, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(userId, sessionId, m.provider, m.modelId, question, cleanText, r.inputTokens, r.outputTokens, cost, durationMs);
        }
      } catch (err) {
        send('model:error', { modelId: m.modelId, provider: m.provider, error: err.message });
      }
    })
  );

  // ── Cross-validation consensus scoring (improvement #2) ──
  if (results.length >= 2) {
    const consensus = computeConsensus(results);
    send('consensus', consensus);
  }

  // ── Debate mode (improvement #7) ──
  const allDebateResults = []; // accumulate across rounds
  if (debateEnabled && results.length >= 2) {
    send('debate:start', {});
    for (let round = 0; round < Math.min(debateRounds, 3); round++) {
      for (const r of results) {
        const otherResponses = results.filter(o => o.modelId !== r.modelId)
          .map(o => `[${o.modelId}]: ${o.text.slice(0, 1500)}`).join('\n\n');
        const debatePrompt = `Analiza críticamente estas respuestas de otros modelos a la pregunta "${question}". ` +
          `Identifica errores, sesgos o puntos débiles. Defiende tu posición o corrígela si los demás tienen razón.\n\n${otherResponses}`;
        try {
          const dr = await withTimeout(
            callModel(r.provider, r.modelId, 'Eres un debatiente riguroso. Sé conciso (max 400 palabras).', debatePrompt, 1024, [], false, []),
            60_000, `debate-${r.modelId}`
          );
          const cost = calcCost(r.modelId, dr.inputTokens, dr.outputTokens);
          const entry = { round, modelId: r.modelId, provider: r.provider, text: dr.text, cost };
          allDebateResults.push(entry);
          send('debate:response', entry);
          if (userId) db.prepare(`INSERT INTO debate_responses (user_id, session_id, round, model_id, provider, response, cost_usd) VALUES (?,?,?,?,?,?,?)`)
            .run(userId, sessionId, round, r.modelId, r.provider, dr.text, cost);
        } catch (err) {
          send('debate:error', { round, modelId: r.modelId, error: err.message });
        }
      }
    }

    // ── Debate voting: each model votes for best initial response ──
    if (allDebateResults.length >= 2) {
      send('debate:voting', {});
      const votes = {}; // modelId -> count
      const voterLog = []; // { voter, votedFor }
      const candidateIds = results.map(r => r.modelId);

      await Promise.allSettled(results.map(async (r) => {
        const others = results.filter(o => o.modelId !== r.modelId);
        const candidateBlock = others.map((o, i) =>
          `CANDIDATO ${String.fromCharCode(65 + i)} (${o.modelId}):\n${o.text.slice(0, 900)}`
        ).join('\n\n---\n\n');
        const votePrompt =
          `Pregunta original: "${question}"\n\n` +
          `Respuestas iniciales de los otros modelos:\n\n${candidateBlock}\n\n` +
          `Siendo completamente imparcial y honesto, ¿cuál de estos candidatos dio la MEJOR respuesta inicial? ` +
          `Razona brevemente (1-2 frases) y termina tu respuesta con exactamente: VOTE:${others.map(o => o.modelId).join(' o VOTE:')}`;
        try {
          const vr = await withTimeout(
            callModel(r.provider, r.modelId, 'Eres un juez imparcial de calidad de respuestas de IA.', votePrompt, 300, [], false, []),
            30_000, `vote-${r.modelId}`
          );
          // Extract VOTE:<modelId> — match the longest candidate id found after VOTE:
          const match = vr.text.match(/VOTE:([^\s\n,\.]+)/i);
          if (match) {
            const raw = match[1].trim();
            // Find the closest candidate (exact or substring)
            const voted = candidateIds.find(id => id !== r.modelId && (raw === id || raw.includes(id) || id.includes(raw)));
            if (voted) {
              votes[voted] = (votes[voted] || 0) + 1;
              voterLog.push({ voter: r.modelId, votedFor: voted });
              if (userId) db.prepare(`INSERT INTO debate_votes (user_id, session_id, voter_model_id, voter_provider, voted_for_model_id) VALUES (?,?,?,?,?)`)
                .run(userId, sessionId, r.modelId, r.provider, voted);
            }
          }
        } catch {}
      }));

      // Find winner(s)
      const maxVotes = Math.max(0, ...Object.values(votes));
      const winners = Object.keys(votes).filter(id => votes[id] === maxVotes);
      send('debate:votes', { votes, voterLog, winner: maxVotes > 0 ? winners[0] : null, totalVoters: results.length });
    }

    send('debate:done', {});
  }

  // ── Integrator with citations (improvements #3, #4) ──
  if (results.length > 0 && integrator.modelId) {
    send('integrator:start', { modelId: integrator.modelId, provider: integrator.provider });

    // Build model label map for citations
    const modelLabels = {};
    for (const r of results) {
      const provCfg = { anthropic: 'Claude', openai: 'OpenAI', google: 'Gemini', xai: 'Grok', moonshot: 'Kimi' };
      modelLabels[r.modelId] = provCfg[r.provider] || r.modelId;
    }

    const allResponsesBlock = results
      .map((r, i) => `### Respuesta ${i + 1} — [${modelLabels[r.modelId]}] (${r.modelId})\n\n${r.text}`)
      .join('\n\n---\n\n');

    const defaultSysPrompt = INTEGRATOR_PROMPT + `\nAvailable models: ${Object.values(modelLabels).join(', ')}`;
    const sysPrompt = integrator.customInstructions
      ? `${HIDDEN_INSTRUCTIONS}\n\n${integrator.customInstructions}\n\n${defaultSysPrompt}`
      : `${HIDDEN_INSTRUCTIONS}\n\n${defaultSysPrompt}`;

    const userMsg = `Pregunta original: ${question}\n\nRespuestas de todos los modelos:\n\n${allResponsesBlock}`;

    try {
      const t0 = Date.now();
      const r = await withTimeout(
        callModelStream(integrator.provider, integrator.modelId, sysPrompt, userMsg, maxTokensIntegrator, processedAttachments, false, conversationHistory,
          (chunk) => send('integrator:chunk', { chunk })),
        120_000, 'integrator'
      );
      const cost = calcCost(integrator.modelId, r.inputTokens, r.outputTokens);
      const durationMs = Date.now() - t0;
      send('integrator:done', { text: r.text, inputTokens: r.inputTokens, outputTokens: r.outputTokens, cost, durationMs });

      if (userId) {
        db.prepare(`INSERT INTO history (user_id, session_id, provider, model_id, prompt, response, input_tokens, output_tokens, cost_usd, duration_ms, is_integrator) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
          .run(userId, sessionId, integrator.provider, integrator.modelId, question, r.text, r.inputTokens, r.outputTokens, cost, durationMs);
        const allCosts = results.reduce((s, x) => s + x.cost, 0) + cost;
        db.prepare('UPDATE users SET total_cost_usd = total_cost_usd + ? WHERE id = ?').run(allCosts, userId);
        addMonthlyCost(userId, allCosts);
        const u = db.prepare('SELECT total_cost_usd, monthly_cost_usd, plan FROM users WHERE id = ?').get(userId);
        send('cost:update', { total_cost_usd: u.total_cost_usd, monthly_cost_usd: u.monthly_cost_usd, plan: u.plan, budget: (PLANS[u.plan]||PLANS.free).budget });
      }
    } catch (err) {
      send('integrator:error', { error: err.message });
    }
  } else if (results.length > 0 && userId) {
    // No integrator — still update costs
    const allCosts = results.reduce((s, x) => s + x.cost, 0);
    if (allCosts > 0) {
      db.prepare('UPDATE users SET total_cost_usd = total_cost_usd + ? WHERE id = ?').run(allCosts, userId);
      addMonthlyCost(userId, allCosts);
      const u = db.prepare('SELECT total_cost_usd, monthly_cost_usd, plan FROM users WHERE id = ?').get(userId);
      send('cost:update', { total_cost_usd: u.total_cost_usd, monthly_cost_usd: u.monthly_cost_usd, plan: u.plan, budget: (PLANS[u.plan]||PLANS.free).budget });
    }
  }

  clearInterval(ping);
  send('complete', { sessionId });
  res.end();
});

// ── Consensus computation (improvement #2) ──────────────────────────────────
function computeConsensus(results) {
  const texts = results.map(r => r.text.toLowerCase());
  const n = texts.length;

  // Extract key sentences (first sentence of each paragraph)
  const extractKeySentences = (text) => {
    return text.split(/\n\n+/)
      .map(p => p.split(/[.!?]/)[0]?.trim())
      .filter(s => s && s.length > 20);
  };

  // ── Tokenización semántica con stop words y stems ────────────────────────────
  const STOP = new Set([
    'para','con','por','que','los','las','una','del','los','sus','más','pero','sin','sobre',
    'como','este','esta','estos','estas','ese','esa','esos','esas','entre','cuando','donde',
    'from','that','this','with','have','been','were','they','will','your','which','when',
    'there','about','would','could','should','their','after','before','some','each','like',
    'just','over','such','even','most','other','these','those','both','only','very','well',
    'here','time','year','much','many','make','good','know','does','come','said','want',
    'also','into','than','then','more','what','because','through','during','while','where',
  ]);

  const tokenize = text => {
    const words = text.toLowerCase()
      .replace(/[^a-záéíóúüñ\s]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length > 4 && !STOP.has(w));
    // stem simple: primeros 6 chars para agrupar variantes morfológicas
    return new Set(words.map(w => w.slice(0, 6)));
  };

  // Jaccard + bigrams + rescalado calibrado
  // Dos textos expertos sobre el mismo tema tienen Jaccard ~0.15-0.35 → mapear a 50-90%
  const similarity = (a, b) => {
    const tA = tokenize(a), tB = tokenize(b);
    const inter = [...tA].filter(w => tB.has(w)).length;
    const union = new Set([...tA, ...tB]).size;
    const jaccard = union === 0 ? 0 : inter / union;
    // Rescalado no lineal: jaccard 0.05→18%, 0.15→50%, 0.25→72%, 0.35→88%, 0.5→100%
    return Math.min(1, 1 - Math.exp(-jaccard * 6));
  };

  // Pairwise similarity matrix
  const matrix = [];
  let totalSim = 0, pairs = 0;
  for (let i = 0; i < n; i++) {
    matrix[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) { matrix[i][j] = 1; continue; }
      if (j < i) { matrix[i][j] = matrix[j][i]; continue; }
      const sim = similarity(texts[i], texts[j]);
      matrix[i][j] = sim;
      totalSim += sim;
      pairs++;
    }
  }

  const avgSimilarity = pairs > 0 ? totalSim / pairs : 0;
  const consensusLevel = avgSimilarity > 0.65 ? 'high' : avgSimilarity > 0.40 ? 'medium' : 'low';

  // Per-model agreement score (how much each model agrees with others)
  const modelScores = results.map((r, i) => {
    const avgSim = matrix[i].reduce((s, v, j) => j === i ? s : s + v, 0) / (n - 1);
    return { modelId: r.modelId, provider: r.provider, agreementScore: Math.round(avgSim * 100) };
  });

  // Identify outlier (lowest agreement)
  const outlier = modelScores.reduce((min, m) => m.agreementScore < min.agreementScore ? m : min, modelScores[0]);

  return {
    avgSimilarity: Math.round(avgSimilarity * 100),
    consensusLevel,
    modelScores,
    outlier: outlier.agreementScore < 30 ? outlier : null,
  };
}

// ─── Projects ─────────────────────────────────────────────────────────────────

app.get('/api/projects', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const projects = db.prepare(`
      SELECT p.*,
        (SELECT COUNT(DISTINCT ps.session_id) FROM project_sessions ps WHERE ps.project_id = p.id) AS session_count,
        (SELECT COUNT(*) FROM project_attachments pa WHERE pa.project_id = p.id) AS attachment_count
      FROM projects p WHERE p.user_id = ? ORDER BY p.updated_at DESC
    `).all(req.session.userId);
    res.json({ projects });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/projects', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const { name, instructions = '', color = '#58a6ff' } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const result = db.prepare('INSERT INTO projects (user_id, name, instructions, color) VALUES (?, ?, ?, ?)').run(req.session.userId, name.trim(), instructions, color);
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    res.json({ project });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/projects/:id', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const { name, instructions, color } = req.body;
    const proj = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
    if (!proj) return res.status(404).json({ error: 'Not found' });
    db.prepare('UPDATE projects SET name=COALESCE(?,name), instructions=COALESCE(?,instructions), color=COALESCE(?,color), updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(name ?? null, instructions ?? null, color ?? null, proj.id);
    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(proj.id);
    res.json({ project: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/projects/:id', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const proj = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
    if (!proj) return res.status(404).json({ error: 'Not found' });
    db.prepare('DELETE FROM projects WHERE id = ?').run(proj.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/projects/:id/sessions', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
    const proj = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
    if (!proj) return res.status(404).json({ error: 'Not found' });
    db.prepare('INSERT OR IGNORE INTO project_sessions (project_id, session_id, user_id) VALUES (?, ?, ?)').run(proj.id, sessionId, req.session.userId);
    db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(proj.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/projects/:id/sessions/:sessionId', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    db.prepare('DELETE FROM project_sessions WHERE project_id = ? AND session_id = ? AND user_id = ?')
      .run(req.params.id, req.params.sessionId, req.session.userId);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/projects/session/:sessionId', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const rows = db.prepare(`
      SELECT p.id, p.name, p.color FROM projects p
      INNER JOIN project_sessions ps ON ps.project_id = p.id
      WHERE ps.session_id = ? AND p.user_id = ?
    `).all(req.params.sessionId, req.session.userId);
    res.json({ projects: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/projects/:id/history', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const proj = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
    if (!proj) return res.status(404).json({ error: 'Not found' });
    const rows = db.prepare(`
      SELECT h.id, h.session_id, h.created_at, h.provider, h.model_id, h.model_label,
             h.prompt, h.response, h.input_tokens, h.output_tokens, h.cost_usd, h.duration_ms, h.is_integrator
      FROM history h
      INNER JOIN project_sessions ps ON ps.session_id = h.session_id
      WHERE ps.project_id = ? AND h.user_id = ?
      ORDER BY h.created_at DESC LIMIT 500
    `).all(proj.id, req.session.userId);
    const attachments = db.prepare('SELECT id, name, type, size FROM project_attachments WHERE project_id = ?').all(proj.id);
    res.json({ project: proj, rows, attachments });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const ALLOWED_ATTACH_TYPES = new Set(['application/pdf','image/png','image/jpeg','image/gif','image/webp','image/svg+xml','text/plain','text/csv']);
const MAX_ATTACH_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per file
const MAX_ATTACH_PER_PROJECT = 20;

app.post('/api/projects/:id/attachments', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const proj = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
    if (!proj) return res.status(404).json({ error: 'Not found' });
    const name    = sanitizeStr(req.body.name, 255);
    const type    = sanitizeStr(req.body.type, 100) || 'application/octet-stream';
    const content = typeof req.body.content === 'string' ? req.body.content : '';
    const size    = typeof req.body.size === 'number' ? req.body.size : Math.ceil(content.length * 0.75);
    if (!name || !content) return res.status(400).json({ error: 'Missing fields' });
    if (!ALLOWED_ATTACH_TYPES.has(type)) return res.status(400).json({ error: `File type "${type}" not allowed` });
    if (size > MAX_ATTACH_SIZE_BYTES) return res.status(400).json({ error: `File too large (max ${MAX_ATTACH_SIZE_BYTES / 1024 / 1024}MB)` });
    const count = db.prepare('SELECT COUNT(*) AS n FROM project_attachments WHERE project_id = ?').get(proj.id).n;
    if (count >= MAX_ATTACH_PER_PROJECT) return res.status(400).json({ error: `Max ${MAX_ATTACH_PER_PROJECT} attachments per project` });
    const result = db.prepare('INSERT INTO project_attachments (project_id, name, type, content, size) VALUES (?, ?, ?, ?, ?)')
      .run(proj.id, name, type, content, size);
    res.json({ id: result.lastInsertRowid, name, type, size });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/projects/:id/attachments/:attachId', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const proj = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
    if (!proj) return res.status(404).json({ error: 'Not found' });
    db.prepare('DELETE FROM project_attachments WHERE id = ? AND project_id = ?').run(req.params.attachId, proj.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Billing & Plans ─────────────────────────────────────────────────────────

// GET /api/billing/plans — public list of plans
app.get('/api/billing/plans', (req, res) => {
  const rows = db.prepare('SELECT * FROM plans ORDER BY price_eur').all();
  res.json({ plans: rows });
});

// GET /api/billing/me — current user's billing status
app.get('/api/billing/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const user = db.prepare('SELECT id, plan, monthly_cost_usd, billing_period_start, paused, stripe_subscription_id, plan_expires_at FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Not found' });
  resetMonthlyIfNeeded(user);
  const plan = PLANS[user.plan] || PLANS.free;
  res.json({
    plan: user.plan,
    planName: plan.name,
    budget: plan.budget,
    monthly_cost_usd: user.monthly_cost_usd || 0,
    billing_period_start: user.billing_period_start,
    paused: !!user.paused,
    has_subscription: !!user.stripe_subscription_id,
    plan_expires_at: user.plan_expires_at,
    limits: plan,
  });
});

// POST /api/billing/checkout — create Stripe checkout session
app.post('/api/billing/checkout', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  if (!stripe) return res.status(503).json({ error: 'Payments not configured' });
  const { planId } = req.body;
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
  if (!plan || !plan.stripe_price_id) return res.status(400).json({ error: 'Invalid plan or price not configured' });
  const user = db.prepare('SELECT email, stripe_customer_id FROM users WHERE id = ?').get(req.session.userId);
  try {
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { userId: String(req.session.userId) } });
      customerId = customer.id;
      db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, req.session.userId);
    }
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url: `${process.env.APP_URL || 'http://localhost:3000'}/?billing=success`,
      cancel_url:  `${process.env.APP_URL || 'http://localhost:3000'}/?billing=cancelled`,
      metadata: { userId: String(req.session.userId), planId },
    });
    res.json({ url: session.url });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/billing/portal — open Stripe customer portal
app.post('/api/billing/portal', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  if (!stripe) return res.status(503).json({ error: 'Payments not configured' });
  const user = db.prepare('SELECT stripe_customer_id FROM users WHERE id = ?').get(req.session.userId);
  if (!user?.stripe_customer_id) return res.status(400).json({ error: 'No billing account found' });
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.APP_URL || 'http://localhost:3000'}/`,
    });
    res.json({ url: portal.url });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/billing/webhook — Stripe webhook
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.sendStatus(200);
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
  } catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    const userId = parseInt(s.metadata?.userId);
    const planId = s.metadata?.planId;
    if (userId && planId) {
      const expires = new Date(); expires.setMonth(expires.getMonth() + 1);
      db.prepare('UPDATE users SET plan = ?, stripe_subscription_id = ?, plan_expires_at = ?, paused = 0 WHERE id = ?')
        .run(planId, s.subscription, expires.toISOString(), userId);
      db.prepare(`INSERT INTO billing_events (user_id, type, amount_usd, description, stripe_id) VALUES (?,?,?,?,?)`)
        .run(userId, 'subscription_created', 0, `Subscribed to ${planId}`, s.id);
    }
  } else if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    const user = db.prepare('SELECT id FROM users WHERE stripe_subscription_id = ?').get(sub.id);
    if (user) {
      db.prepare('UPDATE users SET plan = ?, stripe_subscription_id = NULL, plan_expires_at = NULL WHERE id = ?').run('free', user.id);
      db.prepare(`INSERT INTO billing_events (user_id, type, description, stripe_id) VALUES (?,?,?,?)`).run(user.id, 'subscription_cancelled', 'Subscription cancelled', sub.id);
    }
  } else if (event.type === 'invoice.payment_succeeded') {
    // Subscription renewal: reset monthly cost and extend plan expiry
    const inv = event.data.object;
    if (inv.billing_reason === 'subscription_cycle') {
      const user = db.prepare('SELECT id FROM users WHERE stripe_customer_id = ?').get(inv.customer);
      if (user) {
        const expires = new Date(); expires.setMonth(expires.getMonth() + 1);
        db.prepare('UPDATE users SET monthly_cost_usd = 0, paused = 0, billing_period_start = ?, plan_expires_at = ? WHERE id = ?')
          .run(currentPeriodStart(), expires.toISOString(), user.id);
        db.prepare(`INSERT INTO billing_events (user_id, type, amount_usd, description, stripe_id) VALUES (?,?,?,?,?)`)
          .run(user.id, 'renewal', inv.amount_paid / 100, `Subscription renewed`, inv.id);
      }
    }
  } else if (event.type === 'invoice.payment_failed') {
    const inv = event.data.object;
    const user = db.prepare('SELECT id FROM users WHERE stripe_customer_id = ?').get(inv.customer);
    if (user) db.prepare('UPDATE users SET paused = 1 WHERE id = ?').run(user.id);
  } else if (event.type === 'customer.subscription.updated') {
    // Plan change via portal
    const sub = event.data.object;
    const user = db.prepare('SELECT id FROM users WHERE stripe_subscription_id = ?').get(sub.id);
    if (user && sub.items?.data?.[0]?.price?.id) {
      const newPriceId = sub.items.data[0].price.id;
      const plan = db.prepare('SELECT id FROM plans WHERE stripe_price_id = ?').get(newPriceId);
      if (plan) {
        const expires = new Date(sub.current_period_end * 1000);
        db.prepare('UPDATE users SET plan = ?, plan_expires_at = ?, paused = 0 WHERE id = ?')
          .run(plan.id, expires.toISOString(), user.id);
      }
    }
  }
  res.sendStatus(200);
});

// ── Admin: configure Stripe Price IDs ──────────────────────────────────────
// POST /api/admin/billing/plans  body: { token, plans: [{id:'starter', stripe_price_id:'price_xxx'}, ...] }
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin_change_me';
app.post('/api/admin/billing/plans', (req, res) => {
  const { token, plans } = req.body || {};
  if (token !== ADMIN_TOKEN) return res.status(403).json({ error: 'Forbidden' });
  if (!Array.isArray(plans)) return res.status(400).json({ error: 'plans must be an array' });
  const stmt = db.prepare('UPDATE plans SET stripe_price_id = ? WHERE id = ?');
  const results = [];
  for (const { id, stripe_price_id } of plans) {
    if (!id || !stripe_price_id) continue;
    const info = stmt.run(stripe_price_id, id);
    results.push({ id, stripe_price_id, updated: info.changes > 0 });
  }
  res.json({ ok: true, results });
});

// ─── DB Migration import (temporary, protected by token) ─────────────────────
const MIGRATE_TOKEN = 'mig_7x9kQpL2wNzR4vT8sY1uJ3bX';
app.post('/api/migrate-import', express.json({ limit: '50mb' }), (req, res) => {
  if (req.headers['x-migrate-token'] !== MIGRATE_TOKEN) return res.status(403).json({ error: 'forbidden' });
  const { users: srcUsers = [], history: srcHistory = [], debate_responses: srcDebate = [],
          debate_votes: srcVotes = [], projects: srcProjects = [], project_sessions: srcPS = [] } = req.body;
  let inserted = { users: 0, history: 0, debate_responses: 0, debate_votes: 0, projects: 0, project_sessions: 0 };
  const userIdMap = {}; // srcId -> destId

  // Users
  for (const u of srcUsers) {
    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(u.username, u.email);
    if (existing) { userIdMap[u.id] = existing.id; continue; }
    const r = db.prepare(`INSERT OR IGNORE INTO users (username, email, password_hash, plan, total_cost_usd, monthly_cost_usd, billing_period_start)
      VALUES (?,?,?,?,?,?,?)`).run(u.username, u.email, u.password_hash, u.plan||'free', u.total_cost_usd||0, u.monthly_cost_usd||0, u.billing_period_start||null);
    userIdMap[u.id] = r.lastInsertRowid || u.id;
    if (r.changes) inserted.users++;
  }

  // History
  for (const h of srcHistory) {
    const newUserId = userIdMap[h.user_id] || h.user_id;
    try {
      db.prepare(`INSERT OR IGNORE INTO history (user_id,session_id,created_at,provider,model_id,model_label,prompt,response,input_tokens,output_tokens,cost_usd,duration_ms,is_integrator)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(newUserId,h.session_id,h.created_at,h.provider,h.model_id,h.model_label,h.prompt,h.response,h.input_tokens||0,h.output_tokens||0,h.cost_usd||0,h.duration_ms||0,h.is_integrator||0);
      inserted.history++;
    } catch(e) {}
  }

  // Debate responses
  for (const d of srcDebate) {
    const newUserId = userIdMap[d.user_id] || d.user_id;
    try {
      db.prepare(`INSERT OR IGNORE INTO debate_responses (user_id,session_id,round,model_id,provider,response,cost_usd,created_at)
        VALUES (?,?,?,?,?,?,?,?)`).run(newUserId,d.session_id,d.round||0,d.model_id,d.provider,d.response,d.cost_usd||0,d.created_at);
      inserted.debate_responses++;
    } catch(e) {}
  }

  // Debate votes
  for (const v of srcVotes) {
    const newUserId = userIdMap[v.user_id] || v.user_id;
    try {
      db.prepare(`INSERT OR IGNORE INTO debate_votes (user_id,session_id,voter_model_id,voter_provider,voted_for_model_id,created_at)
        VALUES (?,?,?,?,?,?)`).run(newUserId,v.session_id,v.voter_model_id,v.voter_provider,v.voted_for_model_id,v.created_at);
      inserted.debate_votes++;
    } catch(e) {}
  }

  // Projects
  for (const p of srcProjects) {
    const newUserId = userIdMap[p.user_id] || p.user_id;
    try {
      db.prepare(`INSERT OR IGNORE INTO projects (user_id,name,instructions,color,created_at,updated_at)
        VALUES (?,?,?,?,?,?)`).run(newUserId,p.name,p.instructions||'',p.color||'#58a6ff',p.created_at,p.updated_at);
      inserted.projects++;
    } catch(e) {}
  }

  res.json({ ok: true, inserted, userIdMap });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`\n  JJ Multi-LLM Research  →  http://localhost:${PORT}\n`); });
