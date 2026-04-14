# Configuración Gmail API — Guía paso a paso

## ⏱️ Tiempo estimado: 5 minutos

## Paso 1: Crear proyecto en Google Cloud

1. Ve a: https://console.cloud.google.com
2. Click en el selector de proyectos (arriba izquierda)
3. Click en "Nuevo proyecto"
4. Nombre: `ReliableAI Backlinks`
5. Click "Crear"
6. Espera 10-20 segundos a que se cree

## Paso 2: Habilitar Gmail API

1. Con el proyecto seleccionado, ve a: https://console.cloud.google.com/apis/library/gmail.googleapis.com
2. Click en "Habilitar"
3. Espera a que se active (5-10 segundos)

## Paso 3: Crear credenciales OAuth 2.0

1. Ve a: https://console.cloud.google.com/apis/credentials
2. Click en "Crear credenciales" (arriba)
3. Selecciona "ID de cliente de OAuth"
4. Si te pide configurar pantalla de consentimiento:
   - Click "Configurar pantalla de consentimiento"
   - Selecciona "Externo"
   - Click "Crear"
   - Rellena solo los campos obligatorios:
     - Nombre de la aplicación: `ReliableAI Backlinks`
     - Correo de asistencia: tu email
     - Correo del desarrollador: tu email
   - Click "Guardar y continuar"
   - En "Permisos" → Click "Guardar y continuar" (sin añadir nada)
   - En "Usuarios de prueba" → Click "Guardar y continuar"
   - Click "Volver al panel"
5. Vuelve a "Credenciales" → "Crear credenciales" → "ID de cliente de OAuth"
6. Tipo de aplicación: **"Aplicación de escritorio"**
7. Nombre: `Backlink Bot`
8. Click "Crear"
9. **IMPORTANTE**: Aparecerá un modal con tu ID y secreto
10. Click en "Descargar JSON"
11. Guarda el archivo como `credentials.json` en la carpeta `backlink-bot/`

## Paso 4: Añadir permisos (scopes)

Ya está configurado en el código — el script pedirá permiso para:
- `https://www.googleapis.com/auth/gmail.readonly` (solo lectura de emails)

## Paso 5: Ejecutar autorización inicial

Una vez tengas `credentials.json` en `backlink-bot/`:

```bash
cd backlink-bot
node authorize-gmail.js
```

Esto:
1. Abrirá tu navegador
2. Te pedirá que inicies sesión con la cuenta de Gmail que quieres usar (info@resistone.es o contact@reliableai.co)
3. Te pedirá que autorices la app
4. Te dará un código
5. Pega el código en la terminal
6. Se creará `token.json` automáticamente

## ✅ Listo

Una vez tengas `token.json`, el bot podrá leer emails automáticamente sin intervención.

## Notas de seguridad

- `credentials.json` y `token.json` son secretos — NO los subas a git
- Ya están en `.gitignore`
- El token expira cada 7 días — el script lo renovará automáticamente
- Solo tienes que autorizar una vez

## Troubleshooting

### Error: "Access blocked: This app's request is invalid"
**Solución**: Asegúrate de haber configurado la pantalla de consentimiento como "Externo" y añadido tu email como usuario de prueba.

### Error: "invalid_grant"
**Solución**: El token expiró. Borra `token.json` y vuelve a ejecutar `authorize-gmail.js`.

### Error: "The user has not granted the app..."
**Solución**: Revoca el acceso en https://myaccount.google.com/permissions y vuelve a autorizar.
