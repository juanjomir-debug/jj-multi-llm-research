# Reddit Bot — Playwright (Sin API)

Bot automatizado para Reddit usando Playwright (navegador real), sin necesidad de API de Reddit.

## 🎯 Ventajas

- ✅ **No requiere API de Reddit** (sin registro de app)
- ✅ **Navegador real** con stealth (evade detección)
- ✅ **Respuestas con GPT-4** (naturales y relevantes)
- ✅ **Backlinks dofollow** (DA 91)
- ✅ **Límites de seguridad** (max 5 comentarios/día)

## 📋 Requisitos

1. **Cuenta de Reddit** (crear en reddit.com):
   - Username: `reliableai_official` (o el que prefieras)
   - Password: (guardar en `.env`)

2. **Dependencias**:
   ```bash
   npm install playwright-extra puppeteer-extra-plugin-stealth openai
   ```

## 🔧 Configuración

### 1. Crear cuenta de Reddit

1. Ve a: https://www.reddit.com/register
2. Crea cuenta: `reliableai_official`
3. Verifica email
4. **IMPORTANTE**: Usa la cuenta manualmente durante 1-2 semanas antes de automatizar (construir karma)

### 2. Configurar .env

```bash
# .env
REDDIT_USERNAME=reliableai_official
REDDIT_PASSWORD=tu_password_aqui
OPENAI_API_KEY=tu_api_key  # Ya la tienes
```

### 3. Ejecutar

```bash
node reddit-bot/reddit-playwright.js
```

## 🚀 Cómo funciona

1. **Login** con Playwright (guarda cookies para próximas ejecuciones)
2. **Busca posts** relevantes en subreddits configurados
3. **Genera respuesta** con GPT-4 (natural y útil)
4. **Publica comentario** automáticamente
5. **Espera 10-30 minutos** antes del siguiente (humanizado)

## ⚙️ Configuración

Edita `reddit-playwright.js` para personalizar:

```javascript
const CONFIG = {
  username: 'reliableai_official',
  
  subreddits: [
    'artificial',
    'ChatGPT',
    'OpenAI',
    'ClaudeAI',
    'LocalLLaMA',
  ],
  
  keywords: [
    'compare llm',
    'multiple ai models',
    'claude vs gpt',
    'best ai tool',
  ],
  
  maxCommentsPerDay: 5,
  minDelayMinutes: 10,
  maxDelayMinutes: 30,
};
```

## 📊 Límites de seguridad

- **Max 5 comentarios/día** (evitar spam)
- **Delay 10-30 minutos** entre comentarios
- **Solo posts con 5+ upvotes** (populares)
- **Guarda posts procesados** (no repetir)
- **Cookies persistentes** (no login cada vez)

## 🎨 Estrategia

### Fase 1: Construcción de karma (Semanas 1-2)

**Antes de automatizar**:
- Usa la cuenta manualmente
- Comenta en posts (sin mencionar tu producto)
- Upvotea contenido de calidad
- Objetivo: 50-100 karma

### Fase 2: Automatización (Semana 3+)

**Con el bot**:
- Max 5 comentarios/día
- Solo menciona ReliableAI si es relevante
- GPT-4 genera respuestas naturales
- Monitorea métricas semanalmente

## 📈 Métricas esperadas

| Métrica | Mes 1 | Mes 2 | Mes 3 |
|---|---|---|---|
| **Comentarios** | 150 | 150 | 150 |
| **Karma** | +100 | +200 | +300 |
| **Backlinks** | 5-10 | 15-20 | 25-30 |
| **Tráfico** | 50-100 | 200-400 | 500-800 |

## 🔄 Automatización (cron)

```bash
# Ejecutar 3 veces al día (9:00, 15:00, 21:00)
0 9,15,21 * * * cd /var/www/reliableai && node reddit-bot/reddit-playwright.js >> reddit-bot/reddit-playwright.log 2>&1
```

## 🚨 Señales de alerta

Si ves esto, **para inmediatamente**:

- ❌ Shadowban (comentarios no aparecen)
- ❌ Downvotes masivos (< -5)
- ❌ Mensajes de moderadores
- ❌ Cuenta suspendida

**Solución**: Reducir frecuencia, mejorar calidad de respuestas.

## 🎯 Subreddits recomendados

| Subreddit | Miembros | Permite menciones | Notas |
|---|---|---|---|
| r/artificial | 200K | Sí | Muy activo |
| r/ChatGPT | 5M | Sí (limitado) | Alto tráfico |
| r/OpenAI | 500K | Sí | Técnico |
| r/ClaudeAI | 50K | Sí | Específico |
| r/LocalLLaMA | 150K | Sí | Usuarios avanzados |

## 💡 Tips

1. **Construye karma primero** (1-2 semanas manual)
2. **Varía las respuestas** (GPT-4 lo hace automáticamente)
3. **No menciones siempre tu producto** (solo cuando es relevante)
4. **Responde a replies** (aumenta engagement)
5. **Monitorea métricas** semanalmente

## 🔗 Comparativa con API oficial

| Aspecto | API oficial | Playwright |
|---|---|---|
| **Setup** | Complejo | Simple |
| **Registro** | Requiere app | No requiere |
| **Detección** | Baja | Media (con stealth) |
| **Flexibilidad** | Limitada | Alta |
| **Mantenimiento** | Bajo | Medio |

## ✅ Checklist

- [ ] Crear cuenta de Reddit
- [ ] Usar cuenta manualmente (1-2 semanas)
- [ ] Alcanzar 50-100 karma
- [ ] Configurar `.env`
- [ ] Instalar dependencias
- [ ] Ejecutar test manual
- [ ] Configurar cron
- [ ] Monitorear métricas

## 🎉 Resultado esperado

En 3 meses:
- ✅ 25-30 backlinks DA 91
- ✅ 500-800 visitantes cualificados
- ✅ 300+ karma
- ✅ Comunidad construida
- ✅ Autoridad aumentada

**ROI**: Infinito (inversión $0, retorno alto)


## 🎯 Ventajas de Reddit para SEO

- ✅ **Alta autoridad**: DA 91 (uno de los sitios más autoritarios)
- ✅ **Tráfico real**: Usuarios cualificados buscando soluciones
- ✅ **Backlinks dofollow**: En muchos subreddits
- ✅ **Comunidades específicas**: Por nicho exacto
- ✅ **Engagement real**: Conversaciones que generan más backlinks

## 📋 Requisitos

1. **Cuentas de Reddit** (crear manualmente):
   - `reliableai_official` (o similar)
   - `resistone_microcemento` (o similar)
   - **IMPORTANTE**: Cuentas nuevas necesitan 30 días + 100 karma antes de promocionar

2. **Reddit API** (gratis):
   - Ve a: https://www.reddit.com/prefs/apps
   - Click "create app"
   - Tipo: "script"
   - Copia `client_id` y `client_secret`

3. **Dependencias**:
   ```bash
   npm install snoowrap
   ```

## 🔧 Configuración

### 1. Crear aplicación en Reddit

1. Ve a: https://www.reddit.com/prefs/apps
2. Click "create another app..."
3. Rellena:
   - **name**: reliableai-bot
   - **type**: script
   - **description**: Engagement bot
   - **redirect uri**: http://localhost:8080
4. Click "create app"
5. Copia:
   - **client_id**: (debajo de "personal use script")
   - **client_secret**: (el código largo)

### 2. Configurar variables de entorno

```bash
# .env
REDDIT_CLIENT_ID=tu_client_id
REDDIT_CLIENT_SECRET=tu_client_secret
REDDIT_RELIABLEAI_PASSWORD=password_cuenta_reliableai
REDDIT_RESISTONE_PASSWORD=password_cuenta_resistone
```

### 3. Actualizar configuración

Edita `reddit-config.js`:
- Cambia `username` por tus cuentas reales
- Ajusta `subreddits` según tu nicho
- Personaliza `keywords` para tu producto
- Modifica `TEMPLATES` con tus mensajes

## 🚀 Uso

### Ejecución manual

```bash
node reddit-bot/reddit-bot.js
```

### Ejecución automática (cron)

```bash
# Ejecutar 2 veces al día (10:00 y 18:00)
0 10,18 * * * cd /ruta/proyecto && node reddit-bot/reddit-bot.js >> reddit-bot/reddit-bot.log 2>&1
```

## 📊 Estrategia

### Fase 1: Construcción de karma (Mes 1)

**Objetivo**: Alcanzar 100+ karma sin promocionar

**Acciones**:
- Comentar en posts populares (sin mencionar tu producto)
- Responder preguntas con valor real
- Participar en discusiones relevantes
- Upvotear contenido de calidad

**Límites**:
- Max 10 comentarios/día
- Max 2 posts/día
- 0% self-promotion

### Fase 2: Engagement con mención sutil (Mes 2-3)

**Objetivo**: Mencionar tu producto de forma natural

**Acciones**:
- Responder preguntas donde tu producto es relevante
- Compartir casos de uso reales
- Ofrecer comparativas honestas
- Incluir link solo cuando aporta valor

**Límites**:
- Max 10 comentarios/día
- Max 10% self-promotion
- Solo en posts con 10+ upvotes

### Fase 3: Contenido propio (Mes 3+)

**Objetivo**: Crear posts originales con backlinks

**Acciones**:
- Guías y tutoriales
- Casos de estudio
- Comparativas
- AMAs (Ask Me Anything)

**Límites**:
- Max 2 posts/semana
- Solo en subreddits que permiten self-promotion

## 🎨 Templates de respuestas

### ReliableAI

**Helpful (90% de comentarios)**:
```
I've been using ReliableAI for this. It lets you compare responses from 
multiple LLMs side by side, which is really helpful for [use case].
```

**Showcase (10% de comentarios)**:
```
Here's a comparison I did using ReliableAI: [screenshot]
The consensus between Claude, GPT, and Gemini was interesting...
```

### Resistone

**Helpful (90% de comentarios)**:
```
We've been working with microcement for over 15 years. For [use case], 
I'd recommend [solution]. Key things to consider: [tips]
```

**Showcase (10% de comentarios)**:
```
Here's a recent bathroom renovation we did with microcement: [photos]
The seamless finish and durability are unmatched.
```

## 🛡️ Reglas anti-spam

1. **Esperar 5-15 minutos** entre acciones
2. **Max 10 comentarios/día** por cuenta
3. **Max 10% self-promotion** (9 comentarios útiles, 1 con link)
4. **Min 100 karma** antes de promocionar
5. **Min 30 días** de antigüedad de cuenta
6. **Variar horarios** de publicación
7. **Humanizar texto** con GPT-4
8. **No repetir** el mismo mensaje

## 📈 Métricas esperadas

| Métrica | Mes 1 | Mes 2 | Mes 3 |
|---|---|---|---|
| **Karma** | 100+ | 300+ | 500+ |
| **Comentarios** | 200 | 300 | 300 |
| **Backlinks** | 0 | 10-15 | 20-30 |
| **Tráfico** | 0 | 50-100 | 200-500 |
| **Conversiones** | 0 | 2-5 | 10-20 |

## 🚨 Señales de alerta

Si ves esto, **para inmediatamente**:

- ❌ Shadowban (tus comentarios no aparecen)
- ❌ Downvotes masivos (< -5)
- ❌ Mensajes de moderadores
- ❌ Cuenta suspendida
- ❌ Comentarios eliminados automáticamente

**Solución**: Reducir frecuencia, aumentar valor, menos self-promotion.

## 🎯 Subreddits recomendados

### ReliableAI (AI Tools)

| Subreddit | Miembros | Permite self-promo | Notas |
|---|---|---|---|
| r/artificial | 200K | Sí (con valor) | Muy activo |
| r/MachineLearning | 2.8M | No | Solo comentarios útiles |
| r/ChatGPT | 5M | Sí (limitado) | Alto tráfico |
| r/OpenAI | 500K | Sí | Comunidad técnica |
| r/LocalLLaMA | 150K | Sí | Usuarios avanzados |

### Resistone (Home Improvement)

| Subreddit | Miembros | Permite self-promo | Notas |
|---|---|---|---|
| r/HomeImprovement | 5M | Sí (con fotos) | Muy activo |
| r/DIY | 23M | Sí (proyectos) | Enorme audiencia |
| r/InteriorDesign | 6M | Sí (showcase) | Visual |
| r/Renovations | 200K | Sí | Específico |
| r/spain | 300K | Sí | Mercado local |

## 💡 Tips avanzados

1. **Usa GPT-4** para generar respuestas naturales y variadas
2. **Incluye screenshots** cuando sea relevante
3. **Responde a replies** para aumentar engagement
4. **Upvotea** contenido de calidad (karma positivo)
5. **Participa en AMAs** de tu nicho
6. **Crosspostea** contenido propio (con moderación)
7. **Usa flair** apropiado en cada subreddit
8. **Lee las reglas** de cada subreddit antes de postear

## 🔗 Comparativa con directorios

| Aspecto | Directorios | Reddit |
|---|---|---|
| **Autoridad** | Baja-Media | Muy Alta (DA 91) |
| **Tráfico** | Bajo | Alto y cualificado |
| **Conversiones** | Muy bajas | Medias-Altas |
| **Riesgo de ban** | Alto | Bajo (si sigues reglas) |
| **Tiempo de setup** | Alto | Medio |
| **Escalabilidad** | Baja | Alta |
| **ROI** | Bajo | Alto |

## 📝 Checklist de implementación

- [ ] Crear cuentas de Reddit
- [ ] Crear aplicación en Reddit API
- [ ] Configurar variables de entorno
- [ ] Actualizar `reddit-config.js`
- [ ] Instalar dependencias (`npm install snoowrap`)
- [ ] Ejecutar test manual
- [ ] Construir karma (Mes 1)
- [ ] Empezar engagement con menciones (Mes 2)
- [ ] Configurar cron para automatización
- [ ] Monitorear métricas semanalmente

## 🎉 Resultado esperado

En 3 meses:
- ✅ 20-30 backlinks de DA 91
- ✅ 500-1000 visitantes cualificados
- ✅ 10-20 conversiones directas
- ✅ Autoridad de dominio aumentada
- ✅ Comunidad construida

**ROI**: 10-20x mejor que directorios automatizados.
