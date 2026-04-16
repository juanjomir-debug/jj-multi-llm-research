#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateHeroImage(prompt) {
  console.log('🎨 Generando hero image con DALL-E...');
  
  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      size: '1792x1024',
      quality: 'hd',
      n: 1
    });
    
    const imageUrl = response.data[0].url;
    console.log('✅ Hero image generada:', imageUrl);
    return imageUrl;
  } catch (error) {
    console.error('❌ Error generando imagen:', error.message);
    return null;
  }
}

async function publishToBlog(article) {
  const BLOG_DIR = path.join(__dirname, 'public', 'blog');
  const POSTS_DIR = path.join(BLOG_DIR, 'posts');
  
  // Crear directorios
  if (!fs.existsSync(BLOG_DIR)) fs.mkdirSync(BLOG_DIR, { recursive: true });
  if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });
  
  // Extraer hero image prompt
  const heroMatch = article.response.match(/\[HERO_IMAGE:\s*([^\]]+)\]/);
  const heroPrompt = heroMatch ? heroMatch[1].trim() : null;
  
  let heroImageUrl = null;
  if (heroPrompt) {
    heroImageUrl = await generateHeroImage(heroPrompt);
  }
  
  // Extraer título y subtítulo
  const titleMatch = article.response.match(/^#\s+(.+)$/m);
  const subtitleMatch = article.response.match(/^\*(.+)\*$/m);
  
  const title = titleMatch ? titleMatch[1].trim() : 'AI and Employment: The Net Effect';
  const subtitle = subtitleMatch ? subtitleMatch[1].trim() : 'Analysis of the latest data, insights and trends';
  
  // Limpiar el contenido (quitar marcadores especiales)
  let content = article.response
    .replace(/\[HERO_IMAGE:[^\]]+\]/g, '')
    .replace(/\[OG_CARD\]/g, '')
    .replace(/\[CONSENSUS_CHART\]/g, '<div class="chart-placeholder">📊 Consensus Chart</div>')
    .trim();
  
  // Convertir markdown a HTML básico
  content = content
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, '<p>$1</p>')
    .replace(/<p><h/g, '<h')
    .replace(/<\/h[1-6]><\/p>/g, '')
    .replace(/<p><blockquote>/g, '<blockquote>')
    .replace(/<\/blockquote><\/p>/g, '</blockquote>')
    .replace(/<p><hr><\/p>/g, '<hr>');
  
  // Generar slug
  const slug = title
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  const date = new Date().toISOString().split('T')[0];
  const filename = `${date}-${slug}.html`;
  const filepath = path.join(POSTS_DIR, filename);
  
  // Generar HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | ReliableAI Blog</title>
  <meta name="description" content="${subtitle}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${subtitle}">
  <meta property="og:image" content="${heroImageUrl || 'https://reliableai.app/og-image.png'}">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${subtitle}">
  <meta name="twitter:image" content="${heroImageUrl || 'https://reliableai.app/og-image.png'}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; background: #fff; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 1rem 2rem; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header a { color: white; text-decoration: none; font-weight: 600; margin-right: 2rem; }
    .header .logo { font-size: 1.5rem; }
    .hero-image { width: 100%; max-height: 500px; overflow: hidden; margin-bottom: 2rem; }
    .hero-image img { width: 100%; height: 100%; object-fit: cover; }
    .container { max-width: 800px; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 2.5rem; margin: 1rem 0; line-height: 1.2; }
    h2 { font-size: 1.8rem; margin: 2rem 0 1rem; color: #667eea; }
    h3 { font-size: 1.4rem; margin: 1.5rem 0 0.5rem; }
    p { margin: 1rem 0; }
    .subtitle { font-size: 1.2rem; color: #666; font-style: italic; margin: 1rem 0 2rem; }
    .meta { color: #999; font-size: 0.9rem; margin: 1rem 0 2rem; padding-bottom: 1rem; border-bottom: 1px solid #eee; }
    blockquote { border-left: 4px solid #667eea; padding-left: 1rem; margin: 1.5rem 0; color: #555; font-style: italic; }
    .chart-placeholder { background: #f5f5f5; border: 2px dashed #ddd; padding: 3rem; text-align: center; font-size: 2rem; margin: 2rem 0; border-radius: 8px; }
    hr { border: none; border-top: 1px solid #eee; margin: 2rem 0; }
    .footer { background: #f9f9f9; padding: 2rem; text-align: center; margin-top: 3rem; border-top: 1px solid #eee; }
    .cta { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1rem 2rem; border-radius: 8px; text-decoration: none; display: inline-block; margin: 2rem 0; font-weight: 600; }
    .cta:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); }
  </style>
</head>
<body>
  <div class="header">
    <a href="/" class="logo">ReliableAI</a>
    <a href="/blog">Blog</a>
    <a href="/">App</a>
  </div>
  
  ${heroImageUrl ? `<div class="hero-image"><img src="${heroImageUrl}" alt="${title}"></div>` : ''}
  
  <div class="container">
    <article>
      ${content}
      
      <div class="footer">
        <a href="/" class="cta">Try ReliableAI Free</a>
        <p style="margin-top: 2rem; color: #999;">&copy; ${new Date().getFullYear()} ReliableAI. All rights reserved.</p>
      </div>
    </article>
  </div>
</body>
</html>`;
  
  fs.writeFileSync(filepath, html, 'utf-8');
  
  console.log('\n✅ Artículo publicado en el blog');
  console.log(`   Archivo: ${filename}`);
  console.log(`   URL: https://reliableai.app/blog/posts/${filename}`);
  
  return {
    title,
    subtitle,
    slug,
    filename,
    heroImageUrl,
    url: `https://reliableai.app/blog/posts/${filename}`
  };
}

function createTwitterThread(article, blogUrl) {
  const tweets = [];
  
  // Tweet 1: Hook
  tweets.push(`AI Won't Kill Jobs. It Will Kill *Your* Job.

The macro numbers look fine. The micro reality is brutal.

🧵 Thread on what 5 AI models agree (and violently disagree) about employment 👇`);
  
  // Tweet 2: The consensus
  tweets.push(`2/ Where ALL models agree:

• Net +78M jobs by 2030 (WEF)
• Middle-skill workers crushed
• AI skills = 23-56% salary premium

But here's where it gets interesting...`);
  
  // Tweet 3: The split
  tweets.push(`3/ The models split into 2 camps:

Camp 1 (GPT, Qwen, Grok): "Manageable disruption"
→ Temporary 0.3-0.6% unemployment bump

Camp 2 (Claude, Gemini): "Structural fracture"
→ The junior-to-senior pipeline is collapsing`);
  
  // Tweet 4: The pipeline problem
  tweets.push(`4/ The pipeline collapse is the scariest prediction:

If AI absorbs entry-level work, you never become a senior professional.

No junior analyst jobs → No senior analysts in 10 years

This isn't automation. It's destroying the apprenticeship ladder.`);
  
  // Tweet 5: The brutal stat
  tweets.push(`5/ The stat that matters:

77% of emerging AI roles require a master's degree or equivalent.

You can't retrain millions of admin workers into ML engineers in 2-3 years.

The math doesn't work.`);
  
  // Tweet 6: Gender gap
  tweets.push(`6/ What only ONE model mentioned:

79% of employed women in the US work in high-automation-risk positions vs 58% of men.

4.7% of women's jobs face severe AI disruption vs 2.4% for men.

This should have been raised by all of them.`);
  
  // Tweet 7: Winners and losers
  tweets.push(`7/ Winners:
• AI-fluent professionals
• Physical-skill workers (trades, healthcare)
• Early-adopter firms

Losers:
• Entry-level knowledge workers (Gen Z)
• Women in admin/support
• Workers in mid-size cities`);
  
  // Tweet 8: What's already happening
  tweets.push(`8/ This isn't theoretical:

• Amazon: 30,000+ positions eliminated
• Salesforce: 4,000 support roles cut
• MIT study: 11.7% of jobs could be automated TODAY

The gap between "could be" and "has been" is closing fast.`);
  
  // Tweet 9: Action items
  tweets.push(`9/ What to do:

Stop planning for the average. Plan for the distribution.

Audit every role for AI complementarity in the next 90 days.

Invest in skills at the intersection of AI fluency + human judgment.`);
  
  // Tweet 10: CTA
  tweets.push(`10/ Full article with all the data, charts, and blind spots:

${blogUrl}

Produced using @ReliableAI_app — 5 AI models researching independently.

#AI #FutureOfWork #Employment`);
  
  return tweets;
}

async function main() {
  const articleData = JSON.parse(fs.readFileSync('article-full.json', 'utf-8'));
  
  console.log('📝 Publicando artículo en el blog...\n');
  const blogPost = await publishToBlog(articleData);
  
  console.log('\n📱 Generando thread para Twitter...\n');
  const tweets = createTwitterThread(articleData, blogPost.url);
  
  const threadData = {
    title: blogPost.title,
    slug: blogPost.slug,
    blogUrl: blogPost.url,
    heroImage: blogPost.heroImageUrl,
    tweets,
    createdAt: new Date().toISOString(),
    published: false
  };
  
  fs.writeFileSync(`twitter-thread-${blogPost.slug}.json`, JSON.stringify(threadData, null, 2));
  
  console.log('✅ Thread guardado en:', `twitter-thread-${blogPost.slug}.json`);
  console.log(`\nTotal tweets: ${tweets.length}\n`);
  
  tweets.forEach((tweet, i) => {
    console.log(`--- Tweet ${i + 1} (${tweet.length} chars) ---`);
    console.log(tweet);
    console.log('');
  });
  
  console.log('\n🎉 ¡Proceso completado!');
  console.log(`\n📄 Blog: ${blogPost.url}`);
  console.log(`🐦 Thread listo para publicar en Twitter`);
}

main().catch(console.error);
