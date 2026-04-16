#!/usr/bin/env node
/**
 * Publica artículo directamente en WordPress via SSH + MySQL
 */

const { Client } = require('ssh2');
const fs = require('fs');

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

function markdownToWPBlocks(markdown) {
  let html = '';
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
    if (line.startsWith('# ')) {
      if (inParagraph && paragraphContent) {
        html += `<!-- wp:paragraph -->\n<p>${paragraphContent}</p>\n<!-- /wp:paragraph -->\n\n`;
        paragraphContent = '';
        inParagraph = false;
      }
      html += `<!-- wp:heading {"level":1} -->\n<h1>${escapeHTML(line.substring(2))}</h1>\n<!-- /wp:heading -->\n\n`;
    } else if (line.startsWith('## ')) {
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

async function publishToWordPress(articleFile) {
  if (!fs.existsSync(articleFile)) {
    console.error(`❌ Archivo no encontrado: ${articleFile}`);
    process.exit(1);
  }
  
  const article = JSON.parse(fs.readFileSync(articleFile, 'utf-8'));
  
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  📝 Publicando en WordPress (blog.reliableai.net)            ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  // Extraer datos
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
  
  // Convertir a bloques de WordPress
  const wpContent = markdownToWPBlocks(content);
  
  console.log(`📄 Título: ${title}`);
  console.log(`🔗 Slug: ${slug}`);
  console.log(`📝 Contenido: ${wpContent.length} chars\n`);
  
  // Conectar via SSH
  const conn = new Client();
  
  return new Promise((resolve, reject) => {
    conn.on('ready', () => {
      console.log('✅ Conectado al servidor\n');
      
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
          console.log('📤 SQL guardado en servidor\n');
          
          // Ejecutar SQL
          const mysqlCmd = `mysql -u${MYSQL_CONFIG.user} -p${MYSQL_CONFIG.password} ${MYSQL_CONFIG.database} < ${sqlFile}`;
          
          conn.exec(mysqlCmd, (err, stream) => {
            if (err) {
              conn.end();
              return reject(err);
            }
            
            let output = '';
            let error = '';
            
            stream.on('data', (data) => {
              output += data.toString();
            });
            
            stream.stderr.on('data', (data) => {
              error += data.toString();
            });
            
            stream.on('close', (code) => {
              if (code !== 0 || error) {
                console.error('❌ Error ejecutando SQL:', error);
                conn.end();
                return reject(new Error(error));
              }
              
              console.log('✅ Artículo insertado en la base de datos\n');
              
              // Verificar el post
              const verifyCmd = `mysql -u${MYSQL_CONFIG.user} -p${MYSQL_CONFIG.password} ${MYSQL_CONFIG.database} -sNe "SELECT ID, post_title, post_status FROM wp_posts WHERE post_name='${slug}' LIMIT 1"`;
              
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
                  const parts = result.trim().split('\t');
                  if (parts.length >= 3) {
                    const postId = parts[0];
                    const postTitle = parts[1];
                    const postStatus = parts[2];
                    
                    console.log('╔═══════════════════════════════════════════════════════════════╗');
                    console.log('║  ✅ Artículo publicado exitosamente                          ║');
                    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
                    console.log(`📄 ID: ${postId}`);
                    console.log(`📝 Título: ${postTitle}`);
                    console.log(`✓ Estado: ${postStatus}`);
                    console.log(`🔗 URL: https://blog.reliableai.net/${slug}/\n`);
                    
                    conn.end();
                    resolve({ postId, slug, url: `https://blog.reliableai.net/${slug}/` });
                  } else {
                    conn.end();
                    reject(new Error('No se pudo verificar el post'));
                  }
                });
              });
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

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Uso: node publish-to-wp-direct.js <article-full.json>');
    console.log('\nEjemplo:');
    console.log('  node publish-to-wp-direct.js article-full.json');
    process.exit(1);
  }
  
  publishToWordPress(args[0])
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { publishToWordPress };
