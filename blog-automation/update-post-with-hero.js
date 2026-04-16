#!/usr/bin/env node
/**
 * Actualiza un post existente de WordPress agregando imagen hero permanente
 */

const { Client } = require('ssh2');
const https = require('https');

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

// Configuración del post
const POST_SLUG = 'ai-won-t-kill-jobs-it-will-kill-your-job';
const HERO_IMAGE_SOURCE = 'https://reliableai.net/og-image.png'; // Usar imagen OG existente

function escapeSQL(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

async function updatePost() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  🔄 Actualizando post con imagen hero                        ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`📝 Post: ${POST_SLUG}`);
  console.log(`🖼️  Imagen: ${HERO_IMAGE_SOURCE}\n`);
  
  const conn = new Client();
  
  return new Promise((resolve, reject) => {
    conn.on('ready', () => {
      console.log('✅ Conectado al servidor\n');
      
      // Obtener el contenido actual del post
      const getCmd = `mysql -u${MYSQL_CONFIG.user} -p${MYSQL_CONFIG.password} ${MYSQL_CONFIG.database} -sNe "SELECT post_content FROM wp_posts WHERE post_name='${POST_SLUG}' AND post_type='post' LIMIT 1"`;
      
      conn.exec(getCmd, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        
        let currentContent = '';
        stream.on('data', (data) => {
          currentContent += data.toString();
        });
        
        stream.on('close', () => {
          if (!currentContent.trim()) {
            console.error('❌ Post no encontrado');
            conn.end();
            return reject(new Error('Post no encontrado'));
          }
          
          console.log('✅ Contenido actual obtenido\n');
          
          // Verificar si ya tiene una imagen hero
          if (currentContent.includes('wp:image') && currentContent.indexOf('wp:image') < 200) {
            console.log('⚠️  El post ya tiene una imagen hero');
            console.log('   Reemplazando con la nueva imagen...\n');
            
            // Remover la imagen existente (primeros bloques wp:image)
            currentContent = currentContent.replace(/<!-- wp:image.*?<!-- \/wp:image -->\s*/s, '');
          }
          
          // Agregar hero image al inicio
          const heroImageBlock = `<!-- wp:image {"sizeSlug":"large"} -->
<figure class="wp-block-image size-large"><img src="${HERO_IMAGE_SOURCE}" alt="AI Won't Kill Jobs - Hero Image" style="width:100%;height:auto;"/></figure>
<!-- /wp:image -->

`;
          
          const newContent = heroImageBlock + currentContent;
          const escapedContent = escapeSQL(newContent);
          
          // Actualizar el post
          const updateCmd = `mysql -u${MYSQL_CONFIG.user} -p${MYSQL_CONFIG.password} ${MYSQL_CONFIG.database} -e "UPDATE wp_posts SET post_content='${escapedContent}', post_modified=NOW(), post_modified_gmt=UTC_TIMESTAMP() WHERE post_name='${POST_SLUG}' AND post_type='post'"`;
          
          conn.exec(updateCmd, (err, stream) => {
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
                console.error('❌ Error actualizando:', error);
                conn.end();
                return reject(new Error(error));
              }
              
              console.log('╔═══════════════════════════════════════════════════════════════╗');
              console.log('║  ✅ Post actualizado exitosamente                            ║');
              console.log('╚═══════════════════════════════════════════════════════════════╝\n');
              console.log(`🔗 URL: https://blog.reliableai.net/${POST_SLUG}/\n`);
              console.log('💡 Limpia la caché del navegador si no ves los cambios\n');
              
              conn.end();
              resolve();
            });
          });
        });
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
  updatePost()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { updatePost };
