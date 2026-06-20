# trust-corp - continuous 24h development worker (ASCII only; PS5.1 safe)
# Loops: each iteration runs one headless Claude "work" session that implements
# and verifies ONE backlog/plan increment, appends to reports/<date>/worklog.md.
# Stops only when state\worker-stop.flag appears. A lock file prevents duplicates.

$ErrorActionPreference = 'Continue'
$root    = 'd:\Claude_Cowork\trust\trust-corp'
$stateD  = Join-Path $root 'state'
$logDir  = Join-Path $root 'logs'
$lock    = Join-Path $stateD 'worker.lock'
$stop    = Join-Path $stateD 'worker-stop.flag'
$tplPath = Join-Path $root 'scripts\report-prompts\work.md'
$gap     = 8   # seconds between iterations (lets stop-flag be honored; ~continuous)

foreach ($d in @($stateD, $logDir)) {
  if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force $d | Out-Null }
}

# --- single-instance guard ---
if (Test-Path $lock) {
  $oldPid = (Get-Content $lock -ErrorAction SilentlyContinue | Select-Object -First 1)
  if ($oldPid -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) {
    Write-Output "worker already running (PID $oldPid). exit."
    return
  }
}
"$PID" | Out-File $lock -Encoding ASCII -Force

# fresh start clears any prior stop request
if (Test-Path $stop) { Remove-Item $stop -Force -ErrorAction SilentlyContinue }

$wlog = Join-Path $logDir 'worker.log'
("[" + (Get-Date -Format o) + "] worker START pid=$PID") | Out-File $wlog -Append -Encoding UTF8

try {
  while (-not (Test-Path $stop)) {
    $date    = Get-Date -Format 'yyyy-MM-dd'
    $reports = Join-Path $root ("reports\" + $date)
    if (-not (Test-Path $reports)) { New-Item -ItemType Directory -Force $reports | Out-Null }

    $tpl    = Get-Content $tplPath -Raw -Encoding UTF8
    $prompt = $tpl.Replace('<DATE>', $date)

    ("[" + (Get-Date -Format o) + "] iteration start") | Out-File $wlog -Append -Encoding UTF8
    Set-Location $root
    $prompt | & claude -p --permission-mode bypassPermissions 2>&1 |
      Tee-Object -FilePath $wlog -Append
    ("[" + (Get-Date -Format o) + "] iteration done") | Out-File $wlog -Append -Encoding UTF8

    if (Test-Path $stop) { break }
    Start-Sleep -Seconds $gap
  }
}
finally {
  ("[" + (Get-Date -Format o) + "] worker STOP pid=$PID") | Out-File $wlog -Append -Encoding UTF8
  Remove-Item $lock -Force -ErrorAction SilentlyContinue
  if (Test-Path $stop) { Remove-Item $stop -Force -ErrorAction SilentlyContinue }
}
