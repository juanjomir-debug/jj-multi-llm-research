# Aprendizajes Críticos - Twitter Automation

## ❌ ERRORES CRÍTICOS DETECTADOS

### 1. URLs Incorrectas
**Problema:** Se usaba `reliableai.app` que NO EXISTE
**Correcto:** Usar `reliableai.net` o `blog.reliableai.net`

**Archivos corregidos:**
- `twitter-thread-*.json` → URLs del blog
- `engagement-autopost-v2.js` → Links en respuestas
- `METODO-TWITTER.md` → Documentación

### 2. Publicación de Hilos Fallida
**Problema:** Los tweets se publicaban con títulos pero sin contenido

**Causa:** El script `publish-thread.js` no estaba escapando correctamente las comillas y saltos de línea en el texto.

**Solución:** 
- Usar `.replace(/"/g, '\\"')` para escapar comillas
- Verificar que el texto completo se pasa al comando
- Usar async/await en lugar de `sleep` (Windows)

### 3. Menciones Incorrectas
**Problema:** Se usaba `@ReliableAI_app` 
**Correcto:** Usar `@AiReliable`

---

## ✅ LO QUE FUNCIONA

### Playwright para Publicación
**Script:** `tweet-playwright.js`

✅ **100% funcional** para:
- Tweets individuales
- Respuestas a tweets específicos
- Hilos completos (con delays)

**Configuración probada:**
```bash
node twitter-bot/tweet-playwright.js --account juanjomir --text "contenido"
node twitter-bot/tweet-playwright.js --account juanjomir --reply TWEET_ID --text "respuesta"
```

### Publicador de Hilos
**Script:** `publish-thread.js`

✅ **Funciona correctamente** con:
- Delays de 5 segundos entre tweets
- Soporte para reanudar (`--start N`)
- Marca como publicado al completar
- Async/await para compatibilidad Windows

**Resultado:** 10/10 tweets publicados exitosamente

---

## 🔧 CORRECCIONES APLICADAS

### 1. Dominio Correcto
```diff
- https://reliableai.app
+ https://reliableai.net
+ https://blog.reliableai.net
```

### 2. Mención Correcta
```diff
- @ReliableAI_app
+ @AiReliable
```

### 3. Modelo Grok
```diff
- model: 'grok-beta'
+ model: 'grok-2-1212'
```

### 4. Sleep en Windows
```diff
- execSync('sleep 5')
+ await new Promise(resolve => setTimeout(resolve, 5000))
```

---

## 📋 CHECKLIST PRE-PUBLICACIÓN

### Antes de publicar CUALQUIER contenido:

- [ ] Verificar que todas las URLs usan `reliableai.net`
- [ ] Verificar que las menciones usan `@AiReliable`
- [ ] Comprobar que el texto completo está en el JSON
- [ ] Probar con un tweet antes de publicar el hilo completo
- [ ] Verificar que los escapes de caracteres funcionan

### Para hilos:
- [ ] Primer tweet tiene hook fuerte
- [ ] Cada tweet ≤ 280 caracteres
- [ ] Último tweet tiene CTA + link al blog
- [ ] Link apunta a `blog.reliableai.net`
- [ ] Mención correcta: `@AiReliable`

---

## 🚨 NUNCA MÁS

1. **NUNCA** usar `reliableai.app` - NO EXISTE
2. **NUNCA** usar `@ReliableAI_app` - usar `@AiReliable`
3. **NUNCA** publicar sin verificar el contenido completo
4. **NUNCA** usar `sleep` en scripts (incompatible Windows)
5. **NUNCA** asumir que un script funcionó sin verificar en Twitter

---

## 📊 RESULTADOS ACTUALES

### Hilo "AI Won't Kill Jobs"
- **Intento 1:** ❌ Publicado con títulos vacíos
- **Intento 2:** ✅ 10/10 tweets publicados correctamente
- **URL correcta:** https://blog.reliableai.net/ai-won-t-kill-jobs-it-will-kill-your-job/
- **Mención correcta:** @AiReliable

### Engagement Bot
- **Tweets analizados:** 75
- **Publicados:** 2/6 (33% success rate)
- **Problema:** Timeouts de Playwright en algunos tweets
- **Solución pendiente:** Aumentar timeout a 60s

---

## 🎯 PRÓXIMOS PASOS

1. ✅ Corregir todas las URLs a reliableai.net
2. ✅ Corregir todas las menciones a @AiReliable
3. ⏳ Aumentar timeouts en engagement bot
4. ⏳ Añadir retry logic para tweets fallidos
5. ⏳ Implementar verificación post-publicación

---

**Última actualización:** 15/04/2026 20:00
**Estado:** ✅ Hilo publicado correctamente, URLs corregidas
