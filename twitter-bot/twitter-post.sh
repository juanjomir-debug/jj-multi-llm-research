#!/bin/bash
# twitter-post.sh — Genera y publica posts desde múltiples cuentas via Playwright
# Cron: 0 9 * * 1-5 /root/scripts/twitter-post.sh >> /root/scripts/twitter-post.log 2>&1

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$SCRIPT_DIR/twitter-post.log"
ANTHROPIC_KEY="${ANTHROPIC_API_KEY:-}"

ACCOUNTS=(
  "juanjomir|Eres @juanjomir, experto en comparativas de modelos de IA y creador de reliableai.net. Escribe en ingles."
  "martinkarsel|Eres @martinkarsel, investigador de IA. Escribe en ingles sobre comparativas de LLMs."
  "reliableai|Eres la cuenta oficial de @reliableai, plataforma multi-LLM. Escribe en inglés."
)

TOPICS=(
  "comparativa de rendimiento entre Claude, GPT-5 y Gemini en tareas de codigo"
  "por que usar varios LLMs a la vez da mejores resultados que uno solo"
  "diferencias de precio entre modelos de IA y cuando vale la pena pagar mas"
  "casos donde Claude falla y GPT acierta, y viceversa"
  "como el contexto largo de Gemini cambia el juego para documentos extensos"
  "por que Grok destaca en datos recientes y noticias vs otros modelos"
  "el problema de confiar en un solo modelo de IA para decisiones importantes"
  "como el modo debate entre modelos detecta contradicciones que uno solo no ve"
  "benchmarks recientes: que modelo lidera en razonamiento, codigo y analisis"
)

echo "=== $(date '+%Y-%m-%d %H:%M:%S') ===" | tee -a "$LOG"

for ACCOUNT in "${ACCOUNTS[@]}"; do
  HANDLE=$(echo "$ACCOUNT" | cut -d'|' -f1)
  PERSONA=$(echo "$ACCOUNT" | cut -d'|' -f2)

  echo "[account] @$HANDLE" | tee -a "$LOG"

  TOPIC="${TOPICS[$((RANDOM % ${#TOPICS[@]}))]}"

  POST=$(python3 - <<PYEOF
import urllib.request, json, sys

persona = """$PERSONA"""
topic = """$TOPIC"""

prompt = f"""{persona}

Escribe un tweet original sobre: {topic}

Reglas:
- Entre 180 y 260 caracteres
- Tono directo y profesional, sin exclamaciones
- Maximo 2 hashtags: #LLM #IA #AIResearch 
- Sin emojis excesivos (maximo 1)
- Dato o perspectiva concreta, no generalidades

Responde SOLO con el texto del tweet, sin comillas ni explicaciones."""

payload = json.dumps({
    "model": "claude-sonnet-4-6",
    "max_tokens": 200,
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
    echo "[error] @$HANDLE — failed to generate post" | tee -a "$LOG"
    continue
  fi

  echo "[post] @$HANDLE: $POST" | tee -a "$LOG"

  RESULT=$(cd /root/scripts && node tweet-playwright.js --account "$HANDLE" --text "$POST" 2>&1)
  echo "[playwright] $RESULT" | tee -a "$LOG"

  if echo "$RESULT" | grep -q "successfully"; then
    echo "[done] @$HANDLE published" | tee -a "$LOG"
  else
    echo "[error] @$HANDLE failed" | tee -a "$LOG"
  fi

  sleep $((30 + RANDOM % 60))
done
