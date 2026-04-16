# ReliableAI - Aplicación Principal

Esta carpeta contiene el código core de la aplicación ReliableAI.

## Archivos principales

- `server.js` - Servidor Express principal
- `db.js` - Gestión de base de datos SQLite
- `admin-middleware.js` - Middleware de autenticación admin
- `admin-routes.js` - Rutas del panel de administración
- `ecosystem.config.js` - Configuración PM2 para producción

## Carpetas

- `public/` - Frontend (HTML/CSS/JS vanilla)
- `data/` - Bases de datos SQLite
- `benchmark/` - Tests de rendimiento
- `deploy/` - Scripts y configuración de deploy
- `ios-assets/` - Assets para app iOS (Capacitor)
- `fastlane/` - Automatización de builds iOS

## Deploy

### Local
```bash
npm install
npm start
```

### Producción (VPS)
```bash
deploy.bat  # Desde Windows
# O manualmente:
git push origin master
ssh root@187.124.184.177 "cd /var/www/reliableai && git pull && npm install --omit=dev && pm2 restart jj-multi-llm"
```

## Stack

- **Backend:** Node.js + Express
- **Frontend:** HTML/CSS/JS vanilla
- **DB:** SQLite (better-sqlite3)
- **Sesiones:** SQLite store
- **Deploy:** VPS Hostinger + PM2
