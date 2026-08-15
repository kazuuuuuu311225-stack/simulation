$ErrorActionPreference = "Stop"
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$lines = [System.IO.File]::ReadAllLines((Join-Path $base "index.html"), [System.Text.Encoding]::UTF8)
$template = [System.IO.File]::ReadAllText((Join-Path $base "_folder_template.html"), [System.Text.Encoding]::UTF8)
$metaJson = [System.IO.File]::ReadAllText((Join-Path $base "_folder_meta.json"), [System.Text.Encoding]::UTF8)
$folders = $metaJson | ConvertFrom-Json

function Get-ChapterBlock([int]$start, [int]$end) {
  $block = ($lines[($start - 1)..($end - 1)] -join "`n")
  $block = [regex]::Replace($block, '(?s)\r?\n\r?\n        </ul>\r?\n      </li>\s*
  return $block.Trim()
}

foreach ($f in $folders) {
  $chapters = Get-ChapterBlock $f.start $f.end
  $html = $template
  $html = $html.Replace('{{TITLE}}', $f.title)
  $html = $html.Replace('{{SUB}}', $f.sub)
  $html = $html.Replace('{{STAT}}', $f.stat)
  $html = $html.Replace('{{ACCENT}}', $f.accent)
  $html = $html.Replace('{{CLASS}}', $f.class)
  $html = $html.Replace('{{CHAPTERS}}', $chapters)
  $outPath = Join-Path $base $f.file
  [System.IO.File]::WriteAllText($outPath, $html, [System.Text.UTF8Encoding]::new($false))
  Write-Output ("Wrote " + $f.file)
}

Write-Output "Done."
, '')
  return $block.Trim()
}

foreach ($f in $folders) {
  $chapters = Get-ChapterBlock $f.start $f.end
  $html = $template
  $html = $html.Replace('{{TITLE}}', $f.title)
  $html = $html.Replace('{{SUB}}', $f.sub)
  $html = $html.Replace('{{STAT}}', $f.stat)
  $html = $html.Replace('{{ACCENT}}', $f.accent)
  $html = $html.Replace('{{CLASS}}', $f.class)
  $html = $html.Replace('{{CHAPTERS}}', $chapters)
  $outPath = Join-Path $base $f.file
  [System.IO.File]::WriteAllText($outPath, $html, [System.Text.UTF8Encoding]::new($false))
  Write-Output ("Wrote " + $f.file)
}

Write-Output "Done."
