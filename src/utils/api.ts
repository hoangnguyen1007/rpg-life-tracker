import type {
  ActivityCategory,
  AIChatThread,
  AIConsultResponse,
  AIDayPlanResult,
  AISettings,
  AssistantOverviewPayload,
  AssistantSettings,
  AttributeKey,
  AuditLogEntry,
  BackupFileEntry,
  BackupStatusPayload,
  ChatContextScope,
  CloseoutMood,
  CoreHabit,
  DailyCloseoutRecord,
  DaySettlementReport,
  DeathReport,
  DisciplineSettings,
  EveningCloseoutPreviewPayload,
  HabitCompletionKind,
  HabitFrequency,
  HabitTimeOfDay,
  KnowledgeNote,
  KnowledgeSource,
  LanAccessPayload,
  LocalIntelligencePayload,
  LongTermAnalyticsPayload,
  PlayerProfile,
  Quest,
  QuestRank,
  QuestType,
  RaidChestId,
  RaidDifficultyTier,
  RecallRating,
  RejectionReason,
  StatMap,
  StorageInfoPayload,
  SystemResetMode,
  SystemStatePayload,
  TaskDraftAnalysis,
  TimetableBlock,
  WeeklyBlueprintBlockDraft,
  WeeklyBlueprintDraft,
  WeeklyRaidPayload,
  WeeklyReviewRecord,
} from '../types/system';

const LAN_TOKEN_STORAGE_KEY = 'rpg_lan_token';

export class LanAuthError extends Error {
  readonly code = 'LAN_AUTH_REQUIRED';
  readonly status = 401;

  constructor(message = 'Cần ghép nối LAN bằng mã PIN hoặc QR token để truy cập.') {
    super(message);
    this.name = 'LanAuthError';
  }
}

export function isLanAuthError(err: unknown): boolean {
  if (err instanceof LanAuthError) return true;
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; status?: unknown; message?: unknown };
  return (
    e.code === 'LAN_AUTH_REQUIRED' ||
    e.status === 401 ||
    (typeof e.message === 'string' && e.message.includes('LAN_AUTH_REQUIRED'))
  );
}

export function setLanToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token && token.trim()) {
      window.localStorage.setItem(LAN_TOKEN_STORAGE_KEY, token.trim());
    } else {
      window.localStorage.removeItem(LAN_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

function extractTokenFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    let foundToken: string | null = null;
    const url = new URL(window.location.href);

    const searchToken = url.searchParams.get('token');
    if (searchToken && searchToken.trim()) {
      foundToken = searchToken.trim();
      url.searchParams.delete('token');
    }

    if (url.hash && url.hash.includes('?')) {
      const [hashPath, hashQuery] = url.hash.split('?', 2);
      const hashParams = new URLSearchParams(hashQuery);
      const hashToken = hashParams.get('token');
      if (hashToken && hashToken.trim()) {
        foundToken = foundToken || hashToken.trim();
        hashParams.delete('token');
        const nextHashQuery = hashParams.toString();
        url.hash = nextHashQuery ? `${hashPath}?${nextHashQuery}` : hashPath;
      }
    }

    if (foundToken) {
      window.localStorage.setItem(LAN_TOKEN_STORAGE_KEY, foundToken);
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      return foundToken;
    }
  } catch {
    // Ignore malformed URL edge cases
  }
  return null;
}

export function isTauriDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'tauri:' ||
    window.location.hostname === 'tauri.localhost' ||
    Boolean((window as unknown as { __TAURI__?: unknown }).__TAURI__)
  );
}

export const API_BASE = isTauriDesktop() ? 'http://127.0.0.1:3001' : '';

export function resolveApiUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

export function getLanToken(): string | null {
  if (typeof window === 'undefined') return null;
  const urlToken = extractTokenFromLocation();
  if (urlToken) return urlToken;
  try {
    return window.localStorage.getItem(LAN_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

const SYNC_CHANNEL_NAME = 'rpg_system_sync_v1';
const SYNC_STORAGE_KEY = 'rpg_system_sync_ts';
const INSTANCE_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type SyncListener = (payload: { url: string; ts: number; sourceId: string }) => void;
const syncListeners = new Set<SyncListener>();
let broadcastChannel: BroadcastChannel | null = null;

function ensureSyncChannel(): void {
  if (typeof window === 'undefined') return;
  if (!broadcastChannel && typeof BroadcastChannel !== 'undefined') {
    try {
      broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      broadcastChannel.onmessage = (ev) => {
        const data = ev.data as { url?: string; ts?: number; sourceId?: string } | undefined;
        if (!data || data.sourceId === INSTANCE_ID) return;
        const payload = {
          url: data.url || '',
          ts: data.ts || Date.now(),
          sourceId: data.sourceId || 'remote',
        };
        syncListeners.forEach((fn) => fn(payload));
      };
    } catch {
      broadcastChannel = null;
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (ev) => {
    if (ev.key !== SYNC_STORAGE_KEY || !ev.newValue) return;
    try {
      const parsed = JSON.parse(ev.newValue) as { url?: string; ts?: number; sourceId?: string };
      if (!parsed || parsed.sourceId === INSTANCE_ID) return;
      const payload = {
        url: parsed.url || '',
        ts: parsed.ts || Date.now(),
        sourceId: parsed.sourceId || 'storage',
      };
      syncListeners.forEach((fn) => fn(payload));
    } catch {
      // Ignore malformed storage payload
    }
  });
}

export function notifySystemStateMutated(url = 'manual'): void {
  if (typeof window === 'undefined') return;
  const payload = { url, ts: Date.now(), sourceId: INSTANCE_ID };
  try {
    ensureSyncChannel();
    broadcastChannel?.postMessage(payload);
  } catch {
    // Ignore channel errors
  }
  try {
    window.localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage errors
  }
}

export function subscribeSystemStateSync(listener: SyncListener): () => void {
  ensureSyncChannel();
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

function shouldBroadcastMutation(url: string, method?: string): boolean {
  const m = (method || 'GET').toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return false;
  if (
    url.includes('/api/assistant/activity/ingest') ||
    url.includes('/api/assistant/activity/record-sample') ||
    url.includes('/api/hud/sync-state') ||
    url.includes('/api/quests/analyze-draft') ||
    url.includes('/api/settings/ai/test') ||
    url.includes('/api/settings/ai/models') ||
    url.includes('/api/timetable/import-text') && url.includes('previewOnly')
  ) {
    return false;
  }
  return true;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const lanToken = getLanToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(lanToken ? { 'x-system-lan-token': lanToken } : {}),
    ...((options?.headers as Record<string, string> | undefined) || {}),
  };

  const res = await fetch(resolveApiUrl(url), {
    ...options,
    headers,
  });
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      message?: string;
    };
    if (
      res.status === 401 &&
      (errBody.error === 'LAN_AUTH_REQUIRED' ||
        errBody.code === 'LAN_AUTH_REQUIRED' ||
        !errBody.error)
    ) {
      throw new LanAuthError(errBody.message || errBody.error || 'LAN_AUTH_REQUIRED');
    }
    throw new Error(errBody.error || errBody.message || `Request failed: ${res.status}`);
  }
  const data = (await res.json()) as T;
  if (shouldBroadcastMutation(url, options?.method)) {
    notifySystemStateMutated(url);
  }
  return data;
}

export const systemApi = {
  getState: () => request<SystemStatePayload>('/api/system/state'),

  updateProfile: (
    profile: Partial<PlayerProfile> & { hunterClass?: string; activeTitle?: string }
  ) =>
    request<SystemStatePayload>('/api/player/profile', {
      method: 'PUT',
      body: JSON.stringify(profile),
    }),

  getAIContextPreview: () =>
    request<{
      systemInstruction: string;
      contextDossier: string;
      statsSummary: Record<string, string | number>;
    }>('/api/ai/context-preview'),

  completeOnboarding: () =>
    request<SystemStatePayload>('/api/player/onboard', {
      method: 'POST',
      body: JSON.stringify({ isOnboarded: true }),
    }),

  checkin: (payload: {
    energyLevel?: number;
    fatigue?: number;
    activeTitle?: string;
    penaltyActive?: boolean;
  }) =>
    request<SystemStatePayload>('/api/player/checkin', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  reflect: (payload: { reflectionNote?: string; plannedRestMode?: boolean }) =>
    request<SystemStatePayload>('/api/player/reflect', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  microStartQuest: (questId: string) =>
    request<SystemStatePayload>(`/api/quests/${questId}/micro-start`, {
      method: 'POST',
    }),

  analyzeGoal: (rawInput: string) =>
    request<{ analysis: { goal: { title: string }; mode: string }; state: SystemStatePayload }>(
      '/api/goals/analyze',
      {
        method: 'POST',
        body: JSON.stringify({ rawInput }),
      }
    ),

  updateGoal: (id: string, patch: Partial<import('../types/system').Goal>) =>
    request<SystemStatePayload>(`/api/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  deleteGoal: (id: string) =>
    request<SystemStatePayload>(`/api/goals/${id}`, { method: 'DELETE' }),

  saveTimetableBlock: (block: Omit<TimetableBlock, 'id'> & { id?: string }) =>
    request<SystemStatePayload>('/api/timetable/blocks', {
      method: 'POST',
      body: JSON.stringify(block),
    }),

  saveTimetableBatch: (blocks: Array<Omit<TimetableBlock, 'id'>>, replaceExisting = false) =>
    request<SystemStatePayload>('/api/timetable/batch', {
      method: 'POST',
      body: JSON.stringify({ blocks, replaceExisting }),
    }),

  updateTimetableBlock: (id: string, updates: Partial<TimetableBlock>) =>
    request<SystemStatePayload>(`/api/timetable/blocks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  deleteTimetableBlock: (id: string) =>
    request<SystemStatePayload>(`/api/timetable/blocks/${id}`, { method: 'DELETE' }),

  clearTimetable: (dayOfWeek?: number) =>
    request<SystemStatePayload>(
      typeof dayOfWeek === 'number'
        ? `/api/timetable/clear?dayOfWeek=${dayOfWeek}`
        : '/api/timetable/clear',
      { method: 'DELETE' }
    ),

  previewImportTimetableText: (rawText: string) =>
    request<{ parsedBlocks: Array<Omit<TimetableBlock, 'id'>>; mode: string }>(
      '/api/timetable/import-text',
      {
        method: 'POST',
        body: JSON.stringify({ rawText, previewOnly: true }),
      }
    ),

  importTimetableText: (rawText: string, replaceAll = false) =>
    request<{ importedCount: number; mode: string; state: SystemStatePayload }>(
      '/api/timetable/import-text',
      {
        method: 'POST',
        body: JSON.stringify({ rawText, replaceAll }),
      }
    ),

  orchestrate: (payload: { focusNote?: string; dateKey?: string }) =>
    request<SystemStatePayload>('/api/orchestrate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getChatThreads: () => request<{ threads: AIChatThread[] }>('/api/ai/chats'),

  createChatThread: (payload: { title?: string; contextScope?: ChatContextScope }) =>
    request<{ thread: AIChatThread; threads: AIChatThread[] }>('/api/ai/chats', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateChatThread: (
    threadId: string,
    payload: { title?: string; contextScope?: ChatContextScope }
  ) =>
    request<{ thread: AIChatThread; threads: AIChatThread[] }>(`/api/ai/chats/${threadId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteChatThread: (threadId: string) =>
    request<{ threads: AIChatThread[] }>(`/api/ai/chats/${threadId}`, {
      method: 'DELETE',
    }),

  consultAI: (payload: {
    prompt: string;
    threadId?: string;
    contextScope?: ChatContextScope;
    history?: { role: 'user' | 'assistant'; content: string }[];
  }) =>
    request<AIConsultResponse>('/api/ai/consult', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createCustomQuest: (payload: {
    title: string;
    description?: string;
    type?: QuestType;
    rank?: QuestRank;
    durationMinutes?: number;
    scheduledSlot?: string;
    learningMethod?: string;
    primaryStat?: AttributeKey;
    secondaryStat?: AttributeKey;
    skillId?: string;
    goalId?: string;
    statRewards?: Partial<StatMap>;
    requiresProof?: boolean;
    ifThenTrigger?: string;
    scientificProtocol?: string;
    subtasks?: Array<{ id?: string; label: string; done?: boolean } | string>;
    syncToTimetable?: boolean;
    dateKey?: string;
  }) =>
    request<SystemStatePayload>('/api/quests/custom', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  analyzeTaskDraft: (payload: {
    title: string;
    description?: string;
    durationMinutes?: number;
    type?: QuestType;
  }) =>
    request<TaskDraftAnalysis>('/api/quests/analyze-draft', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  startQuest: (questId: string) =>
    request<SystemStatePayload>('/api/quests/' + questId + '/start', { method: 'POST' }),

  pauseQuest: (questId: string) =>
    request<SystemStatePayload>('/api/quests/' + questId + '/pause', { method: 'POST' }),

  reopenQuest: (questId: string) =>
    request<SystemStatePayload>('/api/quests/' + questId + '/reopen', { method: 'POST' }),

  aiPlanDaySchedule: (payload: {
    prompt: string;
    dayOfWeek?: number;
    addAsQuests?: boolean;
  }) =>
    request<AIDayPlanResult>('/api/timetable/ai-plan-day', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteQuest: (questId: string) =>
    request<SystemStatePayload>(`/api/quests/${questId}`, { method: 'DELETE' }),

  toggleSubtask: (questId: string, subtaskId: string) =>
    request<SystemStatePayload>(`/api/quests/${questId}/subtask`, {
      method: 'POST',
      body: JSON.stringify({ subtaskId }),
    }),

  updateQuest: (
    questId: string,
    updates: Partial<Quest> & {
      primaryStat?: AttributeKey;
      secondaryStat?: AttributeKey;
      syncToTimetable?: boolean;
    }
  ) =>
    request<SystemStatePayload>(`/api/quests/${questId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  completeQuest: (
    questId: string,
    payload: {
      proofNote?: string;
      dungeonCleared?: boolean;
      overtimeMinutes?: number;
      focusDistractions?: number;
      microGapCount?: number;
    }
  ) =>
    request<{
      leveledUp: boolean;
      rankPromoted: boolean;
      xpGain: number;
      masteryGain: number;
      goldGain: number;
      runestoneGain: number;
      spGain?: number;
      overtimeBonusXp?: number;
      raidOvertimeDamage?: number;
      actualDurationMinutes?: number;
      contributedSkillName?: string;
      skillPracticeXpGain?: number;
      state: SystemStatePayload;
    }>(`/api/quests/${questId}/complete`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  buyShopItem: (itemId: string) =>
    request<SystemStatePayload>('/api/shop/buy', {
      method: 'POST',
      body: JSON.stringify({ itemId }),
    }),

  createCustomReward: (payload: {
    name: string;
    description?: string;
    currency: 'gold' | 'runestones';
    price: number;
    iconKey?: string;
    rarity?: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';
  }) =>
    request<SystemStatePayload>('/api/shop/custom', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteCustomReward: (itemId: string) =>
    request<SystemStatePayload>(`/api/shop/custom/${itemId}`, { method: 'DELETE' }),

  useInventoryItem: (inventoryId: string) =>
    request<{ message: string; state: SystemStatePayload }>('/api/inventory/use', {
      method: 'POST',
      body: JSON.stringify({ inventoryId }),
    }),

  rejectQuest: (questId: string, reason: RejectionReason) =>
    request<SystemStatePayload>(`/api/quests/${questId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  failQuest: (questId: string) =>
    request<{
      hpDamage: number;
      died: boolean;
      deathReport?: DeathReport;
      state: SystemStatePayload;
    }>('/api/quests/' + questId + '/fail', { method: 'POST' }),

  settleDay: () =>
    request<{ settlement: DaySettlementReport; state: SystemStatePayload }>(
      '/api/system/settle-day',
      { method: 'POST' }
    ),

  acknowledgeDeath: () =>
    request<SystemStatePayload>('/api/player/ack-death', { method: 'POST' }),

  verifyMinionStage: (chapterId: string, stageId: string, proofText: string) =>
    request<{ stageCleared: boolean; state: SystemStatePayload }>(
      '/api/chapters/' + chapterId + '/stages/' + stageId + '/verify-minion',
      {
        method: 'POST',
        body: JSON.stringify({ proofText }),
      }
    ),

  verifyBossStage: (bossId: string, stageId: string, proofText: string) =>
    request<{
      bossDefeated: boolean;
      unlockedChapterBossTitle?: string;
      unlockedChapterTitle?: string;
      state: SystemStatePayload;
    }>(
      `/api/bosses/${bossId}/stages/${stageId}/verify`,
      {
        method: 'POST',
        body: JSON.stringify({ proofText }),
      }
    ),

  verifySkill: (skillId: string, proofNote: string) =>
    request<SystemStatePayload>(`/api/skills/${skillId}/verify`, {
      method: 'POST',
      body: JSON.stringify({ proofNote }),
    }),

  unlockSkill: (skillId: string) =>
    request<SystemStatePayload>(`/api/skills/${skillId}/unlock`, {
      method: 'POST',
    }),

  upgradeSkill: (skillId: string) =>
    request<SystemStatePayload>(`/api/skills/${skillId}/upgrade`, {
      method: 'POST',
    }),

  respecSkills: () =>
    request<SystemStatePayload>('/api/skills/respec', {
      method: 'POST',
    }),

  summonShadow: (shadowId: string) =>
    request<SystemStatePayload>(`/api/shadows/${shadowId}/summon`, {
      method: 'POST',
    }),

  saveAISettings: (settings: Partial<AISettings>) =>
    request<SystemStatePayload>('/api/settings/ai', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  testAIConnection: (settings: AISettings) =>
    request<{ ok: boolean; latencyMs: number; reply?: string; error?: string }>(
      '/api/settings/ai/test',
      {
        method: 'POST',
        body: JSON.stringify(settings),
      }
    ),

  fetchAIModels: (settings: AISettings) =>
    request<{ ok: boolean; models: string[]; error?: string }>('/api/settings/ai/models', {
      method: 'POST',
      body: JSON.stringify(settings),
    }),

  importSnapshot: (snapshot: unknown) =>
    request<SystemStatePayload>('/api/system/import', {
      method: 'POST',
      body: JSON.stringify(snapshot),
    }),

  getHealthFull: () =>
    request<{
      ok: boolean;
      uptimeSeconds: number;
      nodeVersion: string;
      integrityCheck: string;
      storageInfo: StorageInfoPayload;
      recentBackups: Array<{ filename: string; sizeBytes: number; createdAt: string }>;
    }>('/api/system/health-full'),

  getAuditLogs: () => request<{ logs: AuditLogEntry[] }>('/api/system/audit-logs'),

  createDiskBackup: () =>
    request<{
      ok: boolean;
      filename: string;
      filePath: string;
      sizeBytes: number;
      createdAt: string;
      backupCount: number;
      state: SystemStatePayload;
    }>('/api/system/backup', { method: 'POST' }),

  resetSystem: (mode: SystemResetMode = 'progress', options?: { clearChats?: boolean }) =>
    request<SystemStatePayload>('/api/system/reset', {
      method: 'POST',
      body: JSON.stringify({ mode, clearChats: options?.clearChats }),
    }),

  getAssistantOverview: () =>
    request<AssistantOverviewPayload>('/api/assistant/overview'),

  updateAssistantSettings: (patch: Partial<AssistantSettings>) =>
    request<AssistantOverviewPayload>('/api/assistant/settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  toggleDesktopTracker: (enabled: boolean) =>
    request<AssistantOverviewPayload>('/api/assistant/tracker/toggle', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),

  installWindowsStartup: (opts: { createDesktopShortcut?: boolean; launchTray?: boolean }) =>
    request<{ ok: boolean; message: string; overview: AssistantOverviewPayload }>(
      '/api/assistant/startup/install',
      {
        method: 'POST',
        body: JSON.stringify(opts),
      }
    ),

  uninstallWindowsStartup: (opts?: { removeDesktopShortcut?: boolean }) =>
    request<{ ok: boolean; message: string; overview: AssistantOverviewPayload }>(
      '/api/assistant/startup/uninstall',
      {
        method: 'POST',
        body: JSON.stringify(opts || {}),
      }
    ),

  launchSystemTray: () =>
    request<{ ok: boolean; message: string }>('/api/assistant/tray/launch', {
      method: 'POST',
    }),

  testAssistantNotification: () =>
    request<{ ok: boolean; message: string; overview: AssistantOverviewPayload }>(
      '/api/assistant/test-notification',
      { method: 'POST' }
    ),

  dismissAssistantNudge: (id: string) =>
    request<AssistantOverviewPayload>(`/api/assistant/nudge/${id}/dismiss`, {
      method: 'POST',
    }),

  syncActivityToSkill: () =>
    request<{
      ok: boolean;
      minutesCredited: number;
      skillXpAdded: number;
      bonusSp: number;
      message: string;
      overview: AssistantOverviewPayload;
      state: SystemStatePayload;
    }>('/api/assistant/activity/sync-skill', {
      method: 'POST',
    }),

  reclassifyActivityApp: (payload: {
    keyword: string;
    category: Exclude<ActivityCategory, 'idle'>;
    retroactive?: boolean;
  }) =>
    request<{ ok: boolean; updatedRows: number; message: string; overview: AssistantOverviewPayload }>(
      '/api/assistant/activity/reclassify',
      {
        method: 'POST',
        body: JSON.stringify({ ...payload, retroactive: payload.retroactive ?? true }),
      }
    ),

  convertActivityToQuest: (payload: {
    mode: 'complete_new' | 'credit_pending';
    title?: string;
    questId?: string;
    primaryStat?: AttributeKey;
  }) =>
    request<{
      ok: boolean;
      message: string;
      xpGain?: number;
      goldGain?: number;
      spGain?: number;
      overview: AssistantOverviewPayload;
      state: SystemStatePayload;
    }>('/api/assistant/activity/convert-to-quest', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getBackupStatus: () => request<BackupStatusPayload>('/api/backup/status'),

  runBackupNow: () =>
    request<{
      ok: boolean;
      backup: BackupFileEntry;
      status: BackupStatusPayload;
      message: string;
    }>('/api/backup/run', { method: 'POST' }),

  updateBackupConfig: (payload: {
    enabled?: boolean;
    backupDir?: string;
    retentionDays?: number;
  }) =>
    request<{ ok: boolean; status: BackupStatusPayload; message: string }>('/api/backup/config', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  restoreBackup: (filename: string) =>
    request<{
      ok: boolean;
      preRestoreBackup: string;
      message: string;
      state: SystemStatePayload;
    }>('/api/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ filename }),
    }),

  getLanInfo: () => request<LanAccessPayload>('/api/network/lan-info'),

  updateLanConfig: (payload: { enabled?: boolean; rotateToken?: boolean }) =>
    request<{ ok: boolean; lan: LanAccessPayload; message: string }>('/api/network/lan-config', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  pairWithLanPin: async (
    pin: string
  ): Promise<{ ok: boolean; token?: string; error?: string }> => {
    const res = await fetch(resolveApiUrl('/api/network/pair-pin'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      token?: string;
      error?: string;
      message?: string;
    };
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        error: data.error || data.message || `Ghép nối thất bại (${res.status})`,
      };
    }
    if (data.token) {
      setLanToken(data.token);
    }
    return { ok: true, token: data.token };
  },

  getLongTermReview: (range: '7d' | '30d' = '7d') =>
    request<{ analytics: LongTermAnalyticsPayload; reviews: WeeklyReviewRecord[] }>(
      `/api/analytics/review?range=${range}`
    ),

  generateWeeklyReview: () =>
    request<{
      ok: boolean;
      review: WeeklyReviewRecord;
      reviews: WeeklyReviewRecord[];
      analytics: LongTermAnalyticsPayload;
    }>('/api/analytics/weekly-review/generate', { method: 'POST' }),

  generateWeeklyBlueprint: (payload?: { focusNote?: string; maxBlocksPerDay?: number }) =>
    request<WeeklyBlueprintDraft>('/api/schedule/weekly-blueprint', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),

  applyWeeklyBlueprint: (blocks: WeeklyBlueprintBlockDraft[], syncTodayQuests = true) =>
    request<{
      ok: boolean;
      addedBlocksCount: number;
      addedQuestsCount: number;
      message: string;
      state: SystemStatePayload;
    }>('/api/schedule/weekly-blueprint/apply', {
      method: 'POST',
      body: JSON.stringify({ blocks, syncTodayQuests }),
    }),

  setAssistantDnd: (minutes: number) =>
    request<{
      ok: boolean;
      dndActive: boolean;
      dndUntil: string | null;
      overview: AssistantOverviewPayload;
    }>('/api/assistant/dnd', {
      method: 'POST',
      body: JSON.stringify({ minutes }),
    }),

  getHudStatus: () =>
    request<{
      nativeRunning: boolean;
      visible: boolean;
      exeAvailable: boolean;
    }>('/api/hud/status'),

  controlNativeHud: (action: 'show' | 'hide' | 'toggle' | 'dock') =>
    request<{
      ok: boolean;
      nativeRunning: boolean;
      visible: boolean;
      launched?: boolean;
      exeAvailable?: boolean;
    }>('/api/hud/control', {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),

  fetchWeeklyRaid: () => request<WeeklyRaidPayload>('/api/raid/current'),

  setWeeklyRaidDifficulty: (tier: RaidDifficultyTier) =>
    request<WeeklyRaidPayload>('/api/raid/difficulty', {
      method: 'POST',
      body: JSON.stringify({ tier }),
    }),

  claimWeeklyRaidChest: (chestId: RaidChestId) =>
    request<{
      ok: boolean;
      payload: WeeklyRaidPayload;
      rewardSummary: {
        gold: number;
        runestones: number;
        sp: number;
        lootItemName?: string;
        unlockedTitle?: string;
      };
    }>('/api/raid/claim-chest', {
      method: 'POST',
      body: JSON.stringify({ chestId }),
    }),

  regenerateWeeklyRaidAi: () =>
    request<{
      ok: boolean;
      payload: WeeklyRaidPayload;
      usedAi: boolean;
      note?: string;
    }>('/api/raid/regenerate-ai', { method: 'POST' }),

  quickStartFocus: (payload: {
    title?: string;
    durationMinutes: number;
    primaryStat?: AttributeKey;
  }) =>
    request<{ ok: boolean; quest: Quest; state: SystemStatePayload }>('/api/quests/quick-focus', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  fetchCloseoutPreview: () =>
    request<EveningCloseoutPreviewPayload>('/api/system/closeout/preview'),

  fetchCloseoutHistory: (limit = 30) =>
    request<{ records: DailyCloseoutRecord[] }>(`/api/system/closeout/history?limit=${limit}`),

  submitDailyCloseout: (payload: {
    mood: CloseoutMood;
    bottleneckTags?: string[];
    reflectionNote?: string;
    carryOverQuestIds?: string[];
  }) =>
    request<{
      alreadyClosed: boolean;
      closeout: DailyCloseoutRecord;
      settlement: DaySettlementReport | null;
      carriedOverQuests: Quest[];
      state: SystemStatePayload;
      preview: EveningCloseoutPreviewPayload;
    }>('/api/system/closeout', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Core Habits & Rituals
  createHabit: (payload: {
    title: string;
    timeOfDay: HabitTimeOfDay;
    frequency: HabitFrequency;
    customDays?: number[];
    targetPerWeek?: number;
    standardSpec: string;
    minimumSpec: string;
    durationMinutes?: number;
    primaryStat?: AttributeKey;
    goalId?: string;
    skillId?: string;
  }) =>
    request<{ habit: CoreHabit; state: SystemStatePayload }>('/api/habits', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  seedStarterHabits: () =>
    request<{ addedCount: number; state: SystemStatePayload }>('/api/habits/seed-starters', {
      method: 'POST',
    }),

  updateHabit: (id: string, patch: Partial<CoreHabit>) =>
    request<{ habit: CoreHabit; state: SystemStatePayload }>(`/api/habits/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  deleteHabit: (id: string) =>
    request<SystemStatePayload>(`/api/habits/${id}`, { method: 'DELETE' }),

  checkinHabit: (
    id: string,
    payload: { kind: HabitCompletionKind | 'undo'; dateKey?: string; note?: string }
  ) =>
    request<{
      xpGain: number;
      goldGain: number;
      leveledUp?: boolean;
      undone?: boolean;
      kind?: HabitCompletionKind;
      state: SystemStatePayload;
    }>(`/api/habits/${id}/checkin`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Discipline Personalization
  updateDisciplineSettings: (patch: Partial<DisciplineSettings>) =>
    request<{ settings: DisciplineSettings; state: SystemStatePayload }>('/api/discipline/settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  // Knowledge Vault & Spaced Recall
  createKnowledgeNote: (payload: {
    title: string;
    content: string;
    recallPrompt?: string;
    source?: KnowledgeSource;
    goalId?: string;
    skillId?: string;
    primaryStat?: AttributeKey;
    tags?: string[];
    recallEnabled?: boolean;
  }) =>
    request<{ note: KnowledgeNote; state: SystemStatePayload }>('/api/knowledge', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateKnowledgeNote: (id: string, patch: Partial<KnowledgeNote>) =>
    request<{ note: KnowledgeNote; state: SystemStatePayload }>(`/api/knowledge/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  deleteKnowledgeNote: (id: string) =>
    request<SystemStatePayload>(`/api/knowledge/${id}`, { method: 'DELETE' }),

  reviewKnowledgeNote: (id: string, rating: RecallRating) =>
    request<{
      note: KnowledgeNote;
      nextIntervalDays: number;
      xpGain: number;
      leveledUp: boolean;
      state: SystemStatePayload;
    }>(`/api/knowledge/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ rating }),
    }),

  getLocalIntelligence: () => request<LocalIntelligencePayload>('/api/intelligence/local'),
};

export const quickStartFocus = (payload: {
  title?: string;
  durationMinutes: number;
  primaryStat?: AttributeKey;
}): Promise<{ ok: boolean; quest: Quest; state: SystemStatePayload }> =>
  systemApi.quickStartFocus(payload);

export const fetchCloseoutPreview = (): Promise<EveningCloseoutPreviewPayload> =>
  systemApi.fetchCloseoutPreview();

export const fetchCloseoutHistory = (limit = 30): Promise<{ records: DailyCloseoutRecord[] }> =>
  systemApi.fetchCloseoutHistory(limit);

export const submitDailyCloseout = (payload: {
  mood: CloseoutMood;
  bottleneckTags?: string[];
  reflectionNote?: string;
  carryOverQuestIds?: string[];
}): Promise<{
  alreadyClosed: boolean;
  closeout: DailyCloseoutRecord;
  settlement: DaySettlementReport | null;
  carriedOverQuests: Quest[];
  state: SystemStatePayload;
  preview: EveningCloseoutPreviewPayload;
}> => systemApi.submitDailyCloseout(payload);

export const fetchWeeklyRaid = (): Promise<WeeklyRaidPayload> => systemApi.fetchWeeklyRaid();

export const setWeeklyRaidDifficulty = (tier: RaidDifficultyTier): Promise<WeeklyRaidPayload> =>
  systemApi.setWeeklyRaidDifficulty(tier);

export const claimWeeklyRaidChest = (
  chestId: RaidChestId
): Promise<{
  ok: boolean;
  payload: WeeklyRaidPayload;
  rewardSummary: {
    gold: number;
    runestones: number;
    sp: number;
    lootItemName?: string;
    unlockedTitle?: string;
  };
}> => systemApi.claimWeeklyRaidChest(chestId);

export const regenerateWeeklyRaidAi = (): Promise<{
  ok: boolean;
  payload: WeeklyRaidPayload;
  usedAi: boolean;
  note?: string;
}> => systemApi.regenerateWeeklyRaidAi();
