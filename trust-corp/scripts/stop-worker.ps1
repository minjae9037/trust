# trust-corp - request the 24h dev worker to stop after its current iteration
$root = 'd:\Claude_Cowork\trust\trust-corp'
$stop = Join-Path $root 'state\worker-stop.flag'
("stop requested " + (Get-Date -Format o)) | Out-File $stop -Encoding ASCII -Force
Write-Output "stop flag written. worker exits after the current iteration."
