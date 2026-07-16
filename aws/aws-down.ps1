# Stops the POS demo EC2 instance to save compute cost (~\$15/mo).
# Data is kept: MySQL lives on the instance's EBS volume.
# While stopped you still pay ~\$5/mo (EBS disk + reserved public IP).
# Usage:  .\aws-down.ps1
$InstanceId = 'i-0ae9fa11e85bbd897'

Write-Host "Stopping instance $InstanceId ..."
aws ec2 stop-instances --instance-ids $InstanceId --output text | Out-Null
aws ec2 wait instance-stopped --instance-ids $InstanceId
Write-Host "Instance stopped. The site will show an error until you run aws-up.ps1 again." -ForegroundColor Green
