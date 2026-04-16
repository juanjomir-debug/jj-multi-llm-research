# Organización del Proyecto ReliableAI

## 📋 Resumen de cambios

El proyecto ha sido reorganizado en carpetas lógicas para mejor mantenibilidad.

## 🗂️ Estructura anterior vs nueva

### Antes
```
/ (raíz con 50+ archivos mezclados)
├── server.js, db.js, admin-*.js
├── publish-*.js, update-*.js
├── article-full.json
├── twitter-bot/
├── backlink-bot/
└── muchos archivos más...
```

### Ahora
```
/
├── reliableai/              # App principal
├── blog-automation/         # Scripts de blog
├── content-generator/       # Generación de contenido
├── social-bots/            # Bots de redes sociales
├── backlink-automation/    # Automatización de backlinks
├── docs/                   # Documentación
├── package.json            # Actualizado con nuevos scripts
└── README.md               # Documentación principal
```

## 📦 Carpetas principales

### 1. reliableai/
**Contenido:** Aplicación web principal de ReliableAI
- Backend Express (server.js, db.js)
- Frontend vanilla (public/)
- Bases de datos (data/)
- Configuración de deploy
- Assets iOS

**Comando:**
```bash
cd reliableai
npm start
```

### 2. blog-automation/
**Contenido:** Scripts para publicar en WordPress
- Publicación con imagen hero
- Actualización de posts
- Obtención de artículos
- Personalización de tema WP

**Comandos:**
```bash
npm run blog:publish    # Publicar artículo nuevo
npm run blog:update     # Actualizar post existente
```

### 3. content-generator/
**Contenido:** Generación de contenido
- Artículos generados (article-full.json)
- Threads de Twitter
- Generación de imágenes OG
- Herramientas de creación

**Comandos:**
```bash
npm run content:og-image    # Generar imagen OG
```

### 4. social-bots/
**Contenido:** Automatización de redes sociales
- twitter-bot/ (3 cuentas configuradas)
- reddit-bot/
- Logs de engagement
- Screenshots de errores

**Comandos:**
```bash
npm run twitter:thread    # Publicar thread
```

### 5. backlink-automation/
**Contenido:** Registro en directorios
- Bot engine con Playwright
- Datos de negocios
- Analizador de formularios con visión AI
- Verificación de emails

### 6. docs/
**Contenido:** Documentación del proyecto
- Guías técnicas
- Descripciones funcionales
- Aprendizajes y mejores prácticas

## 🚀 Scripts npm actualizados

```json
{
  "start": "node reliableai/server.js",
  "dev": "node --watch reliableai/server.js",
  "blog:publish": "node blog-automation/publish-article-with-hero.js content-generator/article-full.json",
  "blog:update": "node blog-automation/update-post-with-hero.js",
  "twitter:thread": "node social-bots/twitter-bot/publish-thread-final.js",
  "content:og-image": "node content-generator/generate-og-image.js"
}
```

## 📝 Archivos que permanecen en raíz

- `.env` - Variables de entorno (no se mueve por seguridad)
- `.env.example` - Ejemplo de configuración
- `.gitignore` - Configuración de Git
- `package.json` - Dependencias del proyecto
- `package-lock.json` - Lock de dependencias
- `README.md` - Documentación principal
- `data.db`, `sessions.db` - Bases de datos activas (no se mueven)

## 🔄 Migración

### Si tienes scripts que referencian archivos antiguos:

**Antes:**
```javascript
require('./server.js')
require('./db.js')
```

**Ahora:**
```javascript
require('./reliableai/server.js')
require('./reliableai/db.js')
```

### Rutas de archivos comunes:

| Archivo antiguo | Nueva ubicación |
|---|---|
| `server.js` | `reliableai/server.js` |
| `publish-article-with-hero.js` | `blog-automation/publish-article-with-hero.js` |
| `article-full.json` | `content-generator/article-full.json` |
| `twitter-bot/` | `social-bots/twitter-bot/` |
| `backlink-bot/` | `backlink-automation/` |

## ✅ Beneficios

1. **Claridad:** Cada carpeta tiene un propósito específico
2. **Mantenibilidad:** Más fácil encontrar y modificar código
3. **Escalabilidad:** Fácil agregar nuevas funcionalidades
4. **Documentación:** Cada carpeta tiene su README
5. **Scripts npm:** Comandos simplificados para tareas comunes

## 📚 Próximos pasos

1. Actualizar referencias en código que apunten a rutas antiguas
2. Actualizar scripts de deploy si es necesario
3. Verificar que todos los imports funcionen correctamente
4. Actualizar documentación específica de cada módulo

## 🐛 Si algo no funciona

1. Verifica las rutas en los imports
2. Asegúrate de estar en el directorio correcto
3. Revisa el README de cada carpeta para instrucciones específicas
4. Los archivos de base de datos permanecen en la raíz

## 📞 Soporte

Si encuentras problemas con la nueva estructura, revisa:
- README.md principal
- README.md de cada carpeta
- docs/ para documentación técnica
