# ReliableAI - Proyecto Completo

Plataforma multi-LLM para investigación con IA + automatización de contenido y marketing.

## 📁 Estructura del proyecto

```
├── reliableai/              # 🎯 Aplicación web principal
│   ├── server.js           # Backend Express
│   ├── db.js               # Base de datos SQLite
│   ├── public/             # Frontend vanilla
│   ├── data/               # Bases de datos
│   └── deploy/             # Scripts de deploy
│
├── blog-automation/         # 📝 Publicación en WordPress
│   ├── publish-article-with-hero.js
│   ├── update-post-with-hero.js
│   └── wp-skin/            # Personalización tema WP
│
├── content-generator/       # ✍️ Generación de contenido
│   ├── article-full.json   # Último artículo
│   ├── generate-og-image.js
│   └── twitter-thread-*.json
│
├── social-bots/            # 🤖 Automatización redes sociales
│   ├── twitter-bot/        # Bot de Twitter (3 cuentas)
│   └── reddit-bot/         # Bot de Reddit
│
├── backlink-automation/    # 🔗 Registro en directorios
│   ├── bot-engine.js
│   ├── business-data.js
│   └── vision-analyzer.js
│
└── docs/                   # 📚 Documentación
    ├── CLAUDE.md
    ├── DESCRIPCION_TECNICA.md
    └── MODEL_STRENGTHS.md
```

## 🚀 Quick Start

### ReliableAI App
```bash
cd reliableai
npm install
npm start
# http://localhost:3000
```

### Publicar artículo en blog
```bash
cd blog-automation
node publish-article-with-hero.js ../content-generator/article-full.json
```

### Publicar thread en Twitter
```bash
cd social-bots/twitter-bot
node publish-thread-final.js
```

## 🌐 URLs

- **App:** https://reliableai.net
- **Blog:** https://blog.reliableai.net
- **VPS:** 187.124.184.177 (Hostinger)

## 📦 Dependencias principales

```json
{
  "express": "^4.18.2",
  "better-sqlite3": "^9.2.2",
  "@anthropic-ai/sdk": "^0.32.1",
  "openai": "^4.77.0",
  "@google/generative-ai": "^0.21.0",
  "playwright": "^1.41.0",
  "ssh2": "^1.11.0"
}
```

## 🔧 Configuración

### Variables de entorno (.env)
```bash
# API Keys
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_API_KEY=
XAI_API_KEY=
QWEN_API_KEY=
ZHIPU_API_KEY=
MOONSHOT_API_KEY=
PERPLEXITY_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Email
SMTP_HOST=
SMTP_USER=
SMTP_PASS=

# Session
SESSION_SECRET=

# Database
DB_PATH=/app/data/data.db
```

## 📊 Stack tecnológico

- **Backend:** Node.js + Express
- **Frontend:** HTML/CSS/JS vanilla
- **Database:** SQLite (better-sqlite3)
- **Deploy:** VPS + PM2 + Nginx
- **CI/CD:** Git push + SSH deploy
- **Bots:** Playwright + xAI API
- **Blog:** WordPress (blog.reliableai.net)

## 🎯 Funcionalidades principales

### ReliableAI App
- Consultas simultáneas a 8+ modelos de IA
- Comparación de respuestas en tiempo real
- Debates entre modelos
- Síntesis con modelo integrador
- Historial de sesiones
- Sistema de billing (Stripe)
- Panel de administración

### Automatización
- Publicación automática en blog (WordPress)
- Threads de Twitter automáticos
- Engagement en Twitter (buscar y responder)
- Registro en directorios (backlinks)
- Generación de imágenes OG (DALL-E)

## 📝 Documentación

Cada carpeta tiene su propio README con detalles específicos:
- [reliableai/README.md](reliableai/README.md)
- [blog-automation/README.md](blog-automation/README.md)
- [content-generator/README.md](content-generator/README.md)
- [social-bots/README.md](social-bots/README.md)
- [backlink-automation/README.md](backlink-automation/README.md)

## 🔐 Seguridad

- Sesiones HttpOnly + Secure
- Rate limiting (20 req/15min auth, 60 req/min API)
- Bcrypt para passwords (cost 10)
- Helmet para headers de seguridad
- Roles: user, admin, superadmin

## 📈 Deploy

### Producción (VPS)
```bash
# Desde Windows
reliableai/deploy.bat

# O manualmente
git push origin master
ssh root@187.124.184.177 "cd /var/www/reliableai && git pull && npm install --omit=dev && pm2 restart jj-multi-llm"
```

### PM2
```bash
pm2 list
pm2 logs jj-multi-llm
pm2 restart jj-multi-llm
```

## 🐛 Bugs conocidos

Ver `docs/db-and-bugs.md` para lista completa de bugs conocidos y cómo evitarlos.

## 📧 Contacto

- Email: info@reliableai.net
- Twitter: @AiReliable
- GitHub: juanjomir-debug/jj-multi-llm-research

## 📄 Licencia

Propietario - ReliableAI © 2026
