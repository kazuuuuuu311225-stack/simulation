# projectile-sim + assets を Desktop へ同期（GitHub 公開と同じ構成）
$repoRoot = "C:\Users\PC_User\hyakumasu-calc"
$srcSim = Join-Path $repoRoot "projectile-sim"
$dstSim = "C:\Users\PC_User\Desktop\hyakumasu-calc\projectile-sim"
$syncAssets = Join-Path $srcSim "sync-assets-to-sim.ps1"

& powershell -ExecutionPolicy Bypass -File $syncAssets
if ($LASTEXITCODE -gt 7) { exit $LASTEXITCODE }

if (-not (Test-Path (Split-Path $dstSim))) {
  New-Item -ItemType Directory -Path (Split-Path $dstSim) -Force | Out-Null
}

# HTML・assets・画像（node_modules / 開発用のみ除外）
robocopy $srcSim $dstSim /MIR /XD node_modules /XF *.py check-ch7-runtime.js sync-assets-to-sim.ps1 /NFL /NDL /NJH /NJS
$simExit = $LASTEXITCODE

foreach ($dir in @("node_modules", "js", "css")) {
  $p = Join-Path $dstSim $dir
  if (Test-Path $p) { Remove-Item $p -Recurse -Force }
}

# 旧構成の sibling assets を削除
$legacyAssets = "C:\Users\PC_User\Desktop\hyakumasu-calc\assets"
if (Test-Path $legacyAssets) { Remove-Item $legacyAssets -Recurse -Force }

if ($simExit -le 7) {
  Write-Host "Desktop 同期完了: $dstSim"
  Write-Host "  (HTML + assets/ — GitHub Pages と同じ構成)"
  exit 0
}
Write-Host "同期エラー (exit $simExit)"
exit $simExit
