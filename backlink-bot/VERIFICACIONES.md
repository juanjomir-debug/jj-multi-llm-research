# Gestión de Verificaciones — Email y SMS

## Problema

Muchos directorios requieren verificación por:
1. **Email** — Click en enlace de verificación
2. **SMS** — Código de 4-6 dígitos enviado al móvil

Sin automatizar esto, el proceso se queda a medias.

---

## Solución 1: Verificación de Email (Recomendada)

### Opción A: Gmail API (Gratuita, más robusta)

**Ventajas:**
- Gratuita
- Acceso programático a emails
- Búsqueda por remitente/asunto
- Extracción de enlaces

**Configuración:**

1. **Habilitar Gmail API en Google Cloud Console**
   ```
   https://console.cloud.google.com/apis/library/gmail.googleapis.com
   ```

2. **Crear credenciales OAuth 2.0**
   - Tipo: Aplicación de escritorio
   - Descargar `credentials.json`

3. **Instalar dependencias**
   ```bash
   npm install googleapis
   ```

4. **Implementación**
   ```js
   const { google } = require('googleapis');
   const fs = require('fs');
   
   async function getVerificationEmail(emailAddress, fromDomain) {
     // Cargar credenciales
     const credentials = JSON.parse(fs.readFileSync('credentials.json'));
     const { client_secret, client_id, redirect_uris } = credentials.installed;
     const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
     
     // Cargar token (primera vez requiere autorización manual)
     const token = JSON.parse(fs.readFileSync('token.json'));
     oAuth2Client.setCredentials(token);
     
     const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
     
     // Buscar emails recientes del directorio
     const query = `from:${fromDomain} to:${emailAddress} newer_than:1h`;
     const res = await gmail.users.messages.list({
       userId: 'me',
       q: query,
       maxResults: 5,
     });
     
     if (!res.data.messages || res.data.messages.length === 0) {
       return null;
     }
     
     // Obtener el email más reciente
     const messageId = res.data.messages[0].id;
     const message = await gmail.users.messages.get({
       userId: 'me',
       id: messageId,
       format: 'full',
     });
     
     // Extraer enlaces del cuerpo
     const body = Buffer.from(message.data.payload.body.data, 'base64').toString();
     const links = body.match(/https?:\/\/[^\s<>"]+/g) || [];
     
     // Buscar enlace de verificación
     const verificationLink = links.find(link => 
       link.includes('verify') || 
       link.includes('confirm') || 
       link.includes('activate')
     );
     
     return verificationLink;
   }
   
   // Uso en el bot
   async function verificarEmail(bot, emailAddress, fromDomain) {
     const { page, log } = bot;
     
     log('[email] Esperando email de verificación...');
     
     let attempts = 0;
     let verificationLink = null;
     
     while (attempts < 10 && !verificationLink) {
       await new Promise(r => setTimeout(r, 10000)); // Esperar 10s
       verificationLink = await getVerificationEmail(emailAddress, fromDomain);
       attempts++;
       log(`[email] Intento ${attempts}/10...`);
     }
     
     if (verificationLink) {
       log(`[email] Enlace encontrado: ${verificationLink}`);
       await page.goto(verificationLink);
       await page.waitForTimeout(3000);
       return true;
     }
     
     log('[email] No se recibió email de verificación');
     return false;
   }
   ```

### Opción B: IMAP (Alternativa)

**Ventajas:**
- Funciona con cualquier proveedor de email
- No requiere OAuth

**Desventajas:**
- Menos seguro (requiere contraseña de aplicación)
- Más lento

**Implementación:**
```bash
npm install imap mailparser
```

```js
const Imap = require('imap');
const { simpleParser } = require('mailparser');

async function getVerificationEmailIMAP(emailAddress, password, fromDomain) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: emailAddress,
      password: password, // Contraseña de aplicación
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
    });
    
    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) return reject(err);
        
        // Buscar emails recientes
        const searchCriteria = [
          ['FROM', fromDomain],
          ['SINCE', new Date(Date.now() - 3600000)], // Última hora
        ];
        
        imap.search(searchCriteria, (err, results) => {
          if (err || !results.length) {
            imap.end();
            return resolve(null);
          }
          
          const f = imap.fetch(results[results.length - 1], { bodies: '' });
          
          f.on('message', msg => {
            msg.on('body', stream => {
              simpleParser(stream, (err, parsed) => {
                if (err) return reject(err);
                
                const html = parsed.html || parsed.textAsHtml;
                const links = html.match(/https?:\/\/[^\s<>"]+/g) || [];
                const verificationLink = links.find(link => 
                  link.includes('verify') || link.includes('confirm')
                );
                
                imap.end();
                resolve(verificationLink);
              });
            });
          });
        });
      });
    });
    
    imap.connect();
  });
}
```

---

## Solución 2: Verificación por SMS

### Opción A: Servicio de números virtuales (Recomendada)

**Servicios disponibles:**

1. **Twilio** (Más profesional)
   - Coste: ~$1/mes por número + $0.0075 por SMS recibido
   - API robusta
   - Números de muchos países
   
2. **Vonage (Nexmo)** (Alternativa)
   - Coste similar a Twilio
   - Buena API
   
3. **TextNow** (Gratuito pero limitado)
   - Números USA gratuitos
   - Sin API oficial (requiere scraping)

**Implementación con Twilio:**

```bash
npm install twilio
```

```js
const twilio = require('twilio');

async function getSMSCode(accountSid, authToken, phoneNumber) {
  const client = twilio(accountSid, authToken);
  
  // Obtener mensajes recientes
  const messages = await client.messages.list({
    to: phoneNumber,
    limit: 5,
  });
  
  if (messages.length === 0) return null;
  
  // Buscar código en el mensaje más reciente
  const lastMessage = messages[0];
  const codeMatch = lastMessage.body.match(/\b\d{4,6}\b/);
  
  return codeMatch ? codeMatch[0] : null;
}

// Uso en el bot
async function verificarSMS(bot, twilioConfig) {
  const { page, log } = bot;
  
  log('[sms] Esperando código SMS...');
  
  let attempts = 0;
  let code = null;
  
  while (attempts < 10 && !code) {
    await new Promise(r => setTimeout(r, 10000)); // Esperar 10s
    code = await getSMSCode(
      twilioConfig.accountSid,
      twilioConfig.authToken,
      twilioConfig.phoneNumber
    );
    attempts++;
    log(`[sms] Intento ${attempts}/10...`);
  }
  
  if (code) {
    log(`[sms] Código recibido: ${code}`);
    
    // Rellenar campo de código
    await page.locator('input[name*="code"], input[placeholder*="code" i]').fill(code);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);
    
    return true;
  }
  
  log('[sms] No se recibió código SMS');
  return false;
}
```

### Opción B: Números temporales (No recomendada para producción)

**Servicios:**
- receive-smss.com
- sms-online.co
- freephonenum.com

**Problemas:**
- Números públicos (cualquiera puede ver los SMS)
- Bloqueados por muchos servicios
- No confiables

---

## Solución 3: Estrategia híbrida (Recomendada)

Combinar ambas verificaciones con prioridades:

```js
async function verificarCuenta(bot, directorio, config) {
  const { page, log } = bot;
  
  // Detectar tipo de verificación requerida
  const content = await page.content();
  
  if (content.includes('verify') || content.includes('check your email')) {
    log('[verificacion] Email detectado');
    
    const emailVerified = await verificarEmail(
      bot,
      config.email,
      directorio.emailDomain // ej: 'certicalia.com'
    );
    
    if (emailVerified) {
      return { tipo: 'email', estado: 'completado' };
    }
    
    return { tipo: 'email', estado: 'pendiente_manual' };
  }
  
  if (content.includes('sms') || content.includes('phone') || content.includes('código')) {
    log('[verificacion] SMS detectado');
    
    if (config.twilioEnabled) {
      const smsVerified = await verificarSMS(bot, config.twilio);
      
      if (smsVerified) {
        return { tipo: 'sms', estado: 'completado' };
      }
    }
    
    return { tipo: 'sms', estado: 'requiere_manual' };
  }
  
  return { tipo: 'ninguna', estado: 'completado' };
}
```

---

## Configuración recomendada

### 1. Para empezar (solo email)

```js
// .env
GMAIL_CLIENT_ID=xxx
GMAIL_CLIENT_SECRET=xxx
GMAIL_REDIRECT_URI=http://localhost:3000/oauth2callback

// business-data.js
const CONFIG = {
  email: {
    enabled: true,
    provider: 'gmail',
    address: 'info@resistone.es',
  },
  sms: {
    enabled: false, // Desactivado por ahora
  },
};
```

### 2. Para producción (email + SMS)

```js
// .env
GMAIL_CLIENT_ID=xxx
GMAIL_CLIENT_SECRET=xxx
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+34612345678

// business-data.js
const CONFIG = {
  email: {
    enabled: true,
    provider: 'gmail',
    address: 'info@resistone.es',
  },
  sms: {
    enabled: true,
    provider: 'twilio',
    phoneNumber: '+34612345678',
  },
};
```

---

## Costes estimados

| Servicio | Coste mensual | Coste por verificación |
|---|---|---|
| **Gmail API** | Gratis | Gratis |
| **IMAP** | Gratis | Gratis |
| **Twilio SMS** | $1/mes (número) | $0.0075/SMS |
| **Vonage SMS** | $1/mes (número) | $0.01/SMS |

**Para 100 directorios/mes:**
- Solo email: **Gratis**
- Email + SMS (50% requieren SMS): $1 + ($0.0075 × 50) = **$1.38/mes**

---

## Implementación paso a paso

### Paso 1: Configurar Gmail API

1. Ir a https://console.cloud.google.com
2. Crear proyecto nuevo
3. Habilitar Gmail API
4. Crear credenciales OAuth 2.0
5. Descargar `credentials.json` a `backlink-bot/`
6. Ejecutar script de autorización (primera vez):

```js
// authorize-gmail.js
const { google } = require('googleapis');
const fs = require('fs');
const readline = require('readline');

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = 'token.json';

async function authorize() {
  const credentials = JSON.parse(fs.readFileSync('credentials.json'));
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  
  console.log('Autoriza esta app visitando:', authUrl);
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  rl.question('Pega el código aquí: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error:', err);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
      console.log('Token guardado en', TOKEN_PATH);
    });
  });
}

authorize();
```

### Paso 2: Integrar en el bot

```js
// Añadir al script de inscripción
const { verificarEmail } = require('./email-verifier');

// Tras el registro
if (result.estado === 'pendiente_verificacion') {
  const verified = await verificarEmail(bot, biz.email, directorio.emailDomain);
  
  if (verified) {
    result.estado = 'completado';
    result.backlink_activo = true;
  }
}
```

---

## Recomendación final

**Para empezar:**
1. Implementar solo verificación de email con Gmail API (gratis)
2. Marcar directorios que requieren SMS como `requiere_sms`
3. Verificar SMS manualmente (son pocos)

**Para escalar:**
1. Añadir Twilio cuando tengas >20 directorios que requieren SMS
2. El coste es mínimo ($1-2/mes) y automatiza completamente el proceso

**Prioridad:**
- ✅ Email: Alta (70% de directorios lo requieren)
- ⏳ SMS: Media (20% de directorios lo requieren)
- ❌ Captcha: Baja (5% de directorios, mejor resolver manualmente)

¿Quieres que implemente la verificación de email con Gmail API ahora?
