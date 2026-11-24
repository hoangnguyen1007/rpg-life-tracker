param(
  [switch]$CreateDesktopShortcut,
  [switch]$LaunchTray
)

$ErrorActionPreference = 'Stop'
$scriptDir = $PSScriptRoot
$repoRoot = Split-Path -Parent $scriptDir

$startupDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
if (-not (Test-Path $startupDir)) {
  New-Item -ItemType Directory -Path $startupDir -Force | Out-Null
}

$vbsPath = Join-Path $scriptDir 'start-system-hidden.vbs'
$openAppPath = Join-Path $scriptDir 'open-desktop-app.ps1'
$trayPath = Join-Path $scriptDir 'tray-companion.ps1'

$wsh = New-Object -ComObject WScript.Shell

$startupLnk = Join-Path $startupDir 'RPG Life Tracker.lnk'
$sc = $wsh.CreateShortcut($startupLnk)
$sc.TargetPath = 'wscript.exe'
$sc.Arguments = "//B `"$vbsPath`""
$sc.WorkingDirectory = $repoRoot
$sc.Description = 'Tự động khởi chạy RPG Life Tracker nền & icon Khay Hệ Thống khi bật Windows'
$sc.WindowStyle = 7
$sc.Save()

if ($CreateDesktopShortcut) {
  $desktopDir = [Environment]::GetFolderPath('Desktop')
  $desktopLnk = Join-Path $desktopDir 'RPG Life Tracker.lnk'
  $dsc = $wsh.CreateShortcut($desktopLnk)
  $dsc.TargetPath = 'powershell.exe'
  $dsc.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$openAppPath`""
  $dsc.WorkingDirectory = $repoRoot
  $dsc.Description = 'Mở RPG Life Tracker ở chế độ Desktop App độc lập'
  $dsc.WindowStyle = 7
  $dsc.Save()
}

if ($LaunchTray) {
  Start-Process -FilePath 'powershell.exe' -ArgumentList "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -STA -File `"$trayPath`"" -WindowStyle Hidden
}

Write-Output "INSTALLED_STARTUP:$startupLnk"
