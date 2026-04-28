#!/usr/bin/env bash
# ⚡ Agent Flow — Deploy Script (Docker)
# Uso: bash deploy.sh [build|start|stop|restart|logs|clean|backup]
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

COMPOSE_FILE="docker-compose.yml"
CONTAINER="agent-flow"
VOLUME="agent-flow-data"

print_usage() {
  echo "╔══════════════════════════════════════════════════╗"
  echo "║  ⚡ Agent Flow — Deploy Script                   ║"
  echo "╠══════════════════════════════════════════════════╣"
  echo "║  Uso: bash deploy.sh <comando>                   ║"
  echo "║                                                  ║"
  echo "║  Comandos:                                       ║"
  echo "║    build    — Constrói a imagem Docker            ║"
  echo "║    start    — Sobe o container (cria se for 1x)  ║"
  echo "║    stop     — Para o container                   ║"
  echo "║    restart  — Reconstrói e reinicia              ║"
  echo "║    logs     — Segue os logs ao vivo              ║"
  echo "║    clean    — Remove container + imagem          ║"
  echo "║    backup   — Backup do banco SQLite             ║"
  echo "║    status   — Status do container                ║"
  echo "╚══════════════════════════════════════════════════╝"
  echo ""
  echo "  Exemplos:"
  echo "    bash deploy.sh start       # Primeira execução"
  echo "    bash deploy.sh restart     # Rebuild + restart"
  echo "    bash deploy.sh logs        # Ver logs"
  echo "    bash deploy.sh backup      # Backup do DB"
}

ensure_docker() {
  if ! command -v docker &>/dev/null; then
    echo "❌ Docker não encontrado. Instale Docker primeiro."
    echo "   https://docs.docker.com/engine/install/"
    exit 1
  fi
  if ! docker compose version &>/dev/null && ! docker-compose --version &>/dev/null; then
    echo "❌ Docker Compose não encontrado."
    exit 1
  fi
}

dc() {
  if docker compose version &>/dev/null; then
    docker compose -f "$COMPOSE_FILE" "$@"
  else
    docker-compose -f "$COMPOSE_FILE" "$@"
  fi
}

cmd_build() {
  ensure_docker
  echo "🔨 Construindo imagem Docker..."
  dc build --no-cache
  echo "✅ Imagem construída!"
}

cmd_start() {
  ensure_docker
  echo "🚀 Iniciando Agent Flow..."
  dc up -d
  echo ""
  echo "✅ Agent Flow rodando em http://localhost:3790"
  echo "   Token: agent-5678"
  echo ""
  # Aguardar health check
  echo "⏳ Aguardando health check..."
  for i in $(seq 1 10); do
    if curl -sf "http://localhost:3790" > /dev/null 2>&1; then
      echo "✅ Servidor respondendo!"
      break
    fi
    sleep 1
  done
  echo "   Logs: bash deploy.sh logs"
}

cmd_stop() {
  ensure_docker
  echo "🛑 Parando Agent Flow..."
  dc down
  echo "✅ Parado."
}

cmd_restart() {
  cmd_stop
  cmd_build
  cmd_start
}

cmd_logs() {
  ensure_docker
  dc logs -f
}

cmd_clean() {
  ensure_docker
  echo "⚠️  Isso vai remover o container e a imagem Docker."
  read -p "   O VOLUME '$VOLUME' com seus dados SERÁ MANTIDO. Continuar? (s/N) " confirm
  if [[ "$confirm" =~ ^[sSyY] ]]; then
    dc down --rmi all 2>/dev/null || true
    docker rm -f "$CONTAINER" 2>/dev/null || true
    echo "✅ Container e imagem removidos."
    echo "   Dados preservados no volume: $VOLUME"
    echo "   Para remover os dados também: docker volume rm $VOLUME"
  fi
}

cmd_backup() {
  echo "📦 Fazendo backup do banco de dados..."
  local backup_dir="$DIR/backups"
  mkdir -p "$backup_dir"
  local filename="agent-flow-db-$(date +%Y%m%d_%H%M%S).db"

  # Tentar copiar do volume Docker
  if docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    docker cp "$CONTAINER:/app/data/agent-flow.db" "$backup_dir/$filename"
    echo "✅ Backup do container: $backup_dir/$filename"
  elif [ -f "$DIR/data/agent-flow.db" ]; then
    cp "$DIR/data/agent-flow.db" "$backup_dir/$filename"
    echo "✅ Backup local: $backup_dir/$filename"
  else
    echo "⚠️  Nenhum banco encontrado para backup."
    return
  fi

  # Manter apenas os 7 backups mais recentes
  ls -t "$backup_dir"/*.db 2>/dev/null | tail -n +8 | xargs rm -f 2>/dev/null || true
  echo "   📁 Backups em: $backup_dir/ (últimos 7)"
}

cmd_status() {
  ensure_docker
  echo "📊 Status do Agent Flow:"
  echo ""
  if docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
    echo "   Container: 🟢 Rodando"
    docker ps --filter "name=$CONTAINER" --format "   Nome: {{.Names}} | Porta: {{.Ports}} | Desde: {{.RunningFor}} | Status: {{.Status}}"
    echo ""
    echo "   Volume de dados:"
    docker volume inspect "$VOLUME" --format "   Nome: {{.Name}} | Mountpoint: {{.Mountpoint}}" 2>/dev/null || echo "   (volume não encontrado)"
    echo ""
    echo "   Health check:"
    curl -sf "http://localhost:3790" > /dev/null 2>&1 && echo "   🟢 Respondendo em http://localhost:3790" || echo "   🔴 Não responde"
  else
    echo "   Container: 🔴 Parado"
    echo ""
    echo "   Para iniciar: bash deploy.sh start"
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────
case "${1:-help}" in
  build)   cmd_build ;;
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_restart ;;
  logs)    cmd_logs ;;
  clean)   cmd_clean ;;
  backup)  cmd_backup ;;
  status)  cmd_status ;;
  help|*)  print_usage ;;
esac
