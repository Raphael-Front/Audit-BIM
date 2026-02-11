@echo off
REM Sobe a API e o Web. Dê dois cliques em dev.bat ou execute no CMD.
cd /d "%~dp0"

echo Iniciando API (porta 3001) e Web (porta 3000)...
echo.

start "API - porta 3001" cmd /k "cd /d %~dp0apps\api && npm run dev"
timeout /t 3 /nobreak >nul

start "Web - porta 3000" cmd /k "cd /d %~dp0apps\web && npm run dev"

echo.
echo Duas janelas foram abertas.
echo   - API:  http://localhost:3001
echo   - Web:  http://localhost:3000
echo   - Login: http://localhost:3000/login
echo.
echo Feche as janelas do CMD para parar os servidores.
pause
