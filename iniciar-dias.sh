#!/bin/sh
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "O Node.js não está instalado. Instale a versão LTS (https://nodejs.org) e rode de novo."
  exit 1
fi
[ -d node_modules ] || npm install --omit=dev || exit 1
exec node server.js
