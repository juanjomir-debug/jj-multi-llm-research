---
inclusion: always
---

# Backend Map — server.js

## Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/research` | Lanza N modelos en paralelo (SSE stream) |
| POST | `/api/integrate` | Sintetiza respuestas con modelo integrador (SSE) |
| POST | `/api/retry` | Reintenta un modelo individual (SSE) |
| POST | `/api/debate` | Debate multi-ronda entre modelos |
| POST | `/api/plan-research` | Genera plan de investigación con LLM (SSE) |
| GET/POST | `/api/auth/*` | Registro, login, logout, perfil, verificación email |
| GET | `/api/history` | Historial de sesiones del usuario |
| GET/POST/DELETE | `/api/projects/*` | Gestión de proyectos con adjuntos |
| GET/POST | `/api/billing/*` | Planes, consumo, Stripe checkout, webhook |
| GET | `/api/config` | Claves activas + healthcheck |
| GET | `/health` | Health check con DB y memoria |
| GET/PUT/DELETE | `/api/admin/*` | Panel admin (requiere rol admin/superadmin) |

## Callers de modelos

| Función | Provider | Notas |
|---|---|---|
| `callClaudeStream()` | anthropic | Soporta thinking, web search nativo |
| `callOpenAIStream()` | openai | Soporta o-series, gpt-5 family, search |
| `callGemini()` | google | Streaming con fallback, Pro fuerza min 8192 tokens |
| `callGrokStream()` | xai | Web search via Responses API |
| `callQwenStream()` | qwen | OpenAI-compatible, NO soporta imágenes |
| `callZhipuStream()` | zhipu | OpenAI-compatible, NO soporta imágenes |
| `callKimi()` | moonshot | Sin streaming |
| `callPerplexityStream()` | perplexity | OpenAI-compatible |
| `callModelStream()` | dispatcher | Filtra imágenes para qwen/zhipu automáticamente |

## Flujo de `/api/research`
1. Extrae `temporaryChat`, `maxTokens`, `amplitude`, `models`, `attachments` del body
2. `processAttachments()` — extrae texto de PDFs, decodifica archivos de texto
3. Filtra modelos habilitados + restricciones del plan free
4. `runOneModel()` en paralelo (`Promise.allSettled`) o secuencial (cascade)
5. Cada modelo emite SSE: `model:start → model:chunk → model:done | model:error`
6. Si `temporaryChat=false` → INSERT en `history`
7. Consensus scoring si ≥2 modelos
8. Integrador si configurado → `integrator:start → integrator:chunk → integrator:done`
9. `complete { sessionId }`

## Gestión de costes
- `calcCost(modelId, inputTok, outputTok)` — tabla `PRICING` en server.js
- `addMonthlyCost(userId, cost)` — actualiza `monthly_cost_usd`, pausa si supera budget
- `resetMonthlyIfNeeded()` — resetea el 1 de cada mes
- `resetDailyIfNeeded()` — resetea queries diarias cada día

## Caché de respuestas
- `responseCache` — Map en memoria, TTL 30min, max 200 entradas
- Clave: `modelId:amplitude:md5(question)`
- Solo cachea si no hay adjuntos ni historial de conversación

## Timeouts por modelo
- Gemini: 180s
- Thinking/reasoning: 120s
- Resto: 90s

## Seguridad
- `helmet` (CSP desactivado por inline scripts)
- Rate limit: auth 20/15min, API 60/min
- `bcryptjs` cost 10 para passwords
- Sesiones HttpOnly, Secure en prod, SameSite lax, 30 días
- `sanitizeStr()` en inputs
- Roles: `user`, `admin`, `superadmin`
