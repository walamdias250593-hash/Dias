@echo off
chcp 65001 >nul
title Dias - Assistente de Voz
cd /d "%~dp0"

if not exist server.js (
  echo.
  echo O Dias foi aberto de dentro do arquivo ZIP, sem extrair.
  echo.
  echo Faca assim:
  echo   1. Feche esta janela e o programa do ZIP.
  echo   2. Clique com o botao direito no arquivo ZIP e escolha "Extrair tudo" ou "Extrair aqui".
  echo   3. Abra a pasta extraida e de dois cliques em "Iniciar Dias (Windows).bat".
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo O Node.js nao esta instalado.
  echo Vou abrir a pagina de download. Instale a versao LTS e depois abra este atalho de novo.
  start "" https://nodejs.org/pt
  pause
  exit /b 1
)

if not exist node_modules (
  echo Preparando o Dias pela primeira vez, aguarde...
  call npm install --omit=dev
  if errorlevel 1 (
    echo Nao consegui instalar. Verifique sua internet e tente de novo.
    pause
    exit /b 1
  )
)

echo Iniciando o Dias... Para fechar o Dias, feche esta janela.
node server.js
pause
