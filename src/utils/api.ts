import type {
  AIChatThread,
  AIConsultResponse,
  AIDayPlanResult,
  AISettings,
  AssistantOverviewPayload,
  AssistantSettings,
  AttributeKey,
  AuditLogEntry,
  ChatContextScope,
  DaySettlementReport,
  DeathReport,
  PlayerProfile,
  Quest,
  QuestRank,
  QuestType,
  RejectionReason,
  StatMap,
  StorageInfoPayload,
  SystemResetMode,
  SystemStatePayload,
  TaskDraftAnalysis,
  TimetableBlock,
} from '../types/system';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error((errBody as { error?: string }).error || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
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
    statRewards?: Partial<StatMap>;
    requiresProof?: boolean;
    syncToTimetable?: boolean;
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

  updateQuest: (questId: string, updates: Partial<Quest>) =>
    request<SystemStatePayload>(`/api/quests/${questId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  completeQuest: (questId: string, payload: { proofNote?: string; dungeonCleared?: boolean }) =>
    request<{
      leveledUp: boolean;
      rankPromoted: boolean;
      xpGain: number;
      masteryGain: number;
      goldGain: number;
      runestoneGain: number;
      spGain?: number;
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
};
