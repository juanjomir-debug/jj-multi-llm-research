#!/usr/bin/env node
/**
 * test-resistone.js — Test del método con 2 directorios de Resistone
 * Correcciones aplicadas según diagnóstico de visión
 */

const { createBot, STATE } = require('./bot-engine');
const path = require('path');

const BIZ = {
  name: 'Resistone Microcemento',
  razonSocial: 'Ipetel Adquisiciones S.L.',
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
  nif: '12345678Z', // DNI ficticio válido para formularios que lo requieren
  description: 'Fabricantes de microcemento desde 2008. Especialistas en microcemento para suelos, paredes, baños y cocinas.',
  description_long: 'Resistone es fabricante de microcemento de alta calidad desde 2008, con más de 20 años de experiencia. Fabricamos el mejor producto del mercado gracias a un proceso de mejora continua, consiguiendo las más altas prestaciones y resistencias. Disponemos de una amplia gama de productos: listos al uso, Microcemento Epoxi, tradicional y Ecológico. Aplicables en suelos, paredes, muebles, baños, cocinas y exteriores. Cualquier color, sin juntas. Contamos con aplicadores propios con amplia experiencia. Showroom en Madrid.',
  category: 'Reformas', // Categoría genérica que existe en todos los catálogos
  keywords: 'microcemento, microcemento Madrid, fabricantes microcemento, microcemento suelos, microcemento baños',
  companySize: 'De 1 a 10 empleados', // Para formularios que lo requieren
  founded: '2008',
  password: 'Resistone2024!',
};

const DIRECTORIES = [
  {
    id: 'habitissimo',
    name: 'Habitissimo.es',
    url: 'https://www.habitissimo.es/registrar/empresa',
    async submit(bot) {
      const { page, log, goto, fillField, selectOption, clickBtn, checkProgress, screenshot } = bot;
      
      log(`[start] ${this.name}`);
      
      // Estrategia: SPA con JS asíncrono
      await goto(this.url, 'spa');
      
      // CRÍTICO: Cerrar modal de cookies manualmente si sigue visible
      log('[cookies] Intentando cerrar modal manualmente...');
      
      // Intentar click en botón de cerrar (X) del modal
      const closeButtons = [
        'button[aria-label*="close" i]',
        'button[aria-label*="cerrar" i]',
        '[class*="close"]',
        '[class*="dismiss"]',
        'button:has-text("×")',
        'button:has-text("✕")',
      ];
      
      for (const sel of closeButtons) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 500 })) {
            await btn.click();
            log(`[cookies:closed] Modal cerrado con: ${sel}`);
            await page.waitForTimeout(1500);
            break;
          }
        } catch {}
      }
      
      // Verificar que el modal desapareció
      const modalGone = await page.evaluate(() => {
        const modals = document.querySelectorAll('[class*="modal"], [class*="overlay"], [role="dialog"]');
        return [...modals].every(el => !el.offsetParent);
      });
      
      if (!modalGone) {
        log('[warn] Modal puede seguir visible — intentando forzar con ESC');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
      }
      
      await screenshot('hab-initial');
      
      // Paso 1: ¿A qué te dedicas? + ¿Dónde trabajas?
      log('[step:1/2] Rellenando categoría y ubicación');
      
      // Categoría: usar "Reformas" (genérica, existe en catálogo)
      const categoryFilled = await fillField(
        ['¿A qué te dedicas?', 'Categoría', 'categoria', 'input[placeholder*="categoría" i]'],
        BIZ.category
      );
      if (!categoryFilled) {
        log('[warn] No se encontró campo de categoría');
      }
      
      // Ubicación
      await fillField(
        ['¿Dónde trabajas?', 'Ubicación', 'ubicacion', 'input[placeholder*="ubicación" i]', 'input[placeholder*="ciudad" i]'],
        `${BIZ.city}, ${BIZ.province}`
      );
      
      // Click "Conseguir trabajos" o "Continuar"
      await clickBtn(['Conseguir trabajos', 'Continuar', 'Siguiente']);
      await page.waitForTimeout(2000);
      
      // Esperar a que aparezca el paso 2
      await page.waitForSelector('#company-name, input[name="company_name"]', { timeout: 10000 }).catch(() => {});
      
      log('[step:2/2] Rellenando datos de empresa');
      
      // Paso 2: Datos de empresa
      await fillField(['#company-name', 'Nombre de empresa', 'input[name="company_name"]'], BIZ.name);
      await fillField(['#name', 'Nombre', 'input[name="name"]'], 'Resistone');
      await fillField(['input[name="email"]', 'Email', 'Correo'], BIZ.email);
      await fillField(['#phone', 'Teléfono', 'input[name="phone"]'], BIZ.phone);
      await fillField(['#password', 'Contraseña', 'input[name="password"]'], BIZ.password);
      
      // CRÍTICO: Campo "Tamaño de empresa" detectado por visión
      const sizeFilled = await selectOption(
        ['select[name="company_size"]', 'select[id*="size" i]', '#company-size'],
        BIZ.companySize
      );
      if (!sizeFilled) {
        // Intentar como input de texto si no es select
        await fillField(['Tamaño de empresa', 'company_size', 'input[name="company_size"]'], BIZ.companySize);
      }
      
      // Checkbox términos
      await clickBtn(['#third-party', 'input[name="third_party"]', 'input[type="checkbox"]']);
      
      await screenshot('hab-filled', true, 'Habitissimo formulario relleno antes de submit');
      
      const prevUrl = page.url();
      await clickBtn(['Regístrate ahora', 'Registrar', 'Crear cuenta']);
      await page.waitForTimeout(4000);
      
      const result = await screenshot('hab-after', true, 'Habitissimo tras hacer submit');
      const progress = await checkProgress(prevUrl);
      
      log(`[result] ${this.name} — ${progress}`);
      
      if (result.analysis) {
        log(`[vision] state=${result.analysis.state}, errors=${result.analysis.errors.length}`);
        if (result.analysis.errors.length) {
          log(`[vision:errors] ${result.analysis.errors.join(' | ')}`);
        }
      }
      
      return progress;
    }
  },
  
  {
    id: 'certicalia',
    name: 'Certicalia.com',
    url: 'https://www.certicalia.com/usuarios/registro-profesional',
    async submit(bot) {
      const { page, log, goto, fillField, selectOption, clickBtn, checkProgress, screenshot } = bot;
      
      log(`[start] ${this.name}`);
      
      await goto(this.url, 'fast');
      await screenshot('cert-initial');
      
      // Esperar a que el overlay de cookies desaparezca completamente
      await page.waitForFunction(() => {
        const overlays = document.querySelectorAll('[class*="cookie"], [class*="consent"], [id*="cookie"]');
        return [...overlays].every(el => {
          const s = getComputedStyle(el);
          return s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0';
        });
      }, { timeout: 5000 }).catch(() => {});
      
      await page.waitForTimeout(1500);
      
      log('[filling] Rellenando formulario por IDs directos');
      
      // Usar IDs directos (componente Vue/React sin <form> HTML)
      await fillField(['#nombre-input'], 'Resistone');
      await fillField(['#apellidos-input'], 'Microcemento');
      await fillField(['#one_step_email'], BIZ.email);
      await fillField(['#telefono-input'], BIZ.phone);
      await fillField(['#password-input'], BIZ.password);
      
      // CRÍTICO: NIF es required — usar DNI ficticio válido
      await fillField(['#documentacion-input'], BIZ.nif);
      
      // Código postal
      await fillField(['#codigo-postal-input'], BIZ.zip);
      
      // CRÍTICO: razon-social está disabled hasta rellenar CP — esperar 1.5s
      await page.waitForTimeout(1500);
      
      await fillField(['#razon-social-input'], BIZ.name);
      
      // CRÍTICO: Campo "Tamaño de la empresa" es required (detectado por visión)
      log('[filling] Rellenando campo Tamaño de empresa');
      
      // Intentar como select primero
      const sizeOptions = ['De 1 a 10 empleados', '1-10 empleados', 'Micro (1-10)', 'Pequeña', '1-10'];
      let sizeFilled = false;
      
      for (const opt of sizeOptions) {
        sizeFilled = await selectOption(
          ['select[name*="size" i]', 'select[id*="size" i]', 'select[name*="tamano" i]', '#company-size'],
          opt
        );
        if (sizeFilled) {
          log(`[success] Tamaño de empresa: ${opt}`);
          break;
        }
      }
      
      // Si no es select, buscar como input/radio
      if (!sizeFilled) {
        // Intentar click en radio button
        for (const opt of sizeOptions) {
          const clicked = await clickBtn([
            `input[type="radio"][value*="${opt}" i]`,
            `label:has-text("${opt}")`,
          ]);
          if (clicked) {
            log(`[success] Tamaño de empresa (radio): ${opt}`);
            sizeFilled = true;
            break;
          }
        }
      }
      
      if (!sizeFilled) {
        log('[warn] No se pudo rellenar campo Tamaño de empresa');
      }
      
      await screenshot('cert-filled', true, 'Certicalia formulario relleno antes de submit');
      
      const prevUrl = page.url();
      await clickBtn(['button[type="submit"]', 'Registrarme gratis', 'Registrar']);
      await page.waitForTimeout(4000);
      
      const result = await screenshot('cert-after', true, 'Certicalia tras hacer submit');
      const progress = await checkProgress(prevUrl);
      
      log(`[result] ${this.name} — ${progress}`);
      
      if (result.analysis) {
        log(`[vision] state=${result.analysis.state}, errors=${result.analysis.errors.length}`);
        if (result.analysis.errors.length) {
          log(`[vision:errors] ${result.analysis.errors.join(' | ')}`);
        }
      }
      
      return progress;
    }
  },
];

(async () => {
  console.log('=== TEST RESISTONE — 2 DIRECTORIOS ===\n');
  
  const bot = await createBot({
    headless: false, // Visible para debugging
    screenshotsDir: path.join(__dirname, 'screenshots'),
    logFile: path.join(__dirname, 'test-resistone.log'),
  });
  
  const results = [];
  
  for (const dir of DIRECTORIES) {
    try {
      const result = await bot.withRetry(dir.id, async () => {
        return await dir.submit(bot);
      }, 2);
      
      results.push({ id: dir.id, name: dir.name, result });
      
      // Pausa entre directorios
      await bot.page.waitForTimeout(3000);
    } catch (err) {
      bot.log(`[error] ${dir.name} — ${err.message}`);
      results.push({ id: dir.id, name: dir.name, result: `error — ${err.message}` });
    }
  }
  
  await bot.browser.close();
  
  console.log('\n=== RESULTADOS ===\n');
  for (const r of results) {
    console.log(`${r.name}: ${r.result}`);
  }
  
  console.log('\n✅ Test completado. Revisar capturas en screenshots/ y log en test-resistone.log');
})();
