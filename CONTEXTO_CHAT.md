# CONTEXTO PARA NUEVO CHAT — JJ Multi-LLM Research

## Descripción del proyecto
Herramienta web para consultar múltiples LLMs en paralelo (Claude, GPT, Gemini, Grok), con debate entre modelos, síntesis integradora, historial, proyectos y sistema de usuarios con billing por niveles.

---

## Archivos principales
| Archivo | Ruta |
|---|---|
| Backend (Node/Express) | `C:\Users\juanj\OneDrive\Desktop\Prueba claude\multi-llm\server.js` |
| Frontend (HTML/JS/CSS) | `C:\Users\juanj\OneDrive\Desktop\Prueba claude\multi-llm\public\index.html` |
| Base de datos (SQLite) | `C:\Users\juanj\OneDrive\Desktop\Prueba claude\multi-llm\db.js` |
| Deploy config | `C:\Users\juanj\OneDrive\Desktop\Prueba claude\multi-llm\railway.toml` |
| Dependencias | `C:\Users\juanj\OneDrive\Desktop\Prueba claude\multi-llm\package.json` |
| Script migración DB | `C:\Users\juanj\OneDrive\Desktop\Prueba claude\multi-llm\migrate-to-railway.js` |

---

## Infraestructura

### Railway (producción)
| Concepto | Valor |
|---|---|
| Repo GitHub | `juanjomir-debug/jj-multi-llm-research` |
| Branch producción | `main` (push local desde `master:main`) |
| Project ID | `101dba0b-a9e9-4bb6-a745-1940d8f555e3` |
| Service ID | `c7214adb-edda-43f8-a9e5-e804bb78147a` |
| Environment ID | `26684870-cf5e-4003-912b-4759d5cc780a` |
| Railway API token | `2c47cd79-8bac-4d9e-9589-8c9b8ed343ee` |
| URL Railway | `https://jj-multi-llm-research-production.up.railway.app` |
| URL producción | `https://reliableai.net/analyze` |
| URL local | `http://localhost:3000` |
| Volumen ID | `c5c9c8cd-4f3b-4073-a80b-a9ff0a0cfdf9` montado en `/app/data` |

### Variables de entorno Railway (ya configuradas)
```
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
GOOGLE_API_KEY=...
XAI_API_KEY=...
MOONSHOT_API_KEY=...
SESSION_SECRET=...
NODE_ENV=production
APP_URL=https://jj-multi-llm-research-production.up.railway.app
REBUILD_TRIGGER=...
DB_PATH=/app/data/data.db
```

---

## DNS reliableai.net (Hostalia)
- **Panel DNS**: `https://panel.hostalia.com/pam/dns/entries?c=41487007`
- **Nameservers**: `ns10/11/12.servicio-online.net`
- **Registros añadidos**:
  - `CNAME @` → `rsp1muc0.up.railway.app` ✅
  - `TXT _railway-verify` → `railway-verify=1a8f26705616cc9dbbb527aa4552f87c98c1de8252e407be6e219c0ebcf7a9df` ✅
- **Railway domain ID**: `4173c4cc-d2c2-412c-86b9-d1ddc731dc88`
- **Estado**: DNS configurado, Railway emite SSL automáticamente al verificar

---

## Comandos frecuentes

```bash
# Arrancar servidor local
cd "C:\Users\juanj\OneDrive\Desktop\Prueba claude\multi-llm"
node server.js

# Deploy a Railway
git add -A
git commit -m "descripción"
git push origin master:main

# Redeploy forzado vía Railway API
curl -X POST https://backboard.railway.app/graphql/v2 \
  -H "Authorization: Bearer 2c47cd79-8bac-4d9e-9589-8c9b8ed343ee" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"mutation { githubRepoUpdate(input: { projectId: \\\"101dba0b-a9e9-4bb6-a745-1940d8f555e3\\\", serviceId: \\\"c7214adb-edda-43f8-a9e5-e804bb78147a\\\", environmentId: \\\"26684870-cf5e-4003-912b-4759d5cc780a\\\" }) }\"}"

# Verificar DNS propagación
nslookup -type=CNAME reliableai.net ns10.servicio-online.net

# Comprobar Railway está vivo
curl https://jj-multi-llm-research-production.up.railway.app/health

# Añadir variable de entorno Railway vía API
curl -X POST https://backboard.railway.app/graphql/v2 \
  -H "Authorization: Bearer 2c47cd79-8bac-4d9e-9589-8c9b8ed343ee" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"mutation { variableCollectionUpsert(input: { projectId: \\\"101dba0b-a9e9-4bb6-a745-1940d8f555e3\\\", serviceId: \\\"c7214adb-edda-43f8-a9e5-e804bb78147a\\\", environmentId: \\\"26684870-cf5e-4003-912b-4759d5cc780a\\\", variables: { NOMBRE: \\\"VALOR\\\" } }) }\"}"
```

---

## Arquitectura técnica

### Backend (server.js)
- **Express.js** con `trust proxy` (Railway está detrás de proxy)
- **SQLite** via `better-sqlite3` + `connect-sqlite3` para sesiones
- **Sesiones**: `express-session` con cookie `httpOnly`, `secure` en producción
- **Seguridad**: `helmet`, `express-rate-limit` (auth: 20/15min, api: 60/min)
- **Stripe**: opcional, solo activo si existe `STRIPE_SECRET_KEY`
- **SSE (Server-Sent Events)** para streaming de todos los modelos
- **DB_PATH**: variable de entorno apunta al volumen persistente en Railway
- `fs.mkdirSync(DB_DIR, { recursive: true })` antes de abrir DB (necesario en Railway)

### Endpoints principales
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Healthcheck público |
| GET | `/api/config` | Config (requiere auth) — usado por Railway healthcheck |
| POST | `/api/auth/register` | Registro |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Usuario actual |
| POST | `/api/plan-research` | Genera plan con LLM (SSE) |
| POST | `/api/research` | Consulta múltiples modelos (SSE) |
| POST | `/api/query` | Consulta modelo individual (SSE) |
| POST | `/api/integrate` | Síntesis integradora (SSE) |
| GET | `/api/history` | Historial del usuario |
| POST | `/api/debate` | Debate entre modelos |
| GET/POST | `/api/projects` | Gestión de proyectos |
| GET/POST | `/api/billing/*` | Planes y facturación |
| GET | `/analyze` | Sirve index.html (dominio personalizado) |

### Frontend (index.html)
- Single-page app en HTML/CSS/JS vanilla (sin framework)
- Estado global en objeto `state`
- SSE para streaming en tiempo real
- Markdown rendering propio (`renderMarkdown`)
- Modelos disponibles en objeto `PROVIDERS` (Anthropic, OpenAI, Google, xAI, Moonshot)

### Base de datos (SQLite)
Tablas: `users`, `history`, `sessions`, `debate_responses`, `debate_votes`, `votes`, `projects`, `project_attachments`, `project_sessions`, `plans`, `billing_events`

### Sistema de planes
| Plan | Precio | Budget mensual |
|---|---|---|
| Free | $0 | $3 |
| Starter | $9.99 | $25 |
| Pro | $29.99 | $100 |
| Business | $99 | $500 |

---

## Proveedores de modelos activos
| Proveedor | Env var | Modelos principales |
|---|---|---|
| Anthropic (Claude) | `ANTHROPIC_API_KEY` | claude-opus-4-5, claude-sonnet-4-5, claude-haiku-4-5 |
| OpenAI | `OPENAI_API_KEY` | gpt-4o, gpt-4o-mini, o3, o4-mini |
| Google | `GOOGLE_API_KEY` | gemini-2.5-pro-preview, gemini-2.0-flash |
| xAI (Grok) | `XAI_API_KEY` | grok-3, grok-3-mini, grok-2 |
| Moonshot (Kimi) | `MOONSHOT_API_KEY` | kimi-latest |

---

## Pendiente / Tareas abiertas

### Urgente
- **Verificar DNS propagación** `reliableai.net` → puede tardar hasta 1h desde configuración. Comprobar con: `nslookup reliableai.net 8.8.8.8`
- **`www.reliableai.net`** aún apunta a Hostalia (`217.116.0.191`). Si se quiere que funcione, cambiar ese A record a CNAME → `rsp1muc0.up.railway.app` en el panel Hostalia

### Limpiar después de migración DB
- Eliminar el endpoint `/api/migrate-import` de `server.js` (token: `mig_7x9kQpL2wNzR4vT8sY1uJ3bX`)
- El script `migrate-to-railway.js` puede eliminarse también

### Funcionalidades pendientes (~20% del desarrollo)
- Sincronización de resize de ventanas de modelos (arrastrar alto afecta a todos simultáneamente)
- Revisar y limpiar modelos: mantener solo últimas 2 versiones por proveedor
- Revisar costes por modelo (posiblemente desactualizados)

---

## Bugs corregidos en sesiones anteriores (no reintroducir)
1. **Adjuntos invisibles** → `processAttachments()` en server.js procesa PDF, imágenes y texto (base64 decode). No volver a usar inline `Promise.all` para attachment processing.
2. **DB borrada en cada deploy** → `DB_PATH=/app/data/data.db` en Railway + `fs.mkdirSync` en db.js. No eliminar esa variable.
3. **Gemini stuck en "Generating Response"** → Usa `sendMessageStream()` con async iterator y timeout 180s.
4. **Rate limiter crash en Railway** → `app.set('trust proxy', 1)` debe ir ANTES de helmet y rateLimit.
5. **Sesión no persiste tras registro** → Registro usa `req.session.userId = user.id` directo; login usa `req.session.regenerate()`. Ambos funcionan correctamente.
6. **Railway healthcheck** → Path: `/api/config`, timeout: 60s (configurado en railway.toml).
7. **Docker cache busting** → Campo `_buildId` en package.json con timestamp para forzar rebuild.

---

## Notas de despliegue Railway
- `serviceInstanceDeploy` = redeploy imagen cacheada (NO rebuild). Usar `githubRepoUpdate` para rebuild real.
- Si falla el deploy, revisar logs en Railway dashboard → Deployments → ver logs del deploy fallido.
- El volumen está en US West (California). El servicio también debe estar en esa región.
- `sessions.db` se guarda en el mismo directorio que `data.db` (controlado por `DB_PATH`).

---

## bypassPermissions (Claude Code)
Configurado en `C:\Users\juanj\.claude\settings.json`:
```json
{
  "permissions": {
    "defaultMode": "bypassPermissions",
    "allow": ["Bash(*)", "Read(*)", "Write(*)", "Edit(*)", "Glob(*)", "Grep(*)", "mcp__*", "WebFetch(*)", "WebSearch(*)"]
  }
}
```
