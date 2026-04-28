#!/bin/bash
# Agent Flow — Start
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Install deps
if [ ! -d node_modules ]; then
  echo "📦 Instalando dependências..."
  npm install
fi

# Criar diretório de dados
mkdir -p data

echo "🚀 Iniciando Agent Flow..."
echo "   Local: http://localhost:3790"
echo "   Token: agent-5678"
node server.js
