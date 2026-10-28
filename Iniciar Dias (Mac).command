#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "O Node.js não está instalado. Instale a versão LTS e abra este atalho de novo."
  open "https://nodejs.org/pt"
  read -r -p "Pressione Enter para sair."
  exit 1
fi
[ -d node_modules ] || { echo "Preparando o Dias pela primeira vez..."; npm install --omit=dev || exit 1; }
echo "Iniciando o Dias... Para fechar o Dias, feche esta janela."
node server.js
