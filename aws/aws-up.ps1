# Starts the POS demo EC2 instance and waits until the live site responds.
# Usage:  .\aws-up.ps1
$InstanceId = 'i-0ae9fa11e85bbd897'
$SiteUrl    = 'https://d2qttg93iautmd.cloudfront.net'
$HealthUrl  = "$SiteUrl/api/v1/actuator/health"

Write-Host "Starting instance $InstanceId ..."
aws ec2 start-instances --instance-ids $InstanceId --output text | Out-Null
aws ec2 wait instance-running --instance-ids $InstanceId
Write-Host "Instance running. Waiting for the backend to come up (Docker auto-starts it)..."

$deadline = (Get-Date).AddMinutes(5)
while ((Get-Date) -lt $deadline) {
    try {
        $r = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 5
        if ($r.status -eq 'UP') {
            Write-Host ""
            Write-Host "POS demo is LIVE: $SiteUrl" -ForegroundColor Green
            exit 0
        }
    } catch { }
    Start-Sleep -Seconds 10
    Write-Host "  still starting..."
}
Write-Host "Backend did not respond within 5 minutes. Check: ssh -i ~\.ssh\pos-demo-key.pem ec2-user@100.60.189.138 'docker ps; docker logs pos_backend | tail -50'" -ForegroundColor Yellow
exit 1
