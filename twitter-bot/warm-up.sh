#!/bin/bash
# warm-up.sh — Script para ejecutar warm-up diario de ambas cuentas
# Cron: 0 11 * * * /root/scripts/warm-up.sh >> /root/scripts/warm-up.log 2>&1

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== $(date '+%Y-%m-%d %H:%M:%S') ==="
echo "[warm-up] Iniciando calentamiento de cuentas..."

# Warm-up martinkarsel
echo ""
echo "[account] @martinkarsel"
cd "$SCRIPT_DIR" && node warm-up-account.js --account martinkarsel
sleep 300  # 5 minutos entre cuentas

# Warm-up reliableai
echo ""
echo "[account] @reliableai"
cd "$SCRIPT_DIR" && node warm-up-account.js --account reliableai

echo ""
echo "[done] Warm-up completado"
echo "========================================"
