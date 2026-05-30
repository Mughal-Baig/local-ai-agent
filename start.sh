#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install Node 22 or newer, then run this again."
  exit 1
fi

echo "Starting Local AI Agent at http://127.0.0.1:4173"
node server.js
