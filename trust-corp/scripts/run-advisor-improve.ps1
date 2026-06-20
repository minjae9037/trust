# trust-corp - advisor 자가고도화 [분석] 자동 실행 래퍼
# advisor-logs 를 분석해 gap-report.md 생성(지식 공백·부정피드백 집계).
# node 전용(claude 무인루프 아님) → 스케줄러 등록 가능. 일 1회(예: 05:30) 권장.
$ErrorActionPreference = 'Continue'
$env:PATH = "$env:USERPROFILE\scoop\shims;$env:PATH"
$saas = 'd:\Claude_Cowork\trust\trust-saas'
$log  = 'd:\Claude_Cowork\trust\trust-corp\logs'
if (-not (Test-Path $log)) { New-Item -ItemType Directory -Force $log | Out-Null }
$stamp = Get-Date -Format 'yyyy-MM-dd'
Set-Location $saas
("[" + (Get-Date -Format o) + "] advisor-improve start") | Out-File (Join-Path $log "advisor-improve-$stamp.log") -Append -Encoding UTF8
& node (Join-Path $saas 'scripts\advisor-improve.mjs') 2>&1 |
  Tee-Object -FilePath (Join-Path $log "advisor-improve-$stamp.log") -Append
("[" + (Get-Date -Format o) + "] advisor-improve done") | Out-File (Join-Path $log "advisor-improve-$stamp.log") -Append -Encoding UTF8
