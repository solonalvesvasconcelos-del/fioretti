@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node nao encontrado. Nenhum programa sera instalado.
  echo Use o servidor web que voce ja possui para servir esta pasta.
  pause
  exit /b 1
)
echo Abra http://127.0.0.1:8081 no navegador.
node scripts\serve.mjs
pause
