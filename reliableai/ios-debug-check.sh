#!/bin/bash
# iOS Build Debug Checker
# Run this to verify local setup before pushing to CI

echo "=== ReliableAI iOS Build Debug ==="
echo ""

echo "1. Checking directory structure..."
echo "   Root directory: $(pwd)"
echo "   reliableai/ exists: $([ -d "reliableai" ] && echo "✓" || echo "✗")"
echo "   reliableai/package.json exists: $([ -f "reliableai/package.json" ] && echo "✓" || echo "✗")"
echo "   reliableai/capacitor.config.json exists: $([ -f "reliableai/capacitor.config.json" ] && echo "✓" || echo "✗")"
echo "   reliableai/fastlane/ exists: $([ -d "reliableai/fastlane" ] && echo "✓" || echo "✗")"
echo "   reliableai/ios-assets/icon-1024.png exists: $([ -f "reliableai/ios-assets/icon-1024.png" ] && echo "✓" || echo "✗")"
echo ""

echo "2. Checking Capacitor config..."
if [ -f "reliableai/capacitor.config.json" ]; then
  echo "   App ID: $(grep -o '"appId": "[^"]*"' reliableai/capacitor.config.json | cut -d'"' -f4)"
  echo "   App Name: $(grep -o '"appName": "[^"]*"' reliableai/capacitor.config.json | cut -d'"' -f4)"
  echo "   Web Dir: $(grep -o '"webDir": "[^"]*"' reliableai/capacitor.config.json | cut -d'"' -f4)"
fi
echo ""

echo "3. Checking Fastlane files..."
echo "   Gemfile exists: $([ -f "reliableai/fastlane/Gemfile" ] && echo "✓" || echo "✗")"
echo "   Fastfile exists: $([ -f "reliableai/fastlane/Fastfile" ] && echo "✓" || echo "✗")"
echo "   Appfile exists: $([ -f "reliableai/fastlane/Appfile" ] && echo "✓" || echo "✗")"
echo ""

echo "4. Checking Fastfile paths..."
if [ -f "reliableai/fastlane/Fastfile" ]; then
  echo "   xcodeproj path: $(grep 'xcodeproj:' reliableai/fastlane/Fastfile | head -1 | xargs)"
  echo "   workspace path: $(grep 'workspace:' reliableai/fastlane/Fastfile | head -1 | xargs)"
fi
echo ""

echo "5. Checking GitHub secrets (names only, not values)..."
echo "   Required secrets:"
echo "   - IOS_DISTRIBUTION_CERT_BASE64"
echo "   - IOS_DISTRIBUTION_CERT_PASSWORD"
echo "   - KEYCHAIN_PASSWORD"
echo "   - IOS_PROVISIONING_PROFILE_BASE64"
echo "   - ASC_KEY_ID"
echo "   - ASC_ISSUER_ID"
echo "   - ASC_PRIVATE_KEY_BASE64"
echo "   (Verify these exist in GitHub repo settings > Secrets and variables > Actions)"
echo ""

echo "6. Checking workflow file..."
echo "   Workflow exists: $([ -f ".github/workflows/ios-build.yml" ] && echo "✓" || echo "✗")"
if [ -f ".github/workflows/ios-build.yml" ]; then
  echo "   Triggers on: $(grep -A 5 '^on:' .github/workflows/ios-build.yml | grep -E '(branches|tags)' | xargs)"
fi
echo ""

echo "=== Debug check complete ==="
echo ""
echo "If all checks pass (✓), the issue is likely in CI environment or secrets."
echo "If any checks fail (✗), fix those first before pushing to CI."
