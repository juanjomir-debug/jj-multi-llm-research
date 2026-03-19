require('dotenv').config();
const express = require('express');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdfParse = require('pdf-parse');

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Pricing (USD per 1M tokens: input / output) ────────────────────────────
const PRICING = {
  // Anthropic Claude 3.7 (Extended Thinking)
  'claude-3-7-sonnet-20250219': { input:  3.00, output: 15.00 },
  // Anthropic Claude 4
  'claude-opus-4-6-thinking':   { input: 15.00, output: 75.00 },
  'claude-opus-4-6':            { input: 15.00, output: 75.00 },
  'claude-sonnet-4-6':          { input:  3.00, output: 15.00 },
  'claude-haiku-4-5-20251001':  { input:  0.80, output:  4.00 },
  'claude-opus-4-5':            { input: 15.00, output: 75.00 },
  'claude-sonnet-4-5':          { input:  3.00, output: 15.00 },
  // Anthropic Claude 3.x
  'claude-3-5-sonnet-20241022': { input:  3.00, output: 15.00 },
  'claude-3-5-haiku-20241022':  { input:  0.80, output:  4.00 },
  'claude-3-opus-20240229':     { input: 15.00, output: 75.00 },
  // OpenAI GPT / o-series
  'gpt-5.4':                    { input:  7.00, output: 28.00 },
  'gpt-5':                      { input:  5.00, output: 20.00 },
  'gpt-4o':                     { input:  2.50, output: 10.00 },
  'gpt-4o-mini':                { input:  0.15, output:  0.60 },
  'gpt-5-mini':                 { input:  0.15, output:  0.60 },
  'gpt-4.1':                    { input:  2.00, output:  8.00 },
  'gpt-4.1-mini':               { input:  0.40, output:  1.60 },
  'gpt-4.1-nano':               { input:  0.10, output:  0.40 },
  'o1':                         { input: 15.00, output: 60.00 },
  'o3':                         { input: 10.00, output: 40.00 },
  'o3-mini':                    { input:  1.10, output:  4.40 },
  'o4-mini':                    { input:  1.10, output:  4.40 },
  // Google Gemini
  'gemini-2.0-flash-thinking-exp':        { input: 0.10,  output: 0.40 },
  'models/gemini-3.1-flash-lite-preview': { input: 0.075, output: 0.30 },
  'gemini-2.5-pro-preview-03-25':         { input: 1.25,  output: 5.00 },
  'gemini-2.0-flash':                     { input: 0.10,  output: 0.40 },
  'gemini-2.0-flash-lite':                { input: 0.075, output: 0.30 },
  'gemini-1.5-pro':                       { input: 1.25,  output: 5.00 },
  'gemini-1.5-flash':                     { input: 0.075, output: 0.30 },
  // xAI Grok
  'grok-4.20-0309-reasoning':          { input: 3.00,  output: 15.00 },
  'grok-4.20-0309-non-reasoning':      { input: 3.00,  output: 15.00 },
  'grok-4.20-beta-0309':               { input: 3.00,  output: 15.00 },
  'grok-4.20-beta-0309-non-reasoning': { input: 3.00,  output: 15.00 },
  'grok-3':                            { input: 3.00,  output: 15.00 },
  'grok-3-mini':                       { input: 0.30,  output:  0.50 },
  'grok-2-1212':                       { input: 2.00,  output: 10.00 },
  'grok-beta':                         { input: 5.00,  output: 15.00 },
  // Moonshot (Kimi)
  'kimi-k2-5':          { input: 2.00, output: 8.00  },
  'kimi-latest':        { input: 2.00, output: 6.00  },
  'moonshot-v1-128k':   { input: 8.00, output: 8.00  },
  'moonshot-v1-32k':    { input: 2.40, output: 2.40  },
  'moonshot-v1-8k':     { input: 0.80, output: 0.80  },
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

// ─── LLM callers ─────────────────────────────────────────────────────────────

// Models that require Extended Thinking API params
const CLAUDE_THINKING_MODELS = new Set(['claude-3-7-sonnet-20250219', 'claude-opus-4-6-thinking']);
// Maps "virtual" thinking model IDs → real Anthropic API model IDs
const CLAUDE_THINKING_MODEL_MAP = { 'claude-opus-4-6-thinking': 'claude-opus-4-6' };

async function callClaude(modelId, systemPrompt, userMessage, maxTokens, attachments = []) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const useThinking = CLAUDE_THINKING_MODELS.has(modelId);

  // Build multimodal content array if attachments present
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

  // Map virtual thinking IDs to real API model IDs (e.g. claude-opus-4-6-thinking → claude-opus-4-6)
  const actualModelId = CLAUDE_THINKING_MODEL_MAP[modelId] || modelId;

  // Extended thinking requires max_tokens >= budget_tokens + output
  const effectiveMaxTokens = useThinking ? Math.max(maxTokens, 16000) : maxTokens;
  const params = {
    model: actualModelId,
    max_tokens: effectiveMaxTokens,
    messages: [{ role: 'user', content: userContent }],
  };
  if (systemPrompt) params.system = systemPrompt;
  if (useThinking) {
    params.thinking = { type: 'enabled', budget_tokens: Math.min(10000, effectiveMaxTokens - 2000) };
    params.temperature = 1; // Required for extended thinking
  }

  const r = await client.messages.create(params);

  // For thinking models, extract only the text blocks (skip thinking blocks)
  const text = useThinking
    ? r.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
    : r.content[0].text;

  return {
    text,
    inputTokens:  r.usage.input_tokens,
    outputTokens: r.usage.output_tokens,
  };
}

async function callOpenAI(modelId, systemPrompt, userMessage, maxTokens, attachments = []) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });

  // Build multimodal content array if attachments present
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

  // o-series AND gpt-5 family use max_completion_tokens instead of max_tokens
  // Both families may use internal reasoning tokens, so enforce min 4096 to avoid empty responses
  const isOSeries    = /^o\d/.test(modelId);
  const isGpt5Family = modelId.startsWith('gpt-5');
  const useMaxCompletionTokens = isOSeries || isGpt5Family;
  const effectiveMaxTokens = (isOSeries || isGpt5Family) ? Math.max(maxTokens, 4096) : maxTokens;
  const completionOpts = useMaxCompletionTokens
    ? { model: modelId, messages, max_completion_tokens: effectiveMaxTokens }
    : { model: modelId, messages, max_tokens: effectiveMaxTokens };
  const r = await client.chat.completions.create(completionOpts);

  // content can be null if reasoning consumed all tokens or on refusal
  const msg = r.choices[0].message;
  const text = msg.content || msg.refusal || '';
  if (!text) throw new Error(`Respuesta vacía de ${modelId}. Prueba aumentando Max Tokens o usando otro modelo.`);

  return {
    text,
    inputTokens:  r.usage.prompt_tokens,
    outputTokens: r.usage.completion_tokens,
  };
}

async function callGemini(modelId, systemPrompt, userMessage, attachments = []) {
  if (!process.env.GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY not configured');
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  const cleanId = modelId.startsWith('models/') ? modelId.slice(7) : modelId;
  const model = genAI.getGenerativeModel({
    model: cleanId,
    ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
  });

  // Build multimodal parts if attachments present
  let requestArg;
  if (attachments.length > 0) {
    const parts = [];
    for (const att of attachments) {
      if (att.type.startsWith('image/')) {
        parts.push({ inlineData: { mimeType: att.type, data: att.content } });
      } else if (att.textContent) {
        parts.push({ text: `[Archivo adjunto: ${att.name}]\n\n${att.textContent}` });
      }
    }
    parts.push({ text: userMessage });
    requestArg = { contents: [{ role: 'user', parts }] };
  } else {
    requestArg = userMessage;
  }

  const result = await model.generateContent(requestArg);
  const resp = result.response;
  return {
    text: resp.text(),
    inputTokens:  resp.usageMetadata?.promptTokenCount     || 0,
    outputTokens: resp.usageMetadata?.candidatesTokenCount || 0,
  };
}

async function callGrok(modelId, systemPrompt, userMessage, maxTokens, attachments = []) {
  if (!process.env.XAI_API_KEY) throw new Error('XAI_API_KEY not configured');
  const client = new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: 'https://api.x.ai/v1' });
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });

  // Build multimodal content array if attachments present
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

  const r = await client.chat.completions.create({ model: modelId, messages, max_tokens: maxTokens });
  return {
    text: r.choices[0].message.content,
    inputTokens:  r.usage.prompt_tokens,
    outputTokens: r.usage.completion_tokens,
  };
}

async function callKimi(modelId, systemPrompt, userMessage, maxTokens, attachments = []) {
  if (!process.env.MOONSHOT_API_KEY) throw new Error('MOONSHOT_API_KEY not configured');
  // Diagnostic log (safe: shows only prefix, not full key)
  console.log('[Kimi] KEY exists:', !!process.env.MOONSHOT_API_KEY, '| prefix:', process.env.MOONSHOT_API_KEY?.slice(0, 6));
  const client = new OpenAI({ apiKey: process.env.MOONSHOT_API_KEY, baseURL: 'https://api.moonshot.ai/v1' });
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });

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

  const r = await client.chat.completions.create({ model: modelId, messages, max_tokens: maxTokens });
  return {
    text: r.choices[0].message.content,
    inputTokens:  r.usage.prompt_tokens,
    outputTokens: r.usage.completion_tokens,
  };
}

// Dispatch to the right caller
async function callModel(provider, modelId, systemPrompt, userMessage, maxTokens, attachments = []) {
  switch (provider) {
    case 'anthropic': return callClaude(modelId, systemPrompt, userMessage, maxTokens, attachments);
    case 'openai':    return callOpenAI(modelId, systemPrompt, userMessage, maxTokens, attachments);
    case 'google':    return callGemini(modelId, systemPrompt, userMessage, attachments);
    case 'xai':       return callGrok(modelId, systemPrompt, userMessage, maxTokens, attachments);
    case 'moonshot':  return callKimi(modelId, systemPrompt, userMessage, maxTokens, attachments);
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
    moonshot:  !!process.env.MOONSHOT_API_KEY,
  });
});

// ─── API: Kimi diagnostic ─────────────────────────────────────────────────────
app.get('/api/diag/kimi', async (_req, res) => {
  const key = process.env.MOONSHOT_API_KEY || '';
  const baseURL = 'https://api.moonshot.ai/v1';
  const info = { keyExists: !!key, keyLength: key.length, keyPrefix: key.slice(0, 10) + '...', baseURL, results: {} };
  if (!key) return res.json({ ...info, error: 'MOONSHOT_API_KEY not set' });
  const client = new OpenAI({ apiKey: key, baseURL });
  // Test each model in order
  for (const model of ['moonshot-v1-8k', 'moonshot-v1-32k', 'kimi-latest', 'kimi-k2-5']) {
    try {
      const r = await client.chat.completions.create({ model, messages: [{ role: 'user', content: 'Di OK' }], max_tokens: 5 });
      info.results[model] = '✅ ' + (r.choices[0].message.content || 'OK');
    } catch (e) {
      info.results[model] = `❌ ${e.status || ''} ${e.message}`;
    }
  }
  res.json(info);
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

// Diversity note appended to every research model's user message
const DIVERSITY_NOTE = '\n\n---\nEsta respuesta se consolidará con otras 4 de modelos diferentes. Aporta perspectiva única/novedosa.';

// ─── API: run research (SSE stream) ──────────────────────────────────────────
app.post('/api/research', async (req, res) => {
  const { question, models = [], integrator = {}, maxTokens = 2048, maxTokensIntegrator = 4096, attachments = [] } = req.body;

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

  // ── Process attachments: extract text from PDFs ──
  let processedAttachments = [];
  try {
    processedAttachments = await Promise.all(
      attachments.map(async (att) => {
        if (att.type === 'application/pdf') {
          try {
            const textContent = await extractPdfText(att.content);
            return { ...att, textContent };
          } catch {
            return { ...att, textContent: `[Error al extraer texto de ${att.name}]` };
          }
        }
        return att; // images pass through as-is
      })
    );
  } catch (err) {
    processedAttachments = [];
  }

  const enabledModels = models.filter(m => m.enabled);
  const results = [];

  // ── Run all models in parallel ──
  await Promise.allSettled(
    enabledModels.map(async (m) => {
      send('model:start', { modelId: m.modelId, provider: m.provider });
      const t0 = Date.now();
      try {
        const r = await withTimeout(
          callModel(m.provider, m.modelId, m.customInstructions || null, question + DIVERSITY_NOTE, maxTokens, processedAttachments),
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
        callModel(integrator.provider, integrator.modelId, sysPrompt, userMsg, maxTokensIntegrator, processedAttachments),
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
