#!/bin/bash
# twitter-engage.sh — Busca tweets relevantes, genera respuesta con Claude y publica con bird
# Cron: 0 9,18 * * 1-5 /root/scripts/twitter-engage.sh >> /root/scripts/twitter-engage.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$SCRIPT_DIR/twitter-engage.log"
CONFIG="$SCRIPT_DIR/twitter-config.json"
ANTHROPIC_KEY="${ANTHROPIC_API_KEY:-}"
XAI_KEY="${XAI_API_KEY:-}"

echo "=== $(date '+%Y-%m-%d %H:%M:%S') ===" | tee -a "$LOG"

# ── 1. Buscar tweets relevantes ───────────────────────────────────────────────
QUERIES=("Claude vs GPT" "mejor modelo IA" "ChatGPT Gemini Claude" "LLM comparativa")
QUERY="${QUERIES[$((RANDOM % ${#QUERIES[@]}))]}"
echo "[search] Query: $QUERY" | tee -a "$LOG"

SEARCH_RESULT=$(XAI_API_KEY="$XAI_KEY" timeout 30 node /root/clawd/skills/search-x/scripts/search.js "$QUERY" --days 1 --json 2>/dev/null || echo "")

if [ -z "$SEARCH_RESULT" ]; then
  echo "[search] No results, trying --days 3" | tee -a "$LOG"
  SEARCH_RESULT=$(XAI_API_KEY="$XAI_KEY" timeout 30 node /root/clawd/skills/search-x/scripts/search.js "$QUERY" --days 3 --json 2>/dev/null || echo "")
fi

if [ -z "$SEARCH_RESULT" ]; then
  echo "[search] No results found, skipping." | tee -a "$LOG"
  exit 0
fi

# ── 2. Extraer el mejor tweet (primero de los resultados) ─────────────────────
TWEET_ID=$(echo "$SEARCH_RESULT" | python3 -c "
import sys, json, re
data = sys.stdin.read()
# Buscar IDs de tweets en el output
ids = re.findall(r'status/(\d{15,20})', data)
# Filtrar el propio tweet de juanjomir
ids = [i for i in ids if i not in open('/root/scripts/posted_ids.txt').read().split() if True else i]
print(ids[0] if ids else '')
" 2>/dev/null || echo "")

TWEET_URL=$(echo "$SEARCH_RESULT" | python3 -c "
import sys, re
data = sys.stdin.read()
urls = re.findall(r'https://x\.com/\w+/status/\d+', data)
print(urls[0] if urls else '')
" 2>/dev/null || echo "")

TWEET_TEXT=$(echo "$SEARCH_RESULT" | python3 -c "
import sys, re
data = sys.stdin.read()
# Extraer primer tweet content
match = re.search(r'Tweet: \"([^\"]{20,280})\"', data)
print(match.group(1) if match else '')
" 2>/dev/null || echo "")

if [ -z "$TWEET_ID" ] || [ -z "$TWEET_TEXT" ]; then
  echo "[extract] Could not extract tweet ID or text, skipping." | tee -a "$LOG"
  exit 0
fi

# Evitar responder al mismo tweet dos veces
touch /root/scripts/posted_ids.txt
if grep -q "$TWEET_ID" /root/scripts/posted_ids.txt; then
  echo "[skip] Already replied to $TWEET_ID" | tee -a "$LOG"
  exit 0
fi

echo "[tweet] ID: $TWEET_ID" | tee -a "$LOG"
echo "[tweet] Text: $TWEET_TEXT" | tee -a "$LOG"

# ── 3. Generar respuesta con Claude ──────────────────────────────────────────
REPLY=$(python3 - <<PYEOF
import urllib.request, json, sys

tweet_text = """$TWEET_TEXT"""

prompt = f"""Eres @juanjomir, experto en comparativas de modelos de IA y creador de reliableai.net.

Responde a este tweet de forma directa y útil:
"{tweet_text}"

Reglas:
- Máximo 200 caracteres
- En español (o inglés si el tweet es en inglés)
- Aporta un dato concreto o perspectiva nueva
- Tono profesional pero humano, sin exclamaciones
- Menciona reliableai.net solo si encaja de forma natural
- Sin hashtags en respuestas
- NO empieces con "Gran punto" ni frases vacías

Responde SOLO con el texto del tweet, sin comillas ni explicaciones."""

payload = json.dumps({
    "model": "claude-haiku-4-5-20251001",
    "max_tokens": 100,
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
  echo "[claude] Failed to generate reply, skipping." | tee -a "$LOG"
  exit 0
fi

echo "[reply] Generated: $REPLY" | tee -a "$LOG"

# ── 4. Publicar con bird ──────────────────────────────────────────────────────
RESULT=$(bird reply "$TWEET_ID" "$REPLY" 2>&1)
echo "[bird] $RESULT" | tee -a "$LOG"

if echo "$RESULT" | grep -q "successfully"; then
  echo "$TWEET_ID" >> /root/scripts/posted_ids.txt
  REPLY_URL=$(echo "$RESULT" | grep -o 'https://x.com/i/status/[0-9]*' || echo "")
  echo "[done] Reply published: $REPLY_URL" | tee -a "$LOG"
else
  echo "[error] Failed to publish reply" | tee -a "$LOG"
fi
