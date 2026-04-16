# ReliableAI iOS App — Setup Guide

## Prerequisites checklist

- [ ] Apple Developer account ($99/yr) at developer.apple.com
- [ ] App record created in App Store Connect with bundle ID `net.reliableai.app`
- [ ] Distribution certificate (.p12) exported from Keychain
- [ ] App Store provisioning profile (.mobileprovision) downloaded
- [ ] App Store Connect API Key created (.p8 file)

---

## Step 1 — Apple Developer Setup

1. Enroll at https://developer.apple.com/programs/enroll/
2. Go to **Certificates, IDs & Profiles**
3. Create **App ID**: `net.reliableai.app` (explicit, not wildcard)
4. Create **Distribution Certificate** (requires CSR — GitHub Actions can do this automatically with `match`, or generate on MacInCloud)
5. Create **App Store Distribution Provisioning Profile** linked to the App ID
6. Go to **App Store Connect** → create new app with bundle ID `net.reliableai.app`
7. Go to **Users & Access → Integrations → App Store Connect API** → create key, download `.p8`

---

## Step 2 — Prepare GitHub Secrets

In your GitHub repo → Settings → Secrets and variables → Actions, add:

| Secret | How to get it |
|--------|--------------|
| `IOS_DISTRIBUTION_CERT_BASE64` | `base64 -i YourCert.p12` |
| `IOS_DISTRIBUTION_CERT_PASSWORD` | Password you set when exporting .p12 |
| `KEYCHAIN_PASSWORD` | Any strong password (used only in CI) |
| `IOS_PROVISIONING_PROFILE_BASE64` | `base64 -i ReliableAI.mobileprovision` |
| `ASC_KEY_ID` | Key ID from App Store Connect API page |
| `ASC_ISSUER_ID` | Issuer ID from App Store Connect API page |
| `ASC_PRIVATE_KEY_BASE64` | `base64 -i AuthKey_XXXXXX.p8` |

---

## Step 3 — App Icons & Splash

Create these files in `ios-assets/`:
- `icon-1024.png` — 1024x1024, no transparency (solid background)
- `splash-2732x2732.png` — background #1c1c1c with logo centered

Then run (on Mac or GitHub Actions):
```bash
npx @capacitor/assets generate --ios
```

---

## Step 4 — Initialize iOS project (one-time, on Mac)

Use MacInCloud, GitHub Actions manual run, or Codemagic:

```bash
npm install
npm install @capacitor/core@6.2.0 @capacitor/ios@6.2.0 @capacitor/splash-screen@6.0.2
npx cap add ios
npx cap sync ios
```

Commit the generated `ios/` directory (excluding `ios/App/Pods/`).

---

## Step 5 — Edit Info.plist

In `ios/App/App/Info.plist`, add inside the root `<dict>`:

```xml
<key>WKAppBoundDomains</key>
<array>
  <string>reliableai.net</string>
  <string>checkout.stripe.com</string>
  <string>billing.stripe.com</string>
</array>

<key>UIStatusBarStyle</key>
<string>UIStatusBarStyleLightContent</string>

<key>UIViewControllerBasedStatusBarAppearance</key>
<false/>

<key>UISupportedInterfaceOrientations</key>
<array>
  <string>UIInterfaceOrientationPortrait</string>
  <string>UIInterfaceOrientationLandscapeLeft</string>
  <string>UIInterfaceOrientationLandscapeRight</string>
</array>

<key>UISupportedInterfaceOrientations~ipad</key>
<array>
  <string>UIInterfaceOrientationPortrait</string>
  <string>UIInterfaceOrientationPortraitUpsideDown</string>
  <string>UIInterfaceOrientationLandscapeLeft</string>
  <string>UIInterfaceOrientationLandscapeRight</string>
</array>
```

---

## Step 6 — Update Fastfile team_id

In `fastlane/Appfile`, uncomment and fill in your Apple Team ID:
```ruby
team_id "XXXXXXXXXX"
```

Find your Team ID at: https://developer.apple.com/account → top right

---

## Step 7 — Trigger build

```bash
git add .
git commit -m "Add Capacitor iOS app"
git tag v1.0.0
git push origin main --tags
```

GitHub Actions starts automatically. Monitor at: https://github.com/YOUR_REPO/actions

Build time: ~15-20 minutes on macos-latest runner.

---

## App Store Submission Checklist

- [ ] Screenshots for iPhone 6.5" (1242x2688) and iPad Pro 12.9" (2048x2732)
- [ ] App description (do NOT mention "web app" or "website")
- [ ] Privacy Policy URL: `https://reliableai.net/privacy`
- [ ] Support URL: `https://reliableai.net`
- [ ] Age rating: 4+
- [ ] Category: Productivity
- [ ] Keywords: AI, research, GPT, Claude, Gemini, multi-model, analysis

---

## Known Limitations (post-launch improvements)

- `.docx` export doesn't work in WKWebView (no download manager) — add `@capacitor/filesystem` plugin
- No offline mode — add `@capacitor/network` for a "no connection" screen
- Push notifications not implemented — requires `@capacitor/push-notifications` + APNs setup
