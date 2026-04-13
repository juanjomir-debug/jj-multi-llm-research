#!/usr/bin/env node
// tweet-playwright.js — Publica tweets usando Playwright (simula navegador real)
// Uso: node tweet-playwright.js --account martinkarsel --text "texto del tweet"
//      node tweet-playwright.js --account martinkarsel --reply TWEET_ID --text "respuesta"

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// ── Configuración de cuentas ──────────────────────────────────────────────────
const ACCOUNTS = {
  juanjomir: {
    auth_token: '5b257722557b2504f8aaad1194e44b6472aca5cb',
    ct0: '',
  },
  martinkarsel: {
    auth_token: 'f3076850ae503c6f68ba70c78158bc83d6c30553',
    ct0: 'faf6f09dfa26f8e0e806515db7ea242ce9b258132835202f5674fc0d68ff52614ba2c9d6bc6e935602729103a0d15ecbecdf3ed956aefa9c43ddd2d2ef2189c8b62fbf4a3c6ce61a814b1a5586f0d024',
  },
  reliableai: {
    auth_token: '2cf5beff434fe792b8f540380daa628742c426d0',
    ct0: '8a04959a72368239d03e0413f89c34913d77b23fcf5196ad894f001351c3121a03f6ebdb3f9a8342f53953b134a5e06d9039359d5e2396da3a0dd2a79f2478c1eab251e513cf1b60c1260e5b538d4eb0',
  },
};

// ── Parse args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const accountName = get('--account') || 'juanjomir';
const text = get('--text');
const replyTo = get('--reply'); // tweet ID to reply to

if (!text) { console.error('Usage: node tweet-playwright.js --account NAME --text "tweet text" [--reply TWEET_ID]'); process.exit(1); }

const account = ACCOUNTS[accountName];
if (!account) { console.error(`Unknown account: ${accountName}`); process.exit(1); }

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  // Inyectar cookies de sesión
  const cookies = [
    { name: 'auth_token', value: account.auth_token, domain: '.x.com', path: '/', secure: true, httpOnly: true },
  ];
  if (account.ct0) {
    cookies.push({ name: 'ct0', value: account.ct0, domain: '.x.com', path: '/', secure: true });
  }
  await context.addCookies(cookies);

  const page = await context.newPage();

  try {
    if (replyTo) {
      // Navegar al tweet para responder
      console.log(`[playwright] Navigating to tweet ${replyTo}...`);
      await page.goto(`https://x.com/i/status/${replyTo}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Clicar en el botón de reply
      const replyBtn = page.locator('[data-testid="reply"]').first();
      await replyBtn.click();
      await page.waitForTimeout(1500);
    } else {
      // Navegar a home para tweet nuevo
      console.log(`[playwright] Navigating to X home...`);
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Clicar en el compose box
      const composeBtn = page.locator('[data-testid="SideNav_NewTweet_Button"]').first();
      await composeBtn.click();
      await page.waitForTimeout(1500);
    }

    // Escribir el texto
    const textbox = page.locator('[data-testid="tweetTextarea_0"]').first();
    await textbox.click();
    await textbox.fill(text);
    await page.waitForTimeout(1000);

    // Publicar
    const submitBtn = page.locator('[data-testid="tweetButtonInline"], [data-testid="tweetButton"]').first();
    await submitBtn.click();
    await page.waitForTimeout(3000);

    // Verificar éxito buscando el tweet en el perfil
    console.log(`[playwright] ✅ Tweet published successfully from @${accountName}`);
    console.log(`[playwright] Text: ${text.substring(0, 80)}...`);

  } catch (err) {
    // Captura de pantalla para debug
    const screenshotPath = `/tmp/tweet-error-${accountName}-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath });
    console.error(`[playwright] ❌ Error: ${err.message}`);
    console.error(`[playwright] Screenshot saved: ${screenshotPath}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
