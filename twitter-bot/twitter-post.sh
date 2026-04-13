#!/bin/bash
# twitter-post.sh — Genera y publica posts desde múltiples cuentas
# Cron: 0 9 * * 1-5 /root/scripts/twitter-post.sh >> /root/scripts/twitter-post.log 2>&1

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$SCRIPT_DIR/twitter-post.log"
ANTHROPIC_KEY="${ANTHROPIC_API_KEY:-}"

# Formato: "handle|auth_token|ct0|persona"
ACCOUNTS=(
  "juanjomir|5b257722557b2504f8aaad1194e44b6472aca5cb||Eres @juanjomir, experto en comparativas de modelos de IA y creador de reliableai.net. Escribe en español."
  "martinkarsel|f3076850ae503c6f68ba70c78158bc83d6c30553|faf6f09dfa26f8e0e806515db7ea242ce9b258132835202f5674fc0d68ff52614ba2c9d6bc6e935602729103a0d15ecbecdf3ed956aefa9c43ddd2d2ef2189c8b62fbf4a3c6ce61a814b1a5586f0d024|Eres @martinkarsel, investigador de IA. Escribe en español sobre comparativas de LLMs."
  "reliableai|2cf5beff434fe792b8f540380daa628742c426d0|8a04959a72368239d03e0413f89c34913d77b23fcf5196ad894f001351c3121a03f6ebdb3f9a8342f53953b134a5e06d9039359d5e2396da3a0dd2a79f2478c1eab251e513cf1b60c1260e5b538d4eb0|Eres la cuenta oficial de @reliableai, plataforma multi-LLM. Escribe en español e inglés."
)

echo "=== $(date '+%Y-%m-%d %H:%M:%S') ===" | tee -a "$LOG"

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

for ACCOUNT in "${ACCOUNTS[@]}"; do
  HANDLE=$(echo "$ACCOUNT" | cut -d'|' -f1)
  TOKEN=$(echo "$ACCOUNT" | cut -d'|' -f2)
  CT0=$(echo "$ACCOUNT" | cut -d'|' -f3)
  PERSONA=$(echo "$ACCOUNT" | cut -d'|' -f4)

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
- Maximo 2 hashtags: #LLM #IA #AIResearch #ReliableAI
- Añade "-> reliableai.net" al final si cabe
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

  if [ -n "$CT0" ]; then
    RESULT=$(AUTH_TOKEN="$TOKEN" CT0="$CT0" bird tweet "$POST" 2>&1)
  else
    RESULT=$(AUTH_TOKEN="$TOKEN" bird tweet "$POST" 2>&1)
  fi
  echo "[bird] $RESULT" | tee -a "$LOG"

  if echo "$RESULT" | grep -q "successfully"; then
    URL=$(echo "$RESULT" | grep -o 'https://x.com/[^ ]*' || echo "")
    echo "[done] @$HANDLE published: $URL" | tee -a "$LOG"
  else
    echo "[error] @$HANDLE failed to publish" | tee -a "$LOG"
  fi

  sleep $((30 + RANDOM % 60))
done
