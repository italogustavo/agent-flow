#!/usr/bin/env bash
# ⚡ Agent Flow — Trigger Watcher
# Monitora o diretório triggers/ e executa o trigger via OpenClaw.
# Cada trigger .md é lido, spawnado como subagente, e removido.
#
# Uso: bash trigger-watcher.sh [--once]
#
# Integração: 
#   O orchestrator.js cria triggers em triggers/task-{id}-{agent}.md
#   Este watcher lê cada trigger, spawna o subagente e remove o arquivo.

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
TRIGGER_DIR="$DIR/triggers"
WATCH_INTERVAL=10

log() { echo "[$(date '+%H:%M:%S')] $*"; }

process_triggers() {
  local triggers=("$TRIGGER_DIR"/*.md)
  
  if [ ! -e "${triggers[0]}" ]; then
    return 0
  fi

  for trigger_file in "${triggers[@]}"; do
    [ -f "$trigger_file" ] || continue
    
    local filename=$(basename "$trigger_file")
    log "📄 Trigger encontrado: $filename"
    
    # Extrair nome do agente do filename: task-{id}-{agent}.md
    local agent_name=$(echo "$filename" | sed -E 's/^task-[^-]+-(.+)\.md$/\1/' | tr '_' ' ')
    
    log "🎯 Spawnando subagente: $agent_name"
    log "📋 Conteúdo:"
    head -5 "$trigger_file"
    log "..."
    
    # NOTA: O spawn real do subagente no OpenClaw precisa ser feito
    # pelo sistema de triggers do OpenClaw ou manualmente via sessions_spawn.
    # 
    # Para integração automática com OpenClaw, o trigger fica neste diretório
    # até que o OpenClaw leia e processe.
    #
    # Por segurança, NÃO removemos o trigger aqui — o OpenClaw que gerencia.
    # Se o OpenClaw não consumir, remova triggers velhos (+5min)
    
    # Remover triggers com mais de 5 minutos (caso OpenClaw não tenha consumido)
    if [ -f "$trigger_file" ] && [ $(($(date +%s) - $(stat -c %Y "$trigger_file"))) -gt 300 ]; then
      log "⏰ Trigger expirado (>5min), removendo: $filename"
      rm -f "$trigger_file"
    fi
  done
  
  # Se recebeu --once, não continua
  if [ "${1:-}" = "--once" ]; then
    log "✅ Triggers processados."
    exit 0
  fi
}

mkdir -p "$TRIGGER_DIR"
log "👁️  Trigger Watcher iniciado (a cada ${WATCH_INTERVAL}s)"
log "   Diretório: $TRIGGER_DIR"

if [ "${1:-}" = "--once" ]; then
  process_triggers --once
  exit 0
fi

while true; do
  process_triggers
  sleep "$WATCH_INTERVAL"
done
