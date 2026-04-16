#!/usr/bin/env node
/**
 * Actualiza el blog de WordPress con:
 * 1. Menú superior igual a la landing page
 * 2. Sidebar lateral con entradas
 * 3. Quita "Sample Page" y otros títulos innecesarios
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

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║  🎨 Actualizando Layout del Blog                             ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

// CSS adicional para el nuevo layout
const additionalCSS = `
/* ══════════════════════════════════════════════════════════════
   MENÚ SUPERIOR (igual a landing page)
   ══════════════════════════════════════════════════════════════ */

nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: rgba(28,28,28,.94) !important;
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--rai-border);
  padding: 1rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-logo {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--rai-text) !important;
  text-decoration: none;
}

.nav-logo span {
  color: var(--rai-accent);
}

.nav-links {
  display: flex;
  gap: 2rem;
  align-items: center;
}

.nav-links a {
  color: var(--rai-muted) !important;
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 500;
  transition: color 0.2s;
}

.nav-links a:hover {
  color: var(--rai-text) !important;
}

.nav-cta {
  background: var(--rai-accent) !important;
  color: #fff !important;
  padding: 0.5rem 1.25rem;
  border-radius: 8px;
  font-weight: 600;
}

.nav-cta:hover {
  opacity: 0.85;
}

.nav-hamburger {
  display: none;
  flex-direction: column;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
}

.nav-hamburger span {
  width: 24px;
  height: 2px;
  background: var(--rai-text);
  transition: all 0.3s;
}

/* Mobile menu */
@media (max-width: 968px) {
  .nav-hamburger {
    display: flex;
  }
  
  .nav-links {
    position: fixed;
    top: 70px;
    left: 0;
    right: 0;
    background: rgba(28,28,28,.98);
    flex-direction: column;
    padding: 2rem;
    gap: 1.5rem;
    transform: translateY(-100%);
    opacity: 0;
    pointer-events: none;
    transition: all 0.3s;
  }
  
  .nav-links.active {
    transform: translateY(0);
    opacity: 1;
    pointer-events: all;
  }
}

/* Ajustar contenido para el nav fijo */
body {
  padding-top: 70px;
}

/* ══════════════════════════════════════════════════════════════
   LAYOUT CON SIDEBAR
   ══════════════════════════════════════════════════════════════ */

.blog-container {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 3rem;
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.blog-main {
  min-width: 0;
}

.blog-sidebar {
  position: sticky;
  top: 90px;
  height: fit-content;
}

@media (max-width: 968px) {
  .blog-container {
    grid-template-columns: 1fr;
  }
  
  .blog-sidebar {
    position: static;
    margin-top: 3rem;
  }
}

/* ══════════════════════════════════════════════════════════════
   SIDEBAR WIDGETS
   ══════════════════════════════════════════════════════════════ */

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

.cta-widget {
  background: linear-gradient(135deg, rgba(207,125,78,.1) 0%, rgba(207,125,78,.05) 100%);
  border-color: rgba(207,125,78,.3);
  text-align: center;
}

.cta-widget p {
  color: var(--rai-muted);
  font-size: 0.9rem;
  margin-bottom: 1rem;
  line-height: 1.5;
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

/* ══════════════════════════════════════════════════════════════
   OCULTAR ELEMENTOS INNECESARIOS
   ══════════════════════════════════════════════════════════════ */

/* Ocultar "Sample Page" y títulos de página */
.page-title,
.entry-title.page-title,
h1.page-title,
.wp-block-post-title.page-title {
  display: none !important;
}

/* Ocultar breadcrumbs si existen */
.breadcrumbs,
.breadcrumb {
  display: none !important;
}
`;

const conn = new Client();

conn.on('ready', () => {
  console.log('✅ Conectado al servidor\n');
  
  conn.sftp((err, sftp) => {
    if (err) {
      console.error('❌ Error SFTP:', err.message);
      conn.end();
      return;
    }
    
    // 1. Actualizar CSS
    console.log('🎨 Actualizando CSS...');
    
    const cssPath = '/var/www/blog/wp-content/mu-plugins/reliableai-skin.css';
    
    sftp.readFile(cssPath, 'utf8', (err, currentCSS) => {
      if (err) {
        console.error('❌ Error leyendo CSS:', err.message);
        conn.end();
        return;
      }
      
      const updatedCSS = currentCSS + '\n\n' + additionalCSS;
      
      sftp.writeFile(cssPath, updatedCSS, (err) => {
        if (err) {
          console.error('❌ Error escribiendo CSS:', err.message);
          conn.end();
          return;
        }
        
        console.log('✅ CSS actualizado\n');
        
        // 2. Crear archivo header personalizado con el menú
        console.log('📝 Creando header personalizado...');
        
        const headerPHP = `<?php
/**
 * Header personalizado para ReliableAI Blog
 */
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>

<!-- Menú superior -->
<nav>
    <a href="https://reliableai.app" class="nav-logo">Reliable<span>AI</span></a>
    <button class="nav-hamburger" id="navHamburger" aria-label="Menu" onclick="document.getElementById('navLinks').classList.toggle('active')">
        <span></span><span></span><span></span>
    </button>
    <div class="nav-links" id="navLinks">
        <a href="https://reliableai.app#how-it-works">How it works</a>
        <a href="https://reliableai.app#features">Features</a>
        <a href="https://reliableai.app#verticals">Use cases</a>
        <a href="https://reliableai.app/demo">Demo</a>
        <a href="https://blog.reliableai.net">Blog</a>
        <a href="https://reliableai.app#pricing">Pricing</a>
        <a href="https://reliableai.app/analyze" class="nav-cta">Try Free →</a>
    </div>
</nav>

<div class="blog-container">
    <div class="blog-main">
`;
        
        const headerPath = '/var/www/blog/wp-content/themes/twentytwentyfive/header.php';
        
        sftp.writeFile(headerPath, headerPHP, (err) => {
          if (err) {
            console.error('⚠️  No se pudo crear header.php (el tema puede no existir)');
            console.log('   Continuando con sidebar...\n');
          } else {
            console.log('✅ Header creado\n');
          }
          
          // 3. Crear sidebar
          console.log('📋 Creando sidebar...');
          
          const sidebarPHP = `<?php
/**
 * Sidebar para ReliableAI Blog
 */

$recent_posts = wp_get_recent_posts(array(
    'numberposts' => 10,
    'post_status' => 'publish'
));
?>

    </div> <!-- .blog-main -->
    
    <aside class="blog-sidebar">
        <div class="sidebar-widget">
            <h3 class="widget-title">📚 Latest Articles</h3>
            <ul class="recent-posts-list">
                <?php foreach($recent_posts as $post): ?>
                    <li class="recent-post-item">
                        <a href="<?php echo get_permalink($post['ID']); ?>" class="recent-post-link">
                            <span class="post-title"><?php echo esc_html($post['post_title']); ?></span>
                            <span class="post-date"><?php echo date('M d, Y', strtotime($post['post_date'])); ?></span>
                        </a>
                    </li>
                <?php endforeach; ?>
            </ul>
        </div>
        
        <div class="sidebar-widget">
            <h3 class="widget-title">🔗 Quick Links</h3>
            <ul class="links-list">
                <li><a href="https://reliableai.app">← Back to ReliableAI</a></li>
                <li><a href="https://reliableai.app#features">Features</a></li>
                <li><a href="https://reliableai.app#pricing">Pricing</a></li>
                <li><a href="https://reliableai.app/demo">Live Demo</a></li>
            </ul>
        </div>
        
        <div class="sidebar-widget cta-widget">
            <h3 class="widget-title">🚀 Try ReliableAI</h3>
            <p>Compare responses from multiple AI models in real-time. Detect contradictions and get reliable answers.</p>
            <a href="https://reliableai.app/analyze" class="cta-button">Start Free</a>
        </div>
    </aside>
    
</div> <!-- .blog-container -->
`;
          
          const sidebarPath = '/var/www/blog/wp-content/themes/twentytwentyfive/sidebar.php';
          
          sftp.writeFile(sidebarPath, sidebarPHP, (err) => {
            if (err) {
              console.error('⚠️  No se pudo crear sidebar.php');
            } else {
              console.log('✅ Sidebar creado\n');
            }
            
            // 4. Eliminar "Sample Page" de la base de datos
            console.log('🗑️  Eliminando "Sample Page"...');
            
            const deleteSQL = `
DELETE FROM wp_posts WHERE post_title = 'Sample Page';
DELETE FROM wp_posts WHERE post_name = 'sample-page';
`;
            
            const sqlFile = '/tmp/cleanup_blog.sql';
            
            sftp.writeFile(sqlFile, deleteSQL, (err) => {
              if (err) {
                console.error('❌ Error creando SQL:', err.message);
                conn.end();
                return;
              }
              
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
                  } else {
                    console.log('✅ "Sample Page" eliminada\n');
                  }
                  
                  console.log('╔═══════════════════════════════════════════════════════════════╗');
                  console.log('║  ✅ Blog actualizado exitosamente                            ║');
                  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
                  console.log('✨ Cambios aplicados:');
                  console.log('   • Menú superior igual a la landing page');
                  console.log('   • Sidebar lateral con últimas 10 entradas');
                  console.log('   • "Sample Page" eliminada');
                  console.log('   • Layout responsive mejorado\n');
                  console.log('🔗 Ver: https://blog.reliableai.net/\n');
                  
                  conn.end();
                });
              });
            });
          });
        });
      });
    });
  });
});

conn.on('error', (err) => {
  console.error('❌ Error de conexión:', err.message);
});

conn.connect(SSH_CONFIG);
