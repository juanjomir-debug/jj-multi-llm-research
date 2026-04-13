#!/usr/bin/env node
// submit-resistone.js — Registra microcemento.org en directorios españoles
// Uso: node submit-resistone.js [--dry-run] [--only habitissimo]

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ── Datos de Resistone ────────────────────────────────────────────────────────
const BIZ = {
  name: 'Resistone Microcemento',
  url: 'https://www.microcemento.org',
  email: 'info@resistone.es',
  phone: '917528727',
  phone_formatted: '+34 917 528 727',
  address: 'C/ Carabaña, 32-3',
  city: 'Alcorcón',
  province: 'Madrid',
  zip: '28925',
  country: 'España',
  cif: 'B85123040',
  description_short: 'Fabricantes de microcemento desde 2008. Especialistas en microcemento para suelos, paredes, baños y cocinas. Aplicadores propios en Madrid.',
  description_long: `Resistone es fabricante de microcemento de alta calidad desde 2008, con más de 20 años de experiencia. Fabricamos el mejor producto del mercado gracias a un proceso de mejora continua, consiguiendo las más altas prestaciones y resistencias. Disponemos de una amplia gama de productos: listos al uso, Microcemento Epoxi, tradicional y Ecológico. Aplicables en suelos, paredes, muebles, baños, cocinas y exteriores. Cualquier color, sin juntas. Contamos con aplicadores propios con amplia experiencia. Showroom en Madrid.`,
  keywords: 'microcemento, microcemento Madrid, fabricantes microcemento, microcemento suelos, microcemento baños, microcemento cocinas, microcemento epoxi',
  category: 'Construcción / Reformas / Revestimientos',
  founded: '2008',
};

const LOG_FILE = path.join(__dirname, 'submissions-resistone.log');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

const isDryRun = process.argv.includes('--dry-run');
const onlyTarget = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

// ── Helper: fill field safely ─────────────────────────────────────────────────
async function fill(page, selectors, value) {
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 })) {
        await el.fill(value);
        return true;
      }
    } catch {}
  }
  return false;
}

async function click(page, selectors) {
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 })) {
        await el.click();
        return true;
      }
    } catch {}
  }
  return false;
}

// ── Directorios ───────────────────────────────────────────────────────────────
const DIRECTORIES = [

  {
    id: 'habitissimo',
    name: 'Habitissimo.es',
    submitUrl: 'https://www.habitissimo.es/pro/registro',
    async submit(page) {
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      await fill(page, ['input[name="email"]', 'input[type="email"]'], BIZ.email);
      await fill(page, ['input[name="name"]', 'input[placeholder*="nombre" i]'], BIZ.name);
      await fill(page, ['input[name="phone"]', 'input[type="tel"]'], BIZ.phone);
      await fill(page, ['input[name="password"]', 'input[type="password"]'], 'Resistone2024!');
      await page.screenshot({ path: `/tmp/resistone-habitissimo.png` });
      if (!isDryRun) {
        await click(page, ['button[type="submit"]', 'button:has-text("Registrar")', 'button:has-text("Crear cuenta")']);
        await page.waitForTimeout(4000);
        await page.screenshot({ path: `/tmp/resistone-habitissimo-after.png` });
      }
      return 'attempted';
    }
  },

  {
    id: 'houzz',
    name: 'Houzz.es',
    submitUrl: 'https://www.houzz.es/pro/signup',
    async submit(page) {
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      await fill(page, ['input[name="email"]', 'input[type="email"]'], BIZ.email);
      await fill(page, ['input[name="password"]', 'input[type="password"]'], 'Resistone2024!');
      await fill(page, ['input[name="firstName"]', 'input[placeholder*="nombre" i]'], 'Resistone');
      await fill(page, ['input[name="lastName"]', 'input[placeholder*="apellido" i]'], 'Microcemento');
      await page.screenshot({ path: `/tmp/resistone-houzz.png` });
      if (!isDryRun) {
        await click(page, ['button[type="submit"]', 'button:has-text("Registrar")']);
        await page.waitForTimeout(4000);
        await page.screenshot({ path: `/tmp/resistone-houzz-after.png` });
      }
      return 'attempted';
    }
  },

  {
    id: 'certicalia',
    name: 'Certicalia.com',
    submitUrl: 'https://www.certicalia.com/registro-empresa',
    async submit(page) {
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      await fill(page, ['input[name="email"]', 'input[type="email"]'], BIZ.email);
      await fill(page, ['input[name="company"]', 'input[placeholder*="empresa" i]'], BIZ.name);
      await fill(page, ['input[name="phone"]', 'input[type="tel"]'], BIZ.phone);
      await fill(page, ['input[name="web"]', 'input[placeholder*="web" i]', 'input[type="url"]'], BIZ.url);
      await page.screenshot({ path: `/tmp/resistone-certicalia.png` });
      if (!isDryRun) {
        await click(page, ['button[type="submit"]', 'button:has-text("Registrar")']);
        await page.waitForTimeout(4000);
      }
      return 'attempted';
    }
  },

  {
    id: 'paginas_amarillas',
    name: 'Páginas Amarillas',
    submitUrl: 'https://www.paginasamarillas.es/alta-empresa',
    async submit(page) {
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      await fill(page, ['input[name="company"]', 'input[placeholder*="empresa" i]', 'input[id*="company" i]'], BIZ.name);
      await fill(page, ['input[name="phone"]', 'input[type="tel"]'], BIZ.phone);
      await fill(page, ['input[name="email"]', 'input[type="email"]'], BIZ.email);
      await fill(page, ['input[name="address"]', 'input[placeholder*="dirección" i]'], BIZ.address);
      await fill(page, ['input[name="city"]', 'input[placeholder*="ciudad" i]'], BIZ.city);
      await fill(page, ['input[name="zip"]', 'input[placeholder*="código postal" i]'], BIZ.zip);
      await fill(page, ['input[name="web"]', 'input[type="url"]'], BIZ.url);
      await page.screenshot({ path: `/tmp/resistone-amarillas.png` });
      if (!isDryRun) {
        await click(page, ['button[type="submit"]', 'button:has-text("Dar de alta")']);
        await page.waitForTimeout(4000);
      }
      return 'attempted';
    }
  },

  {
    id: 'yelp',
    name: 'Yelp.es',
    submitUrl: 'https://biz.yelp.es/signup',
    async submit(page) {
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      await fill(page, ['input[name="email"]', 'input[type="email"]'], BIZ.email);
      await fill(page, ['input[name="password"]', 'input[type="password"]'], 'Resistone2024!');
      await fill(page, ['input[name="name"]', 'input[placeholder*="nombre" i]'], 'Resistone');
      await page.screenshot({ path: `/tmp/resistone-yelp.png` });
      if (!isDryRun) {
        await click(page, ['button[type="submit"]', 'button:has-text("Registrar")']);
        await page.waitForTimeout(4000);
      }
      return 'attempted';
    }
  },

  {
    id: 'europages',
    name: 'Europages.es',
    submitUrl: 'https://www.europages.es/registro-empresa',
    async submit(page) {
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      await fill(page, ['input[name="email"]', 'input[type="email"]'], BIZ.email);
      await fill(page, ['input[name="company"]', 'input[placeholder*="empresa" i]'], BIZ.name);
      await fill(page, ['input[name="phone"]', 'input[type="tel"]'], BIZ.phone);
      await fill(page, ['input[name="website"]', 'input[type="url"]'], BIZ.url);
      await fill(page, ['input[name="country"]'], 'España');
      await page.screenshot({ path: `/tmp/resistone-europages.png` });
      if (!isDryRun) {
        await click(page, ['button[type="submit"]', 'button:has-text("Registrar")']);
        await page.waitForTimeout(4000);
      }
      return 'attempted';
    }
  },

  {
    id: 'infobel',
    name: 'Infobel.es',
    submitUrl: 'https://www.infobel.com/es/spain/add_company',
    async submit(page) {
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      await fill(page, ['input[name="company"]', 'input[placeholder*="empresa" i]', 'input[id*="company" i]'], BIZ.name);
      await fill(page, ['input[name="phone"]', 'input[type="tel"]'], BIZ.phone);
      await fill(page, ['input[name="email"]', 'input[type="email"]'], BIZ.email);
      await fill(page, ['input[name="address"]'], BIZ.address);
      await fill(page, ['input[name="city"]'], BIZ.city);
      await fill(page, ['input[name="zip"]'], BIZ.zip);
      await fill(page, ['input[name="website"]', 'input[type="url"]'], BIZ.url);
      await page.screenshot({ path: `/tmp/resistone-infobel.png` });
      if (!isDryRun) {
        await click(page, ['button[type="submit"]']);
        await page.waitForTimeout(4000);
      }
      return 'attempted';
    }
  },

  {
    id: 'pinterest',
    name: 'Pinterest (perfil empresa)',
    submitUrl: 'https://www.pinterest.es/business/create/',
    async submit(page) {
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      await fill(page, ['input[name="email"]', 'input[type="email"]'], BIZ.email);
      await fill(page, ['input[name="password"]', 'input[type="password"]'], 'Resistone2024!');
      await fill(page, ['input[name="business_name"]', 'input[placeholder*="empresa" i]'], BIZ.name);
      await page.screenshot({ path: `/tmp/resistone-pinterest.png` });
      if (!isDryRun) {
        await click(page, ['button[type="submit"]', 'button:has-text("Crear")']);
        await page.waitForTimeout(4000);
      }
      return 'attempted';
    }
  },

];

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const submitted = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf-8') : '';
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'es-ES',
  });
  const page = await context.newPage();

  const targets = DIRECTORIES.filter(d => !onlyTarget || d.id === onlyTarget);

  for (const dir of targets) {
    if (submitted.includes(`DONE:${dir.id}`)) {
      log(`[skip] ${dir.name} — already submitted`);
      continue;
    }

    log(`[start] ${dir.name}`);
    try {
      const result = await dir.submit(page);
      log(`[DONE:${dir.id}] ${dir.name} — ${result}`);
    } catch (err) {
      log(`[error] ${dir.name} — ${err.message}`);
      await page.screenshot({ path: `/tmp/error-resistone-${dir.id}.png` }).catch(() => {});
    }

    await new Promise(r => setTimeout(r, 4000 + Math.random() * 3000));
  }

  await browser.close();
  log('[done] All directories processed');
  log(`[info] Screenshots saved in /tmp/resistone-*.png`);
  log(`[note] Most registrations require email verification — check info@resistone.es`);
})();
