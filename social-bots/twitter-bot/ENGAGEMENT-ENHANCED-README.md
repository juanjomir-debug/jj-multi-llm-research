# Enhanced Twitter Engagement System

Sistema mejorado de engagement para @juanjomir con priorización inteligente y límite de 25,000 caracteres.

## 🎯 Características principales

### 1. Priorización de respuestas
El sistema prioriza en este orden:

| Prioridad | Tipo | Score | Descripción |
|---|---|---|---|
| 🔥 10 | Respuestas a nuestros tweets | Máxima | Personas que respondieron a nuestros posts |
| ⭐ 8 | Menciones | Alta | Tweets que nos mencionan (@juanjomir o @AiReliable) |
| 💬 6 | Conversaciones relevantes | Media | Hilos sobre temas relevantes |
| 🔍 4 | Keywords | Baja | Búsquedas por palabras clave |

### 2. Límite de caracteres
- **Cuenta Basic:** 25,000 caracteres por tweet
- **Respuestas a nuestros tweets:** Hasta 2,000 caracteres (más sustanciales)
- **Otras respuestas:** Hasta 800 caracteres (concisas pero valiosas)

### 3. Idioma
- **SIEMPRE en inglés** - Verificación automática y regeneración si detecta español

### 4. Estrategias de respuesta

El sistema usa diferentes estrategias según el contexto:

| Estrategia | Cuándo usar | Ejemplo |
|---|---|---|
| `agree_and_expand` | Cuando estamos de acuerdo | "Exactly. And adding to this..." |
| `add_perspective` | Para añadir un punto de vista | "Interesting angle. From my experience..." |
| `challenge_politely` | Para cuestionar educadamente | "I see your point, but in 100+ tests..." |
| `provide_data` | Para aportar datos concretos | "I've tracked this across 500 queries..." |
| `ask_question` | Para profundizar | "Have you tried comparing...?" |
| `share_experience` | Para compartir experiencia | "Last week I ran into this exact issue..." |

## 📊 Flujo de trabajo

```
1. Obtener nuestros últimos tweets
   ↓
2. Buscar respuestas a nuestros tweets (PRIORIDAD MÁXIMA)
   ↓
3. Buscar menciones (@juanjomir, @AiReliable)
   ↓
4. Buscar por keywords relevantes
   ↓
5. Analizar relevancia de cada tweet
   ↓
6. Generar respuestas personalizadas
   ↓
7. Ordenar por prioridad y relevancia
   ↓
8. Publicar top 8 respuestas
```

## 🚀 Uso

### Ejecución manual
```bash
cd social-bots/twitter-bot
node engagement-enhanced.js
```

### Con script de shell
```bash
cd social-bots/twitter-bot
bash twitter-engage-enhanced.sh
```

### Cron job (VPS)
```bash
# Ejecutar 2 veces al día (10:00 y 18:00)
0 10,18 * * * cd /root/scripts && node engagement-enhanced.js >> engagement.log 2>&1
```

## ⚙️ Configuración

Editar `engagement-enhanced.js`:

```javascript
const CONFIG = {
  account: 'juanjomir',
  auth_token: 'tu_token_aqui',
  
  maxCharsPerTweet: 25000,  // Límite de Basic account
  
  priorityTypes: {
    replyToOurTweet: 10,     // Ajustar prioridades
    mentionUs: 8,
    relevantConversation: 6,
    keywordMatch: 4
  },
  
  keywords: [
    'ChatGPT vs Claude',
    'LLM comparison',
    // Añadir más keywords
  ],
  
  minLikes: 3,                // Mínimo de likes para considerar
  minRelevanceScore: 6,       // Score mínimo de relevancia (0-10)
  maxRepliesPerRun: 8,        // Máximo de respuestas por ejecución
  delayBetweenReplies: 2 * 60 * 1000, // 2 minutos entre respuestas
};
```

## 📝 Logs

Los logs se guardan en:
```
social-bots/engagement-enhanced-log-YYYY-MM-DD.json
```

Formato:
```json
[
  {
    "action": "reply",
    "priority": 10,
    "tweet": "https://x.com/user/status/123",
    "author": "username",
    "text": "Response text...",
    "strategy": "agree_and_expand",
    "score": 8,
    "isReplyToUs": true,
    "timestamp": "2026-04-16T10:30:00.000Z"
  }
]
```

## 🎨 Estilo de respuestas

### Características
- ✅ Conversacional y genuino
- ✅ Aporta valor con datos concretos
- ✅ Comparte experiencia real con múltiples modelos
- ✅ Invita a continuar la conversación
- ✅ Usa emojis con moderación (2-3 máximo)
- ❌ No es promocional
- ❌ No usa lenguaje de marketing

### Ejemplos de buen estilo

**Agree and expand:**
```
Exactly. I've run this comparison 100+ times across different use cases. 

Claude consistently wins on complex reasoning tasks, but GPT-4 is faster for straightforward queries. The real insight: the gap narrows significantly when you use structured prompts.

Have you noticed similar patterns?
```

**Add perspective:**
```
Interesting take. In my experience deploying this for enterprise clients, the real challenge isn't model choice—it's knowing when each model's strengths matter.

For legal doc analysis: Claude
For customer support: GPT-4
For code review: Mix of both

Context is everything.
```

**Provide data:**
```
I tracked this across 500 queries last month:

• Hallucination rate: Claude 3.2%, GPT-4 4.1%
• Response time: GPT-4 wins (2.3s vs 3.1s)
• Reasoning depth: Claude wins on 68% of complex tasks

But here's the kicker: running both and comparing catches 94% of errors.
```

## 🔧 Troubleshooting

### Problema: No encuentra respuestas a nuestros tweets
**Solución:** Verificar que el auth_token sea válido y que tengamos tweets recientes

### Problema: Respuestas en español
**Solución:** El sistema detecta y regenera automáticamente. Si persiste, revisar el prompt del sistema.

### Problema: Rate limit de Twitter
**Solución:** Aumentar `delayBetweenReplies` o reducir `maxRepliesPerRun`

### Problema: Respuestas muy largas
**Solución:** Ajustar los límites en `generateResponse()`:
```javascript
const maxLength = tweet.isReplyToUs ? 2000 : 800;
```

## 📈 Métricas de éxito

Monitorear:
- **Tasa de respuesta:** % de respuestas que reciben reply
- **Engagement:** Likes y retweets en nuestras respuestas
- **Conversaciones:** Hilos que se generan
- **Menciones:** Aumento de menciones a @juanjomir

## 🎯 Mejores prácticas

1. **Ejecutar 2 veces al día** (mañana y tarde) para capturar diferentes zonas horarias
2. **Revisar logs semanalmente** para ajustar keywords y estrategias
3. **Responder manualmente** a conversaciones que el bot inicia y que generan engagement
4. **Actualizar keywords** según tendencias y temas emergentes
5. **Mantener el tono consistente** - revisar respuestas generadas periódicamente

## 🔄 Diferencias con versión anterior

| Característica | Anterior | Enhanced |
|---|---|---|
| Priorización | Por keywords | Por tipo de interacción |
| Límite de caracteres | 280 | 25,000 (usa 800-2000) |
| Idioma | Mixto | Siempre inglés |
| Respuestas a nuestros tweets | No priorizadas | Máxima prioridad |
| Estrategias | Básicas | 6 estrategias diferentes |
| Análisis | Simple | Análisis de potencial de conversación |

## 📞 Soporte

Para problemas o mejoras, revisar:
- `social-bots/twitter-bot/APRENDIZAJES.md` - Lecciones aprendidas
- `social-bots/README.md` - Documentación general de bots
- Logs en `engagement-enhanced-log-*.json`
