#!/usr/bin/env node
/**
 * Publicador completo con imágenes:
 * 1. Genera hero image con DALL-E
 * 2. Publica en WordPress con imagen destacada
 * 3. Genera thread para Twitter con imagen en el primer tweet
 */

const fs = require('fs');
const https = require('https');
const { Client } = require('ssh2');
const OpenAI = require('openai');
const Database = require('better-sqlite3');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SSH_CONFIG = {
  host: '187.124.184.177',
  port: 22,
  username: 'root',
  password: 'Z4.HCJf8D&A1lU,V'
};

const MYSQL_CONFIG = {
  user: 'wpuser',
  password: 'cea4c8f3442331ffd4e38440',
  database: 'wordpress'
};

// ═══════════════════════════════════════════════════════════════════════════
// PASO 1: Generar Hero Image con DALL-E
// ═══════════════════════════════════════════════════════════════════════════

async function generateHeroImage(prompt) {
  console.log('🎨 Generando hero image con DALL-E...');
  console.log(`   Prompt: ${prompt.substring(0, 100)}...\n`);
  
  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      size: '1792x1024',
      quality: 'hd',
      n: 1
    });
    
    const imageUrl = response.data[0].url;
    console.log('✅ Hero image generada');
    console.log(`   URL: ${imageUrl}\n`);
    
    return imageUrl;
  } catch (error) {
    console.error('❌ Error generando imagen:', error.message);
    return null;
  }
}

// Descargar imagen
async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PASO 2: Publicar en WordPress con imagen
// ═══════════════════════════════════════════════════════════════════════════

function escapeSQL(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function escapeHTML(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

function markdownToWPBlocks(markdown, heroImageUrl = null) {
  let html = '';
  
  // Agregar hero image al inicio si existe
  if (heroImageUrl) {
    html += `<!-- wp:image {"sizeSlug":"large"} -->\n`;
    html += `<figure class="wp-block-image size-large"><img src="${heroImageUrl}" alt="Hero image"/></figure>\n`;
    html += `<!-- /wp:image -->\n\n`;
  }
  
  const lines = markdown.split('\n');
  let inParagraph = false;
  let paragraphContent = '';
  
  for (let line of lines) {
    line = line.trim();
    
    if (!line) {
      if (inParagraph && paragraphContent) {
        html += `<!-- wp:paragraph -->\n<p>${paragraphContent}</p>\n<!-- /wp:paragraph -->\n\n`;
        paragraphContent = '';
        inParagraph = false;
      }
      continue;
    }
    
    // Headers
    if (line.startsWith('## ')) {
      if (inParagraph && paragraphContent) {
        html += `<!-- wp:paragraph -->\n<p>${paragraphContent}</p>\n<!-- /wp:paragraph -->\n\n`;
        paragraphContent = '';
        inParagraph = false;
      }
      html += `<!-- wp:heading -->\n<h2>${escapeHTML(line.substring(3))}</h2>\n<!-- /wp:heading -->\n\n`;
    } else if (line.startsWith('### ')) {
      if (inParagraph && paragraphContent) {
        html += `<!-- wp:paragraph -->\n<p>${paragraphContent}</p>\n<!-- /wp:paragraph -->\n\n`;
        paragraphContent = '';
        inParagraph = false;
      }
      html += `<!-- wp:heading {"level":3} -->\n<h3>${escapeHTML(line.substring(4))}</h3>\n<!-- /wp:heading -->\n\n`;
    }
    // Blockquote
    else if (line.startsWith('> ')) {
      if (inParagraph && paragraphContent) {
        html += `<!-- wp:paragraph -->\n<p>${paragraphContent}</p>\n<!-- /wp:paragraph -->\n\n`;
        paragraphContent = '';
        inParagraph = false;
      }
      html += `<!-- wp:quote -->\n<blockquote class="wp-block-quote"><p>${escapeHTML(line.substring(2))}</p></blockquote>\n<!-- /wp:quote -->\n\n`;
    }
    // List items
    else if (line.match(/^[-•]\s+/)) {
      if (inParagraph && paragraphContent) {
        html += `<!-- wp:paragraph -->\n<p>${paragraphContent}</p>\n<!-- /wp:paragraph -->\n\n`;
        paragraphContent = '';
        inParagraph = false;
      }
      const content = line.replace(/^[-•]\s+/, '');
      html += `<!-- wp:list-item -->\n<li>${formatInline(content)}</li>\n<!-- /wp:list-item -->\n`;
    }
    // Paragraph
    else {
      if (!inParagraph) {
        inParagraph = true;
        paragraphContent = formatInline(line);
      } else {
        paragraphContent += ' ' + formatInline(line);
      }
    }
  }
  
  if (inParagraph && paragraphContent) {
    html += `<!-- wp:paragraph -->\n<p>${paragraphContent}</p>\n<!-- /wp:paragraph -->\n\n`;
  }
  
  return html;
}

async function publishToWordPress(article, heroImageUrl) {
  console.log('📝 Publicando en WordPress...\n');
  
  // Extraer datos
  const titleMatch = article.response.match(/^#\s+(.+)$/m);
  const subtitleMatch = article.response.match(/^\*(.+)\*$/m);
  
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Article';
  const subtitle = subtitleMatch ? subtitleMatch[1].trim() : '';
  
  // Generar slug
  const slug = title
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  // Limpiar contenido
  let content = article.response
    .replace(/\[HERO_IMAGE:[^\]]+\]/g, '')
    .replace(/\[OG_CARD\]/g, '')
    .replace(/\[CONSENSUS_CHART\]/g, '')
    .replace(/^#\s+.+$/m, '')
    .replace(/^\*.+\*$/m, '')
    .replace(/```mermaid[\s\S]*?```/g, '')
    .trim();
  
  // Convertir a bloques de WordPress con hero image
  const wpContent = markdownToWPBlocks(content, heroImageUrl);
  
  console.log(`📄 Título: ${title}`);
  console.log(`🔗 Slug: ${slug}\n`);
  
  // Conectar via SSH y publicar
  const conn = new Client();
  
  return new Promise((resolve, reject) => {
    conn.on('ready', () => {
      const titleEsc = escapeSQL(title);
      const excerptEsc = escapeSQL(subtitle);
      const bodyEsc = escapeSQL(wpContent);
      
      const sql = `INSERT INTO wp_posts 
        (post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt, 
         post_status, comment_status, ping_status, post_name, post_type, 
         post_modified, post_modified_gmt, to_ping, pinged, post_content_filtered) 
        VALUES 
        (1, NOW(), UTC_TIMESTAMP(), '${bodyEsc}', '${titleEsc}', '${excerptEsc}', 
         'publish', 'open', 'open', '${slug}', 'post', NOW(), UTC_TIMESTAMP(), '', '', '');
        SELECT LAST_INSERT_ID();`;
      
      conn.sftp((err, sftp) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        
        const sqlFile = '/tmp/wp_insert_reliableai.sql';
        const stream = sftp.createWriteStream(sqlFile);
        
        stream.on('close', () => {
          const mysqlCmd = `mysql -u${MYSQL_CONFIG.user} -p${MYSQL_CONFIG.password} ${MYSQL_CONFIG.database} < ${sqlFile}`;
          
          conn.exec(mysqlCmd, (err, stream) => {
            if (err) {
              conn.end();
              return reject(err);
            }
            
            let error = '';
            stream.stderr.on('data', (data) => {
              error += data.toString();
            });
            
            stream.on('close', (code) => {
              if (code !== 0 || error) {
                conn.end();
                return reject(new Error(error));
              }
              
              const verifyCmd = `mysql -u${MYSQL_CONFIG.user} -p${MYSQL_CONFIG.password} ${MYSQL_CONFIG.database} -sNe "SELECT ID FROM wp_posts WHERE post_name='${slug}' LIMIT 1"`;
              
              conn.exec(verifyCmd, (err, stream) => {
                if (err) {
                  conn.end();
                  return reject(err);
                }
                
                let result = '';
                stream.on('data', (data) => {
                  result += data.toString();
                });
                
                stream.on('close', () => {
                  const postId = result.trim();
                  const url = `https://blog.reliableai.net/${slug}/`;
                  
                  console.log('✅ Artículo publicado en WordPress');
                  console.log(`   ID: ${postId}`);
                  console.log(`   URL: ${url}\n`);
                  
                  conn.end();
                  resolve({ postId, slug, url });
                });
              });
            });
          });
        });
        
        stream.write(sql);
        stream.end();
      });
    });
    
    conn.on('error', reject);
    conn.connect(SSH_CONFIG);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PASO 3: Generar thread para Twitter con imagen
// ═══════════════════════════════════════════════════════════════════════════

function createTwitterThread(article, blogUrl, heroImageUrl) {
  const titleMatch = article.response.match(/^#\s+(.+)$/m);
  const subtitleMatch = article.response.match(/^\*(.+)\*$/m);
  
  const title = titleMatch ? titleMatch[1].trim() : '';
  const subtitle = subtitleMatch ? subtitleMatch[1].trim() : '';
  
  const tweets = [];
  
  // Tweet 1: Hook con imagen
  tweets.push({
    text: `${title}\n\n${subtitle}\n\n🧵 Thread 👇`,
    media: heroImageUrl // La imagen se incluirá en el primer tweet
  });
  
  // Resto de tweets (extraer puntos clave del contenido)
  const content = article.response
    .replace(/\[HERO_IMAGE:[^\]]+\]/g, '')
    .replace(/\[OG_CARD\]/g, '')
    .replace(/\[CONSENSUS_CHART\]/g, '')
    .replace(/^#\s+.+$/m, '')
    .replace(/^\*.+\*$/m, '');
  
  const sections = content.split(/^##\s+/m).filter(s => s.trim());
  
  sections.slice(0, 7).forEach((section, i) => {
    const lines = section.split('\n').filter(l => l.trim());
    const heading = lines[0];
    const body = lines.slice(1, 3).join(' ').trim();
    
    if (heading && body) {
      let tweet = `${i + 2}/ ${heading}\n\n${body}`;
      if (tweet.length > 270) {
        tweet = tweet.substring(0, 267) + '...';
      }
      tweets.push({ text: tweet });
    }
  });
  
  // Tweet final: CTA
  tweets.push({
    text: `Lee el artículo completo aquí 👇\n\n${blogUrl}\n\n#AI #ArtificialIntelligence #MultiLLM`
  });
  
  return tweets;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  📰 Publicador Completo con Imágenes                         ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  // 1. Buscar último artículo
  console.log('📊 Buscando último artículo...\n');
  
  const db = new Database('./data/data.db');
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get('juanjomir@gmail.com');
  
  if (!user) {
    console.error('❌ Usuario no encontrado');
    process.exit(1);
  }
  
  const article = db.prepare(`
    SELECT * FROM history 
    WHERE user_id = ? AND prompt LIKE '%employment%'
    ORDER BY created_at DESC LIMIT 1
  `).get(user.id);
  
  db.close();
  
  if (!article) {
    console.error('❌ Artículo no encontrado');
    process.exit(1);
  }
  
  console.log('✅ Artículo encontrado\n');
  
  // 2. Generar hero image
  const heroMatch = article.response.match(/\[HERO_IMAGE:\s*([^\]]+)\]/);
  let heroImageUrl = null;
  
  if (heroMatch && process.env.OPENAI_API_KEY) {
    heroImageUrl = await generateHeroImage(heroMatch[1].trim());
  }
  
  // 3. Publicar en WordPress
  const wpResult = await publishToWordPress(article, heroImageUrl);
  
  // 4. Generar thread
  console.log('🐦 Generando thread para Twitter...\n');
  const tweets = createTwitterThread(article, wpResult.url, heroImageUrl);
  
  const threadData = {
    title: wpResult.slug,
    blogUrl: wpResult.url,
    heroImage: heroImageUrl,
    tweets: tweets,
    createdAt: new Date().toISOString(),
    published: false
  };
  
  const threadFile = `twitter-thread-${wpResult.slug}.json`;
  fs.writeFileSync(threadFile, JSON.stringify(threadData, null, 2));
  
  console.log('✅ Thread guardado:', threadFile);
  console.log(`   Total tweets: ${tweets.length}\n`);
  
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ Proceso completado                                        ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`📄 Blog: ${wpResult.url}`);
  console.log(`🖼️  Hero Image: ${heroImageUrl || 'N/A'}`);
  console.log(`\n📱 Para publicar en Twitter:`);
  console.log(`   node twitter-bot/publish-thread-api.js ${threadFile}\n`);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { generateHeroImage, publishToWordPress, createTwitterThread };
