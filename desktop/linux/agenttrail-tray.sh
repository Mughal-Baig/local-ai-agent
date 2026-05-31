#!/bin/sh
set -eu

ROOT="${AGENTTRAIL_ROOT:-$HOME/local-ai-agent}"
PORT="${PORT:-4173}"
URL="http://127.0.0.1:$PORT/"
LOG_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/agenttrail"
PID_FILE="$LOG_DIR/agenttrail.pid"

mkdir -p "$LOG_DIR"
cd "$ROOT"

export PORT
export AGENTTRAIL_DESKTOP=1
export AGENTTRAIL_APP_MODE="${AGENTTRAIL_APP_MODE:-tray}"
export AGENTTRAIL_DESKTOP_NOTIFICATIONS="${AGENTTRAIL_DESKTOP_NOTIFICATIONS:-on}"
export AGENTTRAIL_UPDATE_CHANNEL="${AGENTTRAIL_UPDATE_CHANNEL:-stable}"

if command -v curl >/dev/null 2>&1 && curl -fsS "$URL/api/status" >/dev/null 2>&1; then
  :
else
  node server.js >> "$LOG_DIR/agenttrail.log" 2>&1 &
  echo "$!" > "$PID_FILE"
fi

if command -v notify-send >/dev/null 2>&1; then
  notify-send "AgentTrail" "Desktop server is running."
fi

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 || true
fi
