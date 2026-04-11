# ReliableAI — Claude Code Context

## Stack
- **Backend:** Node.js + Express — `server.js` (~2,300 líneas, monolítico)
- **Frontend:** HTML/CSS/JS vanilla — `public/index.html` (~7,000 líneas JS inline, ~249KB)
- **DB:** SQLite via `better-sqlite3` (`db.js`), migrations idempotentes al arrancar
- **Hosting prod:** VPS Hostinger `187.124.184.177`, `/var/www/reliableai`, PM2 proceso `reliableai` (id 0)
- **Blog:** blog.reliableai.net (WordPress + mu-plugins dark theme)

## Paths
- **Local (work here):** `C:\Users\juanj\OneDrive\Desktop\ReliableAi\`
- **Producción:** https://reliableai.net
- **Local:** http://localhost:3000

## Archivos clave
| Archivo | Contenido |
|---|---|
| `server.js` | PLANS ~91, auth ~700–860, research ~1500+, billing ~1970+, webhook ~2042+ |
| `public/index.html` | PROVIDERS ~1050, runDiffAnalysis ~2870, buildIntegratorCard ~2333, renderBillingPlans ~3410 |
| `db.js` | plans seed ~115, migrations ~170 |
| `.env` | Todas las claves API |
| `prompts/amplitude.json` | 5 niveles: superconcise/concise/normal/detailed/exhaustive |

## Deploy
```bash
# VPS
git push origin main
ssh user@187.124.184.177 "cd /var/www/reliableai && git reset --hard origin/main && npm install --omit=dev && pm2 restart reliableai"
```

## Proveedores activos
| Proveedor | Env var | SDK |
|---|---|---|
| Anthropic (Claude) | `ANTHROPIC_API_KEY` | @anthropic-ai/sdk |
| OpenAI | `OPENAI_API_KEY` | openai |
| Google (Gemini) | `GOOGLE_API_KEY` | @google/generative-ai |
| xAI (Grok) | `XAI_API_KEY` | openai con baseURL https://api.x.ai/v1 |
| Qwen (DashScope) | `QWEN_API_KEY` | openai con baseURL https://dashscope.aliyuncs.com/compatible-mode/v1 |

## Planes
| ID | Nombre | Precio | Budget API |
|---|---|---|---|
| `free` | Explorer | $0 | $3/mo |
| `starter` | Professional | $29/mo | $15/mo |
| `pro` | Expert | $59/mo | $40/mo |
| `enterprise` | Team | $49/user/mo | $200/mo |

## Features (implementadas, pendientes de deploy)
- Amplitude superconcise (170 tokens display / 600 max API)
- Consensus bars en Integrated Synthesis (verde/naranja/amarillo/rojo)
- Diff analysis: unique phrases, badges `⚡Único`/`✓×N`, heatmap, `⚔` contradiction flags
- Follow-up area, stop button integrador, vote buttons 👍👎
- Stripe sk_live configurado (falta price_ids y webhook)

## Pendientes críticos
- **Claves .env en git** — rotar todas + BFG git history clean
- **SMTP** — migrar a Resend.com (ya en .env, falta testear en VPS)
- **Sin CSRF** — todos los POST vulnerables
- **Sin password reset** — usuarios bloqueados
- **Sin cookie banner GDPR**
- **Stripe** — crear products/prices en Dashboard, configurar webhook

## Bugs conocidos (NO reintroducir)
1. Adjuntos: usar `processAttachments()` en server.js, NO Promise.all inline
2. DB borrada en deploy: `DB_PATH` + `fs.mkdirSync` en db.js
3. Gemini stuck: `sendMessageStream()` con async iterator y timeout 180s
4. Rate limiter crash: `trust proxy 1` ANTES de helmet y rateLimit
5. Sesión no persiste: registro usa `req.session.userId` directo; login usa `req.session.regenerate()`
6. Qwen/Grok: usan OpenAI SDK con baseURL distinta (no el SDK nativo)

## UI — notas de estructura
- **Mobile:** `.mob-top-bar` con botones History/Settings encima del prompt
- **Run buttons:** `.run-btn-row` con flex, texto centrado, 2 líneas en móvil
- **Orden en tab integration:** debate → integrator → reliability index + consensus → hallucination audit → results → follow-up
- **Max-width reliability index:** 480px
- **Integrator maxTokens default:** 4096

## Temperaturas
- `null` = default de la API
- Por modelo: slider individual en UI → `state.models[i].temperature`
- Global override en settings
- Claude thinking fuerza T=1 siempre
- o-series de OpenAI ignora temperatura

## Web Search
- `WEB_SEARCH_PROVIDERS = new Set(['anthropic', 'openai', 'google', 'xai'])`
- Qwen y Zhipu NO tienen web search
- Al activar search en un modelo, los modelos sin search se deseleccionan automáticamente

## Claude Code (este entorno)
- Settings: `C:\Users\juanj\.claude\settings.json`
- GLM-5.1 como Haiku via proxy Zhipu: `ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic`
- Memory: `C:\Users\juanj\.claude\projects\C--Users-juanj-OneDrive-Desktop-ReliableAi\memory\`
