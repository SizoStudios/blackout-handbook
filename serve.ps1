# Tiny offline web server for the Blackout Handbook (Windows, no install needed).
# Serves this folder at http://localhost:8080/ so the app can install and work offline.
param([int]$Port = 8080)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8';
  '.json'='application/json'; '.webmanifest'='application/manifest+json'; '.svg'='image/svg+xml'; '.png'='image/png';
  '.gguf'='application/octet-stream'; '.wasm'='application/wasm'; '.txt'='text/plain; charset=utf-8' }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
try { $l.Start() } catch { Write-Host "Could not start on port $Port. Is it already running? Try http://localhost:$Port/"; exit 1 }
Write-Host "Blackout Handbook is running at http://localhost:$Port/  (close this window to stop)"
Start-Process "http://localhost:$Port/"
while ($l.IsListening) {
  $c = $l.GetContext(); $p = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath).TrimStart('/')
  if ($p -eq '') { $p = 'index.html' }
  $f = [IO.Path]::GetFullPath((Join-Path $root $p))
  if ($f.StartsWith($root) -and (Test-Path $f -PathType Leaf)) {
    $ext = [IO.Path]::GetExtension($f).ToLower()
    $c.Response.ContentType = if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' }
    $b = [IO.File]::ReadAllBytes($f); $c.Response.ContentLength64 = $b.Length
    $c.Response.OutputStream.Write($b, 0, $b.Length)
  } else { $c.Response.StatusCode = 404 }
  $c.Response.Close()
}
