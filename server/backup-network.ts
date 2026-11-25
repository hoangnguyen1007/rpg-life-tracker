import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import QRCode from 'qrcode';
import { DB_PATH, db } from './db.ts';
import { getVnNowParts, getVnTodayKey } from './time-vn.ts';
import type {
  BackupFileEntry,
  BackupStatusPayload,
  LanAccessPayload,
} from './types.ts';

const DEFAULT_BACKUP_DIR = path.resolve(process.cwd(), 'data', 'backups');

export function resolveBackupDir(customDir?: string): string {
  const trimmed = (customDir || '').trim();
  const target = trimmed ? path.resolve(trimmed) : DEFAULT_BACKUP_DIR;
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  return target;
}

function listSqliteBackups(dir: string): BackupFileEntry[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.sqlite'))
    .map((filename) => {
      const fullPath = path.join(dir, filename);
      const st = fs.statSync(fullPath);
      return {
        filename,
        fullPath,
        sizeBytes: st.size,
        createdAt: st.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.filename.localeCompare(a.filename));
}

function enforceBackupRetention(dir: string, retentionDays: number): void {
  const safeDays = Math.max(1, Math.min(365, Math.round(retentionDays || 14)));
  const cutoffMs = Date.now() - safeDays * 24 * 60 * 60 * 1000;
  const regularBackups = listSqliteBackups(dir).filter(
    (b) => !b.filename.includes('_pre_restore_')
  );

  // Keep up to `safeDays` recent files, or any file newer than cutoff
  for (let i = 0; i < regularBackups.length; i++) {
    const b = regularBackups[i];
    const mtimeMs = Date.parse(b.createdAt);
    if (i >= safeDays && (!Number.isFinite(mtimeMs) || mtimeMs < cutoffMs)) {
      try {
        fs.unlinkSync(b.fullPath);
      } catch {
        // Ignore deletion failure
      }
    }
  }
}

export function runBackupNow(tag?: string): BackupFileEntry {
  const settings = db.getAssistantSettings();
  const dir = resolveBackupDir(settings.backupDir);
  const dateKey = getVnTodayKey();
  const parts = getVnNowParts();
  const hhmmss = `${String(parts.hour).padStart(2, '0')}${String(parts.minute).padStart(2, '0')}${String(parts.second).padStart(2, '0')}`;
  const cleanTag = tag ? tag.replace(/[^a-zA-Z0-9_-]/g, '') : '';

  let filename = cleanTag
    ? `the_system_${dateKey}_${cleanTag}.sqlite`
    : `the_system_${dateKey}.sqlite`;
  let fullPath = path.join(dir, filename);

  if (fs.existsSync(fullPath)) {
    filename = cleanTag
      ? `the_system_${dateKey}_${cleanTag}_${hhmmss}.sqlite`
      : `the_system_${dateKey}_${hhmmss}.sqlite`;
    fullPath = path.join(dir, filename);
  }

  db.checkpointWal(true);
  fs.copyFileSync(DB_PATH, fullPath);

  enforceBackupRetention(dir, settings.backupRetentionDays ?? 14);

  const stat = fs.statSync(fullPath);
  db.addAuditLog('SYSTEM_BACKUP', `Sao lưu SQLite xoay vòng "${filename}"`, {
    filename,
    dir,
    sizeBytes: stat.size,
  });

  return {
    filename,
    fullPath,
    sizeBytes: stat.size,
    createdAt: stat.mtime.toISOString(),
  };
}

export function ensureDailyAutoBackup(): BackupFileEntry | null {
  if (process.env.THE_SYSTEM_DB_PATH) return null;
  const settings = db.getAssistantSettings();
  if (settings.backupEnabled === false) return null;

  try {
    const dir = resolveBackupDir(settings.backupDir);
    const todayName = `the_system_${getVnTodayKey()}.sqlite`;
    if (fs.existsSync(path.join(dir, todayName))) {
      return null;
    }
    return runBackupNow();
  } catch (err) {
    console.warn('[AutoBackup] Daily SQLite backup skipped:', err);
    return null;
  }
}

export function getBackupStatus(): BackupStatusPayload {
  const settings = db.getAssistantSettings();
  const backupDir = settings.backupDir || '';
  const resolvedDir = resolveBackupDir(backupDir);
  const backups = listSqliteBackups(resolvedDir);
  return {
    enabled: settings.backupEnabled !== false,
    backupDir,
    resolvedDir,
    retentionDays: settings.backupRetentionDays ?? 14,
    lastBackupAt: backups[0]?.createdAt ?? null,
    backups,
  };
}

export function restoreBackupByFilename(filename: string): { preRestoreBackup: string } {
  const clean = (filename || '').trim();
  if (
    !clean ||
    clean !== path.basename(clean) ||
    clean.includes('..') ||
    clean.includes('/') ||
    clean.includes('\\') ||
    !clean.toLowerCase().endsWith('.sqlite')
  ) {
    throw new Error('Tên file sao lưu không hợp lệ.');
  }

  const settings = db.getAssistantSettings();
  const resolvedDir = resolveBackupDir(settings.backupDir);
  const fullPath = path.join(resolvedDir, clean);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    throw new Error(`Không tìm thấy file sao lưu "${clean}" trong thư mục backup.`);
  }

  const parts = getVnNowParts();
  const stamp = `${String(parts.hour).padStart(2, '0')}${String(parts.minute).padStart(2, '0')}${String(parts.second).padStart(2, '0')}`;
  const preRestorePath = path.join(
    resolvedDir,
    `the_system_${getVnTodayKey()}_pre_restore_${stamp}.sqlite`
  );

  return db.restoreFromBackupFile(fullPath, preRestorePath);
}

function isTailscaleIpv4(ip: string): boolean {
  const octets = ip.split('.').map((n) => Number(n));
  if (octets.length !== 4) return false;
  return octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127;
}

function isPrivateLanIpv4(ip: string): boolean {
  const octets = ip.split('.').map((n) => Number(n));
  if (octets.length !== 4) return false;
  if (octets[0] === 192 && octets[1] === 168) return true;
  if (octets[0] === 10) return true;
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
  return false;
}

const VIRTUAL_IFACE_RE =
  /(vethernet|wsl|hyper-v|docker|vmware|virtualbox|vbox|bluetooth|loopback|npcap|default switch)/i;
const PHYSICAL_IFACE_RE = /(wi-fi|wifi|wlan|ethernet|en\d+|eth\d+)/i;

function scoreNetworkInterface(
  ifaceName: string,
  ip: string,
  isLan: boolean,
  isTailscale: boolean,
  isVirtual: boolean
): number {
  if (!isVirtual && isLan) {
    let score = 100;
    if (ip.startsWith('192.168.')) score += 30;
    else if (ip.startsWith('10.')) score += 10;
    if (PHYSICAL_IFACE_RE.test(ifaceName)) score += 20;
    return score;
  }
  if (isTailscale) return 80;
  if (!isVirtual) return 60;
  return 10;
}

export async function getLanAccessInfo(port: number): Promise<LanAccessPayload> {
  const settings = db.getAssistantSettings();
  const enabled = Boolean(settings.lanAccessEnabled);
  const pairToken = settings.lanPairToken || crypto.randomBytes(16).toString('hex');
  const pairPin = settings.lanPairPin || '123456';

  const nets = os.networkInterfaces();
  const candidates: Array<{
    label: string;
    ip: string;
    isLan: boolean;
    isTailscale: boolean;
    isVirtual: boolean;
    score: number;
  }> = [];
  const seenIps = new Set<string>();

  for (const [ifaceName, addrs] of Object.entries(nets)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      if (seenIps.has(addr.address)) continue;
      seenIps.add(addr.address);
      const ts = isTailscaleIpv4(addr.address);
      const lan = isPrivateLanIpv4(addr.address);
      const isVirtual = !ts && VIRTUAL_IFACE_RE.test(ifaceName);
      const score = scoreNetworkInterface(ifaceName, addr.address, lan, ts, isVirtual);
      candidates.push({
        label: ts
          ? `Tailscale (${ifaceName})`
          : isVirtual
            ? `Ảo (${ifaceName})`
            : lan
              ? `LAN (${ifaceName})`
              : ifaceName,
        ip: addr.address,
        isLan: lan,
        isTailscale: ts,
        isVirtual,
        score,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.ip.localeCompare(b.ip));

  const makeUrl = (ip: string) =>
    `http://${ip}:${port}/#/mobile?token=${encodeURIComponent(pairToken)}`;

  const allAddresses = candidates.map((c) => ({
    label: c.label,
    ip: c.ip,
    mobileUrl: makeUrl(c.ip),
  }));

  const tailscaleIp = candidates.find((c) => c.isTailscale)?.ip ?? null;
  const primaryIp =
    candidates.find((c) => !c.isVirtual && !c.isTailscale)?.ip ??
    tailscaleIp ??
    candidates[0]?.ip ??
    null;
  const mobileUrl = primaryIp ? makeUrl(primaryIp) : null;

  let qrSvg: string | null = null;
  if (enabled && mobileUrl) {
    try {
      qrSvg = await QRCode.toString(mobileUrl, {
        type: 'svg',
        margin: 1,
        width: 180,
      });
    } catch {
      qrSvg = null;
    }
  }

  return {
    enabled,
    port,
    primaryIp,
    tailscaleIp,
    allAddresses,
    mobileUrl,
    qrSvg,
    pairPin,
    pairToken,
  };
}

export function isLocalhostAddress(rawIp: string | undefined): boolean {
  if (!rawIp) return false;
  const clean = rawIp.trim();
  return (
    clean === '127.0.0.1' ||
    clean === '::1' ||
    clean === '::ffff:127.0.0.1' ||
    clean === 'localhost'
  );
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function requireLocalhost(req: Request, res: Response): boolean {
  const remoteIp = req.ip || req.socket.remoteAddress;
  if (!isLocalhostAddress(remoteIp)) {
    res.status(403).json({ error: 'LOCALHOST_ONLY' });
    return false;
  }
  return true;
}

const PIN_WINDOW_MS = 5 * 60 * 1000;
const PIN_MAX_FAILURES = 5;
const pinFailuresByIp = new Map<string, number[]>();

export function checkPinRateLimit(rawIp: string | undefined): { allowed: boolean; retryAfterSec?: number } {
  const ip = (rawIp || 'unknown').trim();
  const now = Date.now();
  const recent = (pinFailuresByIp.get(ip) || []).filter((ts) => now - ts < PIN_WINDOW_MS);
  pinFailuresByIp.set(ip, recent);
  if (recent.length >= PIN_MAX_FAILURES) {
    const oldest = recent[0];
    const retryAfterSec = Math.max(1, Math.ceil((PIN_WINDOW_MS - (now - oldest)) / 1000));
    return { allowed: false, retryAfterSec };
  }
  return { allowed: true };
}

export function recordPinFailure(rawIp: string | undefined): void {
  const ip = (rawIp || 'unknown').trim();
  const now = Date.now();
  const recent = (pinFailuresByIp.get(ip) || []).filter((ts) => now - ts < PIN_WINDOW_MS);
  recent.push(now);
  pinFailuresByIp.set(ip, recent);
}

export function clearPinFailures(rawIp: string | undefined): void {
  const ip = (rawIp || 'unknown').trim();
  pinFailuresByIp.delete(ip);
}

export function lanAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.path.startsWith('/api')) {
    next();
    return;
  }

  if (req.path === '/api/health' || req.path === '/api/network/pair-pin') {
    next();
    return;
  }

  const remoteIp = req.ip || req.socket.remoteAddress;
  if (isLocalhostAddress(remoteIp)) {
    next();
    return;
  }

  const settings = db.getAssistantSettings();
  const headerToken =
    typeof req.headers['x-system-lan-token'] === 'string'
      ? req.headers['x-system-lan-token'].trim()
      : '';
  const queryToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  const providedToken = headerToken || queryToken;

  if (
    settings.lanAccessEnabled === true &&
    Boolean(settings.lanPairToken) &&
    constantTimeEqual(providedToken, settings.lanPairToken!)
  ) {
    next();
    return;
  }

  res.status(401).json({ error: 'LAN_AUTH_REQUIRED' });
}
