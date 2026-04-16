#!/usr/bin/env node
/**
 * Publica artículo en WordPress con imagen hero permanente
 * 1. Descarga la imagen hero de DALL-E
 * 2. La sube al servidor en /var/www/reliableai/public/blog-images/
 * 3. Publica el artículo con la imagen
 */

const { Client } = require('ssh2');
const fs = require('fs');
const https = require('https');
const path = require('path');

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

function escapeSQL(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    console.log('🖼️  Descargando imagen hero...');
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        console.log('✅ Imagen descargada\n');
        resolve(Buffer.concat(chunks));
      });
    }).on('error', reject);
  });
}

function markdownToWPBlocks(markdown, heroImageUrl) {
  let html = '';
  
  // Agregar hero image al inicio
  if (heroImageUrl) {
    html += `<!-- wp:image {"sizeSlug":"large"} -->\n`;
    html += `<figure class="wp-block-image size-large"><img src="${heroImageUrl}" alt="Hero Image" style="width:100%;height:auto;"/></figure>\n`;
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

function formatInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

function escapeHTML(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function publishArticle(articleFile) {
  if (!fs.existsSync(articleFile)) {
    console.error(`❌ Archivo no encontrado: ${articleFile}`);
    process.exit(1);
  }
  
  const article = JSON.parse(fs.readFileSync(articleFile, 'utf-8'));
  
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  📝 Publicando en WordPress con imagen hero                  ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  // Extraer hero image URL
  const heroMatch = article.response.match(/\[HERO_IMAGE:\s*([^\]]+)\]/);
  let heroImageBuffer = null;
  let heroImageFilename = null;
  
  if (heroMatch) {
    const heroPrompt = heroMatch[1];
    console.log('🎨 Hero image prompt encontrado');
    
    // Buscar si ya tenemos la URL generada en el thread JSON
    const threadFile = 'twitter-thread-ai-won-t-kill-jobs-it-will-kill-your-job.json';
    if (fs.existsSync(threadFile)) {
      const threadData = JSON.parse(fs.readFileSync(threadFile, 'utf-8'));
      if (threadData.heroImage) {
        console.log('🔗 URL de imagen encontrada en thread JSON\n');
        try {
          heroImageBuffer = await downloadImage(threadData.heroImage);
          heroImageFilename = `hero-${Date.now()}.png`;
        } catch (err) {
          console.log('⚠️  No se pudo descargar la imagen (puede haber expirado)');
          console.log('   Continuando sin imagen hero...\n');
        }
      }
    }
  }
  
  // Extraer datos del artículo
  const titleMatch = article.response.match(/^#\s+(.+)$/m);
  const subtitleMatch = article.response.match(/^\*(.+)\*$/m);
  
  const title = titleMatch ? titleMatch[1].trim() : 'AI and Employment: The Net Effect';
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
  
  console.log(`📄 Título: ${title}`);
  console.log(`🔗 Slug: ${slug}\n`);
  
  // Conectar via SSH
  const conn = new Client();
  
  return new Promise((resolve, reject) => {
    conn.on('ready', async () => {
      console.log('✅ Conectado al servidor\n');
      
      let heroImageUrl = null;
      
      // Subir imagen si la tenemos
      if (heroImageBuffer && heroImageFilename) {
        try {
          heroImageUrl = await uploadImageToServer(conn, heroImageBuffer, heroImageFilename);
          console.log(`✅ Imagen subida: ${heroImageUrl}\n`);
        } catch (err) {
          console.log('⚠️  Error subiendo imagen:', err.message);
          console.log('   Continuando sin imagen...\n');
        }
      }
      
      // Convertir a bloques de WordPress
      const wpContent = markdownToWPBlocks(content, heroImageUrl);
      
      // Escapar contenido para SQL
      const titleEsc = escapeSQL(title);
      const excerptEsc = escapeSQL(subtitle);
      const bodyEsc = escapeSQL(wpContent);
      
      // Crear SQL
      const sql = `INSERT INTO wp_posts 
        (post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt, 
         post_status, comment_status, ping_status, post_name, post_type, 
         post_modified, post_modified_gmt, to_ping, pinged, post_content_filtered) 
        VALUES 
        (1, NOW(), UTC_TIMESTAMP(), '${bodyEsc}', '${titleEsc}', '${excerptEsc}', 
         'publish', 'open', 'open', '${slug}', 'post', NOW(), UTC_TIMESTAMP(), '', '', '');
        SELECT LAST_INSERT_ID();`;
      
      // Guardar SQL en archivo temporal
      conn.sftp((err, sftp) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        
        const sqlFile = '/tmp/wp_insert_reliableai.sql';
        const stream = sftp.createWriteStream(sqlFile);
        
        stream.on('close', () => {
          console.log('📤 Ejecutando SQL...\n');
          
          // Ejecutar SQL
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
                console.error('❌ Error ejecutando SQL:', error);
                conn.end();
                return reject(new Error(error));
              }
              
              console.log('╔═══════════════════════════════════════════════════════════════╗');
              console.log('║  ✅ Artículo publicado exitosamente                          ║');
              console.log('╚═══════════════════════════════════════════════════════════════╝\n');
              console.log(`📝 Título: ${title}`);
              console.log(`🔗 URL: https://blog.reliableai.net/${slug}/\n`);
              
              conn.end();
              resolve({ slug, url: `https://blog.reliableai.net/${slug}/` });
            });
          });
        });
        
        stream.write(sql);
        stream.end();
      });
    });
    
    conn.on('error', (err) => {
      console.error('❌ Error de conexión SSH:', err.message);
      reject(err);
    });
    
    conn.connect(SSH_CONFIG);
  });
}

function uploadImageToServer(conn, imageBuffer, filename) {
  return new Promise((resolve, reject) => {
    console.log('📤 Subiendo imagen al servidor...');
    
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      
      // Crear directorio si no existe
      const remoteDir = '/var/www/reliableai/public/blog-images';
      const remotePath = `${remoteDir}/${filename}`;
      
      conn.exec(`mkdir -p ${remoteDir}`, (err) => {
        if (err) return reject(err);
        
        const stream = sftp.createWriteStream(remotePath);
        
        stream.on('close', () => {
          const publicUrl = `https://reliableai.net/blog-images/${filename}`;
          resolve(publicUrl);
        });
        
        stream.on('error', reject);
        
        stream.write(imageBuffer);
        stream.end();
      });
    });
  });
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Uso: node publish-article-with-hero.js <article-full.json>');
    console.log('\nEjemplo:');
    console.log('  node publish-article-with-hero.js article-full.json');
    process.exit(1);
  }
  
  publishArticle(args[0])
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { publishArticle };
