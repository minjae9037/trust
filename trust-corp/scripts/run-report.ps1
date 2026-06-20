# trust-corp - scheduled report runner (ASCII only; PS5.1 safe)
# Runs a mode-specific headless Claude Code session for the daily reporting rhythm.
#   Modes: morning(09) progress(14) interim(17) final(21) verify(02) prep(06)
# Intended for Windows Task Scheduler (one trigger per mode).

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('morning', 'progress', 'interim', 'final', 'verify', 'prep')]
  [string]$Mode
)

$ErrorActionPreference = 'Stop'
$root    = 'd:\Claude_Cowork\trust\trust-corp'
$date    = Get-Date -Format 'yyyy-MM-dd'
$ydate   = (Get-Date).AddDays(-1).ToString('yyyy-MM-dd')   # "yesterday" for verify/prep
$reports = Join-Path $root ("reports\" + $date)
$yrep    = Join-Path $root ("reports\" + $ydate)
$logDir  = Join-Path $root 'logs'

foreach ($d in @($reports, $yrep, $logDir, (Join-Path $root 'state'))) {
  if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force $d | Out-Null }
}
$log = Join-Path $logDir ("report-" + $date + "-" + $Mode + ".log")

# Build prompt from UTF-8 template, inject dates
$tpl = Get-Content (Join-Path $root ("scripts\report-prompts\" + $Mode + ".md")) -Raw -Encoding UTF8
$prompt = $tpl.Replace('<DATE>', $date).Replace('<YDATE>', $ydate)

Set-Location $root
("[" + (Get-Date -Format o) + "] start report mode=" + $Mode + " date=" + $date) | Out-File $log -Append -Encoding UTF8

# Headless Claude Code run (unattended).
$prompt | & claude -p --permission-mode bypassPermissions 2>&1 |
  Tee-Object -FilePath $log -Append

("[" + (Get-Date -Format o) + "] done report mode=" + $Mode) | Out-File $log -Append -Encoding UTF8
