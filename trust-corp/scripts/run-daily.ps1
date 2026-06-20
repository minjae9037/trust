# trust-corp - daily cycle runner (ASCII only; PS5.1 safe)
# Runs the trust automation AI org daily cycle headlessly via Claude Code,
# then notifies the owner (handled inside the prompt). Intended for Task Scheduler.

$ErrorActionPreference = 'Stop'
$root    = 'd:\Claude_Cowork\trust\trust-corp'
$date    = Get-Date -Format 'yyyy-MM-dd'
$reports = Join-Path $root ("reports\" + $date)
$logDir  = Join-Path $root 'logs'

foreach ($d in @($reports, $logDir)) {
  if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force $d | Out-Null }
}
$log = Join-Path $logDir ("cycle-" + $date + ".log")

# Build prompt from UTF-8 template, inject date
$tpl    = Get-Content (Join-Path $root 'scripts\daily-prompt.md') -Raw -Encoding UTF8
$prompt = $tpl.Replace('<DATE>', $date)

Set-Location $root
("[" + (Get-Date -Format o) + "] start daily cycle " + $date) | Out-File $log -Append -Encoding UTF8

# Headless Claude Code run. --permission-mode bypassPermissions lets the
# workflow + file writes + notifications proceed unattended.
$prompt | & claude -p --permission-mode bypassPermissions 2>&1 |
  Tee-Object -FilePath $log -Append

("[" + (Get-Date -Format o) + "] done daily cycle " + $date) | Out-File $log -Append -Encoding UTF8
