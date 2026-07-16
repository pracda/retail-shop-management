# Shows whether the POS demo is up and reachable.
# Usage:  .\aws-status.ps1
$InstanceId = 'i-0ae9fa11e85bbd897'
$SiteUrl    = 'https://d2qttg93iautmd.cloudfront.net'

$state = aws ec2 describe-instances --instance-ids $InstanceId --query 'Reservations[0].Instances[0].State.Name' --output text
Write-Host "EC2 instance: $state"
try {
    $r = Invoke-RestMethod -Uri "$SiteUrl/api/v1/actuator/health" -TimeoutSec 5
    Write-Host "Backend API : $($r.status)"
    Write-Host "Site        : $SiteUrl" -ForegroundColor Green
} catch {
    Write-Host "Backend API : not responding" -ForegroundColor Yellow
}
