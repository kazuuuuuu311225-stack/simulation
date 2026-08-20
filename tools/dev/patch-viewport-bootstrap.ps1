$root = "C:\Users\PC_User\hyakumasu-calc\projectile-sim"
$oldInline = "(function(){var D=1180,m=document.querySelector('meta[name=viewport]');if(!m)return;document.documentElement.classList.add('physlabo-unified-layout');var vw=window.visualViewport&&window.visualViewport.width>0?window.visualViewport.width:window.innerWidth||D;if(vw<D){var s=Math.min(1,vw/D);m.setAttribute('content','width='+D+',initial-scale='+s.toFixed(4)+',minimum-scale='+Math.max(0.2,s*0.45).toFixed(4)+',maximum-scale=5,user-scalable=yes,viewport-fit=cover');}})();"
$newInline = "(function(){var D=1180,m=document.querySelector('meta[name=viewport]');if(!m)return;document.documentElement.classList.add('physlabo-unified-layout');if('scrollRestoration' in history)history.scrollRestoration='manual';var vw=window.innerWidth||document.documentElement.clientWidth||D;if(vw<D){var s=Math.min(1,vw/D);m.setAttribute('content','width='+D+',initial-scale='+s.toFixed(4)+',minimum-scale='+Math.max(0.2,s*0.45).toFixed(4)+',maximum-scale=5,user-scalable=yes,viewport-fit=cover');}})();"
$inlineCount = 0
$verCount = 0
Get-ChildItem -Path $root -Filter '*.html' -Recurse | ForEach-Object {
  $path = $_.FullName
  $c = Get-Content -LiteralPath $path -Raw -Encoding UTF8
  $changed = $false
  if ($c.Contains($oldInline)) {
    $c = $c.Replace($oldInline, $newInline)
    $inlineCount++
    $changed = $true
  }
  if ($c -match 'physlabo-mobile\.(css|js)\?v=20260626a') {
    $c = $c -replace 'physlabo-mobile\.css\?v=20260626a', 'physlabo-mobile.css?v=20260626b'
    $c = $c -replace 'physlabo-mobile\.js\?v=20260626a', 'physlabo-mobile.js?v=20260626b'
    $verCount++
    $changed = $true
  }
  if ($changed) {
    Set-Content -LiteralPath $path -Value $c -Encoding UTF8 -NoNewline
  }
}
Write-Host "Updated inline viewport in $inlineCount files"
Write-Host "Bumped mobile asset version in $verCount files"
