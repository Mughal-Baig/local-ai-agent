#!/bin/sh
set -eu

PORT="${PORT:-4173}"
MODEL="${OLLAMA_MODEL:-llama3.2}"

printf "AgentTrail local install\n"
printf "Port: %s\n" "$PORT"
printf "Default model: %s\n" "$MODEL"

if command -v ollama >/dev/null 2>&1; then
  printf "Ollama found. Pulling %s if needed...\n" "$MODEL"
  ollama pull "$MODEL" || true
else
  printf "Ollama was not found. Install it from https://ollama.com/download before chatting.\n"
fi

printf "Starting AgentTrail at http://127.0.0.1:%s\n" "$PORT"
PORT="$PORT" OLLAMA_MODEL="$MODEL" node server.js
