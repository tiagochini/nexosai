[CmdletBinding()]
param(
  [string]$Profile = 'nexos',
  [string]$InstanceId = 'i-06b2d23fd5bdff95d',
  [string]$ReleaseBucket = 'nexos-467626281008-us-east-2-an',
  [switch]$PublishOnly
)

$ErrorActionPreference = 'Stop'
$region = 'us-east-2'
$expectedAccount = '467626281008'
$releaseId = "manual-$((Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ'))"
$registry = "$expectedAccount.dkr.ecr.$region.amazonaws.com"
$apiImage = "$registry/nexos-api:$releaseId"
$webImage = "$registry/nexos-web:$releaseId"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$workDirectory = Join-Path $env:TEMP "nexos-release-$releaseId"
$archivePath = Join-Path $workDirectory 'nexos-ops.tar.gz'
$checksumPath = "$archivePath.sha256"
$sendCommandPath = Join-Path $workDirectory 'ssm-command.json'
$dockerConfigDirectory = Join-Path $workDirectory 'docker-config'
$script:dockerConfigDirectory = $dockerConfigDirectory
$script:useTemporaryDockerConfig = $false

function Invoke-AwsJson {
  param([Parameter(Mandatory)][string[]]$Arguments)
  $raw = & aws.exe @Arguments
  if ($LASTEXITCODE -ne 0) { throw 'AWS CLI request failed. Check the nexos profile and its permissions.' }
  return ($raw | ConvertFrom-Json)
}

function Invoke-Aws {
  param([Parameter(Mandatory)][string[]]$Arguments)
  & aws.exe @Arguments | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'AWS CLI request failed. Check the nexos profile and its permissions.' }
}

function Invoke-Docker {
  param([Parameter(Mandatory)][string[]]$Arguments)
  if ($script:useTemporaryDockerConfig) {
    & docker.exe --config $script:dockerConfigDirectory @Arguments
  } else {
    & docker.exe @Arguments
  }
  if ($LASTEXITCODE -ne 0) { throw 'Docker command failed.' }
}

if ($ReleaseBucket -notmatch '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$') { throw 'Invalid S3 bucket name.' }
if ($InstanceId -notmatch '^i-[0-9a-f]+$') { throw 'Invalid EC2 instance ID.' }

$identity = Invoke-AwsJson @('sts','get-caller-identity','--profile',$Profile,'--region',$region,'--output','json')
if ($identity.Account -ne $expectedAccount) { throw 'The selected AWS profile is not the Nexos project. No release was published.' }

$repositories = Invoke-AwsJson @('ecr','describe-repositories','--repository-names','nexos-api','nexos-web','--profile',$Profile,'--region',$region,'--output','json')
if ($repositories.repositories.Count -ne 2) { throw 'The Nexos ECR repositories are missing.' }
$managedNode = Invoke-AwsJson @('ssm','describe-instance-information','--filters',"Key=InstanceIds,Values=$InstanceId",'--profile',$Profile,'--region',$region,'--output','json')
if (-not $managedNode.InstanceInformationList -or $managedNode.InstanceInformationList[0].PingStatus -ne 'Online') {
  throw 'The EC2 instance is not Online in Systems Manager.'
}

Invoke-Docker @('info','--format','{{.ServerVersion}}')
New-Item -ItemType Directory -Path $workDirectory -Force | Out-Null
$authenticated = $false
try {
  New-Item -ItemType Directory -Path $dockerConfigDirectory -Force | Out-Null
  $dockerConfigAcl = New-Object System.Security.AccessControl.DirectorySecurity
  $dockerConfigAcl.SetAccessRuleProtection($true, $false)
  $currentUserSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
  $dockerConfigAcl.SetOwner($currentUserSid)
  $dockerConfigRule = [System.Security.AccessControl.FileSystemAccessRule]::new(
    $currentUserSid,
    [System.Security.AccessControl.FileSystemRights]::FullControl,
    [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit,
    [System.Security.AccessControl.PropagationFlags]::None,
    [System.Security.AccessControl.AccessControlType]::Allow
  )
  $dockerConfigAcl.AddAccessRule($dockerConfigRule)
  Set-Acl -LiteralPath $dockerConfigDirectory -AclObject $dockerConfigAcl
  [System.IO.File]::WriteAllText((Join-Path $dockerConfigDirectory 'config.json'), '{}', [System.Text.UTF8Encoding]::new($false))
  $script:useTemporaryDockerConfig = $true

  $password = & aws.exe ecr get-login-password --profile $Profile --region $region
  if ($LASTEXITCODE -ne 0) { throw 'Could not obtain a temporary ECR login token.' }
  $password | & docker.exe --config $dockerConfigDirectory login $registry --username AWS --password-stdin | Out-Null
  $password = $null
  if ($LASTEXITCODE -ne 0) { throw 'Docker could not authenticate to ECR.' }
  $authenticated = $true

  Push-Location $repoRoot
  try {
    Invoke-Docker @('build','--tag',$apiImage,'--file','ops/app/Dockerfile','.')
    Invoke-Docker @('build','--tag',$webImage,'--file','ops/app/Dockerfile.web','.')
    Invoke-Docker @('push',$apiImage)
    Invoke-Docker @('push',$webImage)

    & tar.exe -czf $archivePath 'ops/app/compose.yml' 'ops/app/compose.ca.yml' 'ops/app/compose.aws.yml' 'ops/aws'
    if ($LASTEXITCODE -ne 0) { throw 'Could not package the host deployment files.' }
  } finally {
    Pop-Location
  }

  $archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  [System.IO.File]::WriteAllText($checksumPath, "$archiveHash  nexos-ops.tar.gz`n", [System.Text.Encoding]::ASCII)
  $releasePrefix = "s3://$ReleaseBucket/releases/$releaseId"
  Invoke-Aws @('s3','cp',$archivePath,"$releasePrefix/ops.tar.gz",'--sse','AES256','--only-show-errors','--profile',$Profile,'--region',$region)
  Invoke-Aws @('s3','cp',$checksumPath,"$releasePrefix/ops.tar.gz.sha256",'--sse','AES256','--only-show-errors','--profile',$Profile,'--region',$region)

  if ($PublishOnly) {
    Write-Output "Release $releaseId was published to ECR and S3. EC2 deployment was skipped."
    return
  }

  $deploymentScript = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'deploy-ssm.sh'))
  $remoteCommand = @(
    "bash -s <<'NEXOS_DEPLOY_EOF'"
    "export AWS_DEFAULT_REGION=$region NEXOS_RELEASE_BUCKET=$ReleaseBucket NEXOS_RELEASE_ID=$releaseId NEXOS_API_IMAGE=$apiImage NEXOS_WEB_IMAGE=$webImage"
    $deploymentScript
    'NEXOS_DEPLOY_EOF'
  ) -join "`n"
  $request = @{
    InstanceIds = @($InstanceId)
    DocumentName = 'AWS-RunShellScript'
    Comment = "Deploy NexOS $releaseId"
    Parameters = @{ commands = @($remoteCommand) }
  }
  [System.IO.File]::WriteAllText($sendCommandPath, ($request | ConvertTo-Json -Depth 8 -Compress), [System.Text.UTF8Encoding]::new($false))
  $cliInputUri = "file:///$($sendCommandPath.Replace('\','/'))"
  $sent = Invoke-AwsJson @('ssm','send-command','--cli-input-json',$cliInputUri,'--profile',$Profile,'--region',$region,'--output','json')
  $commandId = $sent.Command.CommandId
  if (-not $commandId) { throw 'SSM did not return a command ID.' }

  for ($attempt = 0; $attempt -lt 80; $attempt++) {
    $status = & aws.exe ssm get-command-invocation --command-id $commandId --instance-id $InstanceId --query Status --output text --profile $Profile --region $region 2>$null
    if ($LASTEXITCODE -ne 0) { Start-Sleep -Seconds 5; continue }
    switch ("$status".Trim()) {
      'Success' { Write-Output "Release $releaseId deployed successfully (SSM $commandId)."; return }
      { $_ -in @('Failed','Cancelled','Cancelling','TimedOut','DeliveryTimedOut','ExecutionTimedOut','Undeliverable','Terminated') } {
        $details = & aws.exe ssm get-command-invocation --command-id $commandId --instance-id $InstanceId --query StandardErrorContent --output text --profile $Profile --region $region
        if ($details -and $details -ne 'None') { Write-Output $details }
        throw "Deployment failed with SSM status $status (command $commandId)."
      }
      default { Start-Sleep -Seconds 15 }
    }
  }
  throw "Timed out waiting for SSM command $commandId."
} finally {
  if ($authenticated) { & docker.exe --config $dockerConfigDirectory logout $registry | Out-Null }
  $password = $null
  $script:useTemporaryDockerConfig = $false
  Remove-Item -LiteralPath $workDirectory -Recurse -Force -ErrorAction SilentlyContinue
}
