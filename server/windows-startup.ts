import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type { StartupStatusPayload } from './types.ts';

const execFileAsync = promisify(execFile);

const REPO_ROOT = process.cwd();
const SCRIPTS_DIR = path.join(REPO_ROOT, 'scripts');
const TAURI_EXE_PATH = path.join(REPO_ROOT, 'src-tauri', 'target', 'release', 'rpg-life-tracker.exe');

const PROGRAMS_DIR = process.env.APPDATA
  ? path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs')
  : '';
const STARTUP_DIR = PROGRAMS_DIR ? path.join(PROGRAMS_DIR, 'Startup') : '';
const STARTUP_LNK = STARTUP_DIR ? path.join(STARTUP_DIR, 'RPG Life Tracker.lnk') : '';
const START_MENU_LNK = PROGRAMS_DIR ? path.join(PROGRAMS_DIR, 'RPG Life Tracker.lnk') : '';

const DESKTOP_LNK = path.join(os.homedir(), 'Desktop', 'RPG Life Tracker.lnk');
const ONEDRIVE_DESKTOP_LNK = path.join(os.homedir(), 'OneDrive', 'Desktop', 'RPG Life Tracker.lnk');

// Test-mode simulated state so verification never mutates real %APPDATA% or Desktop
let simStartupInstalled = false;
let simDesktopInstalled = false;

function hasNativeTauriExe(): boolean {
  return process.platform === 'win32' && fs.existsSync(TAURI_EXE_PATH);
}

async function stopLegacyPowershellTray(): Promise<void> {
  if (process.env.THE_SYSTEM_DB_PATH || process.platform !== 'win32') return;
  try {
    const cmd =
      "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*tray-companion.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], {
      windowsHide: true,
    });
  } catch {
    // Ignore cleanup errors
  }
}

export function getStartupStatus(serverUrl = 'http://localhost:3001'): StartupStatusPayload {
  const isWindows = process.platform === 'win32';
  const isTestMode = Boolean(process.env.THE_SYSTEM_DB_PATH);

  const startupInstalled = isTestMode
    ? simStartupInstalled
    : Boolean(isWindows && STARTUP_LNK && fs.existsSync(STARTUP_LNK));
  const localDesktopExists = isWindows && fs.existsSync(DESKTOP_LNK);
  const oneDriveDesktopExists = isWindows && fs.existsSync(ONEDRIVE_DESKTOP_LNK);
  const desktopShortcutInstalled = isTestMode
    ? simDesktopInstalled
    : Boolean(localDesktopExists || oneDriveDesktopExists);
  const resolvedDesktopPath =
    oneDriveDesktopExists && !localDesktopExists ? ONEDRIVE_DESKTOP_LNK : DESKTOP_LNK;

  return {
    platform: process.platform,
    isWindows,
    startupInstalled,
    startupScriptPath: hasNativeTauriExe()
      ? TAURI_EXE_PATH
      : path.join(SCRIPTS_DIR, 'start-system-hidden.vbs'),
    desktopShortcutInstalled,
    desktopShortcutPath: resolvedDesktopPath,
    traySupported: isWindows,
    daemonRunning: true,
    serverUrl,
  };
}

export async function installWindowsStartup(opts: {
  createDesktopShortcut?: boolean;
  launchTray?: boolean;
}): Promise<{ ok: boolean; message: string; status: StartupStatusPayload }> {
  if (process.env.THE_SYSTEM_DB_PATH || process.platform !== 'win32') {
    simStartupInstalled = true;
    if (opts.createDesktopShortcut) simDesktopInstalled = true;
    return {
      ok: true,
      message:
        process.platform !== 'win32'
          ? 'Chỉ hỗ trợ Windows Startup trên Windows (đã mô phỏng trạng thái).'
          : 'Test Mode: Đã mô phỏng cài Tự khởi động cùng Windows & Shortcut Desktop (an toàn).',
      status: getStartupStatus(),
    };
  }

  if (hasNativeTauriExe()) {
    await stopLegacyPowershellTray();
  }

  const scriptPath = path.join(SCRIPTS_DIR, 'install-startup.ps1');
  const args = [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
  ];
  if (opts.createDesktopShortcut) args.push('-CreateDesktopShortcut');
  if (opts.launchTray) args.push('-LaunchTray');

  await execFileAsync('powershell.exe', args, { windowsHide: true });

  const nativeMode = hasNativeTauriExe();
  return {
    ok: true,
    message: opts.createDesktopShortcut
      ? nativeMode
        ? 'Đã cài Tự Khởi Động cùng Windows, Start Menu & Shortcut Desktop trỏ thẳng tới RPG Life Tracker (.exe)!'
        : 'Đã cài Tự Khởi Động cùng Windows và tạo Shortcut Desktop App!'
      : nativeMode
        ? 'Đã cài Tự Khởi Động cùng Windows với Tauri Native (.exe --autostart)!'
        : 'Đã cài Tự Khởi Động cùng Windows (chạy nền khi bật máy)!',
    status: getStartupStatus(),
  };
}

export async function uninstallWindowsStartup(opts: {
  removeDesktopShortcut?: boolean;
}): Promise<{ ok: boolean; message: string; status: StartupStatusPayload }> {
  if (process.env.THE_SYSTEM_DB_PATH || process.platform !== 'win32') {
    simStartupInstalled = false;
    if (opts.removeDesktopShortcut) simDesktopInstalled = false;
    return {
      ok: true,
      message: 'Test Mode: Đã mô phỏng gỡ Tự khởi động cùng Windows.',
      status: getStartupStatus(),
    };
  }

  const scriptPath = path.join(SCRIPTS_DIR, 'uninstall-startup.ps1');
  const args = [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
  ];
  if (opts.removeDesktopShortcut) args.push('-RemoveDesktopShortcut');

  await execFileAsync('powershell.exe', args, { windowsHide: true });

  if (opts.removeDesktopShortcut && START_MENU_LNK && fs.existsSync(START_MENU_LNK)) {
    try {
      fs.unlinkSync(START_MENU_LNK);
    } catch {
      // Ignore cleanup failure
    }
  }

  return {
    ok: true,
    message: 'Đã gỡ Tự Khởi Động cùng Windows thành công.',
    status: getStartupStatus(),
  };
}

export function launchSystemTray(): { ok: boolean; message: string } {
  if (process.env.THE_SYSTEM_DB_PATH || process.platform !== 'win32') {
    return {
      ok: true,
      message:
        process.platform !== 'win32'
          ? 'System Tray chỉ khả dụng trên Windows.'
          : 'Test Mode: Đã mô phỏng khởi chạy Icon Khay Hệ Thống.',
    };
  }

  if (hasNativeTauriExe()) {
    const child = spawn('explorer.exe', [TAURI_EXE_PATH], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    return {
      ok: true,
      message: 'Đã khởi chạy / đánh thức RPG Life Tracker Native Tray & 2D Pixel HUD (.exe).',
    };
  }

  const trayScript = path.join(SCRIPTS_DIR, 'tray-companion.ps1');
  const child = spawn(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-WindowStyle',
      'Hidden',
      '-STA',
      '-File',
      trayScript,
    ],
    {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }
  );
  child.unref();

  return {
    ok: true,
    message: 'Đã mở Icon RPG Life Tracker ở Khay Hệ Thống (góc dưới phải Windows).',
  };
}
