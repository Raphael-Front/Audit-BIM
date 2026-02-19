# Sobe a API e o frontend. Execute no PowerShell: .\dev.ps1
# Ou: powershell -ExecutionPolicy Bypass -File .\dev.ps1

$root = $PSScriptRoot
Write-Host "Iniciando API (porta 3001) e Web (porta 3000)..." -ForegroundColor Cyan
Write-Host ""

# API em uma janela (WorkingDirectory evita problema com espaços no caminho)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'API - porta 3001' -ForegroundColor Green; npm run dev" -WorkingDirectory (Join-Path $root "apps\api")

# Aguarda 2s para a API iniciar primeiro
Start-Sleep -Seconds 2

# Web em outra janela
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Web - porta 3000' -ForegroundColor Green; npm run dev" -WorkingDirectory (Join-Path $root "apps\web")

Write-Host "Duas janelas do PowerShell foram abertas." -ForegroundColor Green
Write-Host "  - API:  http://localhost:3001" -ForegroundColor Yellow
Write-Host "  - Web:  http://localhost:3000" -ForegroundColor Yellow
Write-Host "  - Login: http://localhost:3000/login" -ForegroundColor Yellow
Write-Host ""
Write-Host "Feche as janelas ou pressione Ctrl+C em cada uma para parar." -ForegroundColor Gray
