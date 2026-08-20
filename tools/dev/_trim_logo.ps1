Add-Type -AssemblyName System.Drawing
$path = Join-Path $PSScriptRoot "physLabo_logo.png"
$backup = Join-Path $PSScriptRoot "physLabo_logo_backup.png"
if (-not (Test-Path $backup)) {
  Copy-Item $path $backup
}
$bmp = New-Object System.Drawing.Bitmap $backup

function Get-Alpha([int]$r, [int]$g, [int]$b, [int]$a) {
  if ($a -lt 8) { return 0 }
  $max = [Math]::Max($r, [Math]::Max($g, $b))
  $min = [Math]::Min($r, [Math]::Min($g, $b))
  $sat = $max - $min
  $lum = 0.299 * $r + 0.587 * $g + 0.114 * $b

  if ($min -ge 248) { return 0 }
  if ($lum -ge 235 -and $sat -le 48) { return 0 }
  if ($lum -ge 210 -and $sat -le 28) { return 0 }

  if ($lum -ge 200 -and $sat -le 60) {
    $fade = [Math]::Max(0, ($lum - 200) / 55.0)
    return [int]($a * (1.0 - $fade))
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

Write-Output "crop=${w}x${h} from $($bmp.Width)x$($bmp.Height)"

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

$tmp = Join-Path $PSScriptRoot "physLabo_logo_trimmed.png"
if (Test-Path $tmp) { Remove-Item $tmp -Force }
$out.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$out.Dispose()
$bmp.Dispose()

Copy-Item -Force $tmp $path
Remove-Item $tmp -Force
Write-Output "Saved transparent cropped logo"
