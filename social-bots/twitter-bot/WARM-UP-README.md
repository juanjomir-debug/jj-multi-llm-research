# Warm-up de cuentas nuevas de Twitter

## 🎯 Objetivo

Calentar las cuentas @martinkarsel y @reliableai durante 2-4 semanas para que Twitter las reconozca como "humanas" y permita publicar sin error 226.

## 📋 Qué hace el script

### Actividad diaria simulada:
1. **Login** con cookies de sesión
2. **Scroll timeline** (5 scrolls con delays aleatorios)
3. **Likes** (5-10 tweets aleatorios)
4. **Retweets** (2-3 tweets aleatorios)
5. **Comentarios** (1 cada 2-3 días, comentarios genéricos seguros)

### Delays aleatorios:
- Entre acciones: 3-10 segundos
- Entre likes: 3-8 segundos
- Entre retweets: 4-10 segundos
- Scroll: 2-4 segundos

## 🚀 Uso

### Manual (una cuenta)
```bash
node twitter-bot/warm-up-account.js --account martinkarsel
node twitter-bot/warm-up-account.js --account reliableai
```

### Automático (ambas cuentas)
```bash
bash twitter-bot/warm-up.sh
```

## ⏰ Configurar cron (recomendado)

Ejecutar **1 vez al día** durante 14-21 días:

```bash
# Editar crontab
crontab -e

# Añadir esta línea (ejecuta a las 11:00 AM todos los días)
0 11 * * * cd /var/www/reliableai && bash twitter-bot/warm-up.sh >> twitter-bot/warm-up.log 2>&1
```

## 📊 Seguimiento

El script guarda el estado en `warm-up-state.json`:

```json
{
  "martinkarsel": {
    "day": 5,
    "likes": 42,
    "retweets": 13,
    "comments": 2
  },
  "reliableai": {
    "day": 5,
    "likes": 38,
    "retweets": 11,
    "comments": 2
  }
}
```

## 📈 Timeline esperado

| Día | Actividad | Estado |
|---|---|---|
| 1-7 | Likes + RTs | Cuenta "observada" por Twitter |
| 8-14 | Likes + RTs + Comentarios | Cuenta "confiable" |
| 15-21 | Actividad completa | Cuenta "establecida" |
| 21+ | ✅ Lista para bot | Error 226 desaparece |

## ✅ Cuándo está lista una cuenta

Después de **14-21 días** de warm-up diario:
- ✅ 100+ likes totales
- ✅ 30+ retweets totales
- ✅ 5+ comentarios totales
- ✅ Sin errores 226 al publicar

## 🔄 Integración con bot de publicación

Una vez las cuentas estén listas:

1. **Verificar** que no hay error 226:
   ```bash
   node twitter-bot/tweet-playwright.js --account martinkarsel --text "Test tweet"
   ```

2. **Activar** en el cron de publicación:
   ```bash
   # Las cuentas ya están incluidas en twitter-post.sh y twitter-engage.sh
   # Solo necesitas esperar a que el warm-up termine
   ```

3. **Monitorear** logs:
   ```bash
   tail -f twitter-bot/twitter-post.log
   tail -f twitter-bot/twitter-engage.log
   ```

## ⚠️ Notas importantes

1. **No acelerar el proceso** - Twitter detecta patrones no humanos
2. **Ejecutar 1 vez/día** - Más frecuencia = sospechoso
3. **Delays aleatorios** - Ya implementados en el script
4. **Comentarios genéricos** - Seguros, no spam
5. **Headless: false** - Simula navegador real (más lento pero más seguro)

## 🐛 Troubleshooting

### Error: "Target page closed"
- Chrome se cerró inesperadamente
- Solución: Ejecutar de nuevo

### Error: "Timeout waiting for selector"
- Twitter cambió la UI
- Solución: Actualizar selectores en el script

### Error 226 persiste después de 21 días
- Cuenta puede estar shadowbanned
- Solución: Verificar email, completar perfil, esperar 7 días más

## 📝 Logs

```bash
# Ver log de warm-up
tail -f twitter-bot/warm-up.log

# Ver estado actual
cat twitter-bot/warm-up-state.json

# Ver capturas de error (si las hay)
ls -lh twitter-bot/warm-up-error-*.png
```

## 🎯 Resultado esperado

Después de 2-3 semanas:
- ✅ @martinkarsel puede publicar sin error 226
- ✅ @reliableai puede publicar sin error 226
- ✅ Bot de publicación funciona con las 3 cuentas
- ✅ 60 posts/mes + 60 respuestas/mes = 120 interacciones/mes

## 🚀 Próximos pasos

1. **Ahora**: Ejecutar warm-up manualmente para probar
   ```bash
   node twitter-bot/warm-up-account.js --account martinkarsel
   ```

2. **Hoy**: Configurar cron para ejecución diaria
   ```bash
   crontab -e
   # Añadir: 0 11 * * * cd /var/www/reliableai && bash twitter-bot/warm-up.sh
   ```

3. **Día 14-21**: Verificar que las cuentas pueden publicar
   ```bash
   node twitter-bot/tweet-playwright.js --account martinkarsel --text "Test"
   ```

4. **Día 21+**: Las cuentas están listas, el bot funcionará automáticamente

---

**Tiempo total**: 2-3 semanas
**Esfuerzo**: 0 (automatizado)
**Resultado**: 3 cuentas activas publicando 120 tweets/mes
