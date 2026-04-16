#!/bin/bash
# ============================================================
# JJ Multi-LLM — Actualizar app en VPS tras git push
# Ejecutar desde el directorio de la app o con ruta absoluta
# ============================================================
set -e

APP_DIR="/opt/jj-multi-llm"

echo ""
echo "================================================"
echo "  JJ Multi-LLM — Actualizando en VPS"
echo "================================================"
echo ""

cd $APP_DIR

echo "[1/3] Descargando cambios..."
git pull origin main

echo "[2/3] Actualizando dependencias (si hay nuevas)..."
npm install --omit=dev

echo "[3/3] Reiniciando app..."
pm2 restart jj-multi-llm

echo ""
echo "  Actualización completada!"
echo "  Estado: $(pm2 show jj-multi-llm | grep status)"
echo ""
