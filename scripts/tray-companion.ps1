$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, 'Global\RPG_Life_Tracker_Tray', [ref]$createdNew)
if (-not $createdNew) {
  exit 0
}

$scriptDir = $PSScriptRoot
$baseUrl = 'http://localhost:3001'

function New-PixelShieldIcon {
  $bmp = New-Object System.Drawing.Bitmap(16, 16)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb(11, 14, 22))
  $gold = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(245, 158, 11))
  $cyan = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(56, 189, 248))
  $g.FillRectangle($gold, 3, 2, 10, 2)
  $g.FillRectangle($gold, 2, 4, 12, 5)
  $g.FillRectangle($gold, 4, 9, 8, 3)
  $g.FillRectangle($gold, 6, 12, 4, 2)
  $g.FillRectangle($cyan, 7, 4, 2, 6)
  $g.Dispose()
  $hIcon = $bmp.GetHicon()
  return [System.Drawing.Icon]::FromHandle($hIcon)
}

$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Icon = New-PixelShieldIcon
$notifyIcon.Text = 'RPG Life Tracker — Trợ Lý PC'
$notifyIcon.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip

$itemOpenApp = New-Object System.Windows.Forms.ToolStripMenuItem('Mở RPG Life Tracker (Desktop Window)')
$itemOpenApp.Add_Click({
  $openScript = Join-Path $scriptDir 'open-desktop-app.ps1'
  Start-Process -FilePath 'powershell.exe' -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$openScript`"" -WindowStyle Hidden
})

$itemOpenBrowser = New-Object System.Windows.Forms.ToolStripMenuItem('Trạng thái Hôm Nay (Mở Trình Duyệt)')
$itemOpenBrowser.Add_Click({
  Start-Process $baseUrl
})

$itemToggleTracker = New-Object System.Windows.Forms.ToolStripMenuItem('Bật/Tắt Theo Dõi Thông Minh')
$itemToggleTracker.Add_Click({
  try {
    $overview = Invoke-RestMethod -Uri "$baseUrl/api/assistant/overview" -TimeoutSec 3
    $nextEnabled = -not [bool]$overview.trackerRunning
    $body = @{ enabled = $nextEnabled } | ConvertTo-Json
    $updated = Invoke-RestMethod -Uri "$baseUrl/api/assistant/tracker/toggle" -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 4
    $statusText = if ($updated.trackerRunning) { 'Đang BẬT theo dõi thông minh' } else { 'Đã TẠM DỪNG theo dõi' }
    $notifyIcon.ShowBalloonTip(2500, 'RPG Life Tracker', $statusText, [System.Windows.Forms.ToolTipIcon]::Info)
  } catch {
    $notifyIcon.ShowBalloonTip(2500, 'RPG Life Tracker', 'Không kết nối được server tại localhost:3001', [System.Windows.Forms.ToolTipIcon]::Warning)
  }
})

$itemTestToast = New-Object System.Windows.Forms.ToolStripMenuItem('Thử Thông Báo')
$itemTestToast.Add_Click({
  try {
    Invoke-RestMethod -Uri "$baseUrl/api/assistant/test-notification" -Method Post -TimeoutSec 4 | Out-Null
  } catch {
    $notifyIcon.ShowBalloonTip(2500, 'RPG Life Tracker', 'Server chưa online tại localhost:3001', [System.Windows.Forms.ToolTipIcon]::Warning)
  }
})

$itemExit = New-Object System.Windows.Forms.ToolStripMenuItem('Thoát Tray')
$itemExit.Add_Click({
  $notifyIcon.Visible = $false
  $notifyIcon.Dispose()
  [System.Windows.Forms.Application]::Exit()
})

$menu.Items.Add($itemOpenApp) | Out-Null
$menu.Items.Add($itemOpenBrowser) | Out-Null
$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null
$menu.Items.Add($itemToggleTracker) | Out-Null
$menu.Items.Add($itemTestToast) | Out-Null
$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null
$menu.Items.Add($itemExit) | Out-Null

$notifyIcon.ContextMenuStrip = $menu
$notifyIcon.Add_DoubleClick({
  $openScript = Join-Path $scriptDir 'open-desktop-app.ps1'
  Start-Process -FilePath 'powershell.exe' -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$openScript`"" -WindowStyle Hidden
})

[System.Windows.Forms.Application]::Run()
if ($mutex) { $mutex.ReleaseMutex() | Out-Null }
