<#
.SYNOPSIS
  VS-Free lightweight build & launch helper for RPG Life Tracker (Tauri v2).
  Wires portable MSVC + Windows SDK from D:\tools\msvc (zero Visual Studio Installer, zero UAC).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\build-tauri-light.ps1 -Mode release
  powershell -ExecutionPolicy Bypass -File scripts\build-tauri-light.ps1 -Mode debug
  powershell -ExecutionPolicy Bypass -File scripts\build-tauri-light.ps1 -Mode check
  powershell -ExecutionPolicy Bypass -File scripts\build-tauri-light.ps1 -Mode release -Launch
#>
[CmdletBinding()]
param(
  [ValidateSet('check', 'debug', 'release')]
  [string]$Mode = 'release',

  [string]$MsvcRoot = 'D:\tools\msvc',

  [int]$Jobs = 2,

  [switch]$SkipFrontendBuild,

  [switch]$Launch
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$TauriDir = Join-Path $RepoRoot 'src-tauri'

# 1. Verify Rust toolchain (user-space ~/.cargo/bin)
$CargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
if (-not (Test-Path (Join-Path $CargoBin 'cargo.exe'))) {
  throw "Rust/Cargo not found in '$CargoBin'. Install minimal Rust with: rustup-init.exe -y --default-toolchain stable --default-host x86_64-pc-windows-msvc --profile minimal"
}

# 2. Verify portable MSVC + Windows SDK
if (-not (Test-Path (Join-Path $MsvcRoot 'VC\Tools\MSVC'))) {
  throw "Portable MSVC not found at '$MsvcRoot'. Run in D:\tools: python portable-msvc.py --accept-license --target x64 --host x64"
}

$vcDir = Get-ChildItem (Join-Path $MsvcRoot 'VC\Tools\MSVC') -Directory | Sort-Object Name -Descending | Select-Object -First 1
$sdkDir = Get-ChildItem (Join-Path $MsvcRoot 'Windows Kits\10\bin') -Directory | Where-Object { $_.Name -match '^\d+\.' } | Sort-Object Name -Descending | Select-Object -First 1

if (-not $vcDir -or -not $sdkDir) {
  throw "Could not detect MSVC or Windows SDK version under '$MsvcRoot'."
}

$vcVer = $vcDir.Name
$sdkVer = $sdkDir.Name

$vcBin = Join-Path $MsvcRoot "VC\Tools\MSVC\$vcVer\bin\Hostx64\x64"
$sdkBin = Join-Path $MsvcRoot "Windows Kits\10\bin\$sdkVer\x64"
$sdkUcrtBin = Join-Path $sdkBin 'ucrt'

$env:PATH = "$CargoBin;$vcBin;$sdkBin;$sdkUcrtBin;$env:PATH"
$env:INCLUDE = @(
  (Join-Path $MsvcRoot "VC\Tools\MSVC\$vcVer\include"),
  (Join-Path $MsvcRoot "Windows Kits\10\Include\$sdkVer\ucrt"),
  (Join-Path $MsvcRoot "Windows Kits\10\Include\$sdkVer\shared"),
  (Join-Path $MsvcRoot "Windows Kits\10\Include\$sdkVer\um"),
  (Join-Path $MsvcRoot "Windows Kits\10\Include\$sdkVer\winrt"),
  (Join-Path $MsvcRoot "Windows Kits\10\Include\$sdkVer\cppwinrt")
) -join ';'
$env:LIB = @(
  (Join-Path $MsvcRoot "VC\Tools\MSVC\$vcVer\lib\x64"),
  (Join-Path $MsvcRoot "Windows Kits\10\Lib\$sdkVer\ucrt\x64"),
  (Join-Path $MsvcRoot "Windows Kits\10\Lib\$sdkVer\um\x64")
) -join ';'

$env:VCToolsInstallDir = (Join-Path $MsvcRoot "VC\Tools\MSVC\$vcVer") + '\'
$env:VCToolsVersion = $vcVer
$env:WindowsSdkDir = (Join-Path $MsvcRoot 'Windows Kits\10') + '\'
$env:WindowsSDKVersion = "$sdkVer\"
$env:WindowsSdkBinPath = (Join-Path $MsvcRoot 'Windows Kits\10\bin') + '\'
$env:RC = Join-Path $sdkBin 'rc.exe'
$env:RC_x86_64_pc_windows_msvc = $env:RC
$env:CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER = Join-Path $vcBin 'link.exe'

# Keep Rust/MSVC temporary files on the same drive as portable MSVC (avoids exhausting low C: free space)
$BuildTemp = Join-Path (Split-Path $MsvcRoot -Parent) 'tmp'
New-Item -ItemType Directory -Force -Path $BuildTemp | Out-Null
$env:TEMP = $BuildTemp
$env:TMP = $BuildTemp

Write-Host "[tauri-light] Rust: $(rustc --version)"
Write-Host "[tauri-light] Portable MSVC: $vcVer | WinSDK: $sdkVer | Root: $MsvcRoot | Jobs: $Jobs"

# 3. Build frontend dist/ for release builds unless skipped
if ($Mode -eq 'release' -and -not $SkipFrontendBuild) {
  Write-Host '[tauri-light] Building Vite frontend bundle (npm.cmd run build)...'
  Push-Location $RepoRoot
  try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "Frontend build failed with exit code $LASTEXITCODE" }
  } finally {
    Pop-Location
  }
}

# 4. Run Cargo build/check in src-tauri/
Push-Location $TauriDir
try {
  switch ($Mode) {
    'check' {
      Write-Host "[tauri-light] Running cargo check --features custom-protocol -j $Jobs..."
      & cargo check --features custom-protocol -j $Jobs
    }
    'debug' {
      Write-Host "[tauri-light] Running cargo build --features custom-protocol -j $Jobs (debug)..."
      & cargo build --features custom-protocol -j $Jobs
    }
    'release' {
      Write-Host "[tauri-light] Running cargo build --release --features custom-protocol -j $Jobs (embedded dist standalone binary)..."
      & cargo build --release --features custom-protocol -j $Jobs
    }
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Cargo $Mode failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

if ($Mode -ne 'check') {
  $exePath = Join-Path $TauriDir "target\$Mode\rpg-life-tracker.exe"
  if (Test-Path $exePath) {
    $sizeMb = [math]::Round((Get-Item $exePath).Length / 1MB, 2)
    Write-Host "[tauri-light] SUCCESS: $exePath ($sizeMb MB)"
    if ($Launch) {
      Write-Host '[tauri-light] Launching RPG Life Tracker...'
      Start-Process -FilePath $exePath -WorkingDirectory $RepoRoot
    }
  }
}
