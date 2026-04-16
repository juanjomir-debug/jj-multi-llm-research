# Problema con Publicación de Hilos

## ❌ Problema Detectado

Los tweets se publicaron pero **NO como un hilo encadenado**. Aparecen como tweets separados en el perfil.

### Causa Raíz

El script `publish-thread-v2.js` capturaba correctamente el `lastTweetId` pero **NO lo estaba pasando** al siguiente tweet.

**Evidencia:**
```
Tweet 1: ID 2044503001696489679 ✅
Tweet 2: ID 2044503079316254889 ❌ (debería ser reply a 2044503001696489679)
Tweet 3: ID 2044503157913370969 ❌ (debería ser reply a 2044503079316254889)
...
```

Todos los logs muestran:
```
[playwright] Navigating to X home...
```

Cuando deberían mostrar:
```
[playwright] Navigating to tweet 2044503001696489679...
```

### Por Qué Falló

El `spawn()` con argumentos en array NO estaba pasando correctamente el parámetro `--reply` cuando el texto contenía saltos de línea.

---

## ✅ Solución

### Opción 1: Borrar y Republicar
1. Borrar los 10 tweets actuales
2. Usar un script mejorado que pase correctamente los parámetros

### Opción 2: Publicar Manualmente
1. Copiar cada tweet del JSON
2. Publicar manualmente como respuestas en Twitter

### Opción 3: Script con Archivos Temporales
En lugar de pasar el texto como argumento, escribirlo en un archivo temporal y que Playwright lo lea.

---

## 🔧 Script Corregido

```javascript
// Escribir el texto en un archivo temporal
const tmpFile = `/tmp/tweet-${Date.now()}.txt`;
fs.writeFileSync(tmpFile, tweet);

// Pasar solo la ruta del archivo
const args = [
  'twitter-bot/tweet-playwright.js',
  '--account', accountName,
  '--file', tmpFile
];

if (replyTo) {
  args.push('--reply', replyTo);
}

// Limpiar después
fs.unlinkSync(tmpFile);
```

---

## 📋 Checklist para Próxima Vez

- [ ] Verificar que cada tweet muestra "Navigating to tweet XXXXX" (excepto el primero)
- [ ] Confirmar que el ID se captura correctamente
- [ ] Verificar en Twitter que aparece como hilo (no como tweets separados)
- [ ] Probar con 2-3 tweets antes de publicar el hilo completo

---

**Fecha:** 15/04/2026
**Estado:** ❌ Hilo publicado pero NO encadenado
**Acción requerida:** Borrar y republicar correctamente
