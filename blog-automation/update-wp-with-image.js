#!/usr/bin/env node
/**
 * Actualiza un post de WordPress existente para agregar la hero image
 */

const { Client } = require('ssh2');

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

const POST_ID = 7; // ID del post a actualizar
const HERO_IMAGE_URL = 'https://reliableai.net/og-image.png';

console.log('\n📝 Actualizando post de WordPress con hero image...\n');
console.log(`   Post ID: ${POST_ID}`);
console.log(`   Image URL: ${HERO_IMAGE_URL.substring(0, 80)}...\n`);

const conn = new Client();

conn.on('ready', () => {
  console.log('✅ Conectado al servidor\n');
  
  // Primero obtener el contenido actual
  const getCmd = `mysql -u${MYSQL_CONFIG.user} -p${MYSQL_CONFIG.password} ${MYSQL_CONFIG.database} -sNe "SELECT post_content FROM wp_posts WHERE ID=${POST_ID}"`;
  
  conn.exec(getCmd, (err, stream) => {
    if (err) {
      console.error('❌ Error:', err.message);
      conn.end();
      return;
    }
    
    let currentContent = '';
    stream.on('data', (data) => {
      currentContent += data.toString();
    });
    
    stream.on('close', () => {
      // Agregar hero image al inicio del contenido
      const heroImageBlock = `<!-- wp:image {"sizeSlug":"large"} -->
<figure class="wp-block-image size-large"><img src="${HERO_IMAGE_URL}" alt="AI Won't Kill Jobs - Hero Image"/></figure>
<!-- /wp:image -->

`;
      
      const newContent = heroImageBlock + currentContent;
      const escapedContent = newContent.replace(/'/g, "\\'").replace(/\n/g, '\\n');
      
      // Actualizar el post
      const updateCmd = `mysql -u${MYSQL_CONFIG.user} -p${MYSQL_CONFIG.password} ${MYSQL_CONFIG.database} -e "UPDATE wp_posts SET post_content='${escapedContent}' WHERE ID=${POST_ID}"`;
      
      conn.exec(updateCmd, (err, stream) => {
        if (err) {
          console.error('❌ Error actualizando:', err.message);
          conn.end();
          return;
        }
        
        let error = '';
        stream.stderr.on('data', (data) => {
          error += data.toString();
        });
        
        stream.on('close', (code) => {
          if (code !== 0 || error) {
            console.error('❌ Error:', error);
          } else {
            console.log('✅ Post actualizado con hero image');
            console.log('   URL: https://blog.reliableai.net/ai-won-t-kill-jobs-it-will-kill-your-job/\n');
          }
          conn.end();
        });
      });
    });
  });
});

conn.on('error', (err) => {
  console.error('❌ Error de conexión:', err.message);
});

conn.connect(SSH_CONFIG);
