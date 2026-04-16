#!/bin/bash
# ============================================================
# JJ Multi-LLM — Primera instalación en VPS (Ubuntu/Debian)
# Ejecutar como root o con sudo
# ============================================================
set -e

REPO_URL="https://github.com/TU_USUARIO/TU_REPO.git"   # <-- cambia esto
APP_DIR="/opt/jj-multi-llm"
NODE_VERSION="22"

echo ""
echo "================================================"
echo "  JJ Multi-LLM — Setup VPS"
echo "================================================"
echo ""

# 1. Actualizar paquetes
echo "[1/7] Actualizando paquetes..."
apt-get update -y && apt-get upgrade -y

# 2. Instalar Node.js
echo "[2/7] Instalando Node.js $NODE_VERSION..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs git

# 3. Instalar PM2 globalmente
echo "[3/7] Instalando PM2..."
npm install -g pm2

# 4. Clonar repo
echo "[4/7] Clonando repositorio..."
mkdir -p $APP_DIR
git clone $REPO_URL $APP_DIR
cd $APP_DIR

# 5. Instalar dependencias
echo "[5/7] Instalando dependencias..."
npm install --omit=dev
mkdir -p logs

# 6. Configurar .env
echo "[6/7] Configurando .env..."
if [ ! -f "$APP_DIR/.env" ]; then
  cp $APP_DIR/.env.example $APP_DIR/.env
  echo ""
  echo "  !! IMPORTANTE: edita $APP_DIR/.env con tus API keys:"
  echo "     nano $APP_DIR/.env"
  echo ""
fi

# 7. Arrancar con PM2
echo "[7/7] Arrancando app con PM2..."
cd $APP_DIR
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # genera el comando para arranque automático al reiniciar

echo ""
echo "================================================"
echo "  Setup completo!"
echo "  App corriendo en http://localhost:3000"
echo ""
echo "  Comandos útiles:"
echo "    pm2 status          — ver estado"
echo "    pm2 logs jj-multi-llm  — ver logs"
echo "    pm2 restart jj-multi-llm — reiniciar"
echo ""
echo "  Siguiente paso: configurar Nginx (ver vps-nginx.conf)"
echo "================================================"
echo ""
