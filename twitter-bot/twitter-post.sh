#!/bin/bash
# twitter-post.sh — Genera y publica un post original sobre comparativas LLM
# Cron: 0 9 * * 1-5 /root/scripts/twitter-post.sh >> /root/scripts/twitter-post.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$SCRIPT_DIR/twitter-post.log"
ANTHROPIC_KEY="${ANTHROPIC_API_KEY:-}"

echo "=== $(date '+%Y-%m-%d %H:%M:%S') ===" | tee -a "$LOG"

# ── Generar post con Claude ───────────────────────────────────────────────────
POST=$(python3 - <<PYEOF
import urllib.request, json, sys, datetime

day = datetime.datetime.now().strftime("%A")
topics = [
    "comparativa de rendimiento entre Claude, GPT-5 y Gemini en tareas de codigo",
    "por que usar varios LLMs a la vez da mejores resultados que uno solo",
    "diferencias de precio entre modelos de IA y cuando vale la pena pagar mas",
    "casos donde Claude falla y GPT acierta, y viceversa",
    "como el contexto largo de Gemini cambia el juego para documentos extensos",
    "por que Grok destaca en datos recientes y noticias vs otros modelos",
    "el problema de confiar en un solo modelo de IA para decisiones importantes",
]
import random
topic = random.choice(topics)

prompt = f"""Eres @juanjomir, experto en comparativas de modelos de IA y creador de reliableai.net.

Escribe un tweet original sobre: {topic}

Reglas:
- Entre 200 y 260 caracteres exactos
- En español
- Tono directo y profesional, sin exclamaciones
- Maximo 2 hashtags de esta lista: #LLM #IA #AIResearch #ReliableAI
- Añade "→ reliableai.net" al final si cabe
- Sin emojis excesivos (maximo 1)
- Que aporte un dato o perspectiva concreta, no generalidades

Responde SOLO con el texto del tweet, sin comillas ni explicaciones."""

payload = json.dumps({
    "model": "claude-haiku-4-5-20251001",
    "max_tokens": 150,
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

if [ -z "$POST" ]; then
  echo "[error] Failed to generate post" | tee -a "$LOG"
  exit 1
fi

echo "[post] Generated: $POST" | tee -a "$LOG"

# ── Publicar con bird ─────────────────────────────────────────────────────────
RESULT=$(bird tweet "$POST" 2>&1)
echo "[bird] $RESULT" | tee -a "$LOG"

if echo "$RESULT" | grep -q "successfully"; then
  URL=$(echo "$RESULT" | grep -o 'https://x.com/[^ ]*' || echo "")
  echo "[done] Post published: $URL" | tee -a "$LOG"
else
  echo "[error] Failed to publish post" | tee -a "$LOG"
fi
