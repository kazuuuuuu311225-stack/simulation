$count = 0
Get-ChildItem -Path "$PSScriptRoot" -Filter '*.html' -Recurse | ForEach-Object {
  $path = $_.FullName
  $c = Get-Content -LiteralPath $path -Raw -Encoding UTF8
  if ($c -notmatch 'physlabo-mobile\.(css|js)\?v=20260809d') { return }
  $c = $c -replace 'physlabo-mobile\.css\?v=20260809d', 'physlabo-mobile.css?v=20260626a'
  $c = $c -replace 'physlabo-mobile\.js\?v=20260809d', 'physlabo-mobile.js?v=20260626a'
  Set-Content -LiteralPath $path -Value $c -Encoding UTF8 -NoNewline
  $count++
}
Write-Host "Updated $count HTML files"
