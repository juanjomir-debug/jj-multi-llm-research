---
inclusion: always
---

# Frontend Map — public/index.html

## Estado global (`state`)
```js
state.models[]           // config de cada proveedor: modelId, enabled, customInstructions, webSearch, temperature, thinking, deepResearch
state.attachments[]      // archivos adjuntos: { name, type, content(base64), size }
state.conversationHistory[] // historial: [{ role, content }]
state.lastResults[]      // últimas respuestas de modelos
state.lastDebateResponses[]
state.lastSessionId      // UUID de la sesión actual
state.temporaryChat      // bool — si true, no se guarda en historial
state.integratorEnabled
state.debateEnabled
state.cascadeEnabled
state.cascadeOrder[]
state.isRunning
state.currentUser
```

## Flujo principal
```
runResearch(withIntegrator?)
  → buildBody() → fetch POST /api/research (SSE)
  → SSE loop: model:start → model:chunk → model:done | model:error
  → debate:* → integrator:* → consensus → complete
  → updateConvIndicator() + state.conversationHistory.push(...)
```

## Funciones clave por área

### Modelos y configuración
| Función | Descripción |
|---|---|
| `renderModelCards()` | Renderiza las tarjetas inline de cada proveedor |
| `toggleModel(idx)` | Activa/desactiva un modelo |
| `setModelLevel(level)` | Aplica preset fast/medium/high a todos los modelos |
| `onModelChange(idx, newId)` | Cambia el modelo seleccionado |
| `toggleWebSearch(idx)` | Activa web search (filtra modelos incompatibles) |
| `toggleThinking(idx)` | Activa extended thinking en Claude |
| `toggleDeepResearch(idx)` | Activa deep research mode |

### Resultados y tabs
| Función | Descripción |
|---|---|
| `prepareInlineResultArea(provider, modelId)` | Crea el panel de resultado para un modelo |
| `updateResultCard(modelId, provider, text, meta)` | Actualiza el contenido de una card |
| `buildResultTabs()` | Pre-registra los botones de tab |
| `_ensureModelTab(provider)` | Crea el tab button si no existe |
| `setTabStatus(provider, status, durationMs)` | Actualiza el indicador de estado del tab |
| `switchResultTab(tabId)` | Cambia el panel activo |
| `showIntegrationPanel()` | Muestra el panel de integración |

### Integrador y debate
| Función | Descripción |
|---|---|
| `runIntegration()` | Lanza el integrador con las respuestas actuales |
| `runDebate()` | Lanza debate multi-ronda |
| `buildIntegratorCard(status)` | Construye la card del integrador |
| `renderConsensusPanel(data)` | Renderiza barras de consenso |
| `renderReliabilityIndex(results)` | Renderiza el índice de fiabilidad |

### Historial y sesiones
| Función | Descripción |
|---|---|
| `loadHistory()` | Carga el historial del usuario |
| `recoverSession(sessionId)` | Restaura una sesión anterior completa |
| `clearConversation()` | Limpia todo el estado y la UI |
| `archiveTurn()` | Mueve el turno actual al historial visual |

### Auth y billing
| Función | Descripción |
|---|---|
| `checkAuth()` | Verifica sesión al cargar |
| `submitLogin(e)` | Login |
| `submitRegister(e)` | Registro |
| `openBilling()` | Abre el panel de planes |
| `startCheckout(planId)` | Inicia Stripe checkout |
| `redeemPromo()` | Canjea código promo |

### Utilidades
| Función | Descripción |
|---|---|
| `renderMarkdown(text)` | Convierte MD → HTML |
| `colorizeConsensus(html)` | Colorea menciones de acuerdo/desacuerdo |
| `runDiffAnalysis()` | Análisis de diferencias entre respuestas |
| `exportResearch()` | Exporta resultados |
| `exportToWord(key)` | Exporta a .docx |
| `toast(msg, type)` | Notificación temporal |
| `escHtml(s)` | Escapa HTML |

## Selectores de nivel de modelo
```js
MODEL_LEVELS = {
  fast:   { anthropic: 'claude-haiku-4-5', openai: 'gpt-5-mini', google: 'gemini-3.1-flash-lite', xai: 'grok-4-1-fast', qwen: 'qwen-turbo', zhipu: 'glm-4.5-air' }
  medium: { anthropic: 'claude-sonnet-4-6', openai: 'gpt-5-mini', google: 'gemini-3-flash', xai: 'grok-4-1-fast', qwen: 'qwen-plus', zhipu: 'glm-5-turbo' }
  high:   { anthropic: 'claude-opus-4-6', openai: 'gpt-5.4', google: 'gemini-3.1-pro', xai: 'grok-4.20', qwen: 'qwen-max', zhipu: 'glm-5-turbo' }
}
```

## Notas importantes
- Qwen y GLM NO soportan imágenes — el backend las filtra automáticamente
- Gemini Pro fuerza mínimo 8192 output tokens
- `temporaryChat=true` → no se guarda en DB, pero sí se contabilizan costes
- El tab de resultados NO cambia automáticamente al recibir `model:start`
- En móvil: `.tab-model-ver` oculto, tiempo del tab oculto, no zoom (`user-scalable=no`)
