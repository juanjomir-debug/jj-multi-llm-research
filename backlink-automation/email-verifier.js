#!/usr/bin/env node
/**
 * email-verifier.js — Módulo de verificación de email con Gmail API
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

/**
 * Obtiene el cliente OAuth2 autenticado
 */
function getAuthClient() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error('credentials.json no encontrado. Ejecuta: node authorize-gmail.js');
  }
  
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error('token.json no encontrado. Ejecuta: node authorize-gmail.js');
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
  
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );
  
  oAuth2Client.setCredentials(token);
  
  return oAuth2Client;
}

/**
 * Busca email de verificación de un directorio
 * @param {string} emailAddress - Email donde buscar (ej: info@resistone.es)
 * @param {string} fromDomain - Dominio del remitente (ej: certicalia.com)
 * @param {number} maxAgeMinutes - Antigüedad máxima del email en minutos (default: 60)
 * @returns {Promise<string|null>} - URL de verificación o null
 */
async function getVerificationEmail(emailAddress, fromDomain, maxAgeMinutes = 60) {
  try {
    const auth = getAuthClient();
    const gmail = google.gmail({ version: 'v1', auth });
    
    // Calcular timestamp para búsqueda
    const afterTimestamp = Math.floor((Date.now() - maxAgeMinutes * 60 * 1000) / 1000);
    
    // Buscar emails recientes del directorio
    const query = `from:${fromDomain} to:${emailAddress} after:${afterTimestamp}`;
    
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
    
    // Extraer cuerpo del email
    let body = '';
    
    if (message.data.payload.body.data) {
      body = Buffer.from(message.data.payload.body.data, 'base64').toString();
    } else if (message.data.payload.parts) {
      // Email multipart
      for (const part of message.data.payload.parts) {
        if (part.mimeType === 'text/html' || part.mimeType === 'text/plain') {
          if (part.body.data) {
            body += Buffer.from(part.body.data, 'base64').toString();
          }
        }
      }
    }
    
    // Extraer enlaces del cuerpo
    const links = body.match(/https?:\/\/[^\s<>"']+/g) || [];
    
    // Buscar enlace de verificación (patrones comunes)
    const verificationLink = links.find(link => {
      const lower = link.toLowerCase();
      return (
        lower.includes('verify') ||
        lower.includes('confirm') ||
        lower.includes('activate') ||
        lower.includes('validation') ||
        lower.includes('verificar') ||
        lower.includes('confirmar') ||
        lower.includes('activar')
      );
    });
    
    return verificationLink || null;
    
  } catch (err) {
    console.error('[email-verifier:error]', err.message);
    return null;
  }
}

/**
 * Espera y verifica email con reintentos
 * @param {object} bot - Instancia del bot (con page, log)
 * @param {string} emailAddress - Email donde buscar
 * @param {string} fromDomain - Dominio del remitente
 * @param {number} maxAttempts - Número máximo de intentos (default: 10)
 * @param {number} intervalSeconds - Intervalo entre intentos en segundos (default: 10)
 * @returns {Promise<boolean>} - true si se verificó, false si no
 */
async function verificarEmail(bot, emailAddress, fromDomain, maxAttempts = 10, intervalSeconds = 10) {
  const { page, log } = bot;
  
  log(`[email] Esperando email de verificación de ${fromDomain}...`);
  
  let attempts = 0;
  let verificationLink = null;
  
  while (attempts < maxAttempts && !verificationLink) {
    attempts++;
    
    log(`[email] Intento ${attempts}/${maxAttempts}...`);
    
    verificationLink = await getVerificationEmail(emailAddress, fromDomain);
    
    if (verificationLink) {
      log(`[email] ✅ Enlace encontrado: ${verificationLink}`);
      
      // Navegar al enlace de verificación
      try {
        await page.goto(verificationLink, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
        
        log('[email] ✅ Verificación completada');
        return true;
        
      } catch (err) {
        log(`[email] ⚠️ Error al navegar al enlace: ${err.message}`);
        return false;
      }
    }
    
    if (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, intervalSeconds * 1000));
    }
  }
  
  log('[email] ❌ No se recibió email de verificación');
  return false;
}

/**
 * Busca código de verificación en email (para códigos de 4-6 dígitos)
 * @param {string} emailAddress - Email donde buscar
 * @param {string} fromDomain - Dominio del remitente
 * @returns {Promise<string|null>} - Código o null
 */
async function getVerificationCode(emailAddress, fromDomain) {
  try {
    const auth = getAuthClient();
    const gmail = google.gmail({ version: 'v1', auth });
    
    const afterTimestamp = Math.floor((Date.now() - 3600000) / 1000); // Última hora
    const query = `from:${fromDomain} to:${emailAddress} after:${afterTimestamp}`;
    
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 5,
    });
    
    if (!res.data.messages || res.data.messages.length === 0) {
      return null;
    }
    
    const messageId = res.data.messages[0].id;
    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });
    
    // Extraer cuerpo
    let body = '';
    if (message.data.payload.body.data) {
      body = Buffer.from(message.data.payload.body.data, 'base64').toString();
    } else if (message.data.payload.parts) {
      for (const part of message.data.payload.parts) {
        if (part.mimeType === 'text/html' || part.mimeType === 'text/plain') {
          if (part.body.data) {
            body += Buffer.from(part.body.data, 'base64').toString();
          }
        }
      }
    }
    
    // Buscar código de 4-6 dígitos
    const codeMatch = body.match(/\b\d{4,6}\b/);
    return codeMatch ? codeMatch[0] : null;
    
  } catch (err) {
    console.error('[email-verifier:error]', err.message);
    return null;
  }
}

module.exports = {
  getVerificationEmail,
  verificarEmail,
  getVerificationCode,
};
