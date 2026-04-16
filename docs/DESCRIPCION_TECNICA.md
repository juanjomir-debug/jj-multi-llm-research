# Descripción Técnica Completa — JJ Multi-LLM Research ("The Board")

## Visión general
Aplicación web single-page que permite lanzar consultas simultáneas a múltiples LLMs de distintos proveedores, comparar sus respuestas en tiempo real, forzar debates entre modelos, sintetizar resultados con un integrador y gestionar el historial de sesiones. Incluye sistema de cuentas de usuario con límites de gasto por plan y pasarela de pago Stripe.

**Stack**: Node.js + Express (backend) · HTML/CSS/JS vanilla (frontend) · SQLite (datos) · Railway (hosting) · GitHub (CI/CD)

---

## 1. Arquitectura general

```
Browser (index.html)
    │
    │  HTTP + SSE (Server-Sent Events)
    │
Express server (server.js)
    │
    ├── /api/research     → llama a N modelos en paralelo (streaming)
    ├── /api/query        → llama a 1 modelo individual (streaming)
    ├── /api/integrate    → sintetiza respuestas con modelo integrador (streaming)
    ├── /api/plan-research→ genera plan de investigación con LLM (streaming)
    ├── /api/debate       → debate multi-ronda entre modelos
    ├── /api/auth/*       → registro, login, logout, perfil
    ├── /api/history      → historial de sesiones y respuestas
    ├── /api/projects/*   → gestión de proyectos con adjuntos
    ├── /api/billing/*    → planes, consumo, Stripe checkout
    └── static files      → public/ (index.html, assets)
         │
    SQLite DB (data.db)   ← volumen persistente en Railway (/app/data/data.db)
    Sessions DB (sessions.db)
```

---

## 2. Backend — server.js (1542 líneas)

### 2.1 Inicialización y middleware
```js
app.set('trust proxy', 1)            // obligatorio tras proxy Railway
app.use(helmet(...))                 // seguridad HTTP headers
app.use(rateLimit(...))              // authLimiter: 20/15min, apiLimiter: 60/min
app.use(express.json({ limit: '25mb' }))
app.use(session({ store: SQLiteStore, cookie: { secure: prod, httpOnly, sameSite: 'lax' } }))
app.use(express.static('public'))
```

### 2.2 Callers de modelos (todos con streaming SSE)

#### `callClaudeStream(modelId, systemPrompt, userMessage, maxTokens, attachments, history, onChunk)`
- Cliente: `@anthropic-ai/sdk` — `client.messages.stream()`
- Soporta modelos "thinking" (extended thinking con `budget_tokens`)
- Mapa de IDs para modelos thinking: `CLAUDE_THINKING_MODEL_MAP`
- Historial de conversación en `messages: [...history, { role: 'user', content }]`

#### `callOpenAIStream(modelId, systemPrompt, userMessage, maxTokens, attachments, history, onChunk)`
- Cliente: `openai` — `client.chat.completions.create({ stream: true })`
- Soporta modelos reasoning (o3, o4-mini) con `reasoning_effort`
- Imágenes como `image_url` en content array

#### `callGemini(modelId, systemPrompt, userMessage, attachments, webSearch, history, onChunk)`
- Cliente: `@google/generative-ai` — `sendMessageStream()`
- Web search: tool `googleSearch` activable por modelo
- Timeout: 180s (web search es lento)
- Historial: formato `{ role: 'user'|'model', parts: [...] }`

#### `callGrokStream(modelId, systemPrompt, userMessage, maxTokens, attachments, webSearch, history, onChunk)`
- Usa OpenAI SDK apuntando a `https://api.x.ai/v1`
- Web search: parámetro `search_parameters: { mode: 'auto' }`
- Imágenes como `image_url`

#### `callKimi(modelId, systemPrompt, userMessage, maxTokens, attachments, history)`
- Moonshot API (sin streaming, respuesta completa)
- Endpoint: `https://api.moonshot.cn/v1`

#### `callModelStream(provider, modelId, ...)` — dispatcher
Enruta al caller correcto según provider string.

#### `withTimeout(promise, ms, modelId)`
Envuelve cualquier llamada con timeout. Tiempos por defecto:
- Gemini: 180s
- Modelos thinking/reasoning: 120s
- Resto: 90s

### 2.3 Procesamiento de adjuntos — `processAttachments(attachments)`
```
PDF         → extractPdfText() con pdf-parse → .textContent
Imágenes    → pasan directamente (vision API nativa)
Texto (.txt, .csv, .json, .md, .js, etc.) → Buffer.from(base64).toString('utf-8') → .textContent
Binarios    → nota de texto indicando que el archivo no es legible
```
Los modelos reciben adjuntos como:
- **Imágenes**: bloque `{ type: 'image', source: { type: 'base64', ... } }` (Claude) o `image_url` (OpenAI/Grok)
- **Texto/PDF**: bloque `{ type: 'text', text: '[Archivo: nombre]\n\ncontenido...' }`

### 2.4 Endpoint principal — `POST /api/research`
```
Body: { question, models[], integrator{}, attachments[], amplitude, conversationHistory[], debateEnabled, debateRounds }
```
1. Procesa adjuntos con `processAttachments()`
2. Lanza todos los modelos habilitados **en paralelo** con `Promise.all`
3. Cada modelo streameea chunks via SSE: `model:start → model:chunk → model:done | model:error`
4. Si `debateEnabled`: lanza rondas de debate (cada modelo responde a los anteriores)
5. Si `integrator` configurado: lanza modelo integrador con todas las respuestas como contexto
6. Guarda en DB: history, debate_responses, debate_votes
7. Calcula coste y actualiza `users.total_cost_usd` y `users.monthly_cost_usd`
8. Pausa el servicio si supera el budget mensual del plan

### 2.5 Endpoint de integración — `POST /api/integrate`
- Recibe `debateContext` (transcript del debate) + respuestas de modelos
- Construye prompt con todo el contexto para el modelo integrador
- Streameea resultado

### 2.6 Sistema de costes
```js
function calcCost(modelId, inputTokens, outputTokens)
```
Tabla de precios por modelo ($/1M tokens, entrada/salida). Se actualizan en el objeto `MODEL_COSTS` en server.js.

Tracking:
- `users.total_cost_usd` — acumulado histórico
- `users.monthly_cost_usd` — reiniciado mensualmente (billing_period_start)
- Si `monthly_cost_usd >= plan.budget` → `users.paused = 1` → devuelve 402 en todas las llamadas a modelos

### 2.7 Autenticación
- Registro: `bcrypt.hash(password, 10)` + `INSERT INTO users`
- Login: `bcrypt.compare()` + `req.session.regenerate()` + `req.session.userId`
- Middleware `requireAuth`: verifica `req.session.userId`, comprueba pausa de cuenta
- Sesiones en SQLite (`sessions.db`), cookie 30 días

### 2.8 Billing y Stripe
```
GET  /api/billing/plans     → lista planes con precios
GET  /api/billing/me        → consumo actual del usuario
POST /api/billing/checkout  → crea Stripe checkout session
POST /api/billing/webhook   → recibe eventos Stripe (checkout.session.completed, etc.)
POST /api/billing/cancel    → cancela suscripción
```
Stripe es opcional: `const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(key) : null`

### 2.9 Planes
| ID | Nombre | Precio | Budget/mes |
|---|---|---|---|
| free | Free | $0 | $3 |
| starter | Starter | $9.99 | $25 |
| pro | Pro | $29.99 | $100 |
| business | Business | $99 | $500 |

---

## 3. Base de datos — db.js (161 líneas) + SQLite

### Localización
```js
const DB_DIR  = process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : __dirname;
const DB_FILE = process.env.DB_PATH || path.join(__dirname, 'data.db');
fs.mkdirSync(DB_DIR, { recursive: true }); // crea directorio si no existe (Railway)
```

### Esquema completo

#### `users`
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
username TEXT UNIQUE NOT NULL
email TEXT UNIQUE NOT NULL
password_hash TEXT NOT NULL
total_cost_usd REAL DEFAULT 0
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
plan TEXT DEFAULT 'free'
monthly_cost_usd REAL DEFAULT 0
billing_period_start TEXT
stripe_customer_id TEXT
stripe_subscription_id TEXT
plan_expires_at DATETIME
paused INTEGER DEFAULT 0
```

#### `history`
```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
user_id INTEGER
session_id TEXT
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
provider TEXT
model_id TEXT
model_label TEXT
prompt TEXT
response TEXT
input_tokens INTEGER DEFAULT 0
output_tokens INTEGER DEFAULT 0
cost_usd REAL DEFAULT 0
duration_ms INTEGER DEFAULT 0
is_integrator INTEGER DEFAULT 0
```

#### `debate_responses`
```sql
id, user_id, session_id, round INTEGER, model_id, provider, response, cost_usd, created_at
```

#### `debate_votes`
```sql
id, user_id, session_id, voter_model_id, voter_provider, voted_for_model_id, created_at
```

#### `projects`
```sql
id, user_id, name, instructions, color, created_at, updated_at
```

#### `project_attachments`
```sql
id, project_id, name, type, content (base64), size, created_at
```

#### `project_sessions`
```sql
id, project_id, session_id, user_id, added_at
```

#### `plans`
```sql
id TEXT PRIMARY KEY, name, price_eur, monthly_budget, max_models, web_search, projects, history_days, stripe_price_id
```

#### `billing_events`
```sql
id, user_id, type, amount_usd, description, stripe_id, created_at
```

### Migraciones
Se aplican con `ALTER TABLE ... ADD COLUMN` en try/catch (idempotentes — no fallan si la columna ya existe).

---

## 4. Frontend — index.html (2749 líneas)

### 4.1 Estructura de la página
```
┌─────────────────────────────────────────────┐
│  SIDEBAR (izquierda, colapsable en mobile)  │
│  - Lista de modelos con toggle enable        │
│  - Config por modelo (system prompt, tokens) │
│  - Web search toggle (modelos compatibles)   │
│  - Integrador toggle + config                │
│  - Templates de búsqueda                     │
├─────────────────────────────────────────────┤
│  MAIN (derecha)                              │
│                                             │
│  1. Research Planning (colapsable)           │
│     - Textarea objetivo + selector modelo    │
│     - Botón "Plan Research" (SSE)            │
│     - Resultado con botón "Apply"            │
│                                             │
│  2. Query input                              │
│     - Textarea pregunta                      │
│     - Botón Attach Files                     │
│     - Botón "Establish Debate" | "Integrate" │
│     - Botón RUN                              │
│                                             │
│  3. Results Grid (N columnas dinámicas)      │
│     - Card por modelo con streaming          │
│     - Markdown rendering                     │
│     - Badges de coste/tokens/tiempo          │
│                                             │
│  4. Debate results (encima de synthesis)     │
│                                             │
│  5. Integrated Synthesis                     │
└─────────────────────────────────────────────┘
```

### 4.2 Estado global
```js
const state = {
  models: [],              // configuración de modelos activos
  attachments: [],         // archivos adjuntos actuales [{ name, type, content(base64), size }]
  conversationHistory: [], // historial de la conversación actual [{ role, content }]
  lastDebateResponses: [], // últimas respuestas del debate para pasar al integrador
  lastSessionId: null,     // session_id de la última sesión (para "Add to project")
  lastResults: [],         // últimas respuestas de modelos
  integratorEnabled: true,
  isRunning: false,
  currentUser: null,
}
```

### 4.3 Flujo principal de una consulta
```
runQueries()
  │
  ├── buildBody() → { question, models, integrator, attachments, conversationHistory, ... }
  │
  ├── fetch('/api/research', { method: 'POST', body: JSON.stringify(body) })
  │
  ├── SSE reader loop:
  │     model:start  → muestra spinner en card
  │     model:chunk  → append texto al card (streaming visual)
  │     model:done   → renderMarkdown(), muestra coste/tokens
  │     model:error  → muestra error en card
  │     debate:*     → renderiza respuestas de debate
  │     integrator:* → renderiza síntesis
  │     complete     → { sessionId } → state.lastSessionId
  │
  └── updateConvIndicator() + state.conversationHistory.push(...)
```

### 4.4 Streaming SSE en frontend
```js
const response = await fetch('/api/research', { ... });
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  // parsea líneas "event: X\ndata: {...}\n\n"
}
```

### 4.5 Debate
- `runDebate()`: lanza `/api/research` con `debateEnabled: true`
- Cada ronda: cada modelo recibe las respuestas de los otros como contexto
- Muestra spinner "Model Debate — working..." y hace scroll al panel
- Almacena respuestas en `state.lastDebateResponses`
- Al "Integrate": envía `debateContext` (transcript completo) al endpoint `/api/integrate`

### 4.6 Recuperación de sesiones (`recoverSession`)
- Reconstruye el grid de resultados desde los datos del historial
- Restaura `state.conversationHistory` para poder hacer follow-up
- Restaura `state.lastSessionId` para poder añadir a proyecto
- Carga debate si existía para esa sesión

### 4.7 Adjuntos
- Se leen como base64 via `FileReader.readAsDataURL()`
- Se guardan en `state.attachments`
- Se envían con cada request (no persisten entre sesiones)
- El servidor los procesa con `processAttachments()` antes de pasarlos a los modelos
- Tipos soportados: imágenes (visión), PDF (extracción texto), cualquier archivo de texto

### 4.8 Proyectos
- Agrupan sesiones de historial bajo un nombre con instrucciones personalizadas
- Pueden tener archivos adjuntos propios (persistidos en DB)
- Las instrucciones del proyecto se inyectan como system prompt adicional
- Panel lateral accesible desde el icono de proyectos

### 4.9 Renderizado de respuestas
```js
renderMarkdown(text)   // convierte MD → HTML (headers, bold, italic, code, tables, listas)
colorizeConsensus(html) // colorea menciones de acuerdo/desacuerdo en la síntesis
applyDebateVoteBadges() // añade badges de votación a los modelos ganadores
```

### 4.10 Proveedores y modelos disponibles
Definidos en el objeto `PROVIDERS` con:
- `label`: nombre display
- `icon`: emoji
- `dotColor`: color del indicador
- `models[]`: array de `{ id, label, maxTokens, supportsVision, supportsWebSearch, costPer1M: { input, output } }`

Modelos con web search: Gemini 2.x, Grok 3
Modelos con visión: todos excepto algunos Kimi/Moonshot

---

## 5. Configuración de despliegue

### railway.toml
```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "node server.js"
healthcheckPath = "/api/config"
healthcheckTimeout = 60
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

### Dockerfile implícito (Nixpacks)
Railway usa Nixpacks para detectar Node.js automáticamente. No hay Dockerfile explícito.

### CI/CD
Push a `main` en GitHub → Railway detecta el cambio → rebuild automático → deploy si healthcheck OK.

### Volumen persistente
- ID: `c5c9c8cd-4f3b-4073-a80b-a9ff0a0cfdf9`
- Mount path: `/app/data`
- `data.db` y `sessions.db` se guardan ahí
- Sin volumen: los datos se pierden en cada deploy

---

## 6. Seguridad

### Implementado
- `helmet` con CSP desactivado (app sirve inline scripts)
- Rate limiting diferenciado (auth vs API)
- Contraseñas con bcrypt (cost 10)
- Sesiones HttpOnly, Secure en producción, SameSite lax
- Session regeneration en login (anti session fixation)
- `sanitizeStr()` en todos los inputs del servidor
- `validEmail()` en registro
- `.gitignore` incluye `.env`, `github-deploy.js` (contiene PAT)

### Pendiente / Mejorable
- CSRF protection (no implementado)
- 2FA
- Logs de auditoría
- Límites de tamaño de adjuntos por plan

---

## 7. Dependencias principales (package.json)

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.x",
    "@google/generative-ai": "^0.x",
    "bcryptjs": "^2.x",
    "better-sqlite3": "^9.x",
    "connect-sqlite3": "^0.x",
    "express": "^4.x",
    "express-rate-limit": "^7.x",
    "express-session": "^1.x",
    "helmet": "^7.x",
    "openai": "^4.x",
    "pdf-parse": "^1.x",
    "stripe": "^14.x"
  }
}
```

---

## 8. Variables de entorno completas

| Variable | Descripción | Requerida |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude API key | Sí |
| `OPENAI_API_KEY` | OpenAI API key | Sí |
| `GOOGLE_API_KEY` | Gemini API key | Sí |
| `XAI_API_KEY` | Grok API key | Sí |
| `MOONSHOT_API_KEY` | Kimi API key | Opcional |
| `SESSION_SECRET` | Secreto para firmar cookies de sesión | Sí (prod) |
| `NODE_ENV` | `production` en Railway | Sí |
| `PORT` | Puerto del servidor (default: 3000) | No |
| `DB_PATH` | Ruta al archivo SQLite (Railway: `/app/data/data.db`) | Sí (prod) |
| `APP_URL` | URL pública de la app | Opcional |
| `STRIPE_SECRET_KEY` | Clave secreta Stripe | Opcional |
| `STRIPE_WEBHOOK_SECRET` | Secreto webhook Stripe | Opcional |
| `REBUILD_TRIGGER` | Timestamp para forzar rebuild Docker | Técnico |

---

## 9. Flujo de datos completo — ejemplo de consulta

```
1. Usuario escribe pregunta en textarea y pulsa RUN
2. Frontend llama runQueries()
3. Se construye body con { question, models: [{id, provider, enabled, ...}], attachments, conversationHistory }
4. fetch POST /api/research (abre SSE stream)
5. Servidor: processAttachments() → extrae texto de PDFs/archivos
6. Servidor: por cada modelo enabled → callModelStream() en paralelo
7. Cada stream SSE emite: model:start → chunks → model:done
8. Frontend renderiza cada chunk en tiempo real en la card del modelo
9. Al completar todos: calcCost() → updateUserCost() → saveToHistory()
10. Si integrador activo: callModelStream() con todas las respuestas como contexto
11. Servidor emite: complete { sessionId }
12. Frontend guarda sessionId en state.lastSessionId
13. state.conversationHistory.push({ role:'user', content: question }, { role:'assistant', content: combined })
14. Usuario puede hacer follow-up: el historial se envía en el siguiente request
```
