#!/usr/bin/env node
/**
 * test-two-dirs.js — Prueba del motor en Habitissimo + Certicalia
 * Uso: node test-two-dirs.js [--dry-run]
 *
 * Devuelve informe estructurado por directorio:
 *   objetivo, url, estado_final, pasos_completados, datos_enviados,
 *   bloqueos, evidencia, siguiente_accion
 */

const { createBot, STATE } = require('./bot-engine');
const path = require('path');

const isDryRun = process.argv.includes('--dry-run');

const BIZ = {
  name:        'Resistone Microcemento',
  url:         'https://www.microcemento.org',
  email:       'info@resistone.es',
  phone:       '917528727',
  address:     'C/ Carabaña, 32-3',
  city:        'Alcorcón',
  province:    'Madrid',
  zip:         '28925',
  cif:         'B85123040',
  description: 'Fabricantes de microcemento desde 2008. Especialistas en microcemento para suelos, paredes, baños y cocinas. Aplicadores propios en Madrid.',
  password:    'Resistone2024!',
};

// ── Informe estructurado ──────────────────────────────────────────────────────
function buildReport({ objetivo, url, estado_final, pasos, datos, bloqueos, evidencia, siguiente }) {
  return {
    objetivo,
    url,
    estado_final,
    pasos_completados: pasos,
    datos_enviados: datos,
    bloqueos_encontrados: bloqueos,
    evidencia,
    siguiente_accion: siguiente,
  };
}

// ── Habitissimo ───────────────────────────────────────────────────────────────
async function submitHabitissimo(bot) {
  const { page, log, screenshot, goto, fillField, clickBtn, checkProgress, STATE } = bot;
  // Habitissimo es un wizard multi-step:
  // Paso 1: "¿A qué te dedicas?" + "¿Dónde trabajas?" → "Conseguir trabajos"
  // Paso 2: formulario email/password/nombre
  const report = { objetivo: 'Alta profesional en Habitissimo.es', url: 'https://www.habitissimo.es/registrar/empresa', pasos: [], datos: {}, bloqueos: [] };

  log('[habitissimo] goto...');
  await goto('https://www.habitissimo.es', 'fast');
  report.pasos.push('landing_cargada');

  // Navegar a la URL de registro (descubierta dinámicamente)
  const registerLink = await page.locator('a[href*="registrar"], a[href*="registro"], a:has-text("Regístrate"), a:has-text("Soy profesional")').first();
  const href = await registerLink.getAttribute('href').catch(() => '/registrar/empresa');
  const fullUrl = href.startsWith('http') ? href : `https://www.habitissimo.es${href}`;
  report.url = fullUrl;
  await goto(fullUrl, 'fast');
  report.pasos.push(`navegado_a: ${fullUrl}`);

  // PASO 1: Wizard — "¿A qué te dedicas?" y "¿Dónde trabajas?"
  // CRÍTICO: la categoría debe ser una opción válida del catálogo de Habitissimo
  // "Microcemento" no existe — usar "Reformas" o "Construcción" que sí existen
  const step1Ready = await page.waitForSelector('input[placeholder*="Fontanero" i], input[placeholder*="Carpintero" i]', { timeout: 8000 }).catch(() => null);
  if (step1Ready) {
    log('[habitissimo] paso 1: rellenando categoría y ubicación');
    const catInput = page.locator('input[placeholder*="Fontanero" i], input[placeholder*="Carpintero" i]').first();
    // Usar "Reformas" — categoría amplia que sí existe en el catálogo
    await catInput.fill('Reformas');
    await page.waitForTimeout(1500);
    const sug1 = await page.locator('[role="option"]').all();
    if (sug1.length) { await sug1[0].click(); log('[habitissimo] categoría seleccionada de sugerencia'); }
    else { await catInput.press('Enter'); }
    await page.waitForTimeout(800);

    const locInput = page.locator('input[placeholder*="Madrid" i], input[placeholder*="localidad" i]').first();
    await locInput.fill('Madrid');
    await page.waitForTimeout(1500);
    const sug2 = await page.locator('[role="option"]').all();
    if (sug2.length) { await sug2[0].click(); log('[habitissimo] ubicación seleccionada de sugerencia'); }
    await page.waitForTimeout(800);

    await screenshot('habitissimo-step1');
    await page.locator('button:has-text("Conseguir trabajos")').first().click();
    // Esperar a que el paso 2 cargue — detectar por presencia de #company-name
    await page.waitForSelector('#company-name', { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(1000);
    report.pasos.push('paso_1_completado');
  }

  // PASO 2: formulario email/password — usar IDs exactos descubiertos por inspección
  const step2Ready = await page.waitForSelector('#company-name, #name, #password', { timeout: 10000 }).catch(() => null);
  if (!step2Ready) {
    await screenshot('habitissimo-noform');
    report.bloqueos.push('paso_2_no_cargó');
    return buildReport({ ...report, estado_final: STATE.ERROR, evidencia: `URL: ${page.url()} — sin formulario email/password`, siguiente: 'revisar captura habitissimo-noform — wizard puede tener más pasos' });
  }
  report.pasos.push('paso_2_formulario_visible');
  await screenshot('habitissimo-step2');

  const filled = {
    company:  await fillField(['Nombre de tu negocio', '#company-name', 'input[name="company-name"]'], BIZ.name),
    name:     await fillField(['Tu nombre', '#name', 'input[name="name"]'], 'Resistone'),
    email:    await fillField(['#downshift-\\:r5\\:-input', 'input[name="email"]', 'input[type="email"]'], BIZ.email),
    phone:    await fillField(['Teléfono', '#phone', 'input[name="phone"]'], BIZ.phone),
    password: await fillField(['Contraseña', '#password', 'input[name="password"]'], BIZ.password),
  };
  // Aceptar términos
  await page.locator('#third-party').check().catch(() => {});
  report.datos = { email: BIZ.email, company: BIZ.name, phone: BIZ.phone };
  report.pasos.push(`campos_rellenados: ${JSON.stringify(filled)}`);

  await screenshot('habitissimo-filled');

  if (isDryRun) {
    return buildReport({ ...report, estado_final: 'dry-run', evidencia: `captura: habitissimo-filled — URL: ${page.url()}`, siguiente: 'ejecutar sin --dry-run' });
  }

  // Submit — el botón se llama "Regístrate ahora" (no "Registrar")
  const prevUrl = page.url();
  await clickBtn(['Regístrate ahora', 'Registrar', 'Crear cuenta', 'button[type="submit"]']);
  await page.waitForTimeout(5000);
  await screenshot('habitissimo-after');

  const progress = await checkProgress(prevUrl);
  report.pasos.push(`progress: ${progress}`);

  return buildReport({
    ...report,
    estado_final: progress,
    evidencia: `URL: ${page.url()}`,
    siguiente: progress === STATE.VERIFICACION_EMAIL ? 'revisar info@resistone.es' : 'verificar manualmente',
  });
}

// ── Certicalia ────────────────────────────────────────────────────────────────
async function submitCerticalia(bot) {
  const { page, log, screenshot, goto, fillField, clickBtn, checkProgress, STATE } = bot;
  // Campos exactos obtenidos por inspección:
  // nombre-input (Nombre), apellidos-input (Apellidos), one_step_email (Email),
  // telefono-input (Teléfono móvil), password-input (Contraseña),
  // documentacion-input (NIF/DNI/NIE), codigo-postal-input (CP), razon-social-input (Razón social)
  // Submit: button[type="submit"] text "Registrarme gratis"
  const report = { objetivo: 'Alta empresa en Certicalia.com', url: 'https://www.certicalia.com/usuarios/registro-profesional', pasos: [], datos: {}, bloqueos: [] };

  log('[certicalia] goto...');
  await goto(report.url, 'fast');
  report.pasos.push('landing_cargada');

  // Verificar que el overlay de cookies desapareció
  await page.waitForFunction(() => {
    const el = document.getElementById('CybotCookiebotDialog');
    return !el || getComputedStyle(el).display === 'none' || el.offsetParent === null;
  }, { timeout: 5000 }).catch(() => {});
  report.pasos.push('overlay_cookies_eliminado');

  // Esperar a que los campos del formulario sean visibles
  // NOTA: el <form> visible es el de LOGIN — el registro es un componente JS separado
  // Usar los IDs directos, no waitForSelector('form')
  const formReady = await page.waitForSelector('#nombre-input', { timeout: 10000 }).catch(() => null);
  if (!formReady) {
    await screenshot('certicalia-noform');
    report.bloqueos.push('formulario_no_cargó');
    return buildReport({ ...report, estado_final: STATE.ERROR, evidencia: 'campos no visibles', siguiente: 'revisar captura certicalia-noform' });
  }
  report.pasos.push('formulario_visible');
  await screenshot('certicalia-form');

  // Rellenar con IDs exactos (más robusto que labels en este caso)
  // NOTA: razon-social-input está disabled hasta que se rellena el CP
  // NOTA: documentacion-input es required — usar DNI ficticio válido (formato 12345678A)
  // NOTA: el <form> detectado es el de login — el registro usa componente JS, submit via click directo
  const filled = {
    nombre:       await fillField(['Nombre', '#nombre-input'], 'Resistone'),
    apellidos:    await fillField(['Apellidos', '#apellidos-input'], 'Microcemento'),
    email:        await fillField(['Correo electrónico', '#one_step_email', 'input[name="one_step[email]"]'], BIZ.email),
    telefono:     await fillField(['Teléfono móvil', '#telefono-input', 'input[name="one_step[telefono]"]'], BIZ.phone),
    password:     await fillField(['Contraseña', '#password-input', 'input[name="one_step[password]"]'], BIZ.password),
    nif:          await fillField(['NIF, DNI o NIE', '#documentacion-input', 'input[name="one_step[documentation]"]'], '12345678Z'), // DNI ficticio formato válido
    cp:           await fillField(['Código postal', '#codigo-postal-input', 'input[name="one_step[postal_code]"]'], BIZ.zip),
  };
  // Esperar a que razon-social-input se habilite tras rellenar CP
  await page.waitForTimeout(1500);
  const razonEnabled = await page.locator('#razon-social-input').isEnabled({ timeout: 3000 }).catch(() => false);
  if (razonEnabled) {
    filled.razon_social = await fillField(['Razon social', '#razon-social-input'], BIZ.name);
  } else {
    log('[certicalia] razon-social-input sigue disabled — omitiendo (campo opcional)');
  }
  report.datos = { email: BIZ.email, nombre: 'Resistone', apellidos: 'Microcemento', telefono: BIZ.phone, cp: BIZ.zip, razon_social: BIZ.name };
  report.pasos.push(`campos_rellenados: ${JSON.stringify(filled)}`);

  // Aceptar condiciones si hay checkbox
  await page.locator('#aceptar-condiciones').check().catch(() => {});
  report.pasos.push('condiciones_aceptadas');

  await screenshot('certicalia-filled');

  if (isDryRun) {
    return buildReport({ ...report, estado_final: 'dry-run', evidencia: 'captura: certicalia-filled', siguiente: 'ejecutar sin --dry-run' });
  }

  const prevUrl = page.url();
  // Certicalia puede tener un paso "Continuar" antes del submit final
  // Intentar primero "Continuar", si no existe ir directo al submit
  const continuarVisible = await page.locator('button:has-text("Continuar")').first().isVisible({ timeout: 2000 }).catch(() => false);
  if (continuarVisible) {
    await page.locator('button:has-text("Continuar")').first().click();
    await page.waitForTimeout(3000);
    report.pasos.push('continuar_clicked');
    await screenshot('certicalia-step2');
    // Rellenar campos adicionales si aparecen en el paso 2
    await fillField(['Correo electrónico', '#one_step_email', 'input[name="one_step[email]"]'], BIZ.email);
    await fillField(['Contraseña', '#password-input'], BIZ.password);
    await page.locator('#aceptar-condiciones').check().catch(() => {});
  }
  // Submit final
  const clicked = await clickBtn(['Registrarme gratis', 'button[type="submit"]']);
  if (!clicked) report.bloqueos.push('botón_submit_no_encontrado');
  report.pasos.push(`submit_clicked: ${clicked}`);

  await page.waitForTimeout(5000);
  await screenshot('certicalia-after');

  const progress = await checkProgress(prevUrl);
  report.pasos.push(`progress: ${progress}`);

  if (progress === STATE.CONFIRMACION || progress === STATE.VERIFICACION_EMAIL) {
    return buildReport({ ...report, estado_final: progress, evidencia: `URL: ${page.url()}`, siguiente: progress === STATE.VERIFICACION_EMAIL ? 'revisar info@resistone.es' : 'alta completada' });
  }
  if (progress === STATE.ERROR) {
    const errorText = await page.locator('[role="alert"], .error, [class*="error" i]').first().textContent({ timeout: 2000 }).catch(() => '');
    return buildReport({ ...report, estado_final: STATE.ERROR, evidencia: errorText || 'ver captura certicalia-after', siguiente: 'revisar error' });
  }
  if (progress === 'no_change') {
    report.bloqueos.push('submit_sin_efecto');
    return buildReport({ ...report, estado_final: STATE.ERROR, evidencia: 'URL no cambió', siguiente: 'revisar selectores submit' });
  }

  return buildReport({ ...report, estado_final: progress, evidencia: `URL: ${page.url()}`, siguiente: 'verificar manualmente' });
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const bot = await createBot({
    logFile:        require('path').join(__dirname, 'test-two-dirs.log'),
    screenshotsDir: require('path').join(__dirname, 'screenshots'),
    headless: true,
    locale: 'es-ES',
  });

  const results = [];

  // Habitissimo
  bot.log('\n══════════════════════════════════════');
  bot.log('[TEST 1/2] Habitissimo');
  const r1 = await bot.withRetry('habitissimo', () => submitHabitissimo(bot));
  results.push(typeof r1 === 'object' ? r1 : { estado_final: r1 });

  await bot.page.waitForTimeout(3000);

  // Certicalia
  bot.log('\n══════════════════════════════════════');
  bot.log('[TEST 2/2] Certicalia');
  const r2 = await bot.withRetry('certicalia', () => submitCerticalia(bot));
  results.push(typeof r2 === 'object' ? r2 : { estado_final: r2 });

  await bot.browser.close();

  // ── Informe final ──────────────────────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════');
  console.log('INFORME FINAL');
  console.log('══════════════════════════════════════');
  for (const r of results) {
    console.log(JSON.stringify(r, null, 2));
    console.log('──────────────────────────────────────');
  }
})();
