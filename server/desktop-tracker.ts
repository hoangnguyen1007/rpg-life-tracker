import crypto from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { db } from './db.ts';
import { inferSkillIdForTask } from './scheduler.ts';
import { VN_TIMEZONE, getVnTodayKey } from './time-vn.ts';
import type {
  ActivityCategory,
  ActivityLogEntry,
  ActivityRule,
  AttributeKey,
  DailyActivitySummary,
} from './types.ts';

const DEEP_WORK_PROCESSES = new Set([
  'code',
  'cursor',
  'windsurf',
  'antigravity',
  'antigravity ide',
  'idea64',
  'pycharm',
  'pycharm64',
  'webstorm',
  'webstorm64',
  'clion',
  'clion64',
  'rider',
  'rider64',
  'goland',
  'goland64',
  'phpstorm',
  'datagrip',
  'studio64',
  'devenv',
  'sublime_text',
  'notepad++',
  'zed',
  'eclipse',
  'netbeans',
  'devcpp',
  'codeblocks',
  'nvim',
  'neovim',
  'windowsterminal',
  'wt',
  'powershell',
  'pwsh',
  'cmd',
  'wsl',
  'ubuntu',
  'docker',
  'postman',
  'insomnia',
  'bruno',
  'dbeaver',
  'ssms',
  'pgadmin',
  'mongodb',
  'mongodbcompass',
  'tableplus',
  'wireshark',
  'packettracer',
  'figma',
  'blender',
  'unity',
  'unrealeditor',
  'photoshop',
  'illustrator',
  'premiere',
  'afterfx',
  'capcut',
  'davinci',
  'resolve',
  'autocad',
  'solidworks',
  'matlab',
  'rstudio',
  'winword',
  'excel',
  'powerpnt',
  'onenote',
  'obsidian',
  'notion',
  'logseq',
  'anytype',
  'typora',
]);

const DEEP_WORK_KEYWORDS = [
  // Unambiguous IDE / tool titles
  'visual studio code',
  'vscode',
  'cursor',
  'windsurf',
  'antigravity',
  'jetbrains',
  'android studio',
  'visual studio',
  'windows terminal',
  'figma',
  'obsidian',
  'notion',
  'postman',
  'miro.com',
  'canva',
  'overleaf',
  // Web Dev & Productivity
  'github',
  'gitlab',
  'bitbucket',
  'stackoverflow',
  'leetcode',
  'codeforces',
  'hackerrank',
  'vnoi',
  'kaggle',
  'huggingface',
  'colab',
  'jupyter',
  'vercel',
  'supabase',
  'firebase',
  'aws.amazon',
  'console.cloud.google',
  'developer.mozilla',
  'w3schools',
  'geeksforgeeks',
  'localhost',
  '127.0.0.1',
  'linear',
  'jira',
  'trello',
  'clickup',
  'docs.google',
  'sheets.google',
  'slides.google',
  'drive.google',
  'the system',
  'rpg life tracker',
];

const STUDY_PROCESSES = new Set([
  'anki',
  'acrobat',
  'acrord32',
  'foxit',
  'foxitpdfreader',
  'sumatrapdf',
  'zotero',
  'mendeley',
  'calibre',
  'kindle',
]);

const STUDY_KEYWORDS = [
  'anki',
  'zotero',
  'mendeley',
  '.pdf',
  'coursera',
  'udemy',
  'edx.org',
  'khanacademy',
  'freecodecamp',
  'brilliant.org',
  'duolingo',
  'quizlet',
  'elsa speak',
  'ielts',
  'toeic',
  'cambridge',
  'oxford',
  'dictionary',
  'grammarly',
  'deepl',
  'translate.google',
  'arxiv',
  'scholar.google',
  'researchgate',
  'ieee',
  'wikipedia',
  'courses.uit',
  'daa.uit',
  'moodle',
  'canvas',
  'classroom.google',
  'studocu',
  'fullstack.edu.vn',
  'f8 -',
  'học lập trình',
  '28tech',
  'viblo',
  'chatgpt',
  'openai',
  'claude',
  'anthropic',
  'gemini',
  'aistudio',
  'perplexity',
  'notebooklm',
  'deepseek',
  'grok.com',
];

const YOUTUBE_STUDY_TITLE_RE =
  /(tutorial|course|lecture|bài giảng|học|lập trình|algorithm|english|ielts|toeic|math|toán|physics|cs50|roadmap|programming|coding|system design|documentation|giải đề|ôn thi|hướng dẫn|seminar|workshop)/i;

const COMMUNICATION_KEYWORDS = [
  'slack',
  'teams',
  'ms-teams',
  'zoom',
  'outlook',
  'gmail',
  'mail.google',
  'zalo',
  'messenger',
  'telegram',
  'discord',
  'meet.google',
  'whatsapp',
];

const DISTRACTION_KEYWORDS = [
  'tiktok',
  'facebook',
  'instagram',
  'threads',
  'x.com',
  'twitter',
  'reels',
  'shorts',
  'reddit',
  'netflix',
  'twitch',
  'bilibili',
  'anime',
  'manga',
  'steam',
  'epicgames',
  'riot',
  'league',
  'valorant',
  'genshin',
  'honkai',
  'minecraft',
  'roblox',
  'shopee',
  'lazada',
  'tiki',
  'youtube',
];

const PRIVATE_TITLE_RE =
  /(inprivate|incognito|ẩn danh|1password|bitwarden|keepass|lastpass|internet banking|vietcombank|techcombank|mbbank|acb online)/i;

const SYSTEM_IDLE_PROCESS_RE =
  /^(idle|lockapp|shellexperiencehost|searchhost|startmenuexperiencehost|dwm|taskmgr)$/i;

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

  const procRaw = (processName || '').trim();
  const proc = procRaw.toLowerCase();
  const procBase = proc.replace(/\.exe$/i, '');
  const title = (windowTitle || '').toLowerCase();

  // Treat empty/system shell/lockscreen/Program Manager frames as idle so they never inflate 'other'
  if (
    !procBase ||
    SYSTEM_IDLE_PROCESS_RE.test(procBase) ||
    (procBase === 'explorer' && (!title || title === 'program manager'))
  ) {
    return 'idle';
  }

  const combined = `${procBase} ${title}`;

  // Custom user rules ALWAYS take top priority
  for (const rule of customRules) {
    const kw = (rule.keyword || '').trim().toLowerCase();
    if (!kw) continue;
    if (proc.includes(kw) || title.includes(kw)) {
      return rule.category;
    }
  }

  // Educational YouTube or VLC lectures take precedence over distraction/other
  if ((combined.includes('youtube') || procBase === 'vlc') && YOUTUBE_STUDY_TITLE_RE.test(title)) {
    return 'study_research';
  }

  if (DEEP_WORK_PROCESSES.has(procBase) || DEEP_WORK_KEYWORDS.some((kw) => combined.includes(kw))) {
    return 'deep_work';
  }
  if (STUDY_PROCESSES.has(procBase) || STUDY_KEYWORDS.some((kw) => combined.includes(kw))) {
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

export const WIN_TRACKER_CSHARP = `
using System;
using System.Text;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

public struct LASTINPUTINFO {
  public uint cbSize;
  public uint dwTime;
}

public class WinSampleResult {
  public string ProcessName { get; set; }
  public string WindowTitle { get; set; }
  public int IdleSeconds { get; set; }
}

public static class WinTrackerNative {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll")]
  public static extern int GetWindowTextLength(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  [DllImport("user32.dll")]
  public static extern bool EnumChildWindows(IntPtr hWndParent, EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

  [DllImport("user32.dll")]
  public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

  [DllImport("user32.dll")]
  public static extern bool SetThreadDesktop(IntPtr hDesktop);

  [DllImport("user32.dll")]
  public static extern bool CloseDesktop(IntPtr hDesktop);

  [DllImport("kernel32.dll")]
  public static extern ulong GetTickCount64();

  private static string ReadWindowTitle(IntPtr hWnd) {
    int len = GetWindowTextLength(hWnd);
    if (len <= 0) return "";
    StringBuilder sb = new StringBuilder(len + 1);
    GetWindowText(hWnd, sb, sb.Capacity);
    return sb.ToString();
  }

  private static string ResolveProcessName(IntPtr hwnd, uint pid) {
    if (pid == 0) return "Idle";
    try {
      string name = Process.GetProcessById((int)pid).ProcessName;
      if (string.Equals(name, "ApplicationFrameHost", StringComparison.OrdinalIgnoreCase)) {
        uint resolvedChildPid = 0;
        EnumChildWindows(hwnd, delegate(IntPtr childHwnd, IntPtr lParam) {
          uint cpid = 0;
          GetWindowThreadProcessId(childHwnd, out cpid);
          if (cpid != 0 && cpid != pid) {
            resolvedChildPid = cpid;
            return false;
          }
          return true;
        }, IntPtr.Zero);
        if (resolvedChildPid != 0) {
          try {
            string inner = Process.GetProcessById((int)resolvedChildPid).ProcessName;
            if (!string.IsNullOrEmpty(inner)) return inner;
          } catch {}
        }
      }
      return string.IsNullOrEmpty(name) ? "Idle" : name;
    } catch {
      return "Idle";
    }
  }

  public static int GetIdleSeconds() {
    LASTINPUTINFO lii = new LASTINPUTINFO();
    lii.cbSize = (uint)Marshal.SizeOf(typeof(LASTINPUTINFO));
    if (!GetLastInputInfo(ref lii)) return 0;
    ulong tick64 = GetTickCount64();
    uint tick32 = unchecked((uint)(tick64 & 0xFFFFFFFFUL));
    uint diffMs = unchecked(tick32 - lii.dwTime);
    return (int)(diffMs / 1000U);
  }

  private static WinSampleResult SampleOnCurrentThread() {
    WinSampleResult res = new WinSampleResult();
    res.ProcessName = "Idle";
    res.WindowTitle = "";
    res.IdleSeconds = GetIdleSeconds();

    IntPtr hwnd = GetForegroundWindow();
    if (hwnd == IntPtr.Zero) {
      return res;
    }

    uint pid = 0;
    GetWindowThreadProcessId(hwnd, out pid);
    res.ProcessName = ResolveProcessName(hwnd, pid);
    res.WindowTitle = ReadWindowTitle(hwnd);
    return res;
  }

  public static WinSampleResult Sample() {
    WinSampleResult result = null;
    Thread t = new Thread(() => {
      IntPtr hDesk = IntPtr.Zero;
      try {
        // Bind clean worker thread to the active interactive input desktop (works even if parent shell is on an isolated WinSta0 desktop)
        hDesk = OpenInputDesktop(0, false, 0x0001 | 0x0040 | 0x0002);
        if (hDesk != IntPtr.Zero) {
          SetThreadDesktop(hDesk);
        }
        result = SampleOnCurrentThread();
      } catch {
        result = null;
      } finally {
        if (hDesk != IntPtr.Zero) {
          CloseDesktop(hDesk);
        }
      }
    });
    t.IsBackground = true;
    t.Start();
    t.Join(2500);
    return result ?? SampleOnCurrentThread();
  }
}
`;

function buildPsTrackerScript(pollIntervalSeconds: number): string {
  const sec = Math.max(3, Math.min(60, Math.round(pollIntervalSeconds || 10)));
  const ps = `
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -TypeDefinition @"
${WIN_TRACKER_CSHARP}
"@

while ($true) {
  try {
    $s = [WinTrackerNative]::Sample()
    $payload = @{
      processName = $s.ProcessName
      windowTitle = $s.WindowTitle
      idleSeconds = [int]$s.IdleSeconds
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

const vnHourFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: VN_TIMEZONE,
  hour: '2-digit',
  hourCycle: 'h23',
});

function getVnHourFromIso(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 12;
  const h = Number(vnHourFormatter.format(d));
  return h === 24 ? 0 : h;
}

class DesktopTrackerService {
  private worker: ChildProcessWithoutNullStreams | null = null;
  private shouldRun = false;
  private restartTimer: NodeJS.Timeout | null = null;
  private externalFallbackTimer: NodeJS.Timeout | null = null;
  private stdoutBuffer = '';

  private activeBlock: ActivityLogEntry | null = null;
  private currentApp: DailyActivitySummary['currentApp'] = null;
  private continuousDeepWorkSeconds = 0;
  private continuousDistractionSeconds = 0;
  private activeDistractionStreakSec = 0;
  private lastPollAtMs: number | null = null;
  private lastExternalIngestAt = 0;

  isExternalTrackerActive(): boolean {
    return this.lastExternalIngestAt > 0 && Date.now() - this.lastExternalIngestAt < 60_000;
  }

  isRunning(): boolean {
    return Boolean(
      this.isExternalTrackerActive() || (this.shouldRun && this.worker && !this.worker.killed)
    );
  }

  getContinuousDeepWorkMinutes(): number {
    return this.continuousDeepWorkSeconds / 60;
  }

  getContinuousDistractionMinutes(): number {
    return this.continuousDistractionSeconds / 60;
  }

  getActiveDistractionStreakSeconds(): number {
    if (this.activeDistractionStreakSec <= 0) return 0;
    const dateKey = getVnTodayKey();
    const hasRunningQuest = db
      .getQuests(dateKey)
      .some((q) => q.status === 'pending' && Boolean(q.startedAt) && !q.isPaused);
    if (!hasRunningQuest) {
      this.activeDistractionStreakSec = 0;
      return 0;
    }
    return this.activeDistractionStreakSec;
  }

  getCurrentApp(): DailyActivitySummary['currentApp'] {
    return this.currentApp;
  }

  private stopPowerShellWorkerOnly(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.worker && !this.worker.killed) {
      const child = this.worker;
      this.worker = null;
      try {
        child.kill();
      } catch {
        // Ignore kill error
      }
    } else {
      this.worker = null;
    }
  }

  private scheduleExternalFallbackCheck(): void {
    if (this.externalFallbackTimer) {
      clearTimeout(this.externalFallbackTimer);
      this.externalFallbackTimer = null;
    }
    if (!this.shouldRun || process.platform !== 'win32' || process.env.THE_SYSTEM_DB_PATH) {
      return;
    }
    this.externalFallbackTimer = setTimeout(() => {
      this.externalFallbackTimer = null;
      if (
        this.shouldRun &&
        !this.isExternalTrackerActive() &&
        (!this.worker || this.worker.killed)
      ) {
        const latest = db.getAssistantSettings();
        if (latest.trackerEnabled) {
          this.spawnWorker(latest.pollIntervalSeconds);
        }
      }
    }, 62_000);
    this.externalFallbackTimer.unref?.();
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
    if (this.isExternalTrackerActive()) {
      this.stopPowerShellWorkerOnly();
      this.scheduleExternalFallbackCheck();
      return;
    }
    if (this.worker && !this.worker.killed) return;
    this.spawnWorker(settings.pollIntervalSeconds);
  }

  stop(): void {
    this.shouldRun = false;
    if (this.externalFallbackTimer) {
      clearTimeout(this.externalFallbackTimer);
      this.externalFallbackTimer = null;
    }
    this.stopPowerShellWorkerOnly();
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
    if (this.isExternalTrackerActive()) {
      this.scheduleExternalFallbackCheck();
      return;
    }

    const encoded = buildPsTrackerScript(pollIntervalSeconds);
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true }
    );

    this.worker = child;
    this.stdoutBuffer = '';

    child.stdout.on('data', (chunk: Buffer) => {
      if (this.isExternalTrackerActive()) {
        this.stopPowerShellWorkerOnly();
        this.scheduleExternalFallbackCheck();
        return;
      }
      this.stdoutBuffer += chunk.toString('utf8');
      const lines = this.stdoutBuffer.split(/\r?\n/);
      this.stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) {
        if (this.isExternalTrackerActive()) {
          this.stopPowerShellWorkerOnly();
          this.scheduleExternalFallbackCheck();
          return;
        }
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
            processName: parsed.processName || 'Idle',
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
        if (this.isExternalTrackerActive()) {
          this.scheduleExternalFallbackCheck();
          return;
        }
        this.restartTimer = setTimeout(() => {
          this.restartTimer = null;
          if (this.shouldRun && !this.isExternalTrackerActive()) {
            const latest = db.getAssistantSettings();
            if (latest.trackerEnabled) {
              this.spawnWorker(latest.pollIntervalSeconds);
            }
          }
        }, 5000);
      }
    });
  }

  ingestExternalSample(sample: {
    processName: string;
    windowTitle?: string;
    idleSeconds?: number;
    durationSeconds?: number;
    source?: string;
  }): ActivityCategory {
    if (sample.source === 'tauri-rust') {
      this.lastExternalIngestAt = Date.now();
      this.stopPowerShellWorkerOnly();
      this.scheduleExternalFallbackCheck();
    }
    const entry = this.recordSample({
      processName: sample.processName || 'Idle',
      windowTitle: sample.windowTitle || '',
      idleSeconds: sample.idleSeconds,
      durationSeconds: sample.durationSeconds,
    });
    return entry.category;
  }

  private syncRunningQuestWithPoll(
    dateKey: string,
    category: ActivityCategory,
    dur: number,
    idleSeconds: number,
    nowMs: number,
    idleThresholdSeconds: number,
    autoPauseQuestOnIdle: boolean
  ): void {
    const runningQuest = db
      .getQuests(dateKey)
      .find((q) => q.status === 'pending' && Boolean(q.startedAt) && !q.isPaused);
    if (!runningQuest) {
      this.activeDistractionStreakSec = 0;
      return;
    }

    if (category === 'distraction') {
      this.activeDistractionStreakSec += dur;
    } else {
      this.activeDistractionStreakSec = 0;
    }

    let mutated = false;
    if (category === 'deep_work' || category === 'study_research') {
      runningQuest.verifiedFocusSeconds = (runningQuest.verifiedFocusSeconds || 0) + dur;
      mutated = true;
    } else if (category === 'distraction') {
      runningQuest.distractionSeconds = (runningQuest.distractionSeconds || 0) + dur;
      mutated = true;
    }

    const vf = runningQuest.verifiedFocusSeconds || 0;
    const ds = runningQuest.distractionSeconds || 0;
    if (vf + ds > 0) {
      runningQuest.focusIntegrityPct = Math.round((vf / (vf + ds)) * 100);
      mutated = true;
    }

    if (autoPauseQuestOnIdle && category === 'idle' && idleSeconds >= idleThresholdSeconds) {
      const elapsedSec = runningQuest.startedAt
        ? Math.max(0, Math.round((nowMs - Date.parse(runningQuest.startedAt)) / 1000))
        : 0;
      const activeElapsed = Math.max(0, elapsedSec - Math.min(elapsedSec, idleSeconds));
      runningQuest.pausedAccumulatedSeconds =
        (runningQuest.pausedAccumulatedSeconds || 0) + activeElapsed;
      runningQuest.startedAt = undefined;
      runningQuest.isPaused = true;
      this.activeDistractionStreakSec = 0;
      mutated = true;

      db.addAssistantNudge({
        id: `ndg-${crypto.randomUUID().slice(0, 8)}`,
        dateKey,
        kind: 'system',
        title: 'Đã tự tạm dừng phiên tập trung',
        message: `Đã tự tạm dừng phiên "${runningQuest.title}" vì không thao tác PC (${Math.max(1, Math.round(idleSeconds / 60))} phút).`,
        createdAt: new Date(nowMs).toISOString(),
        dismissed: false,
        toastSent: false,
      });
    }

    if (mutated) {
      db.saveQuest(runningQuest);
    }
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
    const idleThreshold = settings.idleThresholdSeconds || 180;
    const idleSec = input.isIdle
      ? idleThreshold + 10
      : Math.max(0, Number(input.idleSeconds) || 0);

    const processName = (input.processName || 'Unknown').trim() || 'Unknown';
    const rawTitle = (input.windowTitle || '').trim();
    const category = classifyActivity(
      processName,
      rawTitle,
      settings.customRules,
      idleSec,
      idleThreshold
    );
    const windowTitle = scrubWindowTitle(processName, rawTitle);

    const nowMs = Date.now();
    const sleepGapMs = Math.max(60_000, (settings.pollIntervalSeconds || 10) * 3000);
    if (this.lastPollAtMs !== null && nowMs - this.lastPollAtMs > sleepGapMs) {
      // PC slept or hibernated: reset active coalescing block & streaks so sleep time is never credited
      this.activeBlock = null;
      this.continuousDeepWorkSeconds = 0;
      this.continuousDistractionSeconds = 0;
      this.activeDistractionStreakSec = 0;
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

    // Live Quest <-> PC Tracker attribution & auto-pause on idle
    this.syncRunningQuestWithPoll(
      dateKey,
      category,
      dur,
      idleSec,
      nowMs,
      idleThreshold,
      settings.autoPauseQuestOnIdle !== false
    );

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
    const settings = db.getAssistantSettings();
    const logs = db.getActivityLogsByDate(dateKey);

    let deepWorkSec = 0;
    let studySec = 0;
    let commSec = 0;
    let distractionSec = 0;
    let otherSec = 0;
    let idleSec = 0;
    let uncreditedFocusSec = 0;
    let uncreditedDeepSec = 0;
    let uncreditedStudySec = 0;

    const appTotals = new Map<
      string,
      { processName: string; category: ActivityCategory; seconds: number }
    >();
    const uncreditedAppTotals = new Map<string, number>();

    const hourlyBuckets = new Map<
      number,
      {
        deepSec: number;
        studySec: number;
        commSec: number;
        distractionSec: number;
        otherSec: number;
      }
    >();
    for (let h = 6; h <= 23; h++) {
      hourlyBuckets.set(h, { deepSec: 0, studySec: 0, commSec: 0, distractionSec: 0, otherSec: 0 });
    }
    const focusSecByHour = new Map<number, number>();

    for (const log of logs) {
      const sec = Math.max(0, log.durationSeconds);
      const vnHour = getVnHourFromIso(log.startedAt);
      const bucket = hourlyBuckets.get(vnHour);

      switch (log.category) {
        case 'deep_work':
          deepWorkSec += sec;
          if (bucket) bucket.deepSec += sec;
          focusSecByHour.set(vnHour, (focusSecByHour.get(vnHour) || 0) + sec);
          if (!log.creditedToSkill) {
            uncreditedFocusSec += sec;
            uncreditedDeepSec += sec;
            uncreditedAppTotals.set(
              log.processName,
              (uncreditedAppTotals.get(log.processName) || 0) + sec
            );
          }
          break;
        case 'study_research':
          studySec += sec;
          if (bucket) bucket.studySec += sec;
          focusSecByHour.set(vnHour, (focusSecByHour.get(vnHour) || 0) + sec);
          if (!log.creditedToSkill) {
            uncreditedFocusSec += sec;
            uncreditedStudySec += sec;
            uncreditedAppTotals.set(
              log.processName,
              (uncreditedAppTotals.get(log.processName) || 0) + sec
            );
          }
          break;
        case 'communication':
          commSec += sec;
          if (bucket) bucket.commSec += sec;
          break;
        case 'distraction':
          distractionSec += sec;
          if (bucket) bucket.distractionSec += sec;
          break;
        case 'idle':
          idleSec += sec;
          break;
        default:
          otherSec += sec;
          if (bucket) bucket.otherSec += sec;
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

    const hourlyBreakdown: NonNullable<DailyActivitySummary['hourlyBreakdown']> = [];

    for (let h = 6; h <= 23; h++) {
      const b = hourlyBuckets.get(h)!;
      const deepWorkMins = Math.round(b.deepSec / 60);
      const studyMins = Math.round(b.studySec / 60);
      const commMins = Math.round(b.commSec / 60);
      const distractionMins = Math.round(b.distractionSec / 60);
      const otherMins = Math.round(b.otherSec / 60);

      const candidates: Array<{ cat: ActivityCategory; mins: number }> = (
        [
          { cat: 'deep_work', mins: deepWorkMins },
          { cat: 'study_research', mins: studyMins },
          { cat: 'communication', mins: commMins },
          { cat: 'distraction', mins: distractionMins },
          { cat: 'other', mins: otherMins },
        ] satisfies Array<{ cat: ActivityCategory; mins: number }>
      ).sort((a, c) => c.mins - a.mins);

      const dominantCategory: ActivityCategory | 'none' =
        candidates[0] && candidates[0].mins > 0 ? candidates[0].cat : 'none';

      hourlyBreakdown.push({
        hour: h,
        deepWorkMins,
        studyMins,
        commMins,
        distractionMins,
        otherMins,
        dominantCategory,
      });
    }

    let bestHour: number | null = null;
    let bestHourFocusMins = 9; // Require >= 10m to qualify as Peak Focus Hour across all 0..23 hours
    for (let h = 0; h <= 23; h++) {
      const focusSum = Math.round((focusSecByHour.get(h) || 0) / 60);
      if (focusSum > bestHourFocusMins) {
        bestHourFocusMins = focusSum;
        bestHour = h;
      }
    }

    const peakFocusHour =
      bestHour !== null
        ? `${String(bestHour).padStart(2, '0')}:00–${String(bestHour + 1).padStart(2, '0')}:00`
        : null;

    const uncreditedFocusMinutes = Math.floor(uncreditedFocusSec / 60);
    let suggestedFocusSession: DailyActivitySummary['suggestedFocusSession'] = null;
    if (uncreditedFocusMinutes >= 15) {
      const topUncreditedApp =
        Array.from(uncreditedAppTotals.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'PC Focus';
      const dominantCategory: 'deep_work' | 'study_research' =
        uncreditedStudySec > uncreditedDeepSec ? 'study_research' : 'deep_work';
      const primaryStat: AttributeKey = dominantCategory === 'study_research' ? 'PER' : 'INT';
      const skills = db.getSkills();
      const inferredSkillId =
        dominantCategory === 'study_research'
          ? 'sk-knw-1'
          : inferSkillIdForTask(topUncreditedApp, 'deep work', primaryStat, skills) || 'sk-int-1';
      const skillName = skills.find((s) => s.id === inferredSkillId)?.name;

      suggestedFocusSession = {
        minutes: uncreditedFocusMinutes,
        topApp: topUncreditedApp,
        dominantCategory,
        suggestedTitle:
          dominantCategory === 'study_research'
            ? `Phiên Nghiên cứu & Học sâu (${topUncreditedApp} · ${uncreditedFocusMinutes}p)`
            : `Phiên Deep Work trên ${topUncreditedApp} (${uncreditedFocusMinutes}p)`,
        primaryStat,
        skillName,
      };
    }

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
      uncreditedFocusMinutes,
      currentApp:
        this.currentApp && dateKey === getVnTodayKey() && this.isRunning()
          ? this.currentApp
          : null,
      topApps,
      recentLogs: logs.slice(0, 20),
      hourlyBreakdown,
      peakFocusHour,
      distractionBudgetMinutes: settings.distractionBudgetMinutes ?? 45,
      suggestedFocusSession,
    };
  }
}

export const desktopTracker = new DesktopTrackerService();
