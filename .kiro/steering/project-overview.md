---
inclusion: always
---

# ReliableAI — Project Overview

## Qué es
App web multi-LLM que lanza consultas simultáneas a varios modelos de IA, compara respuestas en tiempo real, hace debates entre modelos, sintetiza resultados con un integrador y gestiona historial de sesiones con cuentas de usuario y billing.

## Stack
- **Backend:** Node.js + Express — `server.js` (monolítico, ~2000 líneas)
- **Frontend:** HTML/CSS/JS vanilla — `public/index.html` (~5600 líneas, todo inline)
- **DB:** SQLite via `better-sqlite3` — `db.js`
- **Sesiones:** SQLite store (`sessions.db`)
- **Deploy:** VPS Hostinger `187.124.184.177` → `/var/www/reliableai` → PM2 proceso `reliableai`
- **CI:** GitHub → `git push origin master` → deploy manual con `deploy.bat`

## Proveedores activos
| Provider | Env var | SDK |
|---|---|---|
| Anthropic (Claude) | `ANTHROPIC_API_KEY` | `@anthropic-ai/sdk` |
| OpenAI (GPT) | `OPENAI_API_KEY` | `openai` |
| Google (Gemini) | `GOOGLE_API_KEY` | `@google/generative-ai` |
| xAI (Grok) | `XAI_API_KEY` | `openai` + baseURL x.ai |
| Qwen (DashScope) | `QWEN_API_KEY` | `openai` + baseURL dashscope |
| Zhipu (GLM) | `ZHIPU_API_KEY` | `openai` + baseURL bigmodel.cn |
| Moonshot (Kimi) | `MOONSHOT_API_KEY` | `openai` + baseURL moonshot.ai |
| Perplexity | `PERPLEXITY_API_KEY` | `openai` + baseURL perplexity.ai |

## Planes
| ID | Nombre | Precio | Budget API/mes | Modelos | Web Search |
|---|---|---|---|---|---|
| `free` | Explorer | $0 | $3 | 4 | No |
| `pro_demo` | Pro Demo | $0 | $3 | 99 | Sí |
| `starter` | Professional | $29 | $15 | 4 | No |
| `pro` | Expert | $59 | $40 | 99 | Sí |
| `enterprise` | Team | $49/user | $200 | 99 | Sí |

## Deploy
```bash
# Desde deploy.bat (doble clic):
git push origin master
ssh root@187.124.184.177 "cd /var/www/reliableai && git reset --hard origin/master && npm install --omit=dev && pm2 restart reliableai"
```
