#!/usr/bin/env node
/**
 * Agrega un sidebar con las últimas entradas al blog de WordPress
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

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║  📋 Agregando Sidebar al Blog de WordPress                   ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

const conn = new Client();

conn.on('ready', () => {
  console.log('✅ Conectado al servidor\n');
  
  // Crear el archivo PHP del sidebar
  const sidebarPHP = `<?php
/**
 * Sidebar para ReliableAI Blog
 * Muestra las últimas entradas
 */

// Obtener las últimas 10 entradas
$recent_posts = wp_get_recent_posts(array(
    'numberposts' => 10,
    'post_status' => 'publish'
));
?>

<aside class="blog-sidebar">
    <div class="sidebar-widget">
        <h3 class="widget-title">📚 Últimas Entradas</h3>
        <ul class="recent-posts-list">
            <?php foreach($recent_posts as $post): ?>
                <li class="recent-post-item">
                    <a href="<?php echo get_permalink($post['ID']); ?>" class="recent-post-link">
                        <span class="post-title"><?php echo esc_html($post['post_title']); ?></span>
                        <span class="post-date"><?php echo date('d M Y', strtotime($post['post_date'])); ?></span>
                    </a>
                </li>
            <?php endforeach; ?>
        </ul>
    </div>
    
    <div class="sidebar-widget">
        <h3 class="widget-title">🔗 Enlaces</h3>
        <ul class="links-list">
            <li><a href="https://reliableai.app">← Volver a ReliableAI</a></li>
            <li><a href="https://reliableai.app/#features">Características</a></li>
            <li><a href="https://reliableai.app/#pricing">Precios</a></li>
        </ul>
    </div>
    
    <div class="sidebar-widget cta-widget">
        <h3 class="widget-title">🚀 Prueba ReliableAI</h3>
        <p>Compara respuestas de múltiples modelos de IA en tiempo real</p>
        <a href="https://reliableai.app" class="cta-button">Comenzar Gratis</a>
    </div>
</aside>
`;

  // CSS adicional para el sidebar
  const sidebarCSS = `
/* ── Sidebar Layout ─────────────────────────────────────────── */
.blog-container {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 3rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.blog-main {
  min-width: 0; /* Previene overflow en grid */
}

.blog-sidebar {
  position: sticky;
  top: 2rem;
  height: fit-content;
}

/* Mobile: sidebar abajo */
@media (max-width: 968px) {
  .blog-container {
    grid-template-columns: 1fr;
  }
  
  .blog-sidebar {
    position: static;
    margin-top: 3rem;
  }
}

/* ── Sidebar Widgets ────────────────────────────────────────── */
.sidebar-widget {
  background: var(--rai-bg2);
  border: 1px solid var(--rai-border);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.widget-title {
  color: var(--rai-text);
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid var(--rai-accent);
}

/* ── Recent Posts List ──────────────────────────────────────── */
.recent-posts-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.recent-post-item {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--rai-border);
}

.recent-post-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.recent-post-link {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  text-decoration: none;
  transition: all 0.2s;
}

.recent-post-link:hover {
  transform: translateX(4px);
}

.recent-post-link .post-title {
  color: var(--rai-text);
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.4;
}

.recent-post-link:hover .post-title {
  color: var(--rai-accent);
}

.recent-post-link .post-date {
  color: var(--rai-muted);
  font-size: 0.75rem;
}

/* ── Links List ─────────────────────────────────────────────── */
.links-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.links-list li {
  margin-bottom: 0.75rem;
}

.links-list a {
  color: var(--rai-muted);
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.2s;
}

.links-list a:hover {
  color: var(--rai-accent);
}

/* ── CTA Widget ─────────────────────────────────────────────── */
.cta-widget {
  background: linear-gradient(135deg, rgba(207,125,78,.1) 0%, rgba(207,125,78,.05) 100%);
  border-color: rgba(207,125,78,.3);
  text-align: center;
}

.cta-widget p {
  color: var(--rai-muted);
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.cta-button {
  display: inline-block;
  background: var(--rai-accent);
  color: #fff !important;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  transition: opacity 0.2s;
}

.cta-button:hover {
  opacity: 0.85;
}
`;

  conn.sftp((err, sftp) => {
    if (err) {
      console.error('❌ Error SFTP:', err.message);
      conn.end();
      return;
    }
    
    // 1. Crear archivo sidebar.php
    console.log('📝 Creando sidebar.php...');
    const sidebarStream = sftp.createWriteStream('/var/www/reliableai/wp-content/themes/twentytwentyfive/sidebar.php');
    
    sidebarStream.on('close', () => {
      console.log('✅ sidebar.php creado\n');
      
      // 2. Agregar CSS al archivo existente
      console.log('🎨 Actualizando CSS...');
      
      sftp.readFile('/var/www/reliableai/wp-content/mu-plugins/reliableai-skin.css', 'utf8', (err, data) => {
        if (err) {
          console.error('❌ Error leyendo CSS:', err.message);
          conn.end();
          return;
        }
        
        const updatedCSS = data + '\n\n' + sidebarCSS;
        
        const cssStream = sftp.createWriteStream('/var/www/reliableai/wp-content/mu-plugins/reliableai-skin.css');
        
        cssStream.on('close', () => {
          console.log('✅ CSS actualizado\n');
          
          // 3. Actualizar el template para incluir el sidebar
          console.log('📄 Actualizando template...');
          
          const updateTemplateSQL = `
UPDATE wp_posts 
SET post_content = REPLACE(
  post_content,
  '<h2>',
  '<div class="blog-container"><div class="blog-main"><h2>'
)
WHERE post_type = 'post' AND post_content NOT LIKE '%blog-container%';

UPDATE wp_posts 
SET post_content = CONCAT(
  SUBSTRING_INDEX(post_content, '<!-- /wp:paragraph -->', -1),
  '</div><?php get_sidebar(); ?></div>'
)
WHERE post_type = 'post' AND post_content NOT LIKE '%get_sidebar%';
`;
          
          const sqlFile = '/tmp/update_template.sql';
          const sqlStream = sftp.createWriteStream(sqlFile);
          
          sqlStream.on('close', () => {
            const mysqlCmd = `mysql -u${MYSQL_CONFIG.user} -p${MYSQL_CONFIG.password} ${MYSQL_CONFIG.database} < ${sqlFile}`;
            
            conn.exec(mysqlCmd, (err, stream) => {
              if (err) {
                console.error('❌ Error ejecutando SQL:', err.message);
                conn.end();
                return;
              }
              
              let error = '';
              stream.stderr.on('data', (data) => {
                error += data.toString();
              });
              
              stream.on('close', (code) => {
                if (code !== 0 || error) {
                  console.error('⚠️  SQL warning:', error);
                }
                
                console.log('╔═══════════════════════════════════════════════════════════════╗');
                console.log('║  ✅ Sidebar agregado exitosamente                            ║');
                console.log('╚═══════════════════════════════════════════════════════════════╝\n');
                console.log('📋 El sidebar ahora muestra:');
                console.log('   • Últimas 10 entradas del blog');
                console.log('   • Enlaces a ReliableAI');
                console.log('   • CTA para probar la app\n');
                console.log('🔗 Ver: https://blog.reliableai.net/\n');
                
                conn.end();
              });
            });
          });
          
          sqlStream.write(updateTemplateSQL);
          sqlStream.end();
        });
        
        cssStream.write(updatedCSS);
        cssStream.end();
      });
    });
    
    sidebarStream.write(sidebarPHP);
    sidebarStream.end();
  });
});

conn.on('error', (err) => {
  console.error('❌ Error de conexión:', err.message);
});

conn.connect(SSH_CONFIG);
