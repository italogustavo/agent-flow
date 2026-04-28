#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "============================================"
echo "  ⚡ Agent Flow — Orquestração de Agentes"
echo "============================================"
echo ""

# Check node
if ! command -v node &>/dev/null; then
  echo "❌ Node.js não encontrado. Instale Node.js 18+ primeiro."
  exit 1
fi

# Install deps if needed
if [ ! -d node_modules ]; then
  echo "📦 Instalando dependências..."
  npm install --no-audit --no-fund
  echo ""
fi

# Ensure data dir
mkdir -p data

echo "🚀 Iniciando servidor..."
echo "   URL:  http://localhost:3790"
echo "   WS:   ws://localhost:3790"
echo "   Auth: agent-5678"
echo ""
echo "Pressione Ctrl+C para parar."
echo ""

exec node server.js
