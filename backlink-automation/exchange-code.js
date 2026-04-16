#!/usr/bin/env node
/**
 * exchange-code.js — Intercambia código de autorización por token
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

const code = process.argv[2];

if (!code) {
  console.error('❌ Error: Falta el código de autorización');
  console.error('Uso: node exchange-code.js CODIGO');
  process.exit(1);
}

async function exchangeCode() {
  try {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    
    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );

    console.log('Intercambiando código por token...');
    
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    
    console.log('\n✅ Token guardado en:', TOKEN_PATH);
    console.log('✅ Autorización completada');
    console.log('\nYa puedes usar el bot con verificación de email automática.');
    
  } catch (err) {
    console.error('\n❌ Error al intercambiar código:', err.message);
    console.error('\nPosibles causas:');
    console.error('- El código ya fue usado');
    console.error('- El código expiró (son válidos solo unos minutos)');
    console.error('- Hay un error en las credenciales');
    console.error('\nSolución: Genera un nuevo código autorizando de nuevo.');
  }
}

exchangeCode();
