#!/usr/bin/env node
// submit-resistone.js — Registra microcemento.org en directorios españoles
// Uso: node submit-resistone.js [--dry-run] [--only habitissimo]

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

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
  password: 'Resistone2024!',
};

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const LOG_FILE = path.join(__dirname, 'submissions-resistone.log');

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

const isDryRun = process.argv.includes('--dry-run');
const onlyTarget = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Acepta cookie banners — patrones en español e inglés */
async function acceptCookies(page) {
  const patterns = [
    // Español
    'button:has-text("Aceptar todo")',
    'button:has-text("Aceptar todas")',
    'button:has-text("Aceptar cookies")',
    'button:has-text("Aceptar")',
    'button:has-text("Acepto")',
    'a:has-text("Aceptar todo")',
    'a:has-text("Aceptar")',
    // Inglés
    'button:has-text("Accept all")',
    'button:has-text("Accept All")',
    'button:has-text("Accept")',
    'button:has-text("OK")',
    'button:has-text("Got it")',
    'button:has-text("I agree")',
    // Genéricos por atributo
    'button[id*="accept" i]',
    'button[class*="accept" i]',
    'button[id*="cookie" i]',
    '[aria-label*="accept" i]',
    '[data-testid*="accept" i]',
    // Patrones de CMP comunes (OneTrust, Cookiebot, etc.)
    '#onetrust-accept-btn-handler',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
    '.cc-accept',
    '.cookie-accept',
  ];
  for (const sel of patterns) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click();
        await page.waitForTimeout(1200);
        log(`[cookies] accepted via: ${sel}`);
        return true;
      }
    } catch {}
  }
  return false;
}

/** Espera a que la página esté estable (networkidle + sin spinners) */
async function waitReady(page, timeout = 15000) {
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
  await page.waitForFunction(() => {
    const spinners = document.querySelectorAll('[class*="spinner"], [class*="loader"], [class*="loading"], [class*="overlay"]');
    return [...spinners].every(el => {
      const s = getComputedStyle(el);
      return s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0';
    });
  }, { timeout: 5000 }).catch(() => {});
}

/** Rellena campo buscando por label > placeholder > selector CSS */
async function fillField(page, hints, value) {
  for (const hint of hints) {
    // Por label (más robusto y accesible)
    try {
      const byLabel = page.getByLabel(hint, { exact: false });
      if (await byLabel.first().isVisible({ timeout: 1500 })) {
        await byLabel.first().fill(value);
        return true;
      }
    } catch {}
    // Por placeholder
    try {
      const byPlaceholder = page.getByPlaceholder(hint, { exact: false });
      if (await byPlaceholder.first().isVisible({ timeout: 1500 })) {
        await byPlaceholder.first().fill(value);
        return true;
      }
    } catch {}
    // Por selector CSS (solo si el hint parece un selector)
    if (hint.startsWith('[') || hint.startsWith('#') || hint.startsWith('.') || hint.startsWith('input') || hint.startsWith('textarea')) {
      try {
        const el = page.locator(hint).first();
        if (await el.isVisible({ timeout: 1500 })) {
          await el.fill(value);
          return true;
        }
      } catch {}
    }
  }
  return false;
}

/** Click buscando por texto de botón o selector */
async function clickBtn(page, hints) {
  for (const hint of hints) {
    try {
      const byRole = page.getByRole('button', { name: hint, exact: false });
      if (await byRole.first().isVisible({ timeout: 1500 })) {
        await byRole.first().click();
        return true;
      }
    } catch {}
    try {
      const el = page.locator(hint).first();
      if (await el.isVisible({ timeout: 1500 })) {
        await el.click();
        return true;
      }
    } catch {}
  }
  return false;
}

/** Verifica si avanzamos: compara URL y busca confirmación en el contenido */
async function checkProgress(page, prevUrl) {
  const newUrl = page.url();
  const content = await page.content();
  const confirmKeywords = ['gracias', 'thank', 'success', 'éxito', 'confirmado', 'registrado', 'enviado', 'submitted', 'verificar', 'verifica tu email', 'check your email'];
  const errorKeywords = ['error', 'inválido', 'invalid', 'requerido', 'required', 'ya existe', 'already exists'];

  if (confirmKeywords.some(k => content.toLowerCase().includes(k))) return 'confirmed';
  if (errorKeywords.some(k => content.toLowerCase().includes(k))) return 'error_visible';
  if (newUrl !== prevUrl) return `navigated_to:${newUrl}`;
  return 'no_change';
}

// ── Directorios ───────────────────────────────────────────────────────────────
const DIRECTORIES = [

  {
    id: 'habitissimo',
    name: 'Habitissimo.es',
    submitUrl: 'https://www.habitissimo.es/empresas/registro',  // /pro/registro redirige a directorio
    async submit(page) {
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitReady(page);
      // CRÍTICO: aceptar cookies antes de interactuar con el formulario
      await acceptCookies(page);
      await page.waitForTimeout(1500);

      // Habitissimo tiene un formulario de registro multi-campo
      // Esperar a que el formulario sea visible
      await page.waitForSelector('form', { timeout: 10000 }).catch(() => {});

      await fillField(page, ['Correo electrónico', 'Email', 'email', 'input[name="email"]', 'input[type="email"]'], BIZ.email);
      await fillField(page, ['Nombre', 'Nombre de empresa', 'name', 'input[name="name"]', 'input[name="company_name"]'], BIZ.name);
      await fillField(page, ['Teléfono', 'phone', 'input[name="phone"]', 'input[type="tel"]'], BIZ.phone);
      await fillField(page, ['Contraseña', 'Password', 'password', 'input[name="password"]', 'input[type="password"]'], BIZ.password);

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'resistone-habitissimo.png') });

      if (!isDryRun) {
        const prevUrl = page.url();
        await clickBtn(page, ['Registrar', 'Crear cuenta', 'Continuar', 'Siguiente', 'button[type="submit"]']);
        await page.waitForTimeout(4000);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'resistone-habitissimo-after.png') });
        const progress = await checkProgress(page, prevUrl);
        if (progress === 'confirmed') return 'confirmed — pendiente_verificacion_email';
        if (progress === 'error_visible') return 'error_visible — revisar captura';
        return progress;
      }
      return 'dry-run';
    }
  },

  {
    id: 'houzz',
    name: 'Houzz.es',
    submitUrl: 'https://www.houzz.es/pro/signup',
    async submit(page) {
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitReady(page);
      await acceptCookies(page);
      await page.waitForTimeout(1500);

      await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 }).catch(() => {});

      await fillField(page, ['Correo electrónico', 'Email', 'input[type="email"]', 'input[name="email"]'], BIZ.email);
      await fillField(page, ['Contraseña', 'Password', 'input[type="password"]', 'input[name="password"]'], BIZ.password);
      await fillField(page, ['Nombre', 'First name', 'firstName', 'input[name="firstName"]'], 'Resistone');
      await fillField(page, ['Apellidos', 'Last name', 'lastName', 'input[name="lastName"]'], 'Microcemento');

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'resistone-houzz.png') });

      if (!isDryRun) {
        const prevUrl = page.url();
        await clickBtn(page, ['Registrar', 'Crear cuenta', 'Sign up', 'button[type="submit"]']);
        await page.waitForTimeout(5000);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'resistone-houzz-after.png') });
        const progress = await checkProgress(page, prevUrl);
        if (progress === 'confirmed') return 'confirmed — pendiente_verificacion_email';
        return progress;
      }
      return 'dry-run';
    }
  },

  {
    id: 'certicalia',
    name: 'Certicalia.com',
    submitUrl: 'https://www.certicalia.com/usuarios/registro-profesional',  // /registro-empresa da 404
    async submit(page) {
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitReady(page);
      // CRÍTICO: Certicalia tiene overlay verde de cookies que bloquea el formulario
      await acceptCookies(page);
      await page.waitForTimeout(2000);

      // Verificar que el overlay desapareció
      const overlayGone = await page.waitForFunction(() => {
        const overlays = document.querySelectorAll('[class*="cookie"], [class*="consent"], [id*="cookie"], [id*="consent"]');
        return [...overlays].every(el => getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden');
      }, { timeout: 5000 }).catch(() => null);

      if (!overlayGone) log('[warn] certicalia: overlay puede seguir visible');

      await page.waitForSelector('form', { timeout: 10000 }).catch(() => {});

      await fillField(page, ['Email', 'Correo', 'input[name="email"]', 'input[type="email"]'], BIZ.email);
      await fillField(page, ['Empresa', 'Nombre de empresa', 'company', 'input[name="company"]', 'input[name="company_name"]'], BIZ.name);
      await fillField(page, ['Teléfono', 'phone', 'input[name="phone"]', 'input[type="tel"]'], BIZ.phone);
      await fillField(page, ['Web', 'Página web', 'website', 'input[name="web"]', 'input[type="url"]'], BIZ.url);
      await fillField(page, ['Contraseña', 'Password', 'input[name="password"]', 'input[type="password"]'], BIZ.password);

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'resistone-certicalia.png') });

      if (!isDryRun) {
        const prevUrl = page.url();
        await clickBtn(page, ['Registrar', 'Crear cuenta', 'button[type="submit"]']);
        await page.waitForTimeout(4000);
        const progress = await checkProgress(page, prevUrl);
        if (progress === 'confirmed') return 'confirmed — pendiente_verificacion_email';
        return progress;
      }
      return 'dry-run';
    }
  },

  {
    id: 'paginas_amarillas',
    name: 'Páginas Amarillas',
    submitUrl: 'https://www.paginasamarillas.es/alta-empresa',
    async submit(page) {
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitReady(page);
      // CRÍTICO: Páginas Amarillas tiene modal naranja de cookies
      await acceptCookies(page);
      await page.waitForTimeout(2000);

      // Esperar a que el modal desaparezca completamente
      await page.waitForFunction(() => {
        const modals = document.querySelectorAll('[class*="modal"], [class*="overlay"], [class*="cookie"]');
        return [...modals].every(el => {
          const s = getComputedStyle(el);
          return s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0';
        });
      }, { timeout: 6000 }).catch(() => {});

      await page.waitForSelector('form, input', { timeout: 10000 }).catch(() => {});

      await fillField(page, ['Empresa', 'Nombre de empresa', 'company', 'input[name="company"]', 'input[id*="company" i]'], BIZ.name);
      await fillField(page, ['Teléfono', 'phone', 'input[name="phone"]', 'input[type="tel"]'], BIZ.phone);
      await fillField(page, ['Email', 'Correo', 'input[name="email"]', 'input[type="email"]'], BIZ.email);
      await fillField(page, ['Dirección', 'address', 'input[name="address"]', 'input[placeholder*="dirección" i]'], BIZ.address);
      await fillField(page, ['Ciudad', 'Localidad', 'city', 'input[name="city"]', 'input[placeholder*="ciudad" i]'], BIZ.city);
      await fillField(page, ['Código postal', 'CP', 'zip', 'input[name="zip"]', 'input[name="postal_code"]'], BIZ.zip);
      await fillField(page, ['Web', 'Página web', 'input[name="web"]', 'input[type="url"]'], BIZ.url);

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'resistone-amarillas.png') });

      if (!isDryRun) {
        const prevUrl = page.url();
        await clickBtn(page, ['Dar de alta', 'Registrar', 'Enviar', 'button[type="submit"]']);
        await page.waitForTimeout(4000);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'resistone-amarillas-after.png') });
        return await checkProgress(page, prevUrl);
      }
      return 'dry-run';
    }
  },

  {
    id: 'yelp',
    name: 'Yelp.es',
    submitUrl: 'https://biz.yelp.es/signup',
    async submit(page) {
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitReady(page);
      // CRÍTICO: Yelp tiene cookie banner en zona inferior
      await acceptCookies(page);
      await page.waitForTimeout(1500);

      await page.waitForSelector('input[type="email"]', { timeout: 10000 }).catch(() => {});

      await fillField(page, ['Email', 'Correo electrónico', 'input[type="email"]', 'input[name="email"]'], BIZ.email);
      await fillField(page, ['Contraseña', 'Password', 'input[type="password"]', 'input[name="password"]'], BIZ.password);
      await fillField(page, ['Nombre', 'First name', 'input[name="name"]', 'input[name="first_name"]'], 'Resistone');

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'resistone-yelp.png') });

      if (!isDryRun) {
        const prevUrl = page.url();
        await clickBtn(page, ['Registrar', 'Sign up', 'Crear cuenta', 'button[type="submit"]']);
        await page.waitForTimeout(4000);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'resistone-yelp-after.png') });
        const progress = await checkProgress(page, prevUrl);
        if (progress === 'confirmed') return 'confirmed — pendiente_verificacion_email';
        return progress;
      }
      return 'dry-run';
    }
  },

  {
    id: 'europages',
    name: 'Europages.es',
    submitUrl: 'https://www.europages.es/registro-empresa',
    async submit(page) {
      // CRÍTICO: Europages carga con JS asíncrono — usar networkidle
      await page.goto(this.submitUrl, { waitUntil: 'networkidle', timeout: 45000 });
      await waitReady(page, 20000);
      await acceptCookies(page);
      await page.waitForTimeout(2000);

      // Esperar explícitamente a que aparezca un input
      const formVisible = await page.waitForSelector('input[type="email"], input[name="email"], form input', { timeout: 15000 }).catch(() => null);
      if (!formVisible) {
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'resistone-europages-debug.png') });
        return 'error — formulario no cargó (JS asíncrono), revisar captura debug';
      }

      await fillField(page, ['Email', 'Correo', 'input[type="email"]', 'input[name="email"]'], BIZ.email);
      await fillField(page, ['Empresa', 'Nombre de empresa', 'company', 'input[name="company"]'], BIZ.name);
      await fillField(page, ['Teléfono', 'phone', 'input[name="phone"]', 'input[type="tel"]'], BIZ.phone);
      await fillField(page, ['Web', 'Website', 'input[name="website"]', 'input[type="url"]'], BIZ.url);
      await fillField(page, ['País', 'Country', 'input[name="country"]', 'select[name="country"]'], 'España');
      await fillField(page, ['Contraseña', 'Password', 'input[type="password"]'], BIZ.password);

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'resistone-europages.png') });

      if (!isDryRun) {
        const prevUrl = page.url();
        await clickBtn(page, ['Registrar', 'Crear cuenta', 'button[type="submit"]']);
        await page.waitForTimeout(5000);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'resistone-europages-after.png') });
        const progress = await checkProgress(page, prevUrl);
        if (progress === 'confirmed') return 'confirmed — pendiente_verificacion_email';
        return progress;
      }
      return 'dry-run';
    }
  },

  {
    id: 'infobel',
    name: 'Infobel.es',
    submitUrl: 'https://www.infobel.com/es/spain/add_company',
    async submit(page) {
      // CRÍTICO: Infobel carga en blanco con JS — usar networkidle + espera larga
      await page.goto(this.submitUrl, { waitUntil: 'networkidle', timeout: 45000 });
      await waitReady(page, 20000);
      await acceptCookies(page);
      await page.waitForTimeout(2000);

      const formVisible = await page.waitForSelector('form input, input[name], input[type="text"]', { timeout: 15000 }).catch(() => null);
      if (!formVisible) {
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'resistone-infobel-debug.png') });
        return 'error — página en blanco, JS no ejecutó, revisar captura debug';
      }

      await fillField(page, ['Empresa', 'Company', 'Nombre', 'input[name="company"]', 'input[id*="company" i]'], BIZ.name);
      await fillField(page, ['Teléfono', 'Phone', 'input[name="phone"]', 'input[type="tel"]'], BIZ.phone);
      await fillField(page, ['Email', 'input[name="email"]', 'input[type="email"]'], BIZ.email);
      await fillField(page, ['Dirección', 'Address', 'input[name="address"]'], BIZ.address);
      await fillField(page, ['Ciudad', 'City', 'input[name="city"]'], BIZ.city);
      await fillField(page, ['Código postal', 'Zip', 'input[name="zip"]', 'input[name="postal"]'], BIZ.zip);
      await fillField(page, ['Web', 'Website', 'input[name="website"]', 'input[type="url"]'], BIZ.url);

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'resistone-infobel.png') });

      if (!isDryRun) {
        const prevUrl = page.url();
        await clickBtn(page, ['Enviar', 'Submit', 'Añadir empresa', 'button[type="submit"]']);
        await page.waitForTimeout(4000);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'resistone-infobel-after.png') });
        return await checkProgress(page, prevUrl);
      }
      return 'dry-run';
    }
  },

  {
    id: 'pinterest',
    name: 'Pinterest (perfil empresa)',
    submitUrl: 'https://www.pinterest.es/business/create/',
    async submit(page) {
      // NOTA: Pinterest usa OAuth (Google/Facebook) como método principal
      // El flujo de email directo puede estar disponible como alternativa
      await page.goto(this.submitUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await waitReady(page);
      await acceptCookies(page);
      await page.waitForTimeout(2000);

      // Buscar opción de registro con email (no OAuth)
      const emailOption = await clickBtn(page, [
        'Continuar con el correo electrónico',
        'Continue with email',
        'Usar correo electrónico',
        'Use email',
        'button:has-text("email")',
        'a:has-text("email")',
      ]);

      if (!emailOption) {
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'resistone-pinterest-debug.png') });
        log('[warn] pinterest: no se encontró opción de registro por email — puede requerir OAuth');
        return 'pendiente_intervencion_humana — Pinterest requiere OAuth (Google/Facebook), no automatizable';
      }

      await page.waitForTimeout(1500);
      await fillField(page, ['Email', 'Correo', 'input[type="email"]', 'input[name="email"]'], BIZ.email);
      await fillField(page, ['Contraseña', 'Password', 'input[type="password"]'], BIZ.password);
      await fillField(page, ['Nombre de empresa', 'Business name', 'input[name="business_name"]'], BIZ.name);

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'resistone-pinterest.png') });

      if (!isDryRun) {
        const prevUrl = page.url();
        await clickBtn(page, ['Crear cuenta', 'Crear', 'button[type="submit"]']);
        await page.waitForTimeout(4000);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'resistone-pinterest-after.png') });
        const progress = await checkProgress(page, prevUrl);
        if (progress === 'confirmed') return 'confirmed — pendiente_verificacion_email';
        return progress;
      }
      return 'dry-run';
    }
  },

];

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const submitted = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf-8') : '';
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--lang=es-ES',
    ],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
  });
  const page = await context.newPage();

  const targets = DIRECTORIES.filter(d => !onlyTarget || d.id === onlyTarget);

  for (const dir of targets) {
    if (submitted.includes(`DONE:${dir.id}`)) {
      log(`[skip] ${dir.name} — already submitted`);
      continue;
    }

    log(`[start] ${dir.name} — ${dir.submitUrl}`);
    let retries = 0;
    while (retries < 2) {
      try {
        const result = await dir.submit(page);
        log(`[DONE:${dir.id}] ${dir.name} — ${result}`);
        break;
      } catch (err) {
        retries++;
        log(`[error:attempt${retries}] ${dir.name} — ${err.message}`);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `error-resistone-${dir.id}-attempt${retries}.png`) }).catch(() => {});
        if (retries < 2) await page.waitForTimeout(3000);
      }
    }

    await new Promise(r => setTimeout(r, 4000 + Math.random() * 3000));
  }

  await browser.close();
  log('[done] All directories processed');
  log('[note] Directorios con pendiente_verificacion_email: revisar info@resistone.es');
  log('[note] Pinterest puede requerir intervención manual si solo ofrece OAuth');
})();
