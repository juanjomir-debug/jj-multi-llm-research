# Cómo exportar cookies de Reddit desde Chrome

## Método 1: Manual (más simple)

1. **Abre Chrome** y ve a https://old.reddit.com (asegúrate de estar logueado)

2. **Abre DevTools**: Presiona `F12` o `Ctrl+Shift+I`

3. **Ve a la pestaña Application** (o "Aplicación" si está en español)

4. **En el panel izquierdo**, expande "Cookies" y haz click en `https://old.reddit.com`

5. **Copia estas cookies** (las más importantes):
   - `reddit_session`
   - `token_v2`
   - `edgebucket`

6. **Crea el archivo** `reddit-bot/reddit-cookies-manual.json` con este formato:

```json
[
  {
    "name": "reddit_session",
    "value": "PEGA_AQUI_EL_VALOR",
    "domain": ".reddit.com",
    "path": "/"
  },
  {
    "name": "token_v2",
    "value": "PEGA_AQUI_EL_VALOR",
    "domain": ".reddit.com",
    "path": "/"
  },
  {
    "name": "edgebucket",
    "value": "PEGA_AQUI_EL_VALOR",
    "domain": ".reddit.com",
    "path": "/"
  }
]
```

7. **Ejecuta el bot**:
```bash
node reddit-bot/reddit-with-cookies.js
```

---

## Método 2: Desde la consola de Chrome (más rápido)

1. **Abre Chrome** y ve a https://old.reddit.com (logueado)

2. **Abre la consola**: `F12` → pestaña "Console"

3. **Pega este código** y presiona Enter:

```javascript
copy(JSON.stringify(
  document.cookie.split('; ').map(c => {
    const [name, value] = c.split('=');
    return {
      name,
      value,
      domain: '.reddit.com',
      path: '/'
    };
  }),
  null,
  2
));
```

4. **El JSON se copió al portapapeles**. Pégalo en `reddit-bot/reddit-cookies-manual.json`

5. **Ejecuta el bot**:
```bash
node reddit-bot/reddit-with-cookies.js
```

---

## Verificar que funcionó

Si todo está bien, verás en el log:

```
[cookies] Cargadas 3 cookies
[cookies] ✅ Cookies inyectadas
[login] ✅ Sesión activa
[search] Buscando posts en r/artificial...
```

Si ves `❌ Sesión no válida`, las cookies expiraron o son incorrectas. Repite el proceso.

---

## Duración de las cookies

Las cookies de Reddit suelen durar **30 días**. Después tendrás que exportarlas de nuevo.

---

## Seguridad

⚠️ **IMPORTANTE**: Las cookies son como tu contraseña. No las compartas ni las subas a GitHub.

El archivo `reddit-cookies-manual.json` ya está en `.gitignore`.
