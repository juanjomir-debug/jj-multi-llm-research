# Blog Automation - ReliableAI

Scripts para publicar y gestionar artículos en el blog de WordPress (blog.reliableai.net).

## Scripts principales

### Publicación

- `publish-article-with-hero.js` - Publica artículo con imagen hero permanente (RECOMENDADO)
- `publish-to-wp-direct.js` - Publica directamente via SSH + MySQL
- `publish-to-wordpress.js` - Publica via REST API de WordPress
- `blog-publisher.js` - Publicador general

### Actualización

- `update-post-with-hero.js` - Actualiza post existente con imagen hero
- `update-wp-with-image.js` - Actualiza imagen de un post

### Obtención de artículos

- `get-latest-article.js` - Obtiene el último artículo generado
- `get-article-local.js` - Obtiene artículo de DB local
- `get-article-vps.js` - Obtiene artículo de DB en VPS

## Uso

### Publicar artículo nuevo con imagen hero
```bash
node publish-article-with-hero.js article-full.json
```

### Actualizar post existente con imagen
```bash
node update-post-with-hero.js
```

## Configuración

Los scripts usan SSH directo al servidor:
- Host: 187.124.184.177
- Usuario: root
- Base de datos: wordpress (MySQL)

## Carpeta wp-skin

Contiene scripts para personalizar el tema de WordPress:
- Layout responsive
- Sidebar con CTA
- Integración con ReliableAI
