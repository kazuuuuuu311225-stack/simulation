# Mirror dev assets into projectile-sim/assets for GitHub Pages / USB deploy
$repoRoot = "C:\Users\PC_User\hyakumasu-calc"
$srcAssets = Join-Path $repoRoot "assets"
$dstAssets = Join-Path $repoRoot "projectile-sim\assets"
if (-not (Test-Path $srcAssets)) {
  Write-Host "Missing source assets: $srcAssets"
  exit 1
}

$worksSrc = Join-Path $srcAssets "img\works"
$worksDst = Join-Path $dstAssets "img\works"
$worksBackup = Join-Path $env:TEMP "physlabo-works-backup"
if (Test-Path $worksDst) {
  if (Test-Path $worksBackup) { Remove-Item $worksBackup -Recurse -Force }
  Copy-Item $worksDst $worksBackup -Recurse -Force
}

robocopy $srcAssets $dstAssets /MIR /NFL /NDL /NJH /NJS
$rc = $LASTEXITCODE

if (Test-Path $worksBackup) {
  if (-not (Test-Path $worksDst)) { New-Item -ItemType Directory -Path $worksDst -Force | Out-Null }
  robocopy $worksBackup $worksDst /E /NFL /NDL /NJH /NJS | Out-Null
  Remove-Item $worksBackup -Recurse -Force
} elseif (Test-Path $worksSrc) {
  if (-not (Test-Path $worksDst)) { New-Item -ItemType Directory -Path $worksDst -Force | Out-Null }
  robocopy $worksSrc $worksDst /E /NFL /NDL /NJH /NJS | Out-Null
}

if ($rc -le 7) {
  Write-Host "Synced projectile-sim/assets"
  exit 0
}
exit $rc