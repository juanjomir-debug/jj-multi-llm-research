# Social Bots - ReliableAI

Automatización de redes sociales para promoción de contenido.

## Carpetas

### twitter-bot/
Bot de Twitter con 3 cuentas configuradas:
- @juanjomir (principal, funciona ✅) - **Cuenta Basic (25,000 caracteres)**
- @martinkarsel (cuenta nueva, error 226 ⚠️)
- @reliableai (cuenta nueva, error 226 ⚠️)

**Funcionalidades:**
- Publicación de threads automáticos
- **Engagement mejorado con priorización inteligente** ⭐ NUEVO
  - Prioriza respuestas a nuestros tweets
  - Usa límite de 25,000 caracteres
  - Siempre en inglés
  - Múltiples estrategias de respuesta
- Engagement básico (buscar y responder tweets relevantes)
- Cron jobs configurados en VPS

**Scripts principales:**
- `engagement-enhanced.js` - **Sistema mejorado de engagement** ⭐ NUEVO
- `twitter-engage-enhanced.sh` - Script de shell para engagement mejorado
- `twitter-post.sh` - Publica posts originales (cron 9:00 L-V)
- `twitter-engage.sh` - Busca y responde tweets (cron 18:00 L-V)
- `tweet-playwright.js` - Motor de publicación via Playwright
- `publish-thread-final.js` - Publica thread completo

**Herramientas:**
- Playwright (bypasea anti-bot de Twitter)
- search-x skill (busca tweets via xAI API)
- bird CLI (alternativa con cookies)

### reddit-bot/
Bot de Reddit para promoción en comunidades relevantes.

## Logs

- `engagement-log-*.json` - Log de engagement diario
- `engagement-autopost-log-*.json` - Log de posts automáticos
- `tweet-error-*.png` - Screenshots de errores

## Configuración

### Twitter
Las credenciales están en el VPS en `/root/scripts/`:
- Tokens de autenticación
- Cookies (CT0)
- Posted IDs (para evitar duplicados)

### Cron (VPS)
```bash
0 9  * * 1-5  bash /root/scripts/twitter-post.sh
0 18 * * 1-5  bash /root/scripts/twitter-engage.sh
```

## Notas importantes

- Las cuentas nuevas (@martinkarsel, @reliableai) necesitan 2-4 semanas de actividad orgánica antes de automatizar
- El token de @juanjomir expira periódicamente y debe renovarse
- Playwright está instalado en el VPS en `/root/scripts/`

## Estrategia de contenido

Ver `twitter-bot/APRENDIZAJES.md` para:
- URLs correctas (reliableai.net, blog.reliableai.net)
- Formato de tweets (≤280 caracteres)
- Menciones correctas (@AiReliable)
- Mejores prácticas
