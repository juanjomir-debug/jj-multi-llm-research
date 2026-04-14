---
inclusion: always
---

# Bots y automatizaciones activas

## Twitter Bot (3 cuentas)

### Herramientas instaladas en VPS
- **Playwright** — `/root/scripts/` — simula navegador real, bypasea anti-bot de Twitter
- **search-x skill** — busca tweets via xAI API
- **bird CLI** — alternativa con cookies (tiene limitaciones anti-bot en cuentas nuevas)

### Cuentas configuradas
| Cuenta | Token | CT0 | Estado |
|---|---|---|---|
| @juanjomir | `7d03ee0fecd4c19cff2c4bf6c12c233683858dad` | — | ✅ Funciona |
| @martinkarsel | `f3076850ae503c6f68ba70c78158bc83d6c30553` | `faf6f09d...` | ⚠️ Error 226 (cuenta nueva) |
| @reliableai | `2cf5beff434fe792b8f540380daa628742c426d0` | `8a04959a...` | ⚠️ Error 226 (cuenta nueva) |

### Scripts en VPS `/root/scripts/`
- `twitter-post.sh` — publica posts originales (cron 9:00 L-V)
- `twitter-engage.sh` — busca y responde tweets (cron 18:00 L-V)
- `tweet-playwright.js` — motor de publicación via Playwright
- `posted_ids.txt` — registro de tweets ya respondidos

### Cron configurado
```
0 9  * * 1-5  bash /root/scripts/twitter-post.sh
0 18 * * 1-5  bash /root/scripts/twitter-engage.sh
```

### Pendiente
- @martinkarsel y @reliableai necesitan 2-4 semanas de actividad orgánica antes de poder automatizar
- Actualizar token de @juanjomir cuando expire

---

## Backlink Bot

### Herramientas
- **Playwright** instalado en VPS en `/root/scripts/`
- Scripts en `/root/scripts/` y código fuente en `backlink-bot/`

### ReliableAI — directorios enviados
- aitoolsdirectory.com ✅
- aitools.inc ✅
- aivalley.ai ✅
- toolify.ai ✅
- theresanaiforthat.com — requiere pago manual

### Resistone (microcemento.org) — estado
- Script creado: `backlink-bot/submit-resistone.js`
- **Problema:** los formularios tienen cookie banners y JS dinámico que bloquean el relleno automático
- **Pendiente:** mejorar script con aceptación de cookies, o hacer manualmente
- Directorios objetivo: Habitissimo, Houzz, Certicalia, Páginas Amarillas, Yelp, Europages, Infobel, Pinterest
- Capturas de inspección en `backlink-bot/screenshots/`

### Datos Resistone para formularios manuales
```
Nombre: Resistone Microcemento
Web: https://www.microcemento.org
Email: info@resistone.es
Teléfono: 917528727
Dirección: C/ Carabaña, 32-3, Alcorcón, 28925 Madrid
CIF: B85123040
Descripción: Fabricantes de microcemento desde 2008. Especialistas en microcemento para suelos, paredes, baños y cocinas. Aplicadores propios en Madrid.
```
