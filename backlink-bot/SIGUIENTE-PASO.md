# 🎯 Siguiente Paso — Autorizar Gmail API

## ✅ Lo que ya está hecho

1. ✅ Código implementado (`email-verifier.js`, `authorize-gmail.js`, etc.)
2. ✅ Dependencias instaladas (`googleapis`)
3. ✅ `credentials.json` configurado
4. ✅ `.gitignore` actualizado
5. ✅ Documentación completa

## 🚀 Lo que falta (1 minuto)

Solo necesitas autorizar la aplicación para que pueda leer tus emails.

### Ejecuta este comando:

```bash
node backlink-bot/authorize-gmail.js
```

### Qué pasará:

1. Se abrirá tu navegador con una URL de Google
2. Te pedirá que inicies sesión con Gmail
   - Usa: **info@resistone.es** (o contact@reliableai.co)
3. Te pedirá que autorices la aplicación
   - Click en "Permitir"
4. Te dará un código
5. Pega el código en la terminal
6. Se creará `token.json` automáticamente

### Después de autorizar:

```bash
# Probar que funciona
node backlink-bot/test-email-verifier.js

# Ejecutar el bot con verificación automática
node backlink-bot/completar-altas.js
```

## 🔐 Seguridad

- `credentials.json` y `token.json` están en `.gitignore`
- Nunca se subirán a git
- Solo tú tienes acceso

## 📞 Si tienes problemas

1. Revisa `SETUP-GMAIL-API.md` — Guía completa
2. Revisa `VERIFICACIONES.md` — Documentación de verificaciones
3. Ejecuta `node backlink-bot/setup-wizard.js` — Diagnóstico

## ✅ Checklist

- [x] Código implementado
- [x] Dependencias instaladas
- [x] credentials.json configurado
- [ ] **Ejecutar: node backlink-bot/authorize-gmail.js** ← AHORA
- [ ] Probar: node backlink-bot/test-email-verifier.js
- [ ] Usar: node backlink-bot/completar-altas.js

## 🎉 Resultado final

Una vez autorizado, el bot podrá:

1. Registrar cuenta en directorio
2. Esperar email de verificación (max 100s)
3. Extraer enlace automáticamente
4. Navegar y verificar
5. Todo sin intervención manual

**Tiempo ahorrado**: ~2-3 minutos por directorio × 70% de directorios.

Para 100 directorios: **2.5 horas ahorradas**.
