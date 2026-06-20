# trust-corp - ensure the 24h dev worker is running (daily 08:00 "start work")
# Clears any stop flag, then starts run-worker.ps1 detached if not already alive.
$root  = 'd:\Claude_Cowork\trust\trust-corp'
$lock  = Join-Path $root 'state\worker.lock'
$stop  = Join-Path $root 'state\worker-stop.flag'
$wrun  = Join-Path $root 'scripts\run-worker.ps1'

if (Test-Path $stop) { Remove-Item $stop -Force -ErrorAction SilentlyContinue }

if (Test-Path $lock) {
  $oldPid = (Get-Content $lock -ErrorAction SilentlyContinue | Select-Object -First 1)
  if ($oldPid -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) {
    Write-Output "worker already running (PID $oldPid). nothing to do."
    return
  }
}
Start-Process -FilePath 'powershell.exe' `
  -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $wrun) `
  -WindowStyle Hidden
Write-Output "worker launch requested (08:00 start work)."
