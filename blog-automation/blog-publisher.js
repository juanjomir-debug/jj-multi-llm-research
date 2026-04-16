#!/usr/bin/env node
/**
 * Blog Publisher for ReliableAI
 * Publica artículos en el blog y genera threads para Twitter
 */

const fs = require('fs');
const path = require('path');
const db = require('./db');

// Configuración
const BLOG_DIR = path.join(__dirname, 'public', 'blog');
const BLOG_POSTS_DIR = path.join(BLOG_DIR, 'posts');

// Crear directorios si no existen
if (!fs.existsSync(BLOG_DIR)) fs.mkdirSync(BLOG_DIR, { recursive: true });
if (!fs.existsSync(BLOG_POSTS_DIR)) fs.mkdirSync(BLOG_POSTS_DIR, { recursive: true });

/**
 * Publica un artículo en el blog
 */
async function publishArticle(article) {
  const { title, subtitle, content, heroImage, author, tags = [] } = article;
  
  // Generar slug del título
  const slug = title
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  const date = new Date().toISOString().split('T')[0];
  const filename = `${date}-${slug}.html`;
  const filepath = path.join(BLOG_POSTS_DIR, filename);
  
  // Generar HTML del artículo
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | ReliableAI Blog</title>
  <meta name="description" content="${subtitle}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${subtitle}">
  <meta property="og:image" content="${heroImage || '/og-image.png'}">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${subtitle}">
  <meta name="twitter:image" content="${heroImage || '/og-image.png'}">
  <link rel="stylesheet" href="../blog-style.css">
</head>
<body>
  <header class="blog-header">
    <a href="/" class="logo">ReliableAI</a>
    <nav>
      <a href="/blog">Blog</a>
      <a href="/">App</a>
    </nav>
  </header>
  
  <article class="blog-post">
    ${heroImage ? `<div class="hero-image"><img src="${heroImage}" alt="${title}"></div>` : ''}
    
    <header class="post-header">
      <h1>${title}</h1>
      <p class="subtitle">${subtitle}</p>
      <div class="post-meta">
        <span class="author">${author || 'ReliableAI Team'}</span>
        <span class="date">${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>
      ${tags.length > 0 ? `<div class="tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
    </header>
    
    <div class="post-content">
      ${content}
    </div>
    
    <footer class="post-footer">
      <p>¿Te ha gustado este artículo? <a href="/">Prueba ReliableAI gratis</a></p>
    </footer>
  </article>
  
  <footer class="blog-footer">
    <p>&copy; ${new Date().getFullYear()} ReliableAI. Todos los derechos reservados.</p>
  </footer>
</body>
</html>`;
  
  // Guardar archivo
  fs.writeFileSync(filepath, html, 'utf-8');
  
  console.log(`✅ Artículo publicado: ${filename}`);
  console.log(`   URL: https://reliableai.app/blog/posts/${filename}`);
  
  return {
    slug,
    filename,
    url: `/blog/posts/${filename}`,
    fullUrl: `https://reliableai.app/blog/posts/${filename}`
  };
}

/**
 * Convierte un artículo en un thread de Twitter
 */
function articleToTwitterThread(article) {
  const { title, subtitle, content, fullUrl } = article;
  
  // Extraer puntos clave del contenido
  const paragraphs = content
    .replace(/<[^>]+>/g, '') // quitar HTML
    .split('\n\n')
    .filter(p => p.trim().length > 50 && p.trim().length < 280);
  
  const tweets = [];
  
  // Tweet 1: Hook + título
  tweets.push(`${title}\n\n${subtitle}\n\n🧵 Thread 👇`);
  
  // Tweets 2-N: Puntos clave (máx 8 tweets)
  const keyPoints = paragraphs.slice(0, 7);
  keyPoints.forEach((point, i) => {
    let tweet = point.trim();
    if (tweet.length > 270) {
      tweet = tweet.substring(0, 267) + '...';
    }
    tweets.push(`${i + 2}/ ${tweet}`);
  });
  
  // Tweet final: CTA
  tweets.push(`Lee el artículo completo aquí 👇\n\n${fullUrl}\n\n#AI #ArtificialIntelligence #MultiLLM`);
  
  return tweets;
}

/**
 * Guarda el thread en un archivo para publicar
 */
function saveTwitterThread(tweets, slug) {
  const threadFile = path.join(__dirname, 'twitter-bot', `thread-${slug}.json`);
  const threadData = {
    tweets,
    slug,
    createdAt: new Date().toISOString(),
    published: false
  };
  
  fs.writeFileSync(threadFile, JSON.stringify(threadData, null, 2), 'utf-8');
  console.log(`\n📱 Thread de Twitter guardado: ${threadFile}`);
  console.log(`   Total tweets: ${tweets.length}`);
  
  return threadFile;
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'publish' && args[1]) {
    // Leer artículo desde archivo JSON
    const articleFile = args[1];
    if (!fs.existsSync(articleFile)) {
      console.error(`❌ Archivo no encontrado: ${articleFile}`);
      process.exit(1);
    }
    
    const article = JSON.parse(fs.readFileSync(articleFile, 'utf-8'));
    
    publishArticle(article).then(result => {
      const tweets = articleToTwitterThread({ ...article, fullUrl: result.fullUrl });
      saveTwitterThread(tweets, result.slug);
      
      console.log('\n✅ Proceso completado');
      console.log(`\nPara publicar en Twitter:`);
      console.log(`  cd twitter-bot`);
      console.log(`  node tweet-thread.js ../twitter-bot/thread-${result.slug}.json`);
    });
  } else {
    console.log('Uso: node blog-publisher.js publish <archivo-articulo.json>');
    console.log('\nFormato del JSON:');
    console.log(JSON.stringify({
      title: 'Título del artículo',
      subtitle: 'Subtítulo o descripción',
      content: '<p>Contenido HTML del artículo</p>',
      heroImage: 'https://url-de-la-imagen.jpg',
      author: 'Nombre del autor',
      tags: ['AI', 'Technology']
    }, null, 2));
  }
}

module.exports = { publishArticle, articleToTwitterThread, saveTwitterThread };
