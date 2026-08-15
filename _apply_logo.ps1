Add-Type -AssemblyName System.Drawing
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $base "_logo_source.png"
$path = Join-Path $base "physLabo_logo.png"
$backup = Join-Path $base "physLabo_logo_backup.png"

if (-not (Test-Path $src)) {
  throw "Source logo not found: $src"
}
if (Test-Path $path) {
  Copy-Item -Force $path $backup
}

$bmp = New-Object System.Drawing.Bitmap $src

function Get-Alpha([int]$r, [int]$g, [int]$b, [int]$a) {
  if ($a -lt 8) { return 0 }
  $max = [Math]::Max($r, [Math]::Max($g, $b))
  $min = [Math]::Min($r, [Math]::Min($g, $b))
  $sat = $max - $min
  $lum = 0.299 * $r + 0.587 * $g + 0.114 * $b

  if ($max -le 18) { return 0 }
  if ($lum -le 24 -and $sat -le 36) { return 0 }
  if ($lum -le 42 -and $sat -le 18) { return 0 }

  if ($lum -le 70 -and $sat -le 55) {
    $fade = [Math]::Max(0, (70 - $lum) / 70.0)
    return [int]($a * (1.0 - $fade * 0.85))
  }
  return $a
}

$minX = $bmp.Width
$minY = $bmp.Height
$maxX = 0
$maxY = 0

for ($y = 0; $y -lt $bmp.Height; $y++) {
  for ($x = 0; $x -lt $bmp.Width; $x++) {
    $c = $bmp.GetPixel($x, $y)
    $alpha = Get-Alpha $c.R $c.G $c.B $c.A
    if ($alpha -gt 12) {
      if ($x -lt $minX) { $minX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}

$pad = 2
$minX = [Math]::Max(0, $minX - $pad)
$minY = [Math]::Max(0, $minY - $pad)
$maxX = [Math]::Min($bmp.Width - 1, $maxX + $pad)
$maxY = [Math]::Min($bmp.Height - 1, $maxY + $pad)
$w = $maxX - $minX + 1
$h = $maxY - $minY + 1

Write-Output "source=$($bmp.Width)x$($bmp.Height) crop=${w}x${h}"

$out = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($out)
$g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))

for ($y = 0; $y -lt $h; $y++) {
  for ($x = 0; $x -lt $w; $x++) {
    $c = $bmp.GetPixel($minX + $x, $minY + $y)
    $alpha = Get-Alpha $c.R $c.G $c.B $c.A
    if ($alpha -le 0) {
      $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    } else {
      $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $c.R, $c.G, $c.B))
    }
  }
}

$tmp = Join-Path $base "physLabo_logo_trimmed.png"
if (Test-Path $tmp) { Remove-Item $tmp -Force }
$out.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$out.Dispose()
$bmp.Dispose()

Copy-Item -Force $tmp $path
Remove-Item $tmp -Force
Write-Output "Saved $path"
