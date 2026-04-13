#!/bin/bash
# twitter-engage.sh — Busca tweets y responde desde múltiples cuentas
# Cron: 0 18 * * 1-5 /root/scripts/twitter-engage.sh >> /root/scripts/twitter-engage.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$SCRIPT_DIR/twitter-engage.log"
ANTHROPIC_KEY="${ANTHROPIC_API_KEY:-}"
XAI_KEY="${XAI_API_KEY:-}"

# ── Cuentas configuradas ──────────────────────────────────────────────────────
ACCOUNTS=(
  "juanjomir|5b257722557b2504f8aaad1194e44b6472aca5cb|Eres @juanjomir, experto en comparativas de modelos de IA y creador de reliableai.net. Responde en español."
  "martinkarsel|f3076850ae503c6f68ba70c78158bc83d6c30553|Eres @martinkarsel, investigador de IA. Responde en español sobre comparativas de LLMs."
  "reliableai|8c61a495cd3e3b1fd9fed9c3b215ae60c67f2d42|Eres la cuenta oficial de @reliableai. Responde en español o inglés según el tweet."
)

QUERIES=("Claude vs GPT" "mejor modelo IA" "ChatGPT Gemini Claude" "LLM comparativa" "cual es mejor IA")

echo "=== $(date '+%Y-%m-%d %H:%M:%S') ===" | tee -a "$LOG"

# ── Buscar tweets una sola vez ────────────────────────────────────────────────
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

# Extraer IDs de tweets disponibles
TWEET_IDS=($(echo "$SEARCH_RESULT" | grep -oP 'status/\K\d{15,20}' | head -n 10))
TWEET_TEXTS=($(echo "$SEARCH_RESULT" | grep -oP 'Tweet: "\K[^"]{20,200}' | head -n 10))

if [ ${#TWEET_IDS[@]} -eq 0 ]; then
  echo "[extract] No tweet IDs found, skipping." | tee -a "$LOG"
  exit 0
fi

touch "$SCRIPT_DIR/posted_ids.txt"

# ── Cada cuenta responde a un tweet distinto ──────────────────────────────────
TWEET_IDX=0
for ACCOUNT in "${ACCOUNTS[@]}"; do
  HANDLE=$(echo "$ACCOUNT" | cut -d'|' -f1)
  TOKEN=$(echo "$ACCOUNT" | cut -d'|' -f2)
  PERSONA=$(echo "$ACCOUNT" | cut -d'|' -f3)

  # Buscar un tweet no respondido aún
  TWEET_ID=""
  TWEET_TEXT=""
  for i in "${!TWEET_IDS[@]}"; do
    TID="${TWEET_IDS[$i]}"
    KEY="${HANDLE}:${TID}"
    if ! grep -q "$KEY" "$SCRIPT_DIR/posted_ids.txt" 2>/dev/null; then
      TWEET_ID="$TID"
      TWEET_TEXT="${TWEET_TEXTS[$i]:-}"
      break
    fi
  done

  if [ -z "$TWEET_ID" ]; then
    echo "[skip] @$HANDLE — no new tweets to reply to" | tee -a "$LOG"
    continue
  fi

  echo "[account] @$HANDLE → tweet $TWEET_ID" | tee -a "$LOG"

  REPLY=$(python3 - <<PYEOF
import urllib.request, json, sys

persona = """$PERSONA"""
tweet_text = """$TWEET_TEXT"""

prompt = f"""{persona}

Responde a este tweet de forma directa y útil:
"{tweet_text}"

Reglas:
- Maximo 200 caracteres
- Aporta un dato concreto o perspectiva nueva
- Tono profesional pero humano, sin exclamaciones
- Menciona reliableai.net solo si encaja de forma natural
- Sin hashtags en respuestas
- NO empieces con "Gran punto" ni frases vacías

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

  RESULT=$(AUTH_TOKEN="$TOKEN" bird reply "$TWEET_ID" "$REPLY" 2>&1)
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
