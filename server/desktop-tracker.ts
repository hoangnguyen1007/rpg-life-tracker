import crypto from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { db } from './db.ts';
import { getVnTodayKey } from './time-vn.ts';
import type {
  ActivityCategory,
  ActivityLogEntry,
  ActivityRule,
  DailyActivitySummary,
} from './types.ts';

const DEEP_WORK_KEYWORDS = [
  'code',
  'cursor',
  'idea64',
  'pycharm',
  'webstorm',
  'devenv',
  'windowsterminal',
  'powershell',
  'cmd',
  'wt',
  'figma',
  'obsidian',
  'notion',
  'postman',
  'docker',
  'github',
  'gitlab',
  'stackoverflow',
  'leetcode',
  'localhost',
  '127.0.0.1',
  'antigravity',
  'zed',
  'dbeaver',
  'datagrip',
  'winword',
  'excel',
  'powerpnt',
  'visual studio',
];

const STUDY_KEYWORDS = [
  'anki',
  'acrobat',
  'foxit',
  'sumatrapdf',
  'zotero',
  'coursera',
  'udemy',
  'edx',
  'duolingo',
  'ielts',
  'arxiv',
  'scholar',
  'docs.google',
  'wikipedia',
  'chatgpt',
  'claude',
  'gemini',
  'perplexity',
  'notebooklm',
];

const YOUTUBE_STUDY_TITLE_RE =
  /(tutorial|course|lecture|bài giảng|học|lập trình|algorithm|english|ielts|math|toán|physics|cs50|roadmap|programming|coding|system design|documentation)/i;

const COMMUNICATION_KEYWORDS = [
  'slack',
  'teams',
  'zoom',
  'outlook',
  'mail',
  'zalo',
  'messenger',
  'telegram',
  'discord',
  'meet.google',
];

const DISTRACTION_KEYWORDS = [
  'tiktok',
  'facebook',
  'instagram',
  'reels',
  'shorts',
  'reddit',
  'netflix',
  'twitch',
  'steam',
  'riot',
  'league',
  'valorant',
  'genshin',
  'shopee',
  'lazada',
  'youtube',
];

const PRIVATE_TITLE_RE =
  /(inprivate|incognito|ẩn danh|1password|bitwarden|keepass|lastpass|internet banking|vietcombank|techcombank|mbbank|acb online)/i;

export function scrubWindowTitle(_processName: string, title: string): string {
  const trimmed = (title || '').trim();
  if (!trimmed) return '';
  if (PRIVATE_TITLE_RE.test(trimmed)) {
    return '[Cửa sổ riêng tư]';
  }
  return trimmed;
}

export function classifyActivity(
  processName: string,
  windowTitle: string,
  customRules: ActivityRule[] = [],
  idleSeconds = 0,
  idleThresholdSeconds = 180
): ActivityCategory {
  if (idleSeconds >= idleThresholdSeconds) {
    return 'idle';
  }

  const proc = (processName || '').toLowerCase();
  const title = (windowTitle || '').toLowerCase();
  const combined = `${proc} ${title}`;

  // Custom user rules ALWAYS take top priority
  for (const rule of customRules) {
    const kw = (rule.keyword || '').trim().toLowerCase();
    if (!kw) continue;
    if (proc.includes(kw) || title.includes(kw)) {
      return rule.category;
    }
  }

  // Educational YouTube takes precedence over distraction YouTube
  if (combined.includes('youtube') && YOUTUBE_STUDY_TITLE_RE.test(title)) {
    return 'study_research';
  }

  if (DEEP_WORK_KEYWORDS.some((kw) => combined.includes(kw))) {
    return 'deep_work';
  }
  if (STUDY_KEYWORDS.some((kw) => combined.includes(kw))) {
    return 'study_research';
  }
  if (COMMUNICATION_KEYWORDS.some((kw) => combined.includes(kw))) {
    return 'communication';
  }
  if (DISTRACTION_KEYWORDS.some((kw) => combined.includes(kw))) {
    return 'distraction';
  }

  return 'other';
}

function buildPsTrackerScript(pollIntervalSeconds: number): string {
  const sec = Math.max(3, Math.min(60, Math.round(pollIntervalSeconds || 10)));
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;

public struct LASTINPUTINFO {
  public uint cbSize;
  public uint dwTime;
}

public static class WinTrackerNative {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll")]
  public static extern int GetWindowTextLength(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  [DllImport("user32.dll")]
  public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

  public static uint GetIdleSeconds() {
    LASTINPUTINFO lii = new LASTINPUTINFO();
    lii.cbSize = (uint)Marshal.SizeOf(typeof(LASTINPUTINFO));
    if (!GetLastInputInfo(ref lii)) return 0;
    uint tick = unchecked((uint)Environment.TickCount);
    uint diffMs = tick - lii.dwTime;
    return diffMs / 1000;
  }

  public static string GetActiveWindowTitle(IntPtr hWnd) {
    int len = GetWindowTextLength(hWnd);
    if (len <= 0) return "";
    StringBuilder sb = new StringBuilder(len + 1);
    GetWindowText(hWnd, sb, sb.Capacity);
    return sb.ToString();
  }
}
"@

while ($true) {
  try {
    $hwnd = [WinTrackerNative]::GetForegroundWindow()
    $procName = "Idle"
    $winTitle = ""
    if ($hwnd -ne [IntPtr]::Zero) {
      [uint32]$wpid = 0
      [WinTrackerNative]::GetWindowThreadProcessId($hwnd, [ref]$wpid) | Out-Null
      if ($wpid -gt 0) {
        $p = [System.Diagnostics.Process]::GetProcessById([int]$wpid)
        if ($p -and $p.ProcessName) { $procName = $p.ProcessName }
      }
      $winTitle = [WinTrackerNative]::GetActiveWindowTitle($hwnd)
    }
    $idle = [WinTrackerNative]::GetIdleSeconds()
    $payload = @{
      processName = $procName
      windowTitle = $winTitle
      idleSeconds = [int]$idle
    } | ConvertTo-Json -Compress
    [Console]::Out.WriteLine($payload)
    [Console]::Out.Flush()
  } catch {
  }
  Start-Sleep -Seconds ${sec}
}
`;
  return Buffer.from(ps, 'utf16le').toString('base64');
}

class DesktopTrackerService {
  private worker: ChildProcessWithoutNullStreams | null = null;
  private shouldRun = false;
  private restartTimer: NodeJS.Timeout | null = null;
  private stdoutBuffer = '';

  private activeBlock: ActivityLogEntry | null = null;
  private currentApp: DailyActivitySummary['currentApp'] = null;
  private continuousDeepWorkSeconds = 0;
  private continuousDistractionSeconds = 0;
  private lastPollAtMs: number | null = null;

  isRunning(): boolean {
    return Boolean(this.shouldRun && this.worker && !this.worker.killed);
  }

  getContinuousDeepWorkMinutes(): number {
    return this.continuousDeepWorkSeconds / 60;
  }

  getContinuousDistractionMinutes(): number {
    return this.continuousDistractionSeconds / 60;
  }

  getCurrentApp(): DailyActivitySummary['currentApp'] {
    return this.currentApp;
  }

  start(): void {
    if (process.platform !== 'win32' || process.env.THE_SYSTEM_DB_PATH) {
      return;
    }
    const settings = db.getAssistantSettings();
    if (!settings.trackerEnabled) {
      return;
    }
    this.shouldRun = true;
    if (this.worker && !this.worker.killed) return;
    this.spawnWorker(settings.pollIntervalSeconds);
  }

  stop(): void {
    this.shouldRun = false;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.worker && !this.worker.killed) {
      try {
        this.worker.kill();
      } catch {
        // Ignore kill error
      }
    }
    this.worker = null;
    this.lastPollAtMs = null;
  }

  restartIfEnabled(): void {
    this.stop();
    const settings = db.getAssistantSettings();
    if (settings.trackerEnabled && process.platform === 'win32' && !process.env.THE_SYSTEM_DB_PATH) {
      this.start();
    }
  }

  private spawnWorker(pollIntervalSeconds: number): void {
    if (!this.shouldRun || process.platform !== 'win32' || process.env.THE_SYSTEM_DB_PATH) return;

    const encoded = buildPsTrackerScript(pollIntervalSeconds);
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true }
    );

    this.worker = child;
    this.stdoutBuffer = '';

    child.stdout.on('data', (chunk: Buffer) => {
      this.stdoutBuffer += chunk.toString('utf8');
      const lines = this.stdoutBuffer.split(/\r?\n/);
      this.stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('{')) continue;
        try {
          const parsed = JSON.parse(trimmed) as {
            processName?: string;
            windowTitle?: string;
            idleSeconds?: number;
          };
          const settings = db.getAssistantSettings();
          this.recordSample({
            processName: parsed.processName || 'unknown',
            windowTitle: parsed.windowTitle || '',
            durationSeconds: settings.pollIntervalSeconds || 10,
            idleSeconds: Number(parsed.idleSeconds) || 0,
          });
        } catch {
          // Ignore malformed JSON line
        }
      }
    });

    child.stderr.on('data', () => {
      // Suppress transient Win32 errors
    });

    child.on('exit', () => {
      if (this.worker === child) {
        this.worker = null;
      }
      if (this.shouldRun && !this.restartTimer) {
        this.restartTimer = setTimeout(() => {
          this.restartTimer = null;
          if (this.shouldRun) {
            const latest = db.getAssistantSettings();
            if (latest.trackerEnabled) {
              this.spawnWorker(latest.pollIntervalSeconds);
            }
          }
        }, 5000);
      }
    });
  }

  recordSample(input: {
    processName: string;
    windowTitle: string;
    durationSeconds?: number;
    isIdle?: boolean;
    idleSeconds?: number;
  }): ActivityLogEntry {
    const settings = db.getAssistantSettings();
    const dur = Math.max(1, Math.round(input.durationSeconds ?? settings.pollIntervalSeconds ?? 10));
    const idleSec = input.isIdle
      ? (settings.idleThresholdSeconds || 180) + 10
      : Math.max(0, Number(input.idleSeconds) || 0);

    const processName = (input.processName || 'Unknown').trim() || 'Unknown';
    const rawTitle = (input.windowTitle || '').trim();
    const category = classifyActivity(
      processName,
      rawTitle,
      settings.customRules,
      idleSec,
      settings.idleThresholdSeconds || 180
    );
    const windowTitle = scrubWindowTitle(processName, rawTitle);

    const nowMs = Date.now();
    const sleepGapMs = Math.max(60_000, (settings.pollIntervalSeconds || 10) * 3000);
    if (this.lastPollAtMs !== null && nowMs - this.lastPollAtMs > sleepGapMs) {
      // PC slept or hibernated: reset active coalescing block & streaks so sleep time is never credited
      this.activeBlock = null;
      this.continuousDeepWorkSeconds = 0;
      this.continuousDistractionSeconds = 0;
    }
    this.lastPollAtMs = nowMs;

    const nowIso = new Date(nowMs).toISOString();
    const dateKey = getVnTodayKey();

    if (category === 'deep_work' || category === 'study_research') {
      this.continuousDeepWorkSeconds += dur;
      this.continuousDistractionSeconds = 0;
    } else if (category === 'distraction') {
      this.continuousDistractionSeconds += dur;
      this.continuousDeepWorkSeconds = 0;
    } else if (category === 'idle') {
      this.continuousDeepWorkSeconds = 0;
      this.continuousDistractionSeconds = 0;
    } else {
      this.continuousDistractionSeconds = 0;
    }

    if (
      !this.currentApp ||
      this.currentApp.processName !== processName ||
      this.currentApp.windowTitle !== windowTitle ||
      this.currentApp.category !== category
    ) {
      this.currentApp = {
        processName,
        windowTitle,
        category,
        since: nowIso,
      };
    }

    const canCoalesce =
      this.activeBlock &&
      this.activeBlock.dateKey === dateKey &&
      this.activeBlock.processName === processName &&
      this.activeBlock.windowTitle === windowTitle &&
      this.activeBlock.category === category &&
      !this.activeBlock.creditedToSkill &&
      nowMs - Date.parse(this.activeBlock.endedAt) <= sleepGapMs;

    if (canCoalesce && this.activeBlock) {
      this.activeBlock.durationSeconds += dur;
      this.activeBlock.endedAt = nowIso;
      db.upsertActivityLog(this.activeBlock);
      return this.activeBlock;
    }

    const entry: ActivityLogEntry = {
      id: `act-${crypto.randomUUID().slice(0, 8)}`,
      dateKey,
      processName,
      windowTitle,
      category,
      durationSeconds: dur,
      startedAt: nowIso,
      endedAt: nowIso,
      creditedToSkill: false,
    };
    this.activeBlock = entry;
    db.upsertActivityLog(entry);
    return entry;
  }

  getDailySummary(dateKey: string = getVnTodayKey()): DailyActivitySummary {
    const logs = db.getActivityLogsByDate(dateKey);

    let deepWorkSec = 0;
    let studySec = 0;
    let commSec = 0;
    let distractionSec = 0;
    let otherSec = 0;
    let idleSec = 0;
    let uncreditedFocusSec = 0;

    const appTotals = new Map<
      string,
      { processName: string; category: ActivityCategory; seconds: number }
    >();

    for (const log of logs) {
      const sec = Math.max(0, log.durationSeconds);
      switch (log.category) {
        case 'deep_work':
          deepWorkSec += sec;
          if (!log.creditedToSkill) uncreditedFocusSec += sec;
          break;
        case 'study_research':
          studySec += sec;
          if (!log.creditedToSkill) uncreditedFocusSec += sec;
          break;
        case 'communication':
          commSec += sec;
          break;
        case 'distraction':
          distractionSec += sec;
          break;
        case 'idle':
          idleSec += sec;
          break;
        default:
          otherSec += sec;
          break;
      }

      if (log.category !== 'idle') {
        const key = `${log.processName}::${log.category}`;
        const existing = appTotals.get(key);
        if (existing) {
          existing.seconds += sec;
        } else {
          appTotals.set(key, {
            processName: log.processName,
            category: log.category,
            seconds: sec,
          });
        }
      }
    }

    const activeSec = deepWorkSec + studySec + commSec + distractionSec + otherSec;
    const focusScore =
      activeSec <= 0
        ? 100
        : Math.max(
            0,
            Math.min(
              100,
              Math.round(
                ((deepWorkSec * 1.0 + studySec * 0.95 + commSec * 0.55 + otherSec * 0.4) /
                  activeSec) *
                  100
              )
            )
          );

    const topApps = Array.from(appTotals.values())
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 5)
      .map((a) => ({
        processName: a.processName,
        category: a.category,
        minutes: Math.max(1, Math.round(a.seconds / 60)),
      }));

    return {
      dateKey,
      deepWorkMinutes: Math.round(deepWorkSec / 60),
      studyMinutes: Math.round(studySec / 60),
      communicationMinutes: Math.round(commSec / 60),
      distractionMinutes: Math.round(distractionSec / 60),
      otherMinutes: Math.round(otherSec / 60),
      idleMinutes: Math.round(idleSec / 60),
      totalActiveMinutes: Math.round(activeSec / 60),
      focusScore,
      uncreditedFocusMinutes: Math.floor(uncreditedFocusSec / 60),
      currentApp:
        this.currentApp && dateKey === getVnTodayKey() && this.isRunning()
          ? this.currentApp
          : null,
      topApps,
      recentLogs: logs.slice(0, 20),
    };
  }
}

export const desktopTracker = new DesktopTrackerService();
