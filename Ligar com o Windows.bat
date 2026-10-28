@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "INICIO=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "ARQ=%INICIO%\Dias.vbs"

if exist "%ARQ%" (
  del "%ARQ%"
  echo O Dias NAO vai mais ligar junto com o Windows.
  pause
  exit /b 0
)

rem Roda o servidor escondido, sem abrir janela, toda vez que o Windows liga.
> "%ARQ%" echo Set sh = CreateObject("WScript.Shell")
>> "%ARQ%" echo sh.CurrentDirectory = "%~dp0"
>> "%ARQ%" echo sh.Environment("PROCESS")("DIAS_ABRIR") = "0"
>> "%ARQ%" echo sh.Run "node server.js", 0, False

echo Pronto! O Dias vai ligar sozinho quando o Windows iniciar.
echo Depois e so abrir o app Dias pelo menu Iniciar.
echo Para desfazer, abra este arquivo de novo.
pause
