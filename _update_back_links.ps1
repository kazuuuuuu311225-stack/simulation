$ErrorActionPreference = "Stop"
$base = "C:\Users\PC_User\Desktop\hyakumasu-calc\projectile-sim"
$indexPath = Join-Path $base "index.html"
$lines = [System.IO.File]::ReadAllLines($indexPath, [System.Text.Encoding]::UTF8)

function Get-FolderForChapter([string]$chapterId) {
  if ($chapterId -eq "chapter-ex") { return "00_folder_ex.html" }
  if ($chapterId -match "^chapter-(\d+)$") {
    $n = [int]$Matches[1]
    if ($n -ge 1 -and $n -le 11) { return "00_folder_classical.html" }
    if ($n -ge 12 -and $n -le 15) { return "00_folder_thermo.html" }
    if ($n -ge 16 -and $n -le 17) { return "00_folder_waves.html" }
  }
  throw "Unknown chapter id: $chapterId"
}

$map = @{}
$currentChapter = $null

foreach ($line in $lines) {
  if ($line -match 'class="chapter chapter--') {
    $currentChapter = $null
  }
  if ($line -match 'id="(chapter-[^"]+)"') {
    $currentChapter = $Matches[1]
  }
  if ($currentChapter -and ($line -match 'href="([^"/]+\.html)"')) {
    $file = $Matches[1]
    if ($file -notmatch '^00_') {
      $map[$file] = "$(Get-FolderForChapter $currentChapter)#$currentChapter"
    }
  }
}

Write-Output "Mapped $($map.Count) simulation files"

$updated = 0
$skipped = @()

foreach ($entry in $map.GetEnumerator()) {
  $simFile = Join-Path $base $entry.Key
  if (-not (Test-Path $simFile)) {
    $skipped += "$($entry.Key) (missing file)"
    continue
  }
  $target = $entry.Value
  $html = [System.IO.File]::ReadAllText($simFile, [System.Text.Encoding]::UTF8)
  if ($html -notmatch 'id="back" href="index\.html"') {
    $skipped += "$($entry.Key) (no back link)"
    continue
  }
  $newHtml = $html -replace '(<a id="back" href=")index\.html(">)', "`${1}${target}`${2}"
  if ($newHtml -eq $html) {
    $skipped += "$($entry.Key) (replace failed)"
    continue
  }
  [System.IO.File]::WriteAllText($simFile, $newHtml, [System.Text.UTF8Encoding]::new($false))
  $updated++
}

Write-Output "Updated $updated files"
if ($skipped.Count -gt 0) {
  Write-Output "Skipped $($skipped.Count):"
  $skipped | Select-Object -First 10 | ForEach-Object { Write-Output "  $_" }
}

$remaining = Select-String -Path (Join-Path $base "*.html") -Pattern 'id="back" href="index\.html"' |
  Where-Object { $_.Path -notmatch '\\index\.html|\\00_' } |
  ForEach-Object { [System.IO.Path]::GetFileName($_.Path) } |
  Sort-Object -Unique
Write-Output "Remaining index.html links: $($remaining.Count)"
