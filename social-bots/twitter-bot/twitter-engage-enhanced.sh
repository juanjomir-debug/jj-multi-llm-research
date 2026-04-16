#!/bin/bash
# Enhanced Twitter engagement for @juanjomir
# Prioritizes replies to our tweets, uses 25k char limit, always English

cd "$(dirname "$0")"

echo "🤖 Starting Enhanced Twitter Engagement..."
echo "Account: @juanjomir"
echo "Features:"
echo "  • Prioritizes replies to our tweets"
echo "  • Uses 25,000 character limit (Basic account)"
echo "  • Always responds in English"
echo "  • Adds viewpoints and insists in conversations"
echo ""

node engagement-enhanced.js

echo ""
echo "✅ Engagement cycle completed"
echo "Check logs in engagement-enhanced-log-*.json"
