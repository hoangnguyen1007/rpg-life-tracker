$ErrorActionPreference = 'SilentlyContinue'
$scriptDir = $PSScriptRoot
$repoRoot = Split-Path -Parent $scriptDir
$exePath = Join-Path $repoRoot 'src-tauri\target\release\rpg-life-tracker.exe'

# Prefer native Tauri v2 Desktop App (.exe) when built
if (Test-Path $exePath) {
  Start-Process -FilePath 'explorer.exe' -ArgumentList "`"$exePath`""
  exit 0
}

$url = 'http://localhost:3001'

function Test-ServerOnline {
  try {
    $r = Invoke-RestMethod -Uri "$url/api/health" -TimeoutSec 2 -ErrorAction Stop
    return ($r -and $r.ok)
  } catch {
    return $false
  }
}

if (-not (Test-ServerOnline)) {
  $vbsPath = Join-Path $scriptDir 'start-system-hidden.vbs'
  if (Test-Path $vbsPath) {
    Start-Process -FilePath 'wscript.exe' -ArgumentList "//B `"$vbsPath`"" -WindowStyle Hidden
  }
  for ($i = 0; $i -lt 16; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-ServerOnline) { break }
  }
}

$edgeCandidates = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)
$chromeCandidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$browserExe = $null
foreach ($c in $edgeCandidates) {
  if ($c -and (Test-Path $c)) { $browserExe = $c; break }
}
if (-not $browserExe) {
  $cmdEdge = Get-Command msedge -ErrorAction SilentlyContinue
  if ($cmdEdge) { $browserExe = $cmdEdge.Source }
}
if (-not $browserExe) {
  foreach ($c in $chromeCandidates) {
    if ($c -and (Test-Path $c)) { $browserExe = $c; break }
  }
}
if (-not $browserExe) {
  $cmdChrome = Get-Command chrome -ErrorAction SilentlyContinue
  if ($cmdChrome) { $browserExe = $cmdChrome.Source }
}

if ($browserExe) {
  Start-Process -FilePath $browserExe -ArgumentList "--app=$url"
} else {
  Start-Process $url
}
