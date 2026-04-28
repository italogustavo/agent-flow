#!/usr/bin/env bash
# ⚡ Agent Flow — Heartbeat Helper
# Script auxiliar para agentes enviarem heartbeat/thinking/tokens
#
# Uso:
#   bash agent-heartbeat.sh heartbeat <nome> <status> [taskId] [thinking]
#   bash agent-heartbeat.sh thinking <nome> <mensagem> [taskId]
#   bash agent-heartbeat.sh tokens <nome> <tokensIn> <tokensOut> [taskId]
#   bash agent-heartbeat.sh done <nome> <taskId>
#   bash agent-heartbeat.sh message <nome> <destino> <mensagem>

set -euo pipefail

AGENT_FLOW_URL="${AGENT_FLOW_URL:-http://localhost:3790}"
AUTH_TOKEN="${AUTH_TOKEN:-agent-5678}"

api() {
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -s -X "$method" "$AGENT_FLOW_URL$path" \
      -H "Content-Type: application/json" \
      -H "x-auth-token: $AUTH_TOKEN" \
      -d "$body"
  else
    curl -s "$AGENT_FLOW_URL$path?token=$AUTH_TOKEN"
  fi
}

case "${1:-help}" in
  heartbeat)
    NAME="$2" STATUS="$3" TASK_ID="${4:-null}" THINKING="${5:-}"
    if [ "$TASK_ID" = "null" ]; then TASK_ID=""; fi
    BODY="{\"name\":\"$NAME\",\"status\":\"$STATUS\""
    [ -n "$TASK_ID" ] && BODY="$BODY,\"taskId\":\"$TASK_ID\""
    [ -n "$THINKING" ] && BODY="$BODY,\"thinking\":\"$THINKING\""
    BODY="$BODY}"
    api POST /api/agents/heartbeat "$BODY"
    echo "💓 Heartbeat: $NAME → $STATUS"
    ;;

  thinking)
    NAME="$2" THINKING="$3" TASK_ID="${4:-}"
    BODY="{\"name\":\"$NAME\",\"thinking\":\"$THINKING\""
    [ -n "$TASK_ID" ] && BODY="$BODY,\"taskId\":\"$TASK_ID\""
    BODY="$BODY}"
    api POST /api/agents/thinking "$BODY"
    echo "🤔 Thinking: $NAME → $THINKING"
    ;;

  tokens)
    NAME="$2" TI="$3" TO="$4" TASK_ID="${5:-}"
    BODY="{\"name\":\"$NAME\",\"tokensIn\":$TI,\"tokensOut\":$TO"
    [ -n "$TASK_ID" ] && BODY="$BODY,\"taskId\":\"$TASK_ID\""
    BODY="$BODY}"
    api POST /api/agents/tokens "$BODY"
    echo "💰 Tokens: $NAME → In: $TI / Out: $TO"
    ;;

  done)
    NAME="$2" TASK_ID="$3"
    BODY="{\"name\":\"$NAME\",\"status\":\"online\",\"taskId\":\"$TASK_ID\"}"
    api POST /api/agents/heartbeat "$BODY"
    api PATCH "/api/tasks/$TASK_ID" '{"status":"done"}'
    echo "✅ Task $TASK_ID marcada como done"
    ;;

  message)
    FROM="$2" TO="$3" BODY_MSG="$4"
    BODY="{\"from\":\"$FROM\",\"to\":\"$TO\",\"body\":\"$BODY_MSG\"}"
    api POST /api/agents/messages "$BODY"
    echo "💬 $FROM → $TO: $BODY_MSG"
    ;;

  review)
    NAME="$2" TASK_ID="$3"
    api PATCH "/api/tasks/$TASK_ID" '{"status":"review"}'
    echo "👀 Task $TASK_ID marcada como review"
    ;;

  approve)
    TASK_ID="$2" QUESTION="$3"
    BODY="{\"status\":\"waiting_approval\",\"approval\":\"pending\",\"approval_question\":\"$QUESTION\"}"
    api PATCH "/api/tasks/$TASK_ID" "$BODY"
    echo "👑 Task $TASK_ID → aguardando aprovação do PO"
    ;;

  list)
    api GET "/api/tasks" | python3 -m json.tool 2>/dev/null || curl -s "$AGENT_FLOW_URL/api/tasks?token=$AUTH_TOKEN"
    ;;

  help|*)
    echo "╔══════════════════════════════════════════╗"
    echo "║  ⚡ Agent Flow — Heartbeat Helper        ║"
    echo "╠══════════════════════════════════════════╣"
    echo "║                                         ║"
    echo "║  heartbeat <nome> <status> [task] [msg] ║"
    echo "║  thinking  <nome> <msg> [task]          ║"
    echo "║  tokens    <nome> <in> <out> [task]     ║"
    echo "║  done      <nome> <taskId>              ║"
    echo "║  review    <nome> <taskId>              ║"
    echo "║  approve   <taskId> <pergunta>          ║"
    echo "║  message   <from> <to> <mensagem>       ║"
    echo "║  list                                    ║"
    echo "╚══════════════════════════════════════════╝"
    ;;
esac
