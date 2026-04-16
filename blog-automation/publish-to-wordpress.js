#!/usr/bin/env node
/**
 * Publica un artículo en WordPress usando la REST API
 * Requiere: WP_URL, WP_USER, WP_APP_PASSWORD en .env
 */

const fs = require('fs');
const https = require('https');
const http = require('http');
require('dotenv').config();

// Configuración
const WP_URL = process.env.WP_URL || 'https://blog.reliableai.net';
const WP_USER = process.env.WP_USER || 'admin';
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;

if (!WP_APP_PASSWORD) {
  console.error('❌ Falta WP_APP_PASSWORD en .env');
  console.log('\nPara generar una Application Password:');
  console.log('1. Ve a WordPress Admin → Users → Profile');
  console.log('2. Scroll hasta "Application Passwords"');
  console.log('3. Crea una nueva con nombre "ReliableAI Publisher"');
  console.log('4. Copia el password y agrégalo a .env como WP_APP_PASSWORD');
  process.exit(1);
}

function wpRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${WP_URL}/wp-json/wp/v2/${endpoint}`);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const auth = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ReliableAI-Publisher/1.0'
      }
    };
    
    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(body);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function uploadImage(imageUrl, title) {
  console.log('🖼️  Descargando hero image...');
  
  return new Promise((resolve, reject) => {
    https.get(imageUrl, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        
        console.log('📤 Subiendo imagen a WordPress...');
        
        const url = new URL(`${WP_URL}/wp-json/wp/v2/media`);
        const auth = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');
        
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36);
        const filename = `hero-${Date.now()}.png`;
        
        let body = '';
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`;
        body += `Content-Type: image/png\r\n\r\n`;
        
        const header = Buffer.from(body, 'utf-8');
        const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
        const payload = Buffer.concat([header, buffer, footer]);
        
        const options = {
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': payload.length,
            'Content-Disposition': `attachment; filename="${filename}"`
          }
        };
        
        const req = https.request(options, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const data = JSON.parse(body);
              console.log('✅ Imagen subida:', data.id);
              resolve(data.id);
            } else {
              console.error('❌ Error subiendo imagen:', body);
              resolve(null);
            }
          });
        });
        
        req.on('error', (err) => {
          console.error('❌ Error en request:', err.message);
          resolve(null);
        });
        
        req.write(payload);
        req.end();
      });
    }).on('error', (err) => {
      console.error('❌ Error descargando imagen:', err.message);
      resolve(null);
    });
  });
}

function markdownToGutenberg(markdown) {
  // Convertir markdown a bloques de Gutenberg
  let blocks = [];
  
  // Dividir por líneas
  const lines = markdown.split('\n');
  let currentBlock = { type: null, content: '' };
  
  for (let line of lines) {
    line = line.trim();
    
    if (!line) {
      if (currentBlock.content) {
        blocks.push(currentBlock);
        currentBlock = { type: null, content: '' };
      }
      continue;
    }
    
    // Headers
    if (line.startsWith('# ')) {
      if (currentBlock.content) blocks.push(currentBlock);
      blocks.push({ type: 'heading', level: 1, content: line.substring(2) });
      currentBlock = { type: null, content: '' };
    } else if (line.startsWith('## ')) {
      if (currentBlock.content) blocks.push(currentBlock);
      blocks.push({ type: 'heading', level: 2, content: line.substring(3) });
      currentBlock = { type: null, content: '' };
    } else if (line.startsWith('### ')) {
      if (currentBlock.content) blocks.push(currentBlock);
      blocks.push({ type: 'heading', level: 3, content: line.substring(4) });
      currentBlock = { type: null, content: '' };
    }
    // Blockquote
    else if (line.startsWith('> ')) {
      if (currentBlock.type !== 'quote') {
        if (currentBlock.content) blocks.push(currentBlock);
        currentBlock = { type: 'quote', content: line.substring(2) };
      } else {
        currentBlock.content += '\n' + line.substring(2);
      }
    }
    // Paragraph
    else {
      if (currentBlock.type !== 'paragraph') {
        if (currentBlock.content) blocks.push(currentBlock);
        currentBlock = { type: 'paragraph', content: line };
      } else {
        currentBlock.content += ' ' + line;
      }
    }
  }
  
  if (currentBlock.content) blocks.push(currentBlock);
  
  // Convertir a HTML de Gutenberg
  let html = '';
  
  for (const block of blocks) {
    if (block.type === 'heading') {
      html += `<!-- wp:heading {"level":${block.level}} -->\n`;
      html += `<h${block.level}>${escapeHtml(block.content)}</h${block.level}>\n`;
      html += `<!-- /wp:heading -->\n\n`;
    } else if (block.type === 'quote') {
      html += `<!-- wp:quote -->\n`;
      html += `<blockquote class="wp-block-quote"><p>${escapeHtml(block.content)}</p></blockquote>\n`;
      html += `<!-- /wp:quote -->\n\n`;
    } else if (block.type === 'paragraph') {
      // Convertir markdown inline (bold, italic, links)
      let content = block.content
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
      
      html += `<!-- wp:paragraph -->\n`;
      html += `<p>${content}</p>\n`;
      html += `<!-- /wp:paragraph -->\n\n`;
    }
  }
  
  return html;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function publishArticle(articleFile) {
  if (!fs.existsSync(articleFile)) {
    console.error(`❌ Archivo no encontrado: ${articleFile}`);
    process.exit(1);
  }
  
  const article = JSON.parse(fs.readFileSync(articleFile, 'utf-8'));
  
  console.log('\n📝 Publicando artículo en WordPress...');
  console.log(`   URL: ${WP_URL}\n`);
  
  // Extraer datos del artículo
  const heroMatch = article.response.match(/\[HERO_IMAGE:\s*([^\]]+)\]/);
  const titleMatch = article.response.match(/^#\s+(.+)$/m);
  const subtitleMatch = article.response.match(/^\*(.+)\*$/m);
  
  const title = titleMatch ? titleMatch[1].trim() : 'AI and Employment: The Net Effect';
  const subtitle = subtitleMatch ? subtitleMatch[1].trim() : '';
  
  // Limpiar contenido
  let content = article.response
    .replace(/\[HERO_IMAGE:[^\]]+\]/g, '')
    .replace(/\[OG_CARD\]/g, '')
    .replace(/\[CONSENSUS_CHART\]/g, '')
    .replace(/^#\s+.+$/m, '') // Quitar título (se usa como post title)
    .replace(/^\*.+\*$/m, '') // Quitar subtítulo
    .trim();
  
  // Subir hero image si existe
  let featuredMediaId = null;
  if (heroMatch) {
    // Buscar si ya tenemos la URL generada
    const threadFile = articleFile.replace('article-full.json', 'twitter-thread-ai-won-t-kill-jobs-it-will-kill-your-job.json');
    if (fs.existsSync(threadFile)) {
      const threadData = JSON.parse(fs.readFileSync(threadFile, 'utf-8'));
      if (threadData.heroImage) {
        featuredMediaId = await uploadImage(threadData.heroImage, title);
      }
    }
  }
  
  // Convertir a Gutenberg
  const gutenbergContent = markdownToGutenberg(content);
  
  // Crear el post
  console.log('📤 Creando post en WordPress...');
  
  const postData = {
    title: title,
    content: gutenbergContent,
    excerpt: subtitle,
    status: 'publish', // o 'draft' para revisar antes
    featured_media: featuredMediaId,
    categories: [], // Agregar IDs de categorías si existen
    tags: [] // Agregar IDs de tags si existen
  };
  
  try {
    const result = await wpRequest('posts', 'POST', postData);
    
    console.log('\n✅ Artículo publicado en WordPress');
    console.log(`   ID: ${result.id}`);
    console.log(`   URL: ${result.link}`);
    console.log(`   Status: ${result.status}`);
    
    return result;
    
  } catch (error) {
    console.error('\n❌ Error publicando:', error.message);
    throw error;
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Uso: node publish-to-wordpress.js <article-full.json>');
    console.log('\nEjemplo:');
    console.log('  node publish-to-wordpress.js article-full.json');
    process.exit(1);
  }
  
  publishArticle(args[0]).catch(console.error);
}

module.exports = { publishArticle };
