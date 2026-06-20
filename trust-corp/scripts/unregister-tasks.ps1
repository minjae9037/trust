# trust-corp - remove all 6 daily reporting tasks
Get-ScheduledTask -TaskName 'TrustCorp-*' -ErrorAction SilentlyContinue |
  Unregister-ScheduledTask -Confirm:$false
Write-Output 'TrustCorp-* scheduled tasks removed.'
