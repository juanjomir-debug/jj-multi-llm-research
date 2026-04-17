# ReliableAI iOS Build Guide

## Quick Reference

**Repository:** https://github.com/juanjomir-debug/jj-multi-llm-research  
**Workflow:** `.github/workflows/ios-build.yml`  
**Actions:** https://github.com/juanjomir-debug/jj-multi-llm-research/actions  
**Bundle ID:** `net.reliableai.app`  
**Team ID:** `C59QGKA8BH` (Ipetel Adquisiciones S.L.)

---

## Expected Build Timeline

| Step | Duration | What's Happening |
|------|----------|------------------|
| 1-2. Checkout & Setup Node | 30s | Getting code and Node.js ready |
| 3-4. Install Capacitor | 1-2min | Installing Capacitor CLI and packages |
| 5-6. Initialize & Sync | 1-2min | Creating iOS project structure |
| 7. Generate Assets | 30s | Creating app icons and splash screens |
| 8-9. Setup Ruby & Fastlane | 1min | Installing Fastlane dependencies |
| 10-11. Import Certs | 30s | Setting up code signing |
| 12. Xcode Build | **10-15min** | Compiling the iOS app |
| 13. Upload to TestFlight | 2-3min | Uploading IPA to Apple |

**Total expected time:** ~15-20 minutes

---

## Build Status Indicators

### ✅ Success Signs
- All steps show green checkmarks
- "Build & Upload to TestFlight" completes
- Artifact "ReliableAI.ipa" is uploaded
- No red error messages

### ⚠️ Warning Signs (usually OK)
- "Node.js 20 actions are deprecated" - cosmetic, ignore
- "No artifacts will be uploaded" - only if build failed

### ❌ Failure Signs
- Red X on any step
- "Process completed with exit code 1"
- "Could not find Xcode project"
- "Code signing failed"
- "Upload to TestFlight failed"

---

## Common Errors & Solutions

### Error: "Could not find Xcode project"
**Cause:** Incorrect paths in Fastfile  
**Fix:** Paths should be `ios/App/App.xcodeproj` (no `../`)  
**Status:** ✅ Fixed in commit `4a96176`

### Error: "npm ci failed" or native module errors
**Cause:** Root package.json has heavy dependencies (sqlite, canvas, playwright)  
**Fix:** Skip `npm ci`, install only Capacitor packages  
**Status:** ✅ Fixed in commit `d17791f`

### Error: "MAC verification failed"
**Cause:** P12 certificate uses SHA-256 MAC (incompatible with macOS)  
**Fix:** Regenerate with SHA-1 MAC using OpenSSL flags  
**Status:** ✅ Fixed, using `distribution_compat.p12`

### Error: "Provisioning profile doesn't match"
**Cause:** Profile name in Fastfile doesn't match actual profile  
**Fix:** Ensure Fastfile uses exact name: `"ReliableAI App Store"`  
**Status:** ✅ Should be correct

### Error: "Code signing identity not found"
**Cause:** Certificate not imported correctly or expired  
**Fix:** Check certificate validity (expires Apr 16 2027)  
**Status:** ✅ Should be correct

---

## After Successful Build

1. **Check TestFlight**
   - Open TestFlight app on iPhone
   - Look for "ReliableAI" in Internal Testing
   - May take 5-10 minutes to appear after upload

2. **Install & Test**
   - Tap "Install" in TestFlight
   - Open the app
   - Test basic functionality:
     - App loads correctly
     - Can see the web interface
     - Can interact with the UI

3. **If App Doesn't Work**
   - Check if it's loading the correct URL (https://reliableai.net)
   - Check browser console for errors
   - Verify server is running and accessible

---

## Manual Trigger

If you need to trigger a build manually:

1. Go to: https://github.com/juanjomir-debug/jj-multi-llm-research/actions
2. Click "iOS Build & TestFlight" workflow
3. Click "Run workflow" button (top right)
4. Select branch: `main`
5. Click green "Run workflow" button

---

## Updating the App

To release a new version:

1. Make changes to `reliableai/public/index.html` or other files
2. Commit and push to `main`
3. Workflow runs automatically
4. New build appears in TestFlight

**Note:** Build number auto-increments using GitHub run number.

---

## Troubleshooting Checklist

If build fails, check:

- [ ] All GitHub secrets are set correctly (7 total)
- [ ] Certificate hasn't expired (valid until Apr 16 2027)
- [ ] Provisioning profile is valid
- [ ] App exists in App Store Connect
- [ ] ASC API key has correct permissions
- [ ] Bundle ID matches everywhere: `net.reliableai.app`
- [ ] Team ID matches everywhere: `C59QGKA8BH`
- [ ] Fastfile paths don't have `../` prefix
- [ ] Workflow triggers on `branches: [main]`

---

## Files to Never Delete

- `reliableai/package.json` - Required by Capacitor CLI
- `reliableai/capacitor.config.json` - Capacitor configuration
- `reliableai/fastlane/Fastfile` - Build automation
- `reliableai/fastlane/Appfile` - Team configuration
- `reliableai/fastlane/Gemfile` - Ruby dependencies
- `reliableai/ios-assets/icon-1024.png` - App icon source
- `reliableai/ios-assets/splash-2732x2732.png` - Splash screen
- `.github/workflows/ios-build.yml` - CI/CD pipeline

---

## Secrets Reference

All secrets are stored in: GitHub repo → Settings → Secrets and variables → Actions

| Secret Name | Description | Source File |
|-------------|-------------|-------------|
| `IOS_DISTRIBUTION_CERT_BASE64` | P12 certificate (base64) | `distribution_compat.p12` |
| `IOS_DISTRIBUTION_CERT_PASSWORD` | P12 password | `ReliableAI2024` |
| `KEYCHAIN_PASSWORD` | Temporary keychain password | Any secure string |
| `IOS_PROVISIONING_PROFILE_BASE64` | Provisioning profile (base64) | `ReliableAI.mobileprovision` |
| `ASC_KEY_ID` | App Store Connect API Key ID | `5SHKU82Z6A` |
| `ASC_ISSUER_ID` | App Store Connect Issuer ID | `085d653b-917a-42da-89f9-cfba756c5ce8` |
| `ASC_PRIVATE_KEY_BASE64` | ASC API private key (base64) | `AuthKey_5SHKU82Z6A.p8` |

---

## Contact & Support

- **Apple Developer Account:** Ipetel Adquisiciones S.L.
- **Team ID:** C59QGKA8BH
- **App Store Connect:** https://appstoreconnect.apple.com
- **GitHub Actions:** https://github.com/juanjomir-debug/jj-multi-llm-research/actions

---

## Version History

- **v1.0.0** - Initial iOS build setup
- **Current:** Automated CI/CD with GitHub Actions + TestFlight
