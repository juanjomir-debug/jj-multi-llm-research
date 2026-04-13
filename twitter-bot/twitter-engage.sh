#!/bin/bash
# twitter-engage.sh — Busca tweets y responde desde múltiples cuentas
# Cron: 0 18 * * 1-5 /root/scripts/twitter-engage.sh >> /root/scripts/twitter-engage.log 2>&1

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$SCRIPT_DIR/twitter-engage.log"
ANTHROPIC_KEY="${ANTHROPIC_API_KEY:-}"
XAI_KEY="${XAI_API_KEY:-}"

# Formato: "handle|auth_token|ct0|persona"
ACCOUNTS=(
  "juanjomir|5b257722557b2504f8aaad1194e44b6472aca5cb||Eres @juanjomir, experto en comparativas de modelos de IA y creador de reliableai.net. Responde en español."
  "martinkarsel|f3076850ae503c6f68ba70c78158bc83d6c30553|faf6f09dfa26f8e0e806515db7ea242ce9b258132835202f5674fc0d68ff52614ba2c9d6bc6e935602729103a0d15ecbecdf3ed956aefa9c43ddd2d2ef2189c8b62fbf4a3c6ce61a814b1a5586f0d024|Eres @martinkarsel, investigador de IA. Responde en español sobre comparativas de LLMs."
  "reliableai|2cf5beff434fe792b8f540380daa628742c426d0|8a04959a72368239d03e0413f89c34913d77b23fcf5196ad894f001351c3121a03f6ebdb3f9a8342f53953b134a5e06d9039359d5e2396da3a0dd2a79f2478c1eab251e513cf1b60c1260e5b538d4eb0|Eres la cuenta oficial de @reliableai. Responde en español o inglés según el tweet."
)

QUERIES=("Claude vs GPT" "mejor modelo IA" "ChatGPT Gemini Claude" "LLM comparativa" "cual es mejor IA")

echo "=== $(date '+%Y-%m-%d %H:%M:%S') ===" | tee -a "$LOG"

QUERY="${QUERIES[$((RANDOM % ${#QUERIES[@]}))]}"
echo "[search] Query: $QUERY" | tee -a "$LOG"

SEARCH_RESULT=$(XAI_API_KEY="$XAI_KEY" timeout 30 node /root/clawd/skills/search-x/scripts/search.js "$QUERY" --days 1 2>/dev/null || echo "")
if [ -z "$SEARCH_RESULT" ]; then
  SEARCH_RESULT=$(XAI_API_KEY="$XAI_KEY" timeout 30 node /root/clawd/skills/search-x/scripts/search.js "$QUERY" --days 3 2>/dev/null || echo "")
fi
if [ -z "$SEARCH_RESULT" ]; then
  echo "[search] No results, skipping." | tee -a "$LOG"
  exit 0
fi

TWEET_IDS=($(echo "$SEARCH_RESULT" | grep -oP 'status/\K\d{15,20}' | head -n 10))

if [ ${#TWEET_IDS[@]} -eq 0 ]; then
  echo "[extract] No tweet IDs found, skipping." | tee -a "$LOG"
  exit 0
fi

touch "$SCRIPT_DIR/posted_ids.txt"

for ACCOUNT in "${ACCOUNTS[@]}"; do
  HANDLE=$(echo "$ACCOUNT" | cut -d'|' -f1)
  TOKEN=$(echo "$ACCOUNT" | cut -d'|' -f2)
  CT0=$(echo "$ACCOUNT" | cut -d'|' -f3)
  PERSONA=$(echo "$ACCOUNT" | cut -d'|' -f4)

  TWEET_ID=""
  for TID in "${TWEET_IDS[@]}"; do
    KEY="${HANDLE}:${TID}"
    if ! grep -q "$KEY" "$SCRIPT_DIR/posted_ids.txt" 2>/dev/null; then
      TWEET_ID="$TID"
      break
    fi
  done

  if [ -z "$TWEET_ID" ]; then
    echo "[skip] @$HANDLE — no new tweets to reply to" | tee -a "$LOG"
    continue
  fi

  echo "[account] @$HANDLE -> tweet $TWEET_ID" | tee -a "$LOG"

  # Leer el tweet original para contexto
  TWEET_TEXT=$(AUTH_TOKEN="$TOKEN" bird read "$TWEET_ID" --plain 2>/dev/null | head -c 280 || echo "comparativa de modelos de IA")

  REPLY=$(python3 - <<PYEOF
import urllib.request, json, sys

persona = """$PERSONA"""
tweet_text = """$TWEET_TEXT"""

prompt = f"""{persona}

Responde a este tweet de forma directa y util:
"{tweet_text}"

Reglas:
- Maximo 200 caracteres
- Aporta un dato concreto o perspectiva nueva
- Tono profesional pero humano, sin exclamaciones
- Menciona reliableai.net solo si encaja de forma natural
- Sin hashtags en respuestas
- NO empieces con "Gran punto" ni frases vacias

Responde SOLO con el texto del tweet, sin comillas ni explicaciones."""

payload = json.dumps({
    "model": "claude-sonnet-4-6",
    "max_tokens": 120,
    "messages": [{"role": "user", "content": prompt}]
}).encode()

req = urllib.request.Request(
    "https://api.anthropic.com/v1/messages",
    data=payload,
    headers={
        "x-api-key": "$ANTHROPIC_KEY",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
)
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read())
        print(data["content"][0]["text"].strip())
except Exception as e:
    print("")
    sys.stderr.write(str(e) + "\n")
PYEOF
)

  if [ -z "$REPLY" ]; then
    echo "[error] @$HANDLE — failed to generate reply" | tee -a "$LOG"
    continue
  fi

  echo "[reply] @$HANDLE: $REPLY" | tee -a "$LOG"

  if [ -n "$CT0" ]; then
    RESULT=$(AUTH_TOKEN="$TOKEN" CT0="$CT0" bird reply "$TWEET_ID" "$REPLY" 2>&1)
  else
    RESULT=$(AUTH_TOKEN="$TOKEN" bird reply "$TWEET_ID" "$REPLY" 2>&1)
  fi
  echo "[bird] $RESULT" | tee -a "$LOG"

  if echo "$RESULT" | grep -q "successfully"; then
    echo "${HANDLE}:${TWEET_ID}" >> "$SCRIPT_DIR/posted_ids.txt"
    URL=$(echo "$RESULT" | grep -o 'https://x.com/i/status/[0-9]*' || echo "")
    echo "[done] @$HANDLE replied: $URL" | tee -a "$LOG"
  else
    echo "[error] @$HANDLE failed to reply" | tee -a "$LOG"
  fi

  sleep $((20 + RANDOM % 40))
done
