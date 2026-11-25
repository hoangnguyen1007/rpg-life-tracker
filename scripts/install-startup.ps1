param(
  [switch]$CreateDesktopShortcut,
  [switch]$LaunchTray
)

$ErrorActionPreference = 'Stop'
$scriptDir = $PSScriptRoot
$repoRoot = Split-Path -Parent $scriptDir

$programsDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$startupDir = Join-Path $programsDir 'Startup'
if (-not (Test-Path $startupDir)) {
  New-Item -ItemType Directory -Path $startupDir -Force | Out-Null
}

$exePath = Join-Path $repoRoot 'src-tauri\target\release\rpg-life-tracker.exe'
$icoPath = Join-Path $repoRoot 'src-tauri\icons\icon.ico'
$hasExe = Test-Path $exePath
$hasIco = Test-Path $icoPath

$wsh = New-Object -ComObject WScript.Shell
$startupLnk = Join-Path $startupDir 'RPG Life Tracker.lnk'
$startMenuLnk = Join-Path $programsDir 'RPG Life Tracker.lnk'

if ($hasExe) {
  # Stop any legacy PowerShell tray-companion.ps1 process cleanly when upgrading to native Tauri mode
  try {
    Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -like '*tray-companion.ps1*' } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  } catch {
  }

  # 1. Windows Startup shortcut -> rpg-life-tracker.exe --autostart
  $sc = $wsh.CreateShortcut($startupLnk)
  $sc.TargetPath = $exePath
  $sc.Arguments = '--autostart'
  $sc.WorkingDirectory = $repoRoot
  $sc.Description = 'Tự động khởi chạy RPG Life Tracker (2D Pixel HUD + Khay Hệ Thống) khi bật Windows'
  $sc.WindowStyle = 1
  if ($hasIco) { $sc.IconLocation = "$icoPath,0" }
  $sc.Save()

  # 2. Start Menu shortcut -> rpg-life-tracker.exe
  $smc = $wsh.CreateShortcut($startMenuLnk)
  $smc.TargetPath = $exePath
  $smc.Arguments = ''
  $smc.WorkingDirectory = $repoRoot
  $smc.Description = 'Mở RPG Life Tracker (2D Pixel HUD + Bảng Điều Khiển)'
  $smc.WindowStyle = 1
  if ($hasIco) { $smc.IconLocation = "$icoPath,0" }
  $smc.Save()

  # 3. Desktop shortcut -> rpg-life-tracker.exe
  if ($CreateDesktopShortcut) {
    $desktopDir = [Environment]::GetFolderPath('Desktop')
    $desktopLnk = Join-Path $desktopDir 'RPG Life Tracker.lnk'
    $dsc = $wsh.CreateShortcut($desktopLnk)
    $dsc.TargetPath = $exePath
    $dsc.Arguments = ''
    $dsc.WorkingDirectory = $repoRoot
    $dsc.Description = 'Mở RPG Life Tracker (2D Pixel HUD + Bảng Điều Khiển)'
    $dsc.WindowStyle = 1
    if ($hasIco) { $dsc.IconLocation = "$icoPath,0" }
    $dsc.Save()
  }

  if ($LaunchTray) {
    Start-Process -FilePath 'explorer.exe' -ArgumentList "`"$exePath`""
  }

  Write-Output "INSTALLED_TAURI_STARTUP:$startupLnk"
} else {
  $vbsPath = Join-Path $scriptDir 'start-system-hidden.vbs'
  $openAppPath = Join-Path $scriptDir 'open-desktop-app.ps1'
  $trayPath = Join-Path $scriptDir 'tray-companion.ps1'

  $sc = $wsh.CreateShortcut($startupLnk)
  $sc.TargetPath = 'wscript.exe'
  $sc.Arguments = "//B `"$vbsPath`""
  $sc.WorkingDirectory = $repoRoot
  $sc.Description = 'Tự động khởi chạy RPG Life Tracker nền & icon Khay Hệ Thống khi bật Windows'
  $sc.WindowStyle = 7
  if ($hasIco) { $sc.IconLocation = "$icoPath,0" }
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
    if ($hasIco) { $dsc.IconLocation = "$icoPath,0" }
    $dsc.Save()
  }

  if ($LaunchTray) {
    Start-Process -FilePath 'powershell.exe' -ArgumentList "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -STA -File `"$trayPath`"" -WindowStyle Hidden
  }

  Write-Output "INSTALLED_STARTUP:$startupLnk"
}
