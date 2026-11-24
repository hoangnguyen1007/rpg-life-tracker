import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type { StartupStatusPayload } from './types.ts';

const execFileAsync = promisify(execFile);

const REPO_ROOT = process.cwd();
const SCRIPTS_DIR = path.join(REPO_ROOT, 'scripts');

const STARTUP_DIR = process.env.APPDATA
  ? path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup')
  : '';
const DESKTOP_LNK = path.join(os.homedir(), 'Desktop', 'RPG Life Tracker.lnk');
const ONEDRIVE_DESKTOP_LNK = path.join(os.homedir(), 'OneDrive', 'Desktop', 'RPG Life Tracker.lnk');

const STARTUP_LNK = STARTUP_DIR ? path.join(STARTUP_DIR, 'RPG Life Tracker.lnk') : '';

// Test-mode simulated state so verification never mutates real %APPDATA% or Desktop
let simStartupInstalled = false;
let simDesktopInstalled = false;

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
  const resolvedDesktopPath = oneDriveDesktopExists && !localDesktopExists ? ONEDRIVE_DESKTOP_LNK : DESKTOP_LNK;

  return {
    platform: process.platform,
    isWindows,
    startupInstalled,
    startupScriptPath: path.join(SCRIPTS_DIR, 'start-system-hidden.vbs'),
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

  return {
    ok: true,
    message: opts.createDesktopShortcut
      ? 'Đã cài Tự Khởi Động cùng Windows và tạo Shortcut Desktop App!'
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
