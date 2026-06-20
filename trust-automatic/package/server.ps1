$port = 8765
$root = $PSScriptRoot

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
} catch {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Red
    Write-Host " Server failed to start" -ForegroundColor Red
    Write-Host "================================================" -ForegroundColor Red
    Write-Host (" Error: " + $_.Exception.Message)
    Write-Host ""
    Write-Host " Possible causes:"
    Write-Host "  1. Port $port already in use"
    Write-Host "  2. Firewall blocking"
    Write-Host "  3. Administrator privileges required (HttpListener URL ACL)"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " Trust Document Automation - Local Server" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host (" URL : http://localhost:" + $port + "/") -ForegroundColor Yellow
Write-Host " Stop: Close this window or press Ctrl+C"
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Start-Process ("http://localhost:" + $port + "/")

$mimes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".wasm" = "application/wasm"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".pdf"  = "application/pdf"
    ".txt"  = "text/plain; charset=utf-8"
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $path = $request.Url.LocalPath
        if ($path -eq "/") { $path = "/index.html" }
        $relpath = $path.TrimStart("/").Replace("/", "\")
        $filepath = Join-Path $root $relpath

        $fullroot = (Resolve-Path $root).Path
        if (-not $filepath.StartsWith($fullroot)) {
            $response.StatusCode = 403
            $response.OutputStream.Close()
            continue
        }

        if (Test-Path $filepath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filepath)
            $ext = [System.IO.Path]::GetExtension($filepath).ToLower()
            if ($mimes.ContainsKey($ext)) {
                $response.ContentType = $mimes[$ext]
            } else {
                $response.ContentType = "application/octet-stream"
            }
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $size = $bytes.Length
            Write-Host ("  200  " + $path + "  (" + $size + " bytes)")
        } else {
            $response.StatusCode = 404
            $body = "404 Not Found: " + $path
            $msg = [System.Text.Encoding]::UTF8.GetBytes($body)
            $response.OutputStream.Write($msg, 0, $msg.Length)
            Write-Host ("  404  " + $path) -ForegroundColor Yellow
        }
        $response.OutputStream.Close()
    } catch {
        $err = $_.Exception.Message
        Write-Host ("  ERR  " + $err) -ForegroundColor Red
    }
}
