# projectile-sim（HTML のみ）と assets（js/css）を Desktop へ同期
# node_modules や開発用スクリプトは含めない
$repoRoot = "C:\Users\PC_User\hyakumasu-calc"
$srcSim = Join-Path $repoRoot "projectile-sim"
$srcAssets = Join-Path $repoRoot "assets"
$dstRoot = "C:\Users\PC_User\Desktop\hyakumasu-calc"
$dstSim = Join-Path $dstRoot "projectile-sim"
$dstAssets = Join-Path $dstRoot "assets"

if (-not (Test-Path $dstRoot)) { New-Item -ItemType Directory -Path $dstRoot -Force | Out-Null }

# HTML・画像など（node_modules / js / css / 開発用は除外）
robocopy $srcSim $dstSim /MIR /XD node_modules js css /XF *.py check-ch7-runtime.js /NFL /NDL /NJH /NJS
$simExit = $LASTEXITCODE

# 共通アセット（js / css）
robocopy $srcAssets $dstAssets /MIR /NFL /NDL /NJH /NJS
$assetsExit = $LASTEXITCODE

# /XD では Desktop 側の古いフォルダが残ることがあるため明示削除
foreach ($dir in @("node_modules", "js", "css")) {
  $p = Join-Path $dstSim $dir
  if (Test-Path $p) { Remove-Item $p -Recurse -Force }
}

$worst = [Math]::Max($simExit, $assetsExit)
if ($worst -le 7) {
  Write-Host "Desktop 同期完了:"
  Write-Host "  $dstSim  (HTML のみ)"
  Write-Host "  $dstAssets  (js / css)"
  exit 0
}
Write-Host "同期エラー (sim=$simExit assets=$assetsExit)"
exit $worst
