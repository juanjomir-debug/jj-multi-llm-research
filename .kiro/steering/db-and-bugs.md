---
inclusion: always
---

# DB Schema & Bugs conocidos

## Tablas SQLite (db.js)

| Tabla | Descripción |
|---|---|
| `users` | Cuentas, plan, costes, billing, roles |
| `history` | Respuestas de modelos por sesión |
| `debate_responses` | Respuestas de rondas de debate |
| `debate_votes` | Votos de modelos en debate |
| `projects` | Proyectos con instrucciones personalizadas |
| `project_attachments` | Archivos adjuntos de proyectos (base64 en DB) |
| `project_sessions` | Relación proyecto ↔ sesión |
| `plans` | Definición de planes (seed en cada arranque) |
| `promo_codes` | Códigos promocionales |
| `billing_events` | Log de eventos de billing |
| `admin_audit_log` | Auditoría de acciones admin |
| `model_config` | Config de modelos editable desde admin |
| `system_metrics` | Métricas de rendimiento y errores |

## Columnas clave de `users`
```sql
plan TEXT DEFAULT 'free'
monthly_cost_usd REAL DEFAULT 0
billing_period_start TEXT          -- resetea el 1 de cada mes
paused INTEGER DEFAULT 0           -- 1 = bloqueado por budget
daily_queries INTEGER DEFAULT 0
daily_queries_date TEXT
role TEXT DEFAULT 'user'           -- user | admin | superadmin
stripe_customer_id TEXT
stripe_subscription_id TEXT
promo_code TEXT
email_verified INTEGER DEFAULT 0
reset_token TEXT                   -- para password reset
```

## Localización de la DB
```js
DB_FILE = process.env.DB_PATH || path.join(__dirname, 'data.db')
// VPS: DB_PATH=/app/data/data.db (volumen persistente)
// Local: ./data.db o ./data/data.db
```

## Migraciones
- Idempotentes: `ALTER TABLE ... ADD COLUMN` en try/catch
- Se ejecutan en cada arranque del servidor
- `ON CONFLICT(id) DO UPDATE` para el seed de planes

---

## Bugs conocidos — NO reintroducir

1. **Adjuntos** — usar `processAttachments()` en server.js. NUNCA `Promise.all` inline con los attachments crudos.

2. **DB borrada en deploy** — siempre usar `DB_PATH` env var + `fs.mkdirSync(DB_DIR, { recursive: true })` en db.js.

3. **Gemini stuck** — usar `sendMessageStream()` con async iterator y timeout 180s. No usar `.then()` encadenado.

4. **Rate limiter crash** — `app.set('trust proxy', 1)` debe ir ANTES de helmet y rateLimit.

5. **Sesión no persiste** — registro usa `req.session.userId = id` directo; login usa `req.session.regenerate()` primero.

6. **Qwen/Grok SDK** — usan OpenAI SDK con baseURL distinta. NO usar SDK nativo de cada proveedor.

7. **Qwen/GLM imágenes** — NO soportan visión. El dispatcher `callModelStream()` filtra automáticamente `image/*` para providers `qwen` y `zhipu`.

8. **Gemini Pro tokens cortos** — `callGemini()` fuerza `effectiveMaxTokens = Math.max(maxTokens, 8192)` para modelos Pro.

9. **GitHub workflow push** — el PAT no tiene scope `workflow`. El directorio `.github/workflows/` está en `.gitignore`.

10. **SSH deploy** — requiere contraseña interactiva. Usar `deploy.bat` desde terminal local.

---

## Pendientes críticos

- **CSRF** — todos los POST son vulnerables, no hay protección implementada
- **Password reset** — endpoint existe pero falta UI completa
- **Stripe** — `STRIPE_SECRET_KEY` configurado, falta crear products/prices y configurar webhook
- **SMTP** — nodemailer configurado, falta testear en VPS
- **GDPR** — sin cookie banner
- **Claves en git history** — rotar todas las API keys + BFG clean
