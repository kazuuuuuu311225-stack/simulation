@echo off
cd /d "%~dp0.."
echo physLabo NEWS server starting...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8790 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Write-Host ('Stopping old server PID ' + $_.OwningProcess); Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo 管理: http://localhost:8790/admin/news.html
echo トップ: http://localhost:8790/00_physLabo_top.html#news
node tools\news-server.mjs
pause
