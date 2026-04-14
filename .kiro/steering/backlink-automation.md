---
inclusion: manual
---

# Backlink Automation — Método y Estándares

## Filosofía: Agente autónomo con visión

Operamos mediante **captura de pantalla + análisis visual + acciones**. Cada directorio es diferente, así que nos adaptamos al layout que encontremos en cada momento.

### Principios fundamentales

1. **Paciencia**: Esperar a que cada página cargue completamente (mínimo 3-5s tras navegación)
2. **Scroll**: Si no encuentras un elemento, hacer scroll down antes de declarar que no existe
3. **Adaptabilidad**: Cada directorio es diferente. No asumir layouts. Leer la pantalla cada vez
4. **Resiliencia**: Si un paso falla, intentar alternativa antes de abandonar
5. **Evidencia**: Capturar pantalla después de cada acción importante
6. **Priorizar el backlink**: Todo orientado a que la URL aparezca como enlace clicable público

## Máquina de estados

Cada submisión atraviesa estados bien definidos. Nunca asumir que la página está lista.

```
LANDING → COOKIES → FORMULARIO → PASO_INTERMEDIO → SUBMIT → VERIFICACION_EMAIL | CONFIRMACION | ERROR | BLOQUEO
```

### Estados extendidos

| Estado | Señales | Acción |
|---|---|---|
| `LANDING` | Página de inicio genérica | Buscar "Sign Up", "Add Listing", "Submit Tool", "Join" |
| `LOGIN_PAGE` | Formulario de login | Buscar opción "Create account", "Register" |
| `COOKIES` | Overlay/modal con botón Aceptar | `acceptCookies()` — SIEMPRE antes de interactuar |
| `FORMULARIO` | `<form>` visible con inputs interactuables | Rellenar con `fillField()` |
| `PASO_INTERMEDIO` | Wizard multi-step, progress bar | Registrar paso completado, continuar |
| `VERIFICACION_EMAIL` | "check your email", "verifica tu correo" | Marcar `pendiente_verificacion_email`, ir a email |
| `CONFIRMACION` | "thank you", "success", "registrado" | Marcar `confirmed`, verificar backlink |
| `ERROR` | Mensaje de error visible, campo rojo | Log error, captura, max 2 reintentos |
| `CAPTCHA` | reCAPTCHA, hCaptcha, Cloudflare challenge | Marcar `pendiente_intervencion_humana` |
| `OAUTH_ONLY` | Solo botones Google/Facebook/Apple | Marcar `pendiente_intervencion_humana` |
| `REQUIERE_PAGO` | Formulario de pago obligatorio | Marcar `requiere_pago`, continuar |
| `REQUIERE_SMS` | Verificación por teléfono | Marcar `requiere_sms`, continuar |
| `PENDIENTE_APROBACION` | "Your listing will be reviewed" | Marcar `pendiente_aprobacion` (OK) |
| `BLOQUEADO` | 403, bot detection, IP ban | Marcar `bloqueado`, log y continuar |

## Ciclo principal de navegación

## Ciclo principal de navegación

### PASO 1 — Reconocimiento inicial
1. Navegar a la URL del directorio
2. Capturar pantalla completa
3. Analizar y clasificar qué estamos viendo:
   - **Página de inicio genérica** → buscar "Sign Up", "Add Listing", "Submit Tool", "Join"
   - **Página de login** → buscar "Create account", "Register"
   - **Formulario de alta directa** → pasar al PASO 3
   - **Foro** → buscar "Register", "Sign Up"
   - **Página bloqueada/CAPTCHA/Cloudflare** → marcar `bloqueado`
4. **IMPORTANTE**: Si no encuentras el botón, hacer scroll down y volver a capturar

### PASO 2 — Registro de cuenta
1. Click en botón de registro identificado
2. Capturar pantalla del formulario
3. Identificar cada campo visualmente (label, placeholder)
4. Rellenar mapeando desde datos del negocio:
   - **Name/Nombre** → nombre del negocio
   - **Email** → email de registro
   - **Password** → password por defecto
   - **Website/URL** → **URL del negocio** ← ¡CRÍTICO! Este es el backlink
   - **Phone** → teléfono
   - **Location/City** → ciudad
   - **Country** → país
   - **Bio/Description** → descripción corta o larga según espacio
5. Marcar checkboxes de Terms of Service (obligatorio)
6. NO marcar checkboxes de newsletter (opcional, evitar spam)
7. Enviar formulario

### PASO 3 — Completar perfil / listing
Tras registro, muchos directorios piden completar perfil:

1. Capturar dashboard/perfil post-registro
2. Buscar "Complete your profile", "Add a listing", "Submit your tool"
3. Para cada campo disponible:
   - **Título/Nombre** → nombre del negocio
   - **URL/Website** → **URL del negocio** ← SIEMPRE incluir
   - **Descripción corta/Tagline** → descripción corta
   - **Descripción larga/About** → descripción larga
   - **Categoría** → seleccionar la más cercana
   - **Tags/Keywords** → keywords del negocio
   - **Logo/Imagen** → subir logo
   - **Imágenes adicionales** → subir screenshots
   - **Redes sociales** → rellenar si disponible
   - **Pricing/Plan** → seleccionar "Free" o "Freemium"
4. Guardar/Publicar perfil

### PASO 4 — Verificación de email
1. Tras registro, buscar email de verificación
2. Navegar al email del negocio
3. Buscar email más reciente del directorio
4. Click en enlace de verificación
5. Volver al directorio y confirmar cuenta activa

### PASO 5 — Verificación del backlink
1. Navegar al perfil público creado
2. Capturar pantalla
3. Verificar visualmente:
   - La URL del negocio aparece y es clicable
   - El perfil es público (no privado/draft)
   - La información es correcta
4. Registrar resultado con:
   - `backlink_url`: URL donde aparece nuestro link
   - `backlink_activo`: true/false
   - `backlink_tipo`: dofollow/nofollow/desconocido

## Protocolo para foros

Los foros requieren enfoque diferente — no solo registrarse sino participar:

### Registro en foro
1. Seguir PASO 1 y PASO 2 del ciclo principal
2. Completar perfil incluyendo URL en campo Website/Homepage
3. El perfil del foro ya genera un backlink

### Participación en foro (backlinks en posts)
1. Buscar secciones: "Introduce Yourself", "Presentaciones", "New Members", "Showcase"
2. Crear post de presentación natural:
   ```
   Estructura:
   - Saludo y presentación personal/profesional
   - Qué hace el negocio/producto (2-3 frases, sin spam)
   - Enlace de forma natural: "Podéis ver más en [URL]"
   - Pregunta abierta o invitación al diálogo
   ```
3. Si hay sección "Resources", "Tools", "Showcase":
   - Publicar post presentando producto/servicio
   - Incluir enlace a URL del negocio
   - Añadir capturas/imágenes si posible

### Reglas anti-spam en foros
- NO publicar más de 1-2 posts el primer día
- Tono conversacional, no publicitario
- Si hay reglas visibles, leerlas y respetarlas
- Priorizar foros donde el contenido es genuinamente relevante

## Motor reutilizable

Siempre usar `backlink-bot/bot-engine.js` como base. Nunca copiar helpers inline.

```js
const { createBot } = require('./bot-engine');
const { page, log, acceptCookies, waitReady, fillField, clickBtn, checkProgress, screenshot, STATE } = await createBot(options);
```

## Visión integrada (GPT-4o)

El motor incluye análisis automático de capturas con visión:

```js
// Captura con análisis automático
const result = await screenshot('form-after-submit', true, 'formulario tras submit');
// result.analysis contiene: { state, errors, fieldsWithErrors, diagnosis, nextAction }
```

**Uso standalone**:
```js
const { analyzeScreenshot } = require('./vision-analyzer');
const analysis = await analyzeScreenshot('screenshots/error.png', 'contexto');
// Devuelve: { state, errors, fieldsWithErrors, successMessage, diagnosis, nextAction }
```

**Ventajas**:
- Detecta errores inline que no están en el DOM como texto
- Identifica campos marcados en rojo visualmente
- Diagnostica overlays/modals que bloquean
- Confirma mensajes de éxito aunque no cambien la URL
- Transcribe texto de errores exactamente como aparece

**Requisitos**:
- `npm install openai dotenv` (ya instalados)
- `OPENAI_API_KEY` configurada en `.env` ✅
- Modelo: `gpt-4o` (con visión)
- Coste: ~$0.01 por captura analizada

**Ejemplo real**:
```bash
node backlink-bot/vision-analyzer.js screenshots/error.png "formulario tras submit"
# Output: { state: "error", errors: ["No es una opción válida"], fieldsWithErrors: ["Tamaño de la empresa"], ... }
```

## Estados y cómo detectarlos

| Estado | Señales | Acción |
|---|---|---|
| `LANDING` | URL sin formulario visible, hero/marketing | Buscar CTA "Submit", "Register", "Alta" y clicar |
| `COOKIES` | Overlay/modal con botón Aceptar | `acceptCookies()` — SIEMPRE antes de interactuar |
| `FORMULARIO` | `<form>` visible con inputs interactuables | Rellenar con `fillField()` |
| `PASO_INTERMEDIO` | Wizard multi-step, progress bar | Registrar paso completado, continuar |
| `VERIFICACION_EMAIL` | "check your email", "verifica tu correo" | Marcar `pendiente_verificacion_email`, pausar |
| `CONFIRMACION` | "thank you", "success", "registrado" | Marcar `confirmed`, log DONE |
| `ERROR` | Mensaje de error visible, campo rojo | Log error, captura, max 2 reintentos |
| `CAPTCHA` | reCAPTCHA, hCaptcha, Cloudflare challenge | Marcar `pendiente_intervencion_humana`, NO intentar eludir |
| `OAUTH_ONLY` | Solo botones Google/Facebook/Apple | Marcar `pendiente_intervencion_humana` |
| `BLOQUEO` | 403, bot detection, IP ban | Marcar `bloqueado`, log y continuar con siguiente |

## Reglas de selectores (orden de preferencia)

1. `getByLabel(texto)` — más robusto, basado en accesibilidad
2. `getByPlaceholder(texto)` — segundo más estable
3. `getByRole('button', { name })` — para botones
4. `getByText(texto)` — para links/CTAs
5. Selector CSS por `name`, `id`, `type` — solo como fallback
6. **NUNCA** usar clases dinámicas (`class*="sc-"`, `class*="css-"`, hashes)

## Gestión de cookies — patrones cubiertos

- OneTrust: `#onetrust-accept-btn-handler`
- Cookiebot: `#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll`
- Axeptio: `#axeptio_btn_acceptAll`
- Genéricos ES: "Aceptar todo", "Aceptar todas", "Aceptar cookies", "Acepto"
- Genéricos EN: "Accept all", "Accept", "OK", "Got it", "I agree"
- Atributos: `button[id*="accept" i]`, `[data-testid*="accept" i]`

## Esperas obligatorias

```js
// Después de goto — SIEMPRE
await waitReady(page);        // networkidle + sin spinners/overlays
await acceptCookies(page);    // antes de cualquier interacción
await page.waitForTimeout(1500); // margen para animaciones

// Antes de rellenar campos
await page.waitForSelector('form input', { timeout: 10000 });

// Para JS asíncrono (Europages, Infobel, SPAs)
await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
```

## Verificación de progreso tras submit

```js
const progress = await checkProgress(page, prevUrl);
// Devuelve: 'confirmed' | 'error_visible' | 'navigated_to:URL' | 'no_change'
```

Si `no_change` → el submit no tuvo efecto → revisar selectores del botón.

## Flujos multi-step

- Registrar cada paso completado en el log: `[step:1/3]`, `[step:2/3]`
- Si un paso falla, no continuar al siguiente
- Captura de pantalla en cada transición de paso

## Datos insuficientes

Si un campo obligatorio no tiene dato en el objeto de negocio → log `[datos_insuficientes]` + captura + continuar sin ese campo o abortar si es crítico.

## Reintentos

- Máximo 2 reintentos por acción individual
- Máximo 2 reintentos por directorio completo
- Entre reintentos: `await page.waitForTimeout(3000)`
- Captura en cada intento fallido

## Evidencia de éxito

Solo marcar `DONE` si:
- Texto de confirmación visible ("thank you", "success", "registrado", "enviado")
- O URL cambió a página de confirmación
- O email de verificación mencionado explícitamente

## Output estructurado por directorio

```
objetivo: Alta en [Directorio]
url: [URL]
estado_final: confirmed | pendiente_verificacion_email | pendiente_intervencion_humana | error | bloqueado
pasos_completados: [lista]
datos_enviados: { name, email, url, ... }
bloqueos: [lista]
evidencia: [texto visible o URL de confirmación]
siguiente_accion: [qué hacer manualmente si aplica]
```

## Mejoras aplicadas (abril 2026)

### 1. Inspección en vivo de campos
Antes de rellenar, inspeccionar los campos reales para usar selectores precisos:
```js
const fields = await page.$$eval('input:visible, select:visible', els =>
  els.map(el => ({ tag: el.tagName, name: el.name, id: el.id, placeholder: el.placeholder }))
);
log(`[inspect] Campos: ${JSON.stringify(fields)}`);
```

### 2. Verificación de estado de campos
Verificar que los campos estén habilitados antes de rellenar:
```js
const enabled = await page.locator('#field').isEnabled({ timeout: 5000 });
if (!enabled) {
  await page.waitForFunction(() => !document.querySelector('#field').disabled, { timeout: 10000 });
}
```

### 3. Manejo específico de CMPs
Detectar y manejar CMPs específicos (Didomi, OneTrust, Cookiebot):
```js
const didomiPresent = await page.locator('#didomi-popup').isVisible({ timeout: 2000 });
if (didomiPresent) {
  await page.locator('#didomi-notice-agree-button').click();
  await page.waitForFunction(() => !document.querySelector('#didomi-popup')?.offsetParent, { timeout: 5000 });
}
```

### 4. Scroll automático a formularios
Hacer scroll al formulario antes de interactuar:
```js
await page.locator('form, input[type="text"]').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(1000);
```

### 5. Manejo de autocomplete
Para campos con autocomplete, usar teclado para seleccionar:
```js
await input.fill('valor');
await page.waitForTimeout(1000);
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
```

## Plugins y servicios instalados

### ✅ Instalados y validados
- **Playwright** (chromium) — motor principal
- **playwright-extra** — wrapper para plugins
- **puppeteer-extra-plugin-stealth** — evasión de detección de bots (Cloudflare, PerimeterX)
- **OpenAI SDK** — para visión GPT-4o
- **dotenv** — gestión de variables de entorno

### Recomendados para instalar (si se necesitan)
- **2captcha** o **anticaptcha** — resolución automática de reCAPTCHA/hCaptcha ($1-3/1000 captchas). Integrar solo si el volumen lo justifica.
  - npm: `2captcha` o `@antiadmin/anticaptcha`
- **rotating-proxy** — si hay bloqueos por IP en directorios con rate limiting agresivo

### Para foros y comunidades (Reddit, Quora, etc.)
- Requieren cuenta preexistente con historial — NO automatizar registro
- Usar API oficial donde exista (Reddit API, Stack Exchange API)
- Para posting manual asistido: preparar el contenido con el bot, publicar manualmente

## Manejo de obstáculos

### CAPTCHAs
- **reCAPTCHA v2** (checkbox "No soy un robot") → intentar click. Si pide resolver imágenes → `requiere_captcha_manual`
- **reCAPTCHA v3** (invisible) → normalmente no bloquea, proceder
- **hCaptcha** → `requiere_captcha_manual`
- **Captcha de texto/imagen simple** → intentar resolver visualmente
- Si no se puede resolver → `bloqueado_captcha`

### Popups y banners de cookies
- Buscar y click en "Accept", "Aceptar", "Accept All", "Agree", "OK", "Got it"
- Si bloquea la vista, cerrar con X si existe
- Hacer esto SIEMPRE como primera acción si aparece

### Login social (Google/GitHub/etc)
- NO usar login social — siempre registro con email
- Login social no suele permitir añadir URL de website

### Formulario de pago / Plan Premium
- Si requiere pago obligatorio → `requiere_pago`
- Si ofrece plan gratuito → seleccionar siempre free
- Si tiene trial → NO seleccionar (requiere tarjeta)

### Página en idioma desconocido
- Buscar selector de idioma (EN/ES) y cambiar
- Si no hay selector, proceder — campos suelen ser reconocibles

### Verificación por teléfono/SMS
- Marcar como `requiere_sms`

### Aprobación manual
- Si dice "Your listing will be reviewed" → OK, marcar `pendiente_aprobacion`
- El backlink aparecerá cuando aprueben

## Registro de resultados

Tras cada directorio, registrar resultado estructurado:

```yaml
- url: "https://ejemplo.com"
  timestamp: "2026-04-14 HH:MM"
  estado: "completado | pendiente_verificacion | pendiente_aprobacion | requiere_captcha_manual | requiere_pago | requiere_sms | bloqueado | error"
  cuenta_creada: true/false
  perfil_url: "https://ejemplo.com/profile/minegocio"
  backlink_url: "https://ejemplo.com/profile/minegocio"
  backlink_activo: true/false
  backlink_tipo: "dofollow | nofollow | desconocido"
  notas: "Descripción breve de lo ocurrido"
  capturas: ["screenshot1.png", "screenshot2.png"]
```

## Reglas de comportamiento

1. **Paciencia**: Esperar 3-5s tras cada navegación antes de capturar/actuar
2. **Scroll**: Si no encuentras elemento, scroll down antes de declarar que no existe. Capturar tras cada scroll
3. **Adaptabilidad**: Cada directorio es diferente. No asumir layouts. Leer pantalla cada vez
4. **Resiliencia**: Si un paso falla, intentar alternativa:
   - Botón no encontrado → buscar en menú, hamburger menu, footer
   - Formulario no carga → recargar página una vez
   - Error al enviar → leer mensaje, corregir y reintentar
5. **No atascarse**: Si tras 3 intentos no avanzas, marcar `error` y continuar
6. **Maximizar campos**: Si hay campo opcional para URL, rellenarlo. Más menciones = mejor
7. **Capturar evidencias**: Screenshot después de cada acción importante
8. **Priorizar backlink**: Todo orientado a que URL aparezca como enlace clicable público

## Barreras conocidas y soluciones

### 1. Modales de cookies persistentes
**Síntoma:** Modal bloquea clicks incluso después de `acceptCookies()`.  
**Solución:** Usar botón específico del CMP + verificar con `offsetParent`.

### 2. Campos con autocomplete
**Síntoma:** Error "No es una opción válida" tras rellenar campo de texto.  
**Solución:** Usar `ArrowDown` + `Enter` para seleccionar de la lista.

### 3. Campos disabled dinámicamente
**Síntoma:** Error "element is not enabled" al intentar rellenar.  
**Solución:** Usar `waitForFunction` para esperar a que se habilite.

### 4. Formularios fuera del viewport
**Síntoma:** No se encuentran campos visibles.  
**Solución:** Usar `scrollIntoViewIfNeeded()` antes de rellenar.

### 5. Formularios wizard vs simples
**Síntoma:** No se encuentra botón "Next" en formularios simples.  
**Solución:** Detectar tipo de formulario contando campos visibles (<5 = simple, >5 = wizard).

## Directorios con comportamiento especial conocido

| Directorio | Problema | Solución |
|---|---|---|
| Europages | JS asíncrono, página gris | `waitUntil: 'networkidle'`, timeout 45s |
| Infobel | Página en blanco 17KB | Mismo que Europages |
| Certicalia | Overlay verde CMP (Cookiebot). URL real: `/usuarios/registro-profesional` (no `/registro-empresa` que da 404). Campos exactos por ID: `#nombre-input`, `#apellidos-input`, `#one_step_email`, `#telefono-input`, `#password-input`, `#documentacion-input` (NIF — required, usar DNI ficticio válido `12345678Z`), `#codigo-postal-input`, `#razon-social-input` (disabled hasta rellenar CP). Submit: `button[type="submit"]` texto "Registrarme gratis". El `<form>` visible es el de login — el registro es componente Vue/React sin `<form>` HTML. | `acceptCookies()` + `waitForFunction` overlay gone. Rellenar por IDs directos. Esperar 1.5s tras CP para que razon-social se habilite. |
| Páginas Amarillas | Modal naranja cookies | `acceptCookies()` + espera modal desaparezca |
| Habitissimo | Wizard multi-step. URLs `/pro/registro` y `/empresas/registro` dan 404. URL real: `/registrar/empresa` (descubrir dinámicamente desde home). Paso 1: "¿A qué te dedicas?" + "¿Dónde trabajas?" → "Conseguir trabajos". Paso 2: `#company-name`, `#name`, `input[name="email"]`, `#phone`, `#password`, `#third-party` (checkbox términos). Submit: "Regístrate ahora". **CRÍTICO**: categoría debe ser del catálogo — usar "Reformas" (genérica), NO "Microcemento" (no existe → error "No es una opción válida"). | Navegar desde home siguiendo CTA. Rellenar paso 1 con categoría genérica. Esperar `#company-name` visible antes de rellenar paso 2. |
| Pinterest | Solo OAuth | `pendiente_intervencion_humana` |
| AI Valley | Dark mode, clases dinámicas | Solo `getByLabel`/`getByPlaceholder` |
| TAAFT | Requiere pago | Solo captura, revisión manual |

## Flujo optimizado con visión

**Antes** (sin visión):
- 8+ iteraciones a ciegas por directorio
- Adivinar errores del DOM sin ver la página
- Tiempo: 1-2 horas por directorio

**Ahora** (con visión GPT-4o):
1. Bot ejecuta y captura automáticamente
2. Visión analiza la captura y diagnostica
3. Corrección en 1 iteración
4. Tiempo: 10-15 minutos por directorio

**Ejemplo de flujo**:
```bash
# 1. Ejecutar bot (captura automática)
node backlink-bot/submit-resistone.js --only habitissimo

# 2. Analizar captura con visión
node backlink-bot/vision-analyzer.js screenshots/habitissimo-after.png "tras submit"

# 3. Visión detecta: "Error: No es una opción válida en campo Tamaño de empresa"

# 4. Corrección: añadir selectOption() para ese campo

# 5. Re-ejecutar → éxito en 1 iteración
```

**Escalabilidad**: este método funciona para cualquier directorio futuro — el bot captura, la visión diagnostica, corriges en 1 ciclo en vez de 8.

## Lecciones clave

### detectState() y falsos positivos
Las keywords de confirmación (`registrado`, `gracias`, `success`) pueden aparecer en el DOM de la landing ANTES del submit (en textos de marketing). 

**Regla**: solo llamar `detectState()` / `checkProgress()` DESPUÉS de ejecutar el submit, nunca para evaluar el estado inicial del formulario. Para detectar si el formulario cargó, usar `waitForSelector` con IDs o tipos de campo específicos.

### Visión > DOM scraping
Muchos errores de validación aparecen visualmente (campos rojos, mensajes inline) pero no están en el DOM como texto accesible. La visión detecta:
- Mensajes de error con clases dinámicas
- Campos marcados en rojo sin atributo `aria-invalid`
- Overlays semi-transparentes que bloquean
- Texto en imágenes o canvas

**Regla**: tras cada submit fallido, usar visión para diagnosticar antes de iterar a ciegas.

### URLs de registro

Siempre verificar la URL real antes de hardcodear. Estrategia:
1. Ir a la home
2. Buscar el CTA de registro con `a[href*="registrar"], a[href*="registro"], a:has-text("Regístrate")`
3. Extraer el href y navegar a él
4. Si falla, usar `inspect-live.js` para descubrir la URL correcta

### Categorías y opciones de catálogo
Muchos formularios tienen campos con autocompletado que solo aceptan opciones de su catálogo interno. No inventar valores — usar categorías genéricas amplias que existan en todos los directorios:
- ✅ "Reformas", "Construcción", "Servicios"
- ❌ "Microcemento", "Aplicación de resinas" (muy específicos, no existen en catálogos)
