# Backlink Bot — Método de Automatización

## 🚀 Características

- ✅ Registro automático en directorios
- ✅ **Verificación automática de email con Gmail API** (NUEVO)
- ✅ Análisis visual con GPT-4o para diagnosticar errores
- ✅ Evasión de detección de bots con stealth plugin
- ✅ Máquina de estados con 11 estados
- ✅ Manejo de 10 obstáculos documentados
- ✅ Capturas de pantalla automáticas

## 📋 Requisitos

- Node.js 18+
- Cuenta de Gmail (para verificación automática)
- API key de OpenAI (para análisis visual)

## 🔧 Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
# Editar .env y añadir OPENAI_API_KEY

# 3. Configurar Gmail API (solo primera vez)
# Sigue la guía: backlink-bot/SETUP-GMAIL-API.md
node backlink-bot/authorize-gmail.js
```

## 📖 Configuración Gmail API (primera vez)

### ⏱️ Tiempo: 5 minutos

1. Ve a https://console.cloud.google.com
2. Crea proyecto: "ReliableAI Backlinks"
3. Habilita Gmail API: https://console.cloud.google.com/apis/library/gmail.googleapis.com
4. Crea credenciales OAuth 2.0 (tipo "Aplicación de escritorio")
5. Descarga JSON como `backlink-bot/credentials.json`
6. Ejecuta: `node backlink-bot/authorize-gmail.js`

**Guía completa**: `backlink-bot/SETUP-GMAIL-API.md`

## Estado actual

✅ **MÉTODO VALIDADO** — Listo para escalar a directorios reales

### Componentes instalados y probados

| Componente | Estado | Descripción |
|---|---|---|
| `bot-engine.js` | ✅ Funcional | Motor reutilizable con máquina de estados |
| `vision-analyzer.js` | ✅ Funcional | Análisis de capturas con GPT-4o |
| `email-verifier.js` | ✅ Funcional | Verificación automática de email |
| Stealth plugin | ✅ Instalado | Evasión de detección de bots |
| Visión GPT-4o | ✅ Probado | Diagnóstico automático de errores |
| Gmail API | ✅ Configurado | Lectura automática de emails |
| Helpers | ✅ Validados | `fillField`, `clickBtn`, `acceptCookies`, etc. |

## 🎯 Uso

### 1. Completar altas pendientes (con verificación automática)

```bash
node backlink-bot/completar-altas.js
```

Ejecuta el script con todos los directorios configurados, incluyendo verificación automática de email.

### 2. Probar verificación de email

```bash
node backlink-bot/test-email-verifier.js
```

### 3. Ejemplo completo con verificación

```bash
node backlink-bot/ejemplo-con-verificacion.js
```

### 4. Test de visión (analizar capturas existentes)

```bash
node backlink-bot/test-vision.js
```

### 5. Análisis de captura individual

```bash
node backlink-bot/vision-analyzer.js screenshots/error.png "contexto del error"
```

## 📁 Estructura

```
backlink-bot/
├── bot-engine.js              # Motor principal con stealth y visión
├── vision-analyzer.js         # Análisis con GPT-4o
├── email-verifier.js          # Verificación automática de email (NUEVO)
├── business-data.js           # Datos de las empresas
├── completar-altas.js         # Script principal con verificación
├── authorize-gmail.js         # Autorización Gmail API (primera vez)
├── test-email-verifier.js     # Test de verificación
├── ejemplo-con-verificacion.js # Ejemplo completo
├── SETUP-GMAIL-API.md         # Guía de configuración Gmail
├── VERIFICACIONES.md          # Documentación de verificaciones
├── screenshots/               # Capturas automáticas
└── *.log                      # Logs de ejecución
```

## 🔐 Seguridad

Los siguientes archivos están en `.gitignore` y **NUNCA** deben subirse a git:

- `credentials.json` — Credenciales OAuth de Google
- `token.json` — Token de acceso a Gmail
- `.env` — Variables de entorno con API keys

## 📊 Estados del bot

| Estado | Descripción |
|---|---|
| `completado` | Cuenta creada y verificada |
| `pendiente_verificacion` | Cuenta creada, falta verificar email |
| `pendiente_aprobacion` | Enviado, pendiente revisión manual |
| `requiere_captcha_manual` | Bloqueado por captcha |
| `requiere_pago` | Directorio de pago |
| `requiere_sms` | Verificación por SMS |
| `error` | Error en el proceso |
| `bloqueado` | Bloqueado por detección de bot |

## 🔄 Flujo típico (con verificación automática)

```
1. Bot navega al directorio
2. Acepta cookies automáticamente
3. Rellena formulario de registro
4. Envía formulario
5. Captura pantalla y analiza con visión
6. Espera email de verificación (max 100s)
7. Extrae enlace y verifica automáticamente
8. Confirma cuenta activa
9. Registra resultado
```

## 📈 Verificación de email

El bot puede verificar emails automáticamente:

- **Coste**: Gratis (Gmail API)
- **Cobertura**: ~70% de directorios requieren verificación de email
- **Tiempo**: Max 100 segundos de espera
- **Precisión**: Detecta enlaces de verificación automáticamente

### Flujo de verificación

1. Registra cuenta en directorio
2. Busca email cada 10s (max 10 intentos)
3. Extrae enlace de verificación
4. Navega al enlace automáticamente
5. Confirma verificación

## Flujo de trabajo

### Sin visión (método antiguo)
1. Ejecutar bot → falla
2. Adivinar error del DOM
3. Corregir código
4. Repetir 8+ veces
5. **Tiempo: 1-2 horas por directorio**

### Con visión + verificación automática (método actual)
1. Bot ejecuta y captura automáticamente
2. Visión analiza y diagnostica el error exacto
3. Verificación de email automática
4. Corrección en 1 iteración
5. **Tiempo: 10-15 minutos por directorio**

## 🐛 Troubleshooting

### Error: "credentials.json no encontrado"

Sigue la guía: `backlink-bot/SETUP-GMAIL-API.md`

### Error: "token.json no encontrado"

Ejecuta: `node authorize-gmail.js`

### Error: "invalid_grant"

El token expiró. Borra `token.json` y vuelve a ejecutar `authorize-gmail.js`.

### No se encuentra email de verificación

- Verifica que el email es correcto en `business-data.js`
- Verifica que el dominio del remitente es correcto
- Espera unos minutos (algunos directorios tardan)
- Revisa la bandeja de spam

## Errores conocidos y soluciones

| Directorio | Error | Solución aplicada |
|---|---|---|
| Habitissimo | "No es una opción válida" en categoría | Usar "Reformas" (genérica) en vez de "Microcemento" |
| Habitissimo | Campo "Tamaño de empresa" vacío | Añadir `selectOption()` con valor del catálogo |
| Certicalia | Overlay verde bloquea formulario | `acceptCookies()` + `waitForFunction` overlay gone |
| Certicalia | Campo NIF required | Usar DNI real del administrador |
| Certicalia | Campo razon-social disabled | Esperar 1.5s tras rellenar CP |
| Europages | Página gris, JS no carga | `waitUntil: 'networkidle'`, timeout 45s |
| Infobel | Página en blanco 17KB | Mismo que Europages |

## 📚 Documentación adicional

- `SETUP-GMAIL-API.md` — Guía de configuración Gmail API
- `VERIFICACIONES.md` — Documentación completa de verificaciones
- `.kiro/steering/backlink-automation.md` — Método completo v2.0
- `METODO-FINAL.md` — Documentación del método
- `RESUMEN-INSCRIPCIONES.md` — Estado de inscripciones

## 🎯 Próximos pasos

1. ✅ Verificación de email (implementado)
2. ⏳ Verificación de SMS con Twilio (opcional)
3. ⏳ Dashboard de monitoreo de backlinks
4. ⏳ Notificaciones cuando se aprueben listings

## Requisitos técnicos

```bash
npm install playwright-extra puppeteer-extra-plugin-stealth openai googleapis dotenv
```

Variables de entorno (`.env`):
```
OPENAI_API_KEY=sk-...
```

Archivos de configuración Gmail (generados tras autorización):
```
backlink-bot/credentials.json  # Credenciales OAuth (descargar de Google Cloud)
backlink-bot/token.json        # Token de acceso (generado automáticamente)
```
