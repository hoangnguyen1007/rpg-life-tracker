$ErrorActionPreference = 'Continue'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$dataDir = Join-Path $repoRoot 'data'
if (-not (Test-Path $dataDir)) {
  New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
}
$logFile = Join-Path $dataDir 'daemon.log'

# Single-instance guard: exit cleanly if port 3001 health endpoint is already alive
try {
  $health = Invoke-RestMethod -Uri 'http://localhost:3001/api/health' -TimeoutSec 2 -ErrorAction Stop
  if ($health -and $health.ok) {
    exit 0
  }
} catch {
  # Not running yet; continue to start daemon
}

$distHtml = Join-Path $repoRoot 'dist\index.html'
if (-not (Test-Path $distHtml)) {
  "[$(Get-Date -Format 's')] Building dist/ before starting daemon..." | Out-File -FilePath $logFile -Append -Encoding utf8
  cmd /c npm run build >> $logFile 2>&1
}

$consecutiveFailures = 0
while ($true) {
  "[$(Get-Date -Format 's')] Starting THE SYSTEM // RPG Life Tracker Daemon..." | Out-File -FilePath $logFile -Append -Encoding utf8
  $startedAt = Get-Date
  cmd /c npx.cmd tsx server/index.ts >> $logFile 2>&1
  $exitCode = $LASTEXITCODE
  $uptimeSec = ((Get-Date) - $startedAt).TotalSeconds

  if ($exitCode -eq 0) {
    break
  }

  if ($uptimeSec -lt 10) {
    $consecutiveFailures += 1
  } else {
    $consecutiveFailures = 0
  }

  if ($consecutiveFailures -ge 5) {
    "[$(Get-Date -Format 's')] Too many rapid failures ($consecutiveFailures). Stopping daemon loop." | Out-File -FilePath $logFile -Append -Encoding utf8
    break
  }

  Start-Sleep -Seconds 5
}
