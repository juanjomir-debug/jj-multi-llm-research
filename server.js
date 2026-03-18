require('dotenv').config();
const express = require('express');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Pricing (USD per 1M tokens: input / output) ────────────────────────────
const PRICING = {
  // Anthropic
  'claude-opus-4-6':          { input: 15.00, output: 75.00 },
  'claude-sonnet-4-6':        { input:  3.00, output: 15.00 },
  'claude-haiku-4-5-20251001':{ input:  0.80, output:  4.00 },
  'claude-opus-4-5':          { input: 15.00, output: 75.00 },
  'claude-sonnet-4-5':        { input:  3.00, output: 15.00 },
  // OpenAI
  'gpt-4o':                   { input:  2.50, output: 10.00 },
  'gpt-4o-mini':              { input:  0.15, output:  0.60 },
  'gpt-5-mini':               { input:  0.15, output:  0.60 },
  'o1':                       { input: 15.00, output: 60.00 },
  'o3-mini':                  { input:  1.10, output:  4.40 },
  // Google Gemini
  'gemini-2.0-flash':                        { input: 0.10,  output: 0.40  },
  'gemini-2.0-flash-lite':                   { input: 0.075, output: 0.30  },
  'gemini-1.5-pro':                          { input: 1.25,  output: 5.00  },
  'gemini-2.5-pro-preview-03-25':            { input: 1.25,  output: 5.00  },
  'models/gemini-3.1-flash-lite-preview':    { input: 0.075, output: 0.30  },
  // xAI Grok
  'grok-3':                              { input: 3.00,  output: 15.00 },
  'grok-3-mini':                         { input: 0.30,  output:  0.50 },
  'grok-beta':                           { input: 5.00,  output: 15.00 },
  'grok-4.20-beta-0309-non-reasoning':   { input: 3.00,  output: 15.00 },
};

function calcCost(modelId, inputTok, outputTok) {
  const p = PRICING[modelId];
  if (!p) return 0;
  return (inputTok / 1_000_000) * p.input + (outputTok / 1_000_000) * p.output;
}

// ─── LLM callers ─────────────────────────────────────────────────────────────

async function callClaude(modelId, systemPrompt, userMessage, maxTokens) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const params = {
    model: modelId,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: userMessage }],
  };
  if (systemPrompt) params.system = systemPrompt;
  const r = await client.messages.create(params);
  return {
    text: r.content[0].text,
    inputTokens:  r.usage.input_tokens,
    outputTokens: r.usage.output_tokens,
  };
}

async function callOpenAI(modelId, systemPrompt, userMessage, maxTokens) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userMessage });
  const r = await client.chat.completions.create({ model: modelId, messages, max_tokens: maxTokens });
  return {
    text: r.choices[0].message.content,
    inputTokens:  r.usage.prompt_tokens,
    outputTokens: r.usage.completion_tokens,
  };
}

async function callGemini(modelId, systemPrompt, userMessage) {
  if (!process.env.GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY not configured');
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  const cleanId = modelId.startsWith('models/') ? modelId.slice(7) : modelId;
  const model = genAI.getGenerativeModel({
    model: cleanId,
    ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
  });
  const result = await model.generateContent(userMessage);
  const resp = result.response;
  return {
    text: resp.text(),
    inputTokens:  resp.usageMetadata?.promptTokenCount     || 0,
    outputTokens: resp.usageMetadata?.candidatesTokenCount || 0,
  };
}

async function callGrok(modelId, systemPrompt, userMessage, maxTokens) {
  if (!process.env.XAI_API_KEY) throw new Error('XAI_API_KEY not configured');
  const client = new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: 'https://api.x.ai/v1' });
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userMessage });
  const r = await client.chat.completions.create({ model: modelId, messages, max_tokens: maxTokens });
  return {
    text: r.choices[0].message.content,
    inputTokens:  r.usage.prompt_tokens,
    outputTokens: r.usage.completion_tokens,
  };
}

// Dispatch to the right caller
async function callModel(provider, modelId, systemPrompt, userMessage, maxTokens) {
  switch (provider) {
    case 'anthropic': return callClaude(modelId, systemPrompt, userMessage, maxTokens);
    case 'openai':    return callOpenAI(modelId, systemPrompt, userMessage, maxTokens);
    case 'google':    return callGemini(modelId, systemPrompt, userMessage);
    case 'xai':       return callGrok(modelId, systemPrompt, userMessage, maxTokens);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

// Wrap a promise with a timeout (ms)
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms / 1000}s (${label})`)), ms)
    ),
  ]);
}

// ─── API: which keys are configured ─────────────────────────────────────────
app.get('/api/config', (_req, res) => {
  res.json({
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai:    !!process.env.OPENAI_API_KEY,
    google:    !!process.env.GOOGLE_API_KEY,
    xai:       !!process.env.XAI_API_KEY,
  });
});

// ─── API: cost estimate ───────────────────────────────────────────────────────
app.post('/api/estimate', (req, res) => {
  const { question = '', models = [], integrator = {} } = req.body;
  const qTok = Math.ceil(question.length / 4);
  const estOut = 1500;

  const modelBreakdown = models
    .filter(m => m.enabled)
    .map(m => {
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

// ─── API: run research (SSE stream) ──────────────────────────────────────────
app.post('/api/research', async (req, res) => {
  const { question, models = [], integrator = {}, maxTokens = 2048, maxTokensIntegrator = 4096 } = req.body;

  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (event, data) => {
    if (!res.writableEnded) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };

  // Keep-alive ping every 15 s
  const ping = setInterval(() => send('ping', {}), 15_000);

  const enabledModels = models.filter(m => m.enabled);
  const results = [];

  // ── Run all models in parallel ──
  await Promise.allSettled(
    enabledModels.map(async (m) => {
      send('model:start', { modelId: m.modelId, provider: m.provider });
      const t0 = Date.now();
      try {
        const r = await withTimeout(
          callModel(m.provider, m.modelId, m.customInstructions || null, question, maxTokens),
          90_000,
          m.modelId
        );
        const cost = calcCost(m.modelId, r.inputTokens, r.outputTokens);
        const payload = {
          modelId: m.modelId,
          provider: m.provider,
          text: r.text,
          inputTokens:  r.inputTokens,
          outputTokens: r.outputTokens,
          cost,
          durationMs: Date.now() - t0,
        };
        results.push(payload);
        send('model:done', payload);
      } catch (err) {
        send('model:error', { modelId: m.modelId, provider: m.provider, error: err.message });
      }
    })
  );

  // ── Integrator ──
  if (results.length > 0 && integrator.modelId) {
    send('integrator:start', { modelId: integrator.modelId, provider: integrator.provider });

    const allResponsesBlock = results
      .map((r, i) => `### Response ${i + 1} — ${r.modelId}\n\n${r.text}`)
      .join('\n\n---\n\n');

    const defaultSysPrompt =
      `You are a research synthesizer. Multiple AI models answered the same question. ` +
      `Analyze their responses critically, identify errors and assumptions, assess consensus.\n` +
      `Produce a comprehensive answer that:\n` +
      `• Integrates the best elements from all responses.\n` +
      `• Highlights significant disagreements, naming the source model.\n` +
      `• Avoids unnecessary repetition.\n\n` +
      `Strict formatting rules:\n` +
      `- Clean professional Markdown, max 3 heading levels.\n` +
      `- No horizontal rules, pipes, or excessive bold text.\n` +
      `- Respond ONLY with the final analysis, no meta-commentary.\n` +
      `- Match the language of the original question.`;

    const sysPrompt = integrator.customInstructions
      ? `${integrator.customInstructions}\n\n${defaultSysPrompt}`
      : defaultSysPrompt;

    const userMsg =
      `Original question: ${question}\n\n` +
      `All model responses:\n\n${allResponsesBlock}`;

    try {
      const t0 = Date.now();
      const r = await withTimeout(
        callModel(integrator.provider, integrator.modelId, sysPrompt, userMsg, maxTokensIntegrator),
        120_000,
        'integrator'
      );
      const cost = calcCost(integrator.modelId, r.inputTokens, r.outputTokens);
      send('integrator:done', {
        text: r.text,
        inputTokens:  r.inputTokens,
        outputTokens: r.outputTokens,
        cost,
        durationMs: Date.now() - t0,
      });
    } catch (err) {
      send('integrator:error', { error: err.message });
    }
  }

  clearInterval(ping);
  send('complete', {});
  res.end();
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  JJ Multi-LLM Research  →  http://localhost:${PORT}\n`);
});
