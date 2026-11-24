param(
  [switch]$RemoveDesktopShortcut
)

$ErrorActionPreference = 'SilentlyContinue'
$startupDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$startupLnk = Join-Path $startupDir 'RPG Life Tracker.lnk'

if (Test-Path $startupLnk) {
  Remove-Item -Path $startupLnk -Force
}

if ($RemoveDesktopShortcut) {
  $desktopDir = [Environment]::GetFolderPath('Desktop')
  $desktopLnk = Join-Path $desktopDir 'RPG Life Tracker.lnk'
  if (Test-Path $desktopLnk) {
    Remove-Item -Path $desktopLnk -Force
  }
}

Write-Output "UNINSTALLED_STARTUP"
