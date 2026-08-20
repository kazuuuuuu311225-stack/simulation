$root = "C:\Users\PC_User\hyakumasu-calc\projectile-sim"
$oldInline = "if('scrollRestoration' in history)history.scrollRestoration='manual';var vw=window.innerWidth"
$newInline = "if('scrollRestoration' in history)history.scrollRestoration='manual';if(document.documentElement.classList.contains('hero-landing'))return;var vw=window.innerWidth"
$inlineCount = 0
$verCount = 0
Get-ChildItem -Path $root -Filter '*.html' -Recurse | ForEach-Object {
  $path = $_.FullName
  $c = Get-Content -LiteralPath $path -Raw -Encoding UTF8
  $changed = $false
  if ($c.Contains($oldInline) -and -not $c.Contains("classList.contains('hero-landing'))return")) {
    $c = $c.Replace($oldInline, $newInline)
    $inlineCount++
    $changed = $true
  }
  if ($c -match 'physlabo-mobile\.(css|js)\?v=20260626[ab]') {
    $c = $c -replace 'physlabo-mobile\.css\?v=20260626[ab]', 'physlabo-mobile.css?v=20260626c'
    $c = $c -replace 'physlabo-mobile\.js\?v=20260626[ab]', 'physlabo-mobile.js?v=20260626c'
    $verCount++
    $changed = $true
  }
  if ($changed) {
    Set-Content -LiteralPath $path -Value $c -Encoding UTF8 -NoNewline
  }
}
Write-Host "Updated inline viewport in $inlineCount files"
Write-Host "Bumped mobile asset version in $verCount files"
