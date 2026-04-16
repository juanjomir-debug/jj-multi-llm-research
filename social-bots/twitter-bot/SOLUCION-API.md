# Solución Definitiva: API de X (Twitter)

## 🎯 Por qué API > Playwright

### Ventajas de la API
✅ **Velocidad:** 10x más rápido (sin navegador)  
✅ **Confiabilidad:** Sin timeouts de UI  
✅ **IDs automáticos:** Captura IDs en cada respuesta  
✅ **Rate limits claros:** Errores 429 con retry automático  
✅ **Mantenimiento:** No se rompe con cambios de UI  

### Desventajas de Playwright
❌ Lento (lanza navegador completo)  
❌ Timeouts frecuentes  
❌ Difícil capturar IDs de tweets  
❌ Se rompe con cambios de UI de X  
❌ Consume más recursos  

---

## 🔑 Configuración

### 1. Credenciales en .env
```bash
# OAuth 1.0a (para publicar)
TWITTER_API_KEY=brnU3ToUvVRA6Ikqu5eSDt0RC
TWITTER_API_SECRET=eF6RZl2ayv9MxK8JcNrm9aB89SFiDzzuzatRJYaXSyVOH0DJei
TWITTER_ACCESS_TOKEN=140046339-Oh7I6YXnK2ourlKxLP8F83dzaurhoYWCClJUm4Yh
TWITTER_ACCESS_SECRET=dLXzYOpASRydbT9zHFlUQ8sh5NcBI2OuzXYRVyN5CTTw0
```

### 2. Instalar dependencia
```bash
npm install twitter-api-v2
```

### 3. Inicializar cliente
```javascript
const { TwitterApi } = require('twitter-api-v2');

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});
```

---

## 📝 Casos de Uso

### 1. Publicar Tweet Simple
```javascript
const tweet = await client.v2.tweet('Contenido del tweet');
console.log(`Publicado: ${tweet.data.id}`);
```

### 2. Responder a Tweet
```javascript
const reply = await client.v2.reply('Respuesta', tweetId);
console.log(`Respuesta: ${reply.data.id}`);
```

### 3. Publicar Hilo Completo
```javascript
const tweets = [
  "1/ Primer tweet del hilo",
  "2/ Segundo tweet",
  "3/ Tercer tweet"
];

let previousId = null;

for (const text of tweets) {
  if (!previousId) {
    // Primer tweet
    const result = await client.v2.tweet(text);
    previousId = result.data.id;
  } else {
    // Respuestas encadenadas
    const result = await client.v2.reply(text, previousId);
    previousId = result.data.id;
  }
  
  // Esperar 3 segundos entre tweets
  await new Promise(resolve => setTimeout(resolve, 3000));
}
```

### 4. Buscar Tweets
```javascript
// Búsqueda básica (funciona en tier Free/Basic)
const results = await client.v2.search('AI models', { 
  max_results: 10 
});

for await (const tweet of results) {
  console.log(`@${tweet.author_id}: ${tweet.text}`);
}
```

### 5. Leer Timeline Propio
```javascript
const me = await client.v2.me();
const timeline = await client.v2.userTimeline(me.data.id, { 
  max_results: 10 
});

for await (const tweet of timeline) {
  console.log(tweet.text);
}
```

### 6. Borrar Tweet
```javascript
await client.v2.deleteTweet(tweetId);
```

---

## ⚠️ Limitaciones del Tier Free/Basic

### ❌ No Funciona
- Búsqueda con campos adicionales (`tweet.fields`, `user.fields`, `expansions`)
- Streaming API
- Webhooks
- Métricas avanzadas

### ✅ Funciona Perfectamente
- Publicar tweets
- Responder a tweets
- Borrar tweets
- Búsqueda básica
- Leer timeline propio
- Leer tweets específicos

---

## 🔄 Manejo de Errores

### Rate Limit (429)
```javascript
try {
  const tweet = await client.v2.tweet(text);
} catch (error) {
  if (error.code === 429) {
    console.log('Rate limit alcanzado. Esperando 15 minutos...');
    await new Promise(resolve => setTimeout(resolve, 15 * 60 * 1000));
    // Reintentar
  }
}
```

### Tweet Duplicado (187)
```javascript
try {
  const tweet = await client.v2.tweet(text);
} catch (error) {
  if (error.code === 187) {
    console.log('Tweet duplicado. Ya fue publicado.');
  }
}
```

### Autenticación Inválida (401)
```javascript
try {
  const tweet = await client.v2.tweet(text);
} catch (error) {
  if (error.code === 401) {
    console.log('Credenciales inválidas. Verificar .env');
  }
}
```

---

## 🎯 Mejores Prácticas

### 1. Delays entre Tweets
```javascript
// ✅ Bueno: 3 segundos entre tweets
await new Promise(resolve => setTimeout(resolve, 3000));

// ❌ Malo: Sin delay (rate limit)
// Publicar inmediatamente
```

### 2. Capturar IDs
```javascript
// ✅ Bueno: Guardar IDs para referencia
const publishedIds = [];
for (const text of tweets) {
  const result = await client.v2.tweet(text);
  publishedIds.push(result.data.id);
}

// ❌ Malo: No guardar IDs
await client.v2.tweet(text);
```

### 3. Retry Logic
```javascript
async function tweetWithRetry(text, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.v2.tweet(text);
    } catch (error) {
      if (error.code === 429 && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 60000));
        continue;
      }
      throw error;
    }
  }
}
```

### 4. Validación de Longitud
```javascript
function validateTweet(text) {
  if (text.length > 280) {
    throw new Error(`Tweet demasiado largo: ${text.length} caracteres`);
  }
  return text;
}

await client.v2.tweet(validateTweet(text));
```

---

## 📊 Ejemplos Reales

### Caso 1: Hilo "AI Won't Kill Jobs"
**Resultado:** 10 tweets publicados en 30 segundos  
**Errores:** 0  
**Script:** `republish-thread-2-9.js`

```javascript
// Tweet 1 (raíz): 2044460978327244866
// Tweet 2: 2044522352721944623
// Tweet 3: 2044522367037096299
// ...
// Tweet 10: 2044522546247106986
```

### Caso 2: Test de API Completo
**Resultado:** 5/5 tests pasados  
**Script:** `test-x-api-access.js`

✅ Autenticación  
✅ Búsqueda  
✅ Lectura de timeline  
✅ Publicación y borrado  
✅ Respuestas encadenadas  

---

## 🚀 Scripts Disponibles

| Script | Propósito | Estado |
|---|---|---|
| `test-x-api-access.js` | Test completo de API | ✅ |
| `test-search-simple.js` | Test de búsqueda | ✅ |
| `republish-thread-2-9.js` | Publicar hilo completo | ✅ |
| `publish-tweet-10-final.js` | Añadir tweet a hilo | ✅ |
| `engagement-hybrid.js` | Bot de engagement | ⭐ |

---

## 🔗 Recursos

- **Documentación oficial:** https://github.com/PLhery/node-twitter-api-v2
- **API Reference:** https://developer.twitter.com/en/docs/twitter-api
- **Rate Limits:** https://developer.twitter.com/en/docs/twitter-api/rate-limits

---

## ✅ Checklist de Migración

Si estás migrando de Playwright a API:

- [ ] Instalar `twitter-api-v2`
- [ ] Configurar credenciales en `.env`
- [ ] Reemplazar `page.goto()` con `client.v2.tweet()`
- [ ] Reemplazar captura de IDs con `result.data.id`
- [ ] Añadir delays de 3 segundos entre tweets
- [ ] Implementar retry logic para rate limits
- [ ] Testear con `test-x-api-access.js`
- [ ] Actualizar documentación

---

**Creado:** 15/04/2026  
**Estado:** ✅ Solución definitiva implementada y testeada
