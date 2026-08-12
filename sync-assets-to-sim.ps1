# Mirror dev assets into projectile-sim/assets for GitHub Pages / USB deploy
$repoRoot = "C:\Users\PC_User\hyakumasu-calc"
$srcAssets = Join-Path $repoRoot "assets"
$dstAssets = Join-Path $repoRoot "projectile-sim\assets"
if (-not (Test-Path $srcAssets)) {
  Write-Host "Missing source assets: $srcAssets"
  exit 1
}
robocopy $srcAssets $dstAssets /MIR /NFL /NDL /NJH /NJS
if ($LASTEXITCODE -le 7) {
  Write-Host "Synced projectile-sim/assets"
  exit 0
}
exit $LASTEXITCODE
