# trust-corp - register daily work-start + 6 reporting tasks in Windows Task Scheduler
# Run as the current user (no admin needed). Re-run to update (-Force).
#   08 work-start (start 24h dev worker) | 02 verify / 06 prep (no notify) | 09/14/17/21 reports (notify 대표님)

$script = 'd:\Claude_Cowork\trust\trust-corp\scripts\run-report.ps1'
$jobs = @(
  @{ Name = 'TrustCorp-02-Verify';   Mode = 'verify';   At = '02:00'; Desc = 'trust-corp 02시 어제 검증(보고없음)' },
  @{ Name = 'TrustCorp-06-Prep';     Mode = 'prep';     At = '06:00'; Desc = 'trust-corp 06시 피드백 정리(보고없음)' },
  @{ Name = 'TrustCorp-09-Morning';  Mode = 'morning';  At = '09:00'; Desc = 'trust-corp 09시 어제피드백+오늘계획 보고' },
  @{ Name = 'TrustCorp-14-Progress'; Mode = 'progress'; At = '14:00'; Desc = 'trust-corp 14시 진행상황 보고' },
  @{ Name = 'TrustCorp-17-Interim';  Mode = 'interim';  At = '17:00'; Desc = 'trust-corp 17시 중간 보고' },
  @{ Name = 'TrustCorp-21-Final';    Mode = 'final';    At = '21:00'; Desc = 'trust-corp 21시 최종 보고' }
)
foreach ($j in $jobs) {
  $arg = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -Mode {1}' -f $script, $j.Mode
  $action  = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg
  $trigger = New-ScheduledTaskTrigger -Daily -At $j.At
  $set     = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -ExecutionTimeLimit (New-TimeSpan -Hours 2)
  Register-ScheduledTask -TaskName $j.Name -Action $action -Trigger $trigger -Settings $set -Description $j.Desc -Force | Out-Null
  Write-Output ("registered: {0} @ {1} (mode={2})" -f $j.Name, $j.At, $j.Mode)
}

# 08:00 work-start: ensure the 24h continuous dev worker is running (no time limit)
$wensure = 'd:\Claude_Cowork\trust\trust-corp\scripts\ensure-worker.ps1'
$wArg    = '-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $wensure
$wAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $wArg
$wTrig   = New-ScheduledTaskTrigger -Daily -At '08:00'
$wSet    = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -ExecutionTimeLimit (New-TimeSpan -Hours 0)
Register-ScheduledTask -TaskName 'TrustCorp-08-WorkStart' -Action $wAction -Trigger $wTrig -Settings $wSet -Description 'trust-corp 08시 개발 워커 가동(24h 연속, 이미 실행중이면 유지)' -Force | Out-Null
Write-Output 'registered: TrustCorp-08-WorkStart @ 08:00 (start 24h dev worker)'
Write-Output '---- registered tasks ----'
Get-ScheduledTask -TaskName 'TrustCorp-*' | Select-Object TaskName, State | Format-Table -AutoSize
