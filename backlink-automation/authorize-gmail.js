#!/usr/bin/env node
/**
 * authorize-gmail.js — Script de autorización inicial para Gmail API
 * Solo se ejecuta UNA VEZ para obtener el token.json
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

async function authorize() {
  // Verificar que existe credentials.json
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('❌ ERROR: No se encontró credentials.json');
    console.error('');
    console.error('Sigue estos pasos:');
    console.error('1. Ve a https://console.cloud.google.com/apis/credentials');
    console.error('2. Crea credenciales OAuth 2.0 (tipo "Aplicación de escritorio")');
    console.error('3. Descarga el JSON y guárdalo como backlink-bot/credentials.json');
    console.error('');
    console.error('Guía completa: backlink-bot/SETUP-GMAIL-API.md');
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Generar URL de autorización
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  AUTORIZACIÓN GMAIL API');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('1. Abre esta URL en tu navegador:\n');
  console.log(authUrl);
  console.log('\n2. Inicia sesión con la cuenta de Gmail que quieres usar');
  console.log('   (info@resistone.es o contact@reliableai.co)');
  console.log('\n3. Autoriza la aplicación');
  console.log('\n4. Copia el código que te dan\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Pega el código aquí: ', async (code) => {
    rl.close();
    
    try {
      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);
      
      // Guardar token
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      
      console.log('\n✅ Token guardado en:', TOKEN_PATH);
      console.log('✅ Autorización completada');
      console.log('\nYa puedes usar el bot con verificación de email automática.');
      
    } catch (err) {
      console.error('\n❌ Error al obtener token:', err.message);
      console.error('\nIntenta de nuevo. Si el error persiste:');
      console.error('1. Revoca el acceso en https://myaccount.google.com/permissions');
      console.error('2. Vuelve a ejecutar este script');
    }
  });
}

authorize();
