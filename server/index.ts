import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { computeRankFromMastery, computeXpToNextLevel, db, getTodayKey } from './db.ts';
import { assistantDaemon } from './assistant-daemon.ts';
import { desktopTracker } from './desktop-tracker.ts';
import {
  installWindowsStartup,
  launchSystemTray,
  uninstallWindowsStartup,
} from './windows-startup.ts';
import {
  applyTaskContributionToSkill,
  areSkillPrerequisitesMet,
  computePlayerGrowthBonuses,
  computePlayerMaxHp,
  computeSkillSpentResources,
  computeSkillUpgradeCost,
  computeUnlockOrAscendSpCost,
} from './skill-tree-data.ts';
import {
  SlotAllocator,
  analyzeDaySchedule,
  analyzeFullWeek,
  computeBalancedQuestRewards,
  inferSkillIdForTask,
  minutesToTime,
  timeToMinutes,
} from './scheduler.ts';
import {
  analyzeNaturalLanguageGoal,
  analyzeTaskDraft,
  buildDistilledPlayerContext,
  consultSystemAI,
  listProviderModels,
  parseTimetableWithAI,
  planDayScheduleWithAI,
  runMultiAgentOrchestration,
  testLlmConnection,
} from './ai-orchestrator.ts';
import {
  getVnDayOfWeek,
  getVnDayOfWeekFromDateKey,
  getVnNowMinutes,
  getVnTimeHHmm,
  getVnTodayKey,
} from './time-vn.ts';
import type {
  AIChatMessage,
  AIConsultRequest,
  AISettings,
  ActivityCategory,
  AssistantSettings,
  AttributeKey,
  BossMission,
  ChapterStageNode,
  ChatContextScope,
  DaySettlementReport,
  DeathReport,
  PlayerProfile,
  PlayerState,
  Quest,
  QuestRank,
  QuestType,
  RejectionReason,
  StoryChapter,
  SystemResetMode,
  SystemStatePayload,
  TimetableBlock,
} from './types.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function applyLevelUps(player: PlayerState): boolean {
  let leveledUp = false;
  while (player.currentXp >= player.xpToNextLevel) {
    player.currentXp -= player.xpToNextLevel;
    player.level += 1;
    player.xpToNextLevel = computeXpToNextLevel(player.level);
    player.skillPoints = (player.skillPoints || 0) + 2;
    player.totalSkillPointsEarned = (player.totalSkillPointsEarned || 0) + 2;
    leveledUp = true;
  }
  if (leveledUp) {
    const newMax = computePlayerMaxHp(player, db.getSkills());
    player.maxHp = newMax;
    player.hp = newMax;
  }
  return leveledUp;
}

function awardSkillPoints(player: PlayerState, amount: number): void {
  if (amount <= 0) return;
  player.skillPoints = (player.skillPoints || 0) + amount;
  player.totalSkillPointsEarned = (player.totalSkillPointsEarned || 0) + amount;
}

export function computeQuestMissDamage(quest: Quest, fatigueReductionPct: number): number {
  let raw = 0;
  const r = quest.rank;
  const isHigh = r === 'A' || r === 'S';
  const isMid = r === 'C' || r === 'B';

  switch (quest.type) {
    case 'hidden':
      raw = 0;
      break;
    case 'recovery':
      raw = 4;
      break;
    case 'side':
      raw = isHigh ? 12 : isMid ? 10 : 8;
      break;
    case 'daily':
      raw = isHigh ? 18 : isMid ? 15 : 12;
      break;
    case 'main':
    case 'emergency':
      raw = isHigh ? 26 : isMid ? 22 : 18;
      break;
    default:
      raw = 10;
      break;
  }

  if (raw <= 0) return 0;
  const shield = Math.min(0.35, Math.max(0, fatigueReductionPct / 100));
  return Math.max(2, Math.round(raw * (1 - shield)));
}

function triggerPlayerDeathAndCheckpointRollback(
  player: PlayerState,
  missedQuests: Array<{ title: string; type: QuestType; hpDamage: number }>,
  totalHpDamage: number
): DeathReport {
  const goldLost = Math.floor(player.gold * 0.25);
  player.gold = Math.max(0, player.gold - goldLost);

  let xpLost = Math.round(player.currentXp * 0.3);
  let levelDropped = false;
  if (player.currentXp === 0 && player.level > 1) {
    player.level -= 1;
    levelDropped = true;
    player.xpToNextLevel = computeXpToNextLevel(player.level);
    player.currentXp = Math.round(player.xpToNextLevel * 0.5);
    xpLost = player.currentXp;
  } else {
    player.currentXp = Math.max(0, player.currentXp - xpLost);
  }

  player.streakDays = 0;
  player.deathCount = (player.deathCount || 0) + 1;

  const cp = player.currentCheckpoint || {
    id: 'cp-ch1-start',
    label: 'Chương I · Cổng Khởi Nguyên',
    chapterId: 'ch-1',
    chapterNumber: 1,
    stageNumber: 1,
    savedAt: getTodayKey(),
    levelAtCheckpoint: player.level,
  };

  const chapters = db.getChapters();
  const bosses = db.getBosses();

  for (const ch of chapters) {
    if (ch.chapterNumber < cp.chapterNumber) continue;
    let mutated = false;
    for (const st of ch.stages || []) {
      const afterCp =
        ch.chapterNumber > cp.chapterNumber ||
        st.stageNumber > cp.stageNumber ||
        (st.stageNumber === cp.stageNumber && st.kind === 'minion_wave');
      if (afterCp && st.kind === 'minion_wave' && !st.completed && (st.minionProgress ?? 0) > 0) {
        st.minionProgress = 0;
        mutated = true;
      }
    }
    if (mutated) db.saveChapter(ch);
  }

  for (const b of bosses) {
    if (b.defeated || b.bossRole === 'custom_boss' || !b.chapterId) continue;
    const ch = chapters.find((c) => c.id === b.chapterId);
    if (!ch || ch.chapterNumber < cp.chapterNumber) continue;
    const linkedStage = (ch.stages || []).find((s) => s.bossId === b.id);
    if (
      ch.chapterNumber > cp.chapterNumber ||
      (linkedStage && linkedStage.stageNumber > cp.stageNumber)
    ) {
      b.currentHp = b.maxHp;
      b.stages = b.stages.map((s) => ({ ...s, completed: false, proofText: undefined }));
      db.saveBoss(b);
    }
  }

  const newMaxHp = computePlayerMaxHp(player, db.getSkills());
  player.maxHp = Math.max(100, newMaxHp);
  player.hp = Math.max(15, Math.round(player.maxHp * 0.75));

  const causeSummary =
    missedQuests.length > 0
      ? `Kiệt sức do bỏ lỡ ${missedQuests.length} nhiệm vụ (-${totalHpDamage} HP)`
      : `Kiệt sức trong hành trình (-${totalHpDamage} HP)`;

  const report: DeathReport = {
    id: uid('death'),
    occurredAt: new Date().toISOString(),
    causeSummary,
    missedQuests,
    totalHpDamage,
    goldLost,
    xpLost,
    levelDropped,
    respawnedAtCheckpoint: cp.label,
    respawnHp: player.hp,
  };

  player.lastDeathReport = report;

  db.addAuditLog(
    'PLAYER_DEATH_CHECKPOINT',
    `Ngã xuống & Hồi sinh tại "${cp.label}" (-${goldLost}G, -${xpLost} XP, HP -> ${player.hp}/${player.maxHp})`,
    {
      deathCount: player.deathCount,
      goldLost,
      xpLost,
      levelDropped,
      checkpoint: cp.label,
    }
  );

  db.addMemoryLog({
    id: uid('log'),
    timestamp: new Date().toISOString(),
    agent: 'VITALITY',
    eventType: 'VITALITY_OVERRIDE',
    summary: `Hồi sinh tại Checkpoint "${cp.label}" (Lần ngã xuống #${player.deathCount})`,
    insight: `${causeSummary}. Mất ${goldLost}G & ${xpLost} XP; Cây Kĩ Năng & Runestones vẫn được bảo toàn.`,
  });

  return report;
}

function settlePendingQuestsInTx(
  pendingQuests: Quest[],
  settledDateKeys: string[],
  auditSummaryPrefix: string
): DaySettlementReport {
  const player = db.getPlayer();
  const skills = db.getSkills();
  const inventory = db.getInventory();
  const shadows = db.getShadows();
  const growthBonuses = computePlayerGrowthBonuses(player, skills, inventory, shadows);

  const protectedByGraceDay = Boolean(player.plannedRestMode);
  const mitigatedByShieldPct = Math.round(Math.min(35, growthBonuses.fatigueReductionPct));

  const missedQuests: DaySettlementReport['missedQuests'] = [];
  let totalHpDamage = 0;

  for (const q of pendingQuests) {
    q.status = 'skipped';
    db.saveQuest(q);
    const dmg = protectedByGraceDay
      ? 0
      : computeQuestMissDamage(q, growthBonuses.fatigueReductionPct);
    totalHpDamage += dmg;
    missedQuests.push({
      id: q.id,
      title: q.title,
      type: q.type,
      rank: q.rank,
      hpDamage: dmg,
    });
  }

  let died = false;
  let deathReport: DeathReport | undefined;

  if (totalHpDamage > 0) {
    player.hp = Math.max(0, (player.hp ?? player.maxHp) - totalHpDamage);
    if (player.hp <= 0) {
      died = true;
      deathReport = triggerPlayerDeathAndCheckpointRollback(
        player,
        missedQuests.map((m) => ({ title: m.title, type: m.type, hpDamage: m.hpDamage })),
        totalHpDamage
      );
    }
  }

  player.lastSettledDate = getTodayKey();
  db.savePlayer(player);

  db.addAuditLog(
    'DAY_SETTLED',
    `${auditSummaryPrefix}: ${missedQuests.length} nhiệm vụ bỏ lỡ (-${totalHpDamage} HP${protectedByGraceDay ? ' · Grace Day' : ''})`,
    {
      settledDateKeys,
      missedCount: missedQuests.length,
      totalHpDamage,
      protectedByGraceDay,
      died,
    }
  );

  return {
    settledDateKeys,
    missedQuests,
    totalHpDamage,
    mitigatedByShieldPct,
    protectedByGraceDay,
    died,
    deathReport,
  };
}

function settleOverdueQuestsIfNeeded(): void {
  const todayKey = getTodayKey();
  const overdue = db.getQuests().filter((q) => q.status === 'pending' && q.dateKey < todayKey);
  if (overdue.length === 0) {
    const player = db.getPlayer();
    if (player.lastSettledDate !== todayKey) {
      player.lastSettledDate = todayKey;
      db.savePlayer(player);
    }
    return;
  }

  const dateKeys = Array.from(new Set(overdue.map((q) => q.dateKey))).sort();
  db.runTransaction(() => {
    settlePendingQuestsInTx(overdue, dateKeys, 'Tổng kết tự động ngày cũ');
  });
}

function completeMinionWaveStage(
  ch: StoryChapter,
  stage: ChapterStageNode,
  player: PlayerState,
  auditLabel?: string
): void {
  stage.completed = true;
  player.gold += stage.rewardGold;
  player.currentXp += stage.rewardXp;
  awardSkillPoints(player, stage.rewardSp);
  applyLevelUps(player);

  const nextStage = (ch.stages || []).find((s) => s.stageNumber === stage.stageNumber + 1);
  if (nextStage) {
    nextStage.unlocked = true;
    if (nextStage.bossId) {
      const linkedBoss = db.getBosses().find((b) => b.id === nextStage.bossId);
      if (linkedBoss && !linkedBoss.unlocked) {
        linkedBoss.unlocked = true;
        db.saveBoss(linkedBoss);
      }
    }
  }

  db.saveChapter(ch);
  db.addAuditLog(
    'STAGE_CLEARED',
    auditLabel ||
    `Dọn sạch ${stage.title} (+${stage.rewardGold}G, +${stage.rewardSp} SP, +${stage.rewardXp} XP)`,
    { chapterId: ch.id, stageId: stage.id, unlockedNextStageId: nextStage?.id }
  );
}

function advanceMinionWaveOnQuestComplete(player: PlayerState): void {
  const chapters = db.getChapters();
  const activeCh = chapters.find((c) => c.unlocked && !c.completed);
  if (!activeCh) return;

  const waveStage = (activeCh.stages || []).find(
    (s) => s.kind === 'minion_wave' && s.unlocked && !s.completed
  );
  if (!waveStage) return;

  const reqCount = waveStage.minionCountRequired ?? 2;
  waveStage.minionProgress = (waveStage.minionProgress ?? 0) + 1;
  if (waveStage.minionProgress >= reqCount) {
    completeMinionWaveStage(activeCh, waveStage, player);
  } else {
    db.saveChapter(activeCh);
  }
}

function finalizeBossDefeat(
  boss: BossMission,
  player: PlayerState
): {
  unlockedChapterBossTitle?: string;
  unlockedChapterTitle?: string;
  spGain: number;
  goldGain: number;
  runestoneGain: number;
} {
  boss.defeated = true;
  boss.currentHp = 0;
  for (const st of boss.stages) {
    if (!st.completed) {
      st.completed = true;
      st.proofText = st.proofText || 'Hoàn thành cột mốc Chương Chiến dịch';
    }
  }

  const isChapterBoss = boss.bossRole === 'chapter_boss';
  const goldGain = boss.rewardGold ?? (isChapterBoss ? 400 : 180);
  const runestoneGain = boss.rewardRunestones ?? (isChapterBoss ? 40 : 15);
  const spGain = 4;

  player.masteryScore += boss.rewardMastery;
  player.runestones += runestoneGain;
  player.gold += goldGain;
  awardSkillPoints(player, spGain);

  if (!player.unlockedTitles.includes(boss.rewardTitle)) {
    player.unlockedTitles.push(boss.rewardTitle);
    player.activeTitle = boss.rewardTitle;
  }

  db.saveShadow({
    id: uid('sh'),
    name: boss.rewardShadowName.split('—')[0].trim(),
    title: `Chiết xuất từ ${boss.title}`,
    rank: boss.rank,
    originBoss: boss.title,
    passiveBuff: `+2% Mastery & +2 INT/PER cho mục tiêu liên quan`,
    statBonus: { INT: 2, PER: 2 },
    routineTitle: `${boss.rewardShadowName} Drill (25m)`,
    routineDescription: `Triệu hồi Shadow từ Boss đã bại trận để duy trì phong độ đỉnh cao: ${boss.subtitle}`,
    routineDurationMinutes: 25,
    summonCount: 1,
    extractedAt: getTodayKey(),
  });

  db.saveBoss(boss);

  let unlockedChapterBossTitle: string | undefined;
  let unlockedChapterTitle: string | undefined;

  if (boss.chapterId) {
    const allBosses = db.getBosses();
    const chapters = db.getChapters();
    const chIndex = chapters.findIndex((c) => c.id === boss.chapterId);
    const ch = chIndex >= 0 ? chapters[chIndex] : undefined;

    if (ch) {
      const linkedStage = (ch.stages || []).find((s) => s.bossId === boss.id);
      if (linkedStage) {
        linkedStage.completed = true;
        linkedStage.unlocked = true;
        player.currentCheckpoint = {
          id: uid('cp'),
          label: `Chương ${ch.chapterNumber} · Màn ${linkedStage.code}`,
          chapterId: ch.id,
          chapterNumber: ch.chapterNumber,
          stageNumber: linkedStage.stageNumber,
          savedAt: getTodayKey(),
          levelAtCheckpoint: player.level,
        };
      }

      if (boss.bossRole === 'mini_boss') {
        db.addAuditLog('MINI_BOSS_DEFEATED', `Hạ Mini-Boss "${boss.title}" (+${spGain} SP)`, {
          bossId: boss.id,
          chapterId: ch.id,
        });

        const nextStage = linkedStage
          ? (ch.stages || []).find((s) => s.stageNumber === linkedStage.stageNumber + 1)
          : undefined;

        if (nextStage) {
          nextStage.unlocked = true;
          if (nextStage.kind === 'chapter_boss' && nextStage.bossId) {
            const chBoss = allBosses.find((b) => b.id === nextStage.bossId);
            if (chBoss && !chBoss.unlocked) {
              chBoss.unlocked = true;
              db.saveBoss(chBoss);
              unlockedChapterBossTitle = chBoss.title;
              db.addAuditLog(
                'CHAPTER_BOSS_UNLOCKED',
                `Phá phong ấn Boss Chương ${ch.chapterNumber}: "${chBoss.title}"`,
                { chapterId: ch.id, bossId: chBoss.id }
              );
            }
          }
        } else {
          const allMiniDefeated = ch.miniBossIds.every(
            (mid) => allBosses.find((b) => b.id === mid)?.defeated
          );
          if (allMiniDefeated) {
            const chBoss = allBosses.find((b) => b.id === ch.chapterBossId);
            if (chBoss && !chBoss.unlocked) {
              chBoss.unlocked = true;
              db.saveBoss(chBoss);
              unlockedChapterBossTitle = chBoss.title;
              db.addAuditLog(
                'CHAPTER_BOSS_UNLOCKED',
                `Phá phong ấn Boss Chương ${ch.chapterNumber}: "${chBoss.title}"`,
                { chapterId: ch.id, bossId: chBoss.id }
              );
            }
            const bossStage = (ch.stages || []).find((s) => s.bossId === ch.chapterBossId);
            if (bossStage) bossStage.unlocked = true;
          }
        }
        db.saveChapter(ch);
      } else if (boss.bossRole === 'chapter_boss') {
        if (!ch.completed) {
          ch.completed = true;
          db.addAuditLog('CHAPTER_COMPLETED', `Hoàn thành ${ch.title}`, {
            chapterId: ch.id,
            chapterNumber: ch.chapterNumber,
          });
        }
        db.saveChapter(ch);

        const nextCh = chapters[chIndex + 1];
        if (nextCh && !nextCh.unlocked) {
          nextCh.unlocked = true;
          for (const st of nextCh.stages || []) {
            st.unlocked = st.stageNumber === 1;
          }
          db.saveChapter(nextCh);

          unlockedChapterTitle = nextCh.title;
          db.addAuditLog(
            'CHAPTER_UNLOCKED',
            `Mở khóa ${nextCh.title} (Màn ${nextCh.chapterNumber}-1 sẵn sàng)`,
            { chapterId: nextCh.id, chapterNumber: nextCh.chapterNumber }
          );
        }
      }
    }
  }

  return { unlockedChapterBossTitle, unlockedChapterTitle, spGain, goldGain, runestoneGain };
}

function buildStatePayload(): SystemStatePayload {
  const player = db.getPlayer();
  const goals = db.getGoals();
  const timetable = db.getTimetableBlocks();
  const todayDow = getVnDayOfWeek();
  const todayAnalysis = analyzeDaySchedule(timetable, todayDow, player.energyLevel);
  const weeklyAnalysis = analyzeFullWeek(timetable, player.energyLevel);
  const quests = db.getQuests();
  const bosses = db.getBosses();
  const chapters = db.getChapters();
  const shopItems = db.getShopItems();
  const inventory = db.getInventory();
  const skills = db.getSkills();
  const shadows = db.getShadows();
  const memoryLogs = db.getMemoryLogs(50);
  const dailySnapshots = db.getDailySnapshots(30);
  const auditLogs = db.getAuditLogs(30);
  const storageInfo = db.getStorageInfo();
  const aiSettings = db.getAISettings();
  const lastDeliberation = db.getLastDeliberation();
  const growthBonuses = computePlayerGrowthBonuses(player, skills, inventory, shadows);
  const chatThreads = db.getChatThreads();
  const activitySummary = desktopTracker.getDailySummary(getVnTodayKey());
  const unreadNudges = db.getAssistantNudges(30).filter((n) => !n.dismissed).length;

  return {
    player,
    goals,
    timetable,
    todayAnalysis,
    weeklyAnalysis,
    quests,
    bosses,
    chapters,
    shopItems,
    inventory,
    skills,
    shadows,
    memoryLogs,
    dailySnapshots,
    auditLogs,
    storageInfo,
    aiSettings,
    lastDeliberation,
    growthBonuses,
    chatThreads,
    assistantSummary: {
      trackerRunning: desktopTracker.isRunning(),
      focusScore: activitySummary.focusScore,
      deepWorkMinutes: activitySummary.deepWorkMinutes,
      unreadNudges,
      currentCategory: activitySummary.currentApp?.category,
    },
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'THE SYSTEM // SYS.OS', time: new Date().toISOString() });
});

app.get('/api/system/health-full', (_req, res) => {
  try {
    const report = db.getHealthReport();
    res.json({
      ok: report.ok,
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      integrityCheck: report.integrityCheck,
      storageInfo: report.storageInfo,
      recentBackups: report.recentBackups,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Health check failed' });
  }
});

app.get('/api/system/audit-logs', (req, res) => {
  const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
  res.json({ logs: db.getAuditLogs(limit) });
});

app.post('/api/system/backup', (_req, res) => {
  try {
    const backup = db.createDiskBackup();
    res.json({
      ok: true,
      ...backup,
      state: buildStatePayload(),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Backup failed' });
  }
});

app.get('/api/system/state', (_req, res) => {
  try {
    settleOverdueQuestsIfNeeded();
    res.json(buildStatePayload());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load state' });
  }
});

app.get('/api/system/storage-info', (_req, res) => {
  res.json({
    storageInfo: db.getStorageInfo(),
    dailySnapshots: db.getDailySnapshots(60),
  });
});

// Update Player Profile / Identity (Name, Class, Custom System Prompt)
app.put('/api/player/profile', (req, res) => {
  const player = db.getPlayer();
  const body = req.body as Partial<PlayerProfile> & {
    hunterClass?: string;
    activeTitle?: string;
  };
  const { hunterClass, activeTitle, ...profileFields } = body;
  player.profile = { ...player.profile, ...profileFields };
  if (typeof hunterClass === 'string' && hunterClass.trim()) {
    player.hunterClass = hunterClass.trim();
  }
  if (typeof activeTitle === 'string' && player.unlockedTitles.includes(activeTitle)) {
    player.activeTitle = activeTitle;
  }
  db.savePlayer(player);
  res.json(buildStatePayload());
});

app.get('/api/ai/context-preview', (_req, res) => {
  const state = buildStatePayload();
  res.json(buildDistilledPlayerContext(state));
});

app.post('/api/player/onboard', (req, res) => {
  const player = db.getPlayer();
  const { isOnboarded } = req.body as { isOnboarded?: boolean };
  player.isOnboarded = isOnboarded ?? true;
  db.savePlayer(player);
  res.json(buildStatePayload());
});

app.post('/api/player/checkin', (req, res) => {
  const player = db.getPlayer();
  const { energyLevel, fatigue, activeTitle, penaltyActive } = req.body as {
    energyLevel?: number;
    fatigue?: number;
    activeTitle?: string;
    penaltyActive?: boolean;
  };
  if (typeof energyLevel === 'number') {
    player.energyLevel = Math.max(10, Math.min(100, energyLevel));
  }
  if (typeof fatigue === 'number') {
    player.fatigue = Math.max(0, Math.min(100, fatigue));
  }
  if (typeof activeTitle === 'string' && player.unlockedTitles.includes(activeTitle)) {
    player.activeTitle = activeTitle;
  }
  if (typeof penaltyActive === 'boolean') {
    player.penaltyActive = penaltyActive;
  }
  player.lastCheckinDate = getTodayKey();
  db.savePlayer(player);
  res.json(buildStatePayload());
});

// Daily Reflection & Planned Rest Mode (Anti-Burnout SDT)
app.post('/api/player/reflect', (req, res) => {
  const { reflectionNote, plannedRestMode } = req.body as {
    reflectionNote?: string;
    plannedRestMode?: boolean;
  };
  const player = db.getPlayer();
  const todayKey = getTodayKey();

  if (typeof plannedRestMode === 'boolean') {
    player.plannedRestMode = plannedRestMode;
    if (plannedRestMode) {
      player.energyLevel = Math.min(100, player.energyLevel + 15);
      player.fatigue = Math.max(0, player.fatigue - 20);
      player.hp = Math.min(player.maxHp, (player.hp ?? player.maxHp) + 25);
    }
    db.savePlayer(player);
  }

  if (reflectionNote && reflectionNote.trim()) {
    db.recordDailyProgress({
      dateKey: todayKey,
      energyLevel: player.energyLevel,
      reflectionNote: reflectionNote.trim(),
      isRestDay: player.plannedRestMode,
    });
    db.addMemoryLog({
      id: uid('log'),
      timestamp: new Date().toISOString(),
      agent: 'SCHOLAR',
      eventType: 'QUEST_COMPLETED',
      summary: `Nhật ký suy ngẫm ngày ${todayKey}`,
      insight: `Reflection của Player: "${reflectionNote.trim().slice(0, 140)}"`,
    });
  } else if (typeof plannedRestMode === 'boolean') {
    db.recordDailyProgress({
      dateKey: todayKey,
      energyLevel: player.energyLevel,
      isRestDay: plannedRestMode,
    });
  }

  res.json(buildStatePayload());
});

// Acknowledge Death & Checkpoint Rollback modal
app.post('/api/player/ack-death', (_req, res) => {
  const player = db.getPlayer();
  player.lastDeathReport = null;
  db.savePlayer(player);
  res.json(buildStatePayload());
});

// Settle today's remaining pending quests (End-of-day audit)
app.post('/api/system/settle-day', (_req, res) => {
  const todayKey = getTodayKey();
  const pendingToday = db
    .getQuests()
    .filter((q) => q.status === 'pending' && q.dateKey <= todayKey);

  const dateKeys =
    pendingToday.length > 0
      ? Array.from(new Set(pendingToday.map((q) => q.dateKey))).sort()
      : [todayKey];

  const settlement = db.runTransaction(() =>
    settlePendingQuestsInTx(pendingToday, dateKeys, 'Chốt ngày thủ công')
  );

  res.json({
    settlement,
    state: buildStatePayload(),
  });
});

// Manual Proof-of-Work verification for Minion Wave Stage
app.post('/api/chapters/:chapterId/stages/:stageId/verify-minion', (req, res) => {
  const chapters = db.getChapters();
  const ch = chapters.find((c) => c.id === req.params.chapterId);
  if (!ch) {
    res.status(404).json({ error: 'Chapter not found' });
    return;
  }
  const stage = (ch.stages || []).find((s) => s.id === req.params.stageId);
  if (!stage || stage.kind !== 'minion_wave') {
    res.status(404).json({ error: 'Minion Wave stage not found' });
    return;
  }
  if (!ch.unlocked || !stage.unlocked) {
    res.status(400).json({ error: `Màn ${stage.code} đang bị khóa.` });
    return;
  }
  const { proofText } = (req.body || {}) as { proofText?: string };
  if (!proofText || proofText.trim().length < 5) {
    res.status(400).json({ error: 'Cần nhập bằng chứng thực tế tối thiểu 5 ký tự để vượt ải.' });
    return;
  }

  if (!stage.completed) {
    db.runTransaction(() => {
      const player = db.getPlayer();
      stage.minionProgress = stage.minionCountRequired ?? 2;
      completeMinionWaveStage(
        ch,
        stage,
        player,
        `Vượt ải Màn ${stage.code}: ${stage.title} (+${stage.rewardGold}G, +${stage.rewardSp} SP, +${stage.rewardXp} XP)`
      );
      db.savePlayer(player);

      db.addMemoryLog({
        id: uid('log'),
        timestamp: new Date().toISOString(),
        agent: 'STRATEGIST',
        eventType: 'BOSS_VERIFIED',
        summary: `Vượt ải Màn ${stage.code}: ${stage.minionName || stage.title}`,
        insight: `Proof: "${proofText.trim().slice(0, 100)}"`,
      });
    });
  }

  res.json({
    stageCleared: true,
    state: buildStatePayload(),
  });
});

// Atomic Habits 2-Minute Micro-Start Action
app.post('/api/quests/:id/micro-start', (req, res) => {
  const quest = db.getQuestById(req.params.id);
  if (!quest) {
    res.status(404).json({ error: 'Quest not found' });
    return;
  }
  if (!quest.microStartDone) {
    quest.microStartDone = true;
    db.saveQuest(quest);
    const player = db.getPlayer();
    player.currentXp += 10;
    player.gold += 10;
    applyLevelUps(player);
    db.savePlayer(player);
  }
  res.json(buildStatePayload());
});

// Analyze & Create Natural Language Goal
app.post('/api/goals/analyze', async (req, res) => {
  try {
    const { rawInput } = req.body as { rawInput: string };
    if (!rawInput || !rawInput.trim()) {
      res.status(400).json({ error: 'rawInput is required' });
      return;
    }

    const player = db.getPlayer();
    const skills = db.getSkills();
    const settings = db.getAISettings();
    const distilled = buildDistilledPlayerContext(buildStatePayload());

    const analysis = await analyzeNaturalLanguageGoal(
      rawInput.trim(),
      player,
      skills,
      settings,
      distilled
    );
    db.saveGoal(analysis.goal);

    if (analysis.suggestedBoss) {
      db.saveBoss(analysis.suggestedBoss);
    }
    for (const sk of analysis.suggestedSkills) {
      db.saveSkill(sk);
    }

    // Auto-schedule 1 conflict-free TimetableBlock + 1 Today Quest for the new Goal
    const allSkills = db.getSkills();
    const allBlocks = db.getTimetableBlocks();
    const todayDow = getVnDayOfWeek();
    const nowMin = getVnNowMinutes();
    const todaySchedule = analyzeDaySchedule(allBlocks, todayDow, player.energyLevel);
    const goalStat: AttributeKey =
      analysis.suggestedSkills[0]?.primaryStat ||
      (analysis.goal.category === 'Health & Vitality'
        ? 'STR'
        : analysis.goal.category === 'Language & IELTS' || analysis.goal.category === 'Research & Academic'
          ? 'PER'
          : 'INT');
    const goalDur = 45;

    const upcomingTodayWindows = todaySchedule.freeWindows
      .map((w) => ({
        start: Math.max(nowMin, timeToMinutes(w.startTime)),
        end: timeToMinutes(w.endTime),
      }))
      .filter((w) => w.end - w.start >= 30 && w.start >= 7 * 60 && w.end <= 23 * 60 + 30);

    let scheduledDow = todayDow;
    let blockStart = '';
    let blockEnd = '';

    if (upcomingTodayWindows.length > 0) {
      const w = upcomingTodayWindows[0];
      const dur = Math.min(goalDur, w.end - w.start);
      blockStart = minutesToTime(w.start);
      blockEnd = minutesToTime(w.start + dur);
    } else {
      for (let offset = 1; offset <= 6; offset++) {
        const candDow = (todayDow + offset) % 7;
        const candSched = analyzeDaySchedule(allBlocks, candDow, player.energyLevel);
        const w = candSched.freeWindows.find(
          (fw) => fw.durationMinutes >= 30 && timeToMinutes(fw.startTime) >= 7 * 60
        );
        if (w) {
          scheduledDow = candDow;
          const s = timeToMinutes(w.startTime);
          const dur = Math.min(goalDur, w.durationMinutes);
          blockStart = minutesToTime(s);
          blockEnd = minutesToTime(s + dur);
          break;
        }
      }
    }

    let linkedBlockId: string | undefined;
    if (blockStart && blockEnd) {
      linkedBlockId = uid('tt-goal');
      db.saveTimetableBlock({
        id: linkedBlockId,
        dayOfWeek: scheduledDow,
        startTime: blockStart,
        endTime: blockEnd,
        title: `Mục tiêu: ${analysis.goal.title.slice(0, 40)}`,
        type: 'fixed_habit',
        energyCost: 'MEDIUM',
        isRecurring: false,
        notes: 'Tự động xếp lịch từ Mục tiêu mới',
      });
    }

    const skillId =
      analysis.suggestedSkills[0]?.id ||
      inferSkillIdForTask(analysis.goal.title, analysis.goal.recommendedMethod, goalStat, allSkills);
    const goalRank: QuestRank = analysis.goal.priority === 'CRITICAL' ? 'A' : 'B';
    const rewards = computeBalancedQuestRewards({
      durationMinutes: goalDur,
      rank: goalRank,
      type: 'main',
      requiresProof: false,
      primaryStat: goalStat,
      secondaryStat: 'AGI',
    });

    db.saveQuest({
      id: uid('q-goal'),
      dateKey: getVnTodayKey(),
      type: 'main',
      rank: goalRank,
      title: `Khởi động: ${analysis.goal.title.slice(0, 48)}`,
      description:
        analysis.goal.subMilestones[0] ||
        `Phiên hành động đầu tiên cho mục tiêu "${analysis.goal.title}" (${analysis.goal.recommendedMethod}).`,
      learningMethod: analysis.goal.recommendedMethod,
      reasoning: `Tự động tạo & gắn lịch (${blockStart ? `${blockStart}-${blockEnd}` : 'Flexible'}) khi thiết lập mục tiêu mới.`,
      agentSource: 'STRATEGIST',
      goalId: analysis.goal.id,
      skillId,
      linkedBlockId,
      scheduledSlot: blockStart && blockEnd ? `${blockStart} - ${blockEnd}` : 'Flexible Window',
      durationMinutes: goalDur,
      xpReward: rewards.xpReward,
      masteryReward: rewards.masteryReward,
      goldReward: rewards.goldReward,
      statRewards: rewards.statRewards,
      subtasks: [
        { id: uid('gs-1'), label: 'Đặt mục tiêu đầu ra rõ ràng trước khi bấm giờ', done: false },
        { id: uid('gs-2'), label: analysis.goal.subMilestones[0] || 'Hoàn thành bước đầu tiên', done: false },
      ],
      status: 'pending',
      requiresProof: false,
      ifThenTrigger: analysis.goal.ifThenPlan,
      createdAt: new Date().toISOString(),
    });

    db.checkpointWal();

    db.addMemoryLog({
      id: uid('log'),
      timestamp: new Date().toISOString(),
      agent: 'STRATEGIST',
      eventType: 'GOAL_ANALYSIS',
      summary: `Phân tích mục tiêu mới (${analysis.mode}): "${analysis.goal.title}"`,
      insight: `Đã trích xuất ${analysis.goal.subMilestones.length} cột mốc, xếp lịch ${blockStart ? `${blockStart}-${blockEnd}` : 'linh hoạt'} và tạo Quest khởi động.`,
    });

    res.json({
      analysis,
      state: buildStatePayload(),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Goal analysis failed' });
  }
});

app.delete('/api/goals/:id', (req, res) => {
  const goalId = req.params.id;
  db.runTransaction(() => {
    const goal = db.getGoals().find((g) => g.id === goalId);
    db.deleteGoal(goalId);

    for (const b of db.getBosses()) {
      if (b.goalId === goalId && !b.defeated) {
        db.deleteBoss(b.id);
      }
    }

    for (const q of db.getQuests()) {
      if (q.goalId === goalId) {
        if (q.status === 'pending') {
          if (q.linkedBlockId) db.deleteTimetableBlock(q.linkedBlockId);
          db.deleteQuest(q.id);
        } else {
          q.goalId = undefined;
          db.saveQuest(q);
        }
      }
    }

    if (goal) {
      for (const blk of db.getTimetableBlocks()) {
        if (
          blk.id.startsWith('tt-goal-') &&
          (blk.title.includes(goal.title.slice(0, 40)) ||
            (blk.notes && blk.notes.includes(goal.title)))
        ) {
          db.deleteTimetableBlock(blk.id);
        }
      }
    }
  });
  db.checkpointWal();
  res.json(buildStatePayload());
});

// Timetable CRUD + Batch + Natural Language Importer
app.post('/api/timetable/blocks', (req, res) => {
  const b = req.body as Omit<TimetableBlock, 'id'> & { id?: string };
  const block: TimetableBlock = {
    id: b.id || uid('tt'),
    dayOfWeek: Number(b.dayOfWeek),
    startTime: b.startTime,
    endTime: b.endTime,
    title: b.title,
    type: b.type,
    energyCost: b.energyCost || 'MEDIUM',
    isRecurring: b.isRecurring ?? true,
    notes: b.notes,
  };
  db.saveTimetableBlock(block);
  db.checkpointWal();
  res.json(buildStatePayload());
});

app.post('/api/timetable/batch', (req, res) => {
  const { blocks, replaceExisting } = req.body as {
    blocks: Array<Omit<TimetableBlock, 'id'>>;
    replaceExisting?: boolean;
  };
  if (!Array.isArray(blocks) || blocks.length === 0) {
    res.status(400).json({ error: 'Danh sách khung giờ trống.' });
    return;
  }
  if (replaceExisting) {
    db.clearTimetable();
  }
  for (const b of blocks) {
    if (!b.startTime || !b.endTime || !b.title) continue;
    db.saveTimetableBlock({
      id: uid('tt'),
      dayOfWeek: Number(b.dayOfWeek),
      startTime: b.startTime,
      endTime: b.endTime,
      title: b.title.trim(),
      type: b.type || 'class_work',
      energyCost: b.energyCost || 'MEDIUM',
      isRecurring: b.isRecurring ?? true,
      notes: b.notes,
    });
  }
  db.checkpointWal();
  res.json(buildStatePayload());
});

app.put('/api/timetable/blocks/:id', (req, res) => {
  const existing = db.getTimetableBlocks().find((b) => b.id === req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Timetable block not found' });
    return;
  }
  const updates = req.body as Partial<TimetableBlock>;
  const updated: TimetableBlock = {
    ...existing,
    ...updates,
    id: existing.id,
  };
  db.saveTimetableBlock(updated);
  db.checkpointWal();
  res.json(buildStatePayload());
});

app.delete('/api/timetable/blocks/:id', (req, res) => {
  const blockId = req.params.id;
  db.runTransaction(() => {
    db.deleteTimetableBlock(blockId);
    for (const q of db.getQuests()) {
      if (q.linkedBlockId === blockId) {
        if (q.status === 'pending') {
          db.deleteQuest(q.id);
        } else {
          q.linkedBlockId = undefined;
          db.saveQuest(q);
        }
      }
    }
  });
  db.checkpointWal();
  res.json(buildStatePayload());
});

app.delete('/api/timetable/clear', (req, res) => {
  const dayParam = req.query.dayOfWeek;
  if (typeof dayParam === 'string' && dayParam !== '') {
    db.clearTimetable(Number(dayParam));
  } else {
    db.clearTimetable();
  }
  db.checkpointWal();
  res.json(buildStatePayload());
});

app.post('/api/timetable/ai-plan-day', async (req, res) => {
  try {
    const { prompt, dayOfWeek, addAsQuests } = req.body as {
      prompt?: string;
      dayOfWeek?: number;
      addAsQuests?: boolean;
    };
    if (!prompt || !prompt.trim()) {
      res.status(400).json({ error: 'Vui lòng mô tả các việc bạn muốn AI xếp lịch.' });
      return;
    }

    const vnTodayDow = getVnDayOfWeek();
    const targetDow =
      typeof dayOfWeek === 'number' && dayOfWeek >= 0 && dayOfWeek <= 6 ? dayOfWeek : vnTodayDow;

    const currentState = buildStatePayload();
    const plan = await planDayScheduleWithAI({
      prompt: prompt.trim(),
      dayOfWeek: targetDow,
      state: currentState,
    });

    const addedQuests: Quest[] = [];
    const shouldCreateQuests = addAsQuests ?? targetDow === vnTodayDow;
    const todayKey = getVnTodayKey();
    const skills = db.getSkills();

    db.runTransaction(() => {
      for (const blk of plan.addedBlocks) {
        db.saveTimetableBlock(blk);
        if (shouldCreateQuests && blk.type !== 'sleep' && blk.type !== 'commute_meal') {
          const dur = Math.max(15, timeToMinutes(blk.endTime) - timeToMinutes(blk.startTime));
          const isRest = blk.type === 'rest_buffer';
          const qType: QuestType = isRest ? 'recovery' : 'daily';
          const qRank: QuestRank = dur >= 60 ? 'B' : dur >= 35 ? 'C' : 'D';
          const lowerTitle = blk.title.toLowerCase();
          const primaryStat: AttributeKey = isRest
            ? 'VIT'
            : /(gym|tập|chạy|thể lực|workout)/.test(lowerTitle)
              ? 'STR'
              : /(ngoại ngữ|tiếng anh|ielts|đọc|sách)/.test(lowerTitle)
                ? 'PER'
                : /(giao tiếp|họp|thuyết trình|nhóm)/.test(lowerTitle)
                  ? 'CHA'
                  : /(code|dự án|lập trình|toán|phân tích)/.test(lowerTitle)
                    ? 'INT'
                    : 'AGI';
          const rewards = computeBalancedQuestRewards({
            durationMinutes: dur,
            rank: qRank,
            type: qType,
            requiresProof: false,
            primaryStat,
          });
          const q: Quest = {
            id: uid('q-plan'),
            dateKey: todayKey,
            type: qType,
            rank: qRank,
            title: blk.title,
            description: `Được AI xếp vào khung giờ ${blk.startTime}–${blk.endTime} (${plan.dayLabel}).`,
            learningMethod: 'Timeboxed Execution',
            reasoning: 'Xếp tự động từ AI Day Scheduler (tránh trùng lịch cố định & giờ ngủ 23:30–07:00).',
            agentSource: 'CHRONOS',
            skillId: inferSkillIdForTask(blk.title, undefined, primaryStat, skills),
            linkedBlockId: blk.id,
            scheduledSlot: `${blk.startTime} - ${blk.endTime}`,
            durationMinutes: dur,
            xpReward: rewards.xpReward,
            masteryReward: rewards.masteryReward,
            goldReward: rewards.goldReward,
            statRewards: rewards.statRewards,
            subtasks: [],
            status: 'pending',
            requiresProof: false,
            createdAt: new Date().toISOString(),
          };
          db.saveQuest(q);
          addedQuests.push(q);
        }
      }

      db.addMemoryLog({
        id: uid('log'),
        timestamp: new Date().toISOString(),
        agent: 'CHRONOS',
        eventType: 'ORCHESTRATION',
        summary: `AI Tự Xếp Lịch (${plan.dayLabel}): +${plan.addedBlocks.length} khung giờ`,
        insight: plan.summary,
      });
    });

    db.checkpointWal();

    res.json({
      ...plan,
      addedQuests,
      state: buildStatePayload(),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'AI day plan failed' });
  }
});

app.post('/api/timetable/import-text', async (req, res) => {
  try {
    const { rawText, previewOnly, replaceAll } = req.body as {
      rawText: string;
      previewOnly?: boolean;
      replaceAll?: boolean;
    };
    if (!rawText || !rawText.trim()) {
      res.status(400).json({ error: 'Vui lòng nhập mô tả thời khóa biểu.' });
      return;
    }

    const settings = db.getAISettings();
    const parsed = await parseTimetableWithAI(rawText.trim(), settings);

    if (previewOnly) {
      res.json({
        parsedBlocks: parsed.blocks,
        mode: parsed.mode,
      });
      return;
    }

    if (replaceAll) {
      db.clearTimetable();
    }
    for (const b of parsed.blocks) {
      db.saveTimetableBlock({
        ...b,
        id: uid('tt'),
      });
    }

    db.addMemoryLog({
      id: uid('log'),
      timestamp: new Date().toISOString(),
      agent: 'CHRONOS',
      eventType: 'ORCHESTRATION',
      summary: `Import ${parsed.blocks.length} khung giờ cố định (${parsed.mode})`,
      insight: `Đã cập nhật lịch trình cố định từ mô tả: "${rawText.trim().slice(0, 90)}"`,
    });

    db.checkpointWal();

    res.json({
      importedCount: parsed.blocks.length,
      mode: parsed.mode,
      state: buildStatePayload(),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Timetable import failed' });
  }
});

// Multi-Agent Daily Orchestration
app.post('/api/orchestrate', async (req, res) => {
  try {
    const { focusNote, dateKey } = req.body as { focusNote?: string; dateKey?: string };
    const targetDate = dateKey || getTodayKey();
    const player = db.getPlayer();
    const goals = db.getGoals();
    const timetable = db.getTimetableBlocks();
    const skills = db.getSkills();
    const memoryLogs = db.getMemoryLogs(25);
    const aiSettings = db.getAISettings();

    const dayDow = getVnDayOfWeekFromDateKey(targetDate);
    const dayAnalysis = analyzeDaySchedule(timetable, dayDow, player.energyLevel);
    const distilled = buildDistilledPlayerContext(buildStatePayload());

    db.clearPendingQuestsForDate(targetDate);

    const { quests, deliberation } = await runMultiAgentOrchestration(
      player,
      goals,
      dayAnalysis,
      skills,
      memoryLogs,
      aiSettings,
      { dateKey: targetDate, focusNote, distilled }
    );

    for (const q of quests) {
      db.saveQuest(q);
    }
    db.saveLastDeliberation(deliberation);
    db.checkpointWal();

    db.addMemoryLog({
      id: uid('log'),
      timestamp: new Date().toISOString(),
      agent: 'ARCHITECT',
      eventType: 'ORCHESTRATION',
      summary: `Điều phối ${quests.length} nhiệm vụ cho ngày ${targetDate} (${deliberation.mode})`,
      insight: deliberation.systemDirective,
    });

    res.json(buildStatePayload());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Orchestration failed' });
  }
});

const DEFAULT_SCOPE_TITLES: Record<ChatContextScope, string> = {
  general: 'Cuộc trò chuyện mới',
  timetable: 'Lịch & Thời gian',
  goals: 'Mục tiêu',
  skills: 'Kĩ năng',
  review: 'Phản tư',
};

const AUTO_RENAME_PREFIXES = [
  'Cuộc trò chuyện mới',
  'Context ',
  'Lịch & Thời gian',
  'Mục tiêu',
  'Kĩ năng',
  'Phản tư',
];

app.get('/api/ai/chats', (_req, res) => {
  res.json({ threads: db.getChatThreads() });
});

app.post('/api/ai/chats', (req, res) => {
  const { title, contextScope } = (req.body || {}) as {
    title?: string;
    contextScope?: ChatContextScope;
  };
  const validScopes: ChatContextScope[] = ['general', 'timetable', 'goals', 'skills', 'review'];
  const scope: ChatContextScope =
    contextScope && validScopes.includes(contextScope) ? contextScope : 'general';
  const cleanTitle = title?.trim() || DEFAULT_SCOPE_TITLES[scope];
  const thread = db.createChatThread({
    id: uid('chat'),
    title: cleanTitle,
    contextScope: scope,
  });
  db.checkpointWal();
  res.json({ thread, threads: db.getChatThreads() });
});

app.patch('/api/ai/chats/:threadId', (req, res) => {
  const { title, contextScope } = (req.body || {}) as {
    title?: string;
    contextScope?: ChatContextScope;
  };
  const existing = db.getChatThreadById(req.params.threadId);
  if (!existing) {
    res.status(404).json({ error: 'Không tìm thấy phiên trò chuyện.' });
    return;
  }
  const thread = db.updateChatThread(existing.id, { title, contextScope });
  db.checkpointWal();
  res.json({ thread, threads: db.getChatThreads() });
});

app.delete('/api/ai/chats/:threadId', (req, res) => {
  db.deleteChatThread(req.params.threadId);
  db.checkpointWal();
  res.json({ threads: db.getChatThreads() });
});

// Interactive AI Advisor Consultation (Persistent Context Threads)
app.post('/api/ai/consult', async (req, res) => {
  try {
    const { prompt, threadId, contextScope, history } = req.body as AIConsultRequest;
    const cleanPrompt = prompt?.trim();
    if (!cleanPrompt) {
      res.status(400).json({ error: 'Vui lòng nhập câu hỏi hoặc yêu cầu cho The System.' });
      return;
    }

    const validScopes: ChatContextScope[] = ['general', 'timetable', 'goals', 'skills', 'review'];
    const fallbackScope: ChatContextScope =
      contextScope && validScopes.includes(contextScope) ? contextScope : 'general';

    let thread = threadId ? db.getChatThreadById(threadId) : null;
    if (!thread) {
      thread = db.createChatThread({
        id: uid('chat'),
        title: cleanPrompt.slice(0, 42),
        contextScope: fallbackScope,
      });
    } else if (
      thread.messages.length === 0 &&
      AUTO_RENAME_PREFIXES.some((prefix) => thread!.title.startsWith(prefix))
    ) {
      thread =
        db.updateChatThread(thread.id, { title: cleanPrompt.slice(0, 42) }) || thread;
    }

    const priorHistory =
      thread.messages.length > 0
        ? thread.messages.map((m) => ({ role: m.role, content: m.content }))
        : history || [];

    const userMsg: AIChatMessage = {
      id: uid('msg'),
      threadId: thread.id,
      role: 'user',
      content: cleanPrompt,
      createdAt: new Date().toISOString(),
    };
    db.addChatMessage(userMsg);
    db.checkpointWal();

    const state = buildStatePayload();
    const result = await consultSystemAI(
      cleanPrompt,
      priorHistory,
      state,
      thread.contextScope
    );

    const assistantMsg: AIChatMessage = {
      id: uid('msg'),
      threadId: thread.id,
      role: 'assistant',
      content: result.reply,
      suggestedQuests: result.suggestedQuests,
      modelUsed: result.modelUsed,
      createdAt: new Date().toISOString(),
    };
    db.addChatMessage(assistantMsg);
    db.checkpointWal();

    const updatedThread = db.getChatThreadById(thread.id) ?? undefined;
    res.json({
      ...result,
      threadId: thread.id,
      thread: updatedThread,
      threads: db.getChatThreads(),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'AI Consult failed' });
  }
});

// AI Analyze Task Draft (Stat Reasoning, Balanced Rewards & Best Free Window)
app.post('/api/quests/analyze-draft', async (req, res) => {
  try {
    const body = req.body as {
      title?: string;
      description?: string;
      durationMinutes?: number;
      type?: QuestType;
    };
    if (!body.title || !body.title.trim()) {
      res.status(400).json({ error: 'Vui lòng nhập tên việc trước khi phân tích.' });
      return;
    }
    const analysis = await analyzeTaskDraft(
      {
        title: body.title.trim(),
        description: body.description,
        durationMinutes: body.durationMinutes,
        type: body.type,
      },
      buildStatePayload()
    );
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Draft analysis failed' });
  }
});

// Live Flexible Task Session Stopwatch: Start & Pause
app.post('/api/quests/:id/start', (req, res) => {
  const quest = db.getQuestById(req.params.id);
  if (!quest) {
    res.status(404).json({ error: 'Quest not found' });
    return;
  }
  if (quest.status === 'completed') {
    res.status(400).json({ error: 'Nhiệm vụ đã hoàn thành.' });
    return;
  }

  db.runTransaction(() => {
    if (!quest.startedAt || quest.isPaused) {
      quest.startedAt = new Date().toISOString();
    }
    if (!quest.actualStartTime) {
      quest.actualStartTime = getVnTimeHHmm();
    }
    quest.isPaused = false;
    db.saveQuest(quest);
  });
  db.checkpointWal();
  res.json(buildStatePayload());
});

app.post('/api/quests/:id/pause', (req, res) => {
  const quest = db.getQuestById(req.params.id);
  if (!quest) {
    res.status(404).json({ error: 'Quest not found' });
    return;
  }
  if (quest.status === 'completed') {
    res.status(400).json({ error: 'Nhiệm vụ đã hoàn thành.' });
    return;
  }

  db.runTransaction(() => {
    if (quest.startedAt && !quest.isPaused) {
      const elapsedSec = Math.max(0, Math.round((Date.now() - Date.parse(quest.startedAt)) / 1000));
      quest.pausedAccumulatedSeconds = (quest.pausedAccumulatedSeconds || 0) + elapsedSec;
    }
    quest.startedAt = undefined;
    quest.isPaused = true;
    db.saveQuest(quest);
  });
  db.checkpointWal();
  res.json(buildStatePayload());
});

// Create Custom Manual Quest
app.post('/api/quests/custom', (req, res) => {
  const body = req.body as {
    title: string;
    description?: string;
    type?: QuestType;
    rank?: QuestRank;
    durationMinutes?: number;
    scheduledSlot?: string;
    learningMethod?: string;
    primaryStat?: AttributeKey;
    secondaryStat?: AttributeKey;
    statRewards?: Partial<Record<AttributeKey, number>>;
    skillId?: string;
    requiresProof?: boolean;
    syncToTimetable?: boolean;
  };
  if (!body.title || !body.title.trim()) {
    res.status(400).json({ error: 'Tên nhiệm vụ không được trống.' });
    return;
  }

  const title = body.title.trim();
  const dur = Math.max(10, Math.min(240, Number(body.durationMinutes) || 30));
  const statKey = body.primaryStat || 'INT';
  const qType: QuestType = body.type || 'daily';
  const qRank: QuestRank = body.rank || (dur >= 60 ? 'B' : dur >= 35 ? 'C' : 'D');
  const requiresProof = Boolean(body.requiresProof);
  const skills = db.getSkills();
  const resolvedSkillId =
    body.skillId || inferSkillIdForTask(title, body.description, statKey, skills);

  const balanced = computeBalancedQuestRewards({
    durationMinutes: dur,
    rank: qRank,
    type: qType,
    requiresProof,
    primaryStat: statKey,
    secondaryStat: body.secondaryStat,
  });

  let scheduledSlot = body.scheduledSlot?.trim() || 'Flexible Slot';
  let linkedBlockId: string | undefined;

  if (body.syncToTimetable) {
    const match = scheduledSlot.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
    let startTime = match?.[1];
    let endTime = match?.[2];
    const todayDow = getVnDayOfWeek();

    if (!startTime || !endTime) {
      const player = db.getPlayer();
      const dayAnalysis = analyzeDaySchedule(db.getTimetableBlocks(), todayDow, player.energyLevel);
      const nowMin = getVnNowMinutes();
      const futureWin = dayAnalysis.freeWindows
        .map((w) => ({
          startTime: minutesToTime(Math.max(nowMin, timeToMinutes(w.startTime))),
          endTime: w.endTime,
          durationMinutes:
            timeToMinutes(w.endTime) - Math.max(nowMin, timeToMinutes(w.startTime)),
          windowQuality: w.windowQuality,
        }))
        .filter((w) => w.durationMinutes >= 15);
      const allocated = new SlotAllocator(
        futureWin.length > 0 ? futureWin : dayAnalysis.freeWindows
      ).allocate(dur, dur >= 45);
      const allocMatch = allocated.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
      if (allocMatch) {
        startTime = allocMatch[1];
        endTime = allocMatch[2];
        scheduledSlot = `${startTime} - ${endTime}`;
      }
    }

    if (startTime && endTime) {
      linkedBlockId = uid('tt-task');
      db.saveTimetableBlock({
        id: linkedBlockId,
        dayOfWeek: todayDow,
        startTime,
        endTime,
        title,
        type: qType === 'recovery' ? 'rest_buffer' : 'fixed_habit',
        energyCost: dur >= 50 ? 'HIGH' : 'MEDIUM',
        isRecurring: false,
        notes: 'Đồng bộ từ Quick-Add Task',
      });
    }
  }

  const quest: Quest = {
    id: uid('q-custom'),
    dateKey: getVnTodayKey(),
    type: qType,
    rank: qRank,
    title,
    description: body.description?.trim() || 'Nhiệm vụ tự thiết lập bởi Player.',
    learningMethod: body.learningMethod?.trim() || 'Self-Directed Execution',
    reasoning: 'Được tạo trực tiếp bởi Player (hoặc từ phân tích AI Draft).',
    agentSource: 'ARCHITECT',
    skillId: resolvedSkillId,
    linkedBlockId,
    scheduledSlot,
    durationMinutes: dur,
    xpReward: balanced.xpReward,
    masteryReward: balanced.masteryReward,
    goldReward: balanced.goldReward,
    statRewards: body.statRewards && Object.keys(body.statRewards).length > 0 ? body.statRewards : balanced.statRewards,
    subtasks: [],
    status: 'pending',
    requiresProof,
    createdAt: new Date().toISOString(),
  };
  db.saveQuest(quest);
  db.checkpointWal();
  res.json(buildStatePayload());
});

app.delete('/api/quests/:id', (req, res) => {
  const questId = req.params.id;
  db.runTransaction(() => {
    const quest = db.getQuestById(questId);
    if (quest?.linkedBlockId) {
      db.deleteTimetableBlock(quest.linkedBlockId);
    }
    db.deleteQuest(questId);
  });
  db.checkpointWal();
  res.json(buildStatePayload());
});

// Toggle Quest Subtask
app.post('/api/quests/:id/subtask', (req, res) => {
  const quest = db.getQuestById(req.params.id);
  if (!quest) {
    res.status(404).json({ error: 'Quest not found' });
    return;
  }
  const { subtaskId } = req.body as { subtaskId: string };
  quest.subtasks = quest.subtasks.map((st) =>
    st.id === subtaskId ? { ...st, done: !st.done } : st
  );
  db.saveQuest(quest);
  res.json(buildStatePayload());
});

// Edit Quest Details
app.put('/api/quests/:id', (req, res) => {
  const quest = db.getQuestById(req.params.id);
  if (!quest) {
    res.status(404).json({ error: 'Quest not found' });
    return;
  }
  const updates = req.body as Partial<typeof quest>;
  const updated = {
    ...quest,
    title: updates.title ?? quest.title,
    description: updates.description ?? quest.description,
    scheduledSlot: updates.scheduledSlot ?? quest.scheduledSlot,
    durationMinutes: updates.durationMinutes ?? quest.durationMinutes,
  };
  db.saveQuest(updated);
  res.json(buildStatePayload());
});

// Complete Quest -> Effort XP vs Verified Mastery Progression + Daily Snapshot Recording
app.post('/api/quests/:id/complete', (req, res) => {
  const quest = db.getQuestById(req.params.id);
  if (!quest) {
    res.status(404).json({ error: 'Quest not found' });
    return;
  }
  if (quest.status === 'completed') {
    res.json({ leveledUp: false, rankPromoted: false, state: buildStatePayload() });
    return;
  }

  const { proofNote, dungeonCleared } = req.body as {
    proofNote?: string;
    dungeonCleared?: boolean;
  };

  const result = db.runTransaction(() => {
    const hasLiveStopwatch =
      Boolean(quest.startedAt) || (quest.pausedAccumulatedSeconds ?? 0) > 0;
    let effortRatio = 1.0;

    if (hasLiveStopwatch) {
      const runningSec =
        quest.startedAt && !quest.isPaused
          ? Math.max(0, Math.round((Date.now() - Date.parse(quest.startedAt)) / 1000))
          : 0;
      const totalSec = (quest.pausedAccumulatedSeconds || 0) + runningSec;
      const actualMinutes = Math.max(1, Math.round(totalSec / 60));
      quest.actualDurationMinutes = actualMinutes;
      quest.actualEndTime = getVnTimeHHmm();
      if (!quest.actualStartTime) {
        quest.actualStartTime = minutesToTime(Math.max(0, getVnNowMinutes() - actualMinutes));
      }
      quest.scheduledSlot = `${quest.actualStartTime} - ${quest.actualEndTime} (Thực tế)`;
      quest.startedAt = undefined;
      quest.isPaused = false;
      effortRatio = Math.max(
        0.5,
        Math.min(1.8, actualMinutes / Math.max(10, quest.durationMinutes || 25))
      );
    }

    const effectiveMinutes = quest.actualDurationMinutes ?? quest.durationMinutes;

    quest.status = 'completed';
    quest.completedAt = new Date().toISOString();
    quest.proofNote = proofNote?.trim() || undefined;
    quest.subtasks = quest.subtasks.map((s) => ({ ...s, done: true }));
    db.saveQuest(quest);

    const player = db.getPlayer();
    const skills = db.getSkills();
    const inventory = db.getInventory();
    const shadows = db.getShadows();
    const growthBonuses = computePlayerGrowthBonuses(player, skills, inventory, shadows);
    const equippedEffects = new Set(
      inventory.filter((i) => i.equipped).map((i) => i.effectCode)
    );
    const hasOverdrive = player.activeBuffs.includes('OVERDRIVE_1.5X');
    const hasDoubleXp = player.activeBuffs.includes('DOUBLE_XP_2X');
    const hasEspresso = player.activeBuffs.includes('ESPRESSO_FOCUS');

    const prevRank = player.rank;

    let xpMult =
      (dungeonCleared ? 1.25 + growthBonuses.focusBonusPct / 100 : 1.0) +
      growthBonuses.xpBonusPct / 100;
    if ((quest.verifiedFocusSeconds ?? 0) >= 600 && (quest.focusIntegrityPct ?? 0) >= 80) {
      xpMult += 0.15;
    }
    if (hasEspresso) xpMult += 0.15;
    if (hasOverdrive) xpMult *= 1.5;
    if (hasDoubleXp) xpMult *= 2.0;

    let goldMult = 1.0 + growthBonuses.goldBonusPct / 100;
    if (hasOverdrive) goldMult *= 1.5;

    const xpGain = Math.max(10, Math.round(quest.xpReward * effortRatio * xpMult));
    const goldGain = Math.max(8, Math.round(quest.goldReward * effortRatio * goldMult));
    let spGain =
      quest.type === 'main' || quest.type === 'hidden' || Boolean(dungeonCleared) ? 2 : 1;

    player.currentXp += xpGain;
    player.gold += goldGain;
    awardSkillPoints(player, spGain);

    if (hasOverdrive || hasDoubleXp || hasEspresso) {
      player.activeBuffs = player.activeBuffs.filter(
        (b) => b !== 'OVERDRIVE_1.5X' && b !== 'DOUBLE_XP_2X' && b !== 'ESPRESSO_FOCUS'
      );
    }

    const todayKey = getTodayKey();
    if (player.streakDays === 0 || player.lastCheckinDate !== todayKey) {
      player.streakDays += 1;
      player.lastCheckinDate = todayKey;
    }

    const leveledUp = applyLevelUps(player);

    let masteryGain = 0;
    let runestoneGain = 0;
    const hasValidProof = Boolean(proofNote && proofNote.trim().length >= 6);

    if (!quest.requiresProof || hasValidProof) {
      let mMult = 1.0 + growthBonuses.masteryBonusPct / 100;
      if (hasValidProof && !equippedEffects.has('BUFF_MASTERY_20')) {
        mMult += 0.1;
      }
      masteryGain = Math.round(quest.masteryReward * mMult);
      player.masteryScore += masteryGain;
    }

    if (hasValidProof) {
      runestoneGain = quest.type === 'hidden' || quest.type === 'main' ? 3 : 2;
      player.runestones += runestoneGain;
    } else if (quest.type === 'daily') {
      runestoneGain = 1;
      player.runestones += 1;
    }

    for (const [key, val] of Object.entries(quest.statRewards)) {
      const k = key as AttributeKey;
      if (typeof val === 'number') {
        player.stats[k] = (player.stats[k] || 0) + val;
      }
    }

    if (
      equippedEffects.has('BUFF_BONUS_STAT') &&
      (quest.type === 'main' || quest.type === 'hidden')
    ) {
      player.stats.INT += 1;
    }

    if (quest.type === 'recovery') {
      player.fatigue = Math.max(0, player.fatigue - 25);
      player.energyLevel = Math.min(100, player.energyLevel + 18);
      const recoveryHeal = Math.round(25 * (1 + growthBonuses.recoveryBonusPct / 100));
      player.hp = Math.min(player.maxHp, (player.hp ?? player.maxHp) + recoveryHeal);
      player.penaltyActive = false;
    } else {
      let fatigueDelta = Math.round(quest.durationMinutes / 10);
      if (growthBonuses.fatigueReductionPct > 0) {
        fatigueDelta = Math.max(
          1,
          Math.round(fatigueDelta * (1 - growthBonuses.fatigueReductionPct / 100))
        );
      }
      player.fatigue = Math.min(100, player.fatigue + fatigueDelta);
      if (player.fatigue < 70) {
        player.hp = Math.min(player.maxHp, (player.hp ?? player.maxHp) + 5);
      } else if (player.fatigue >= 80) {
        player.hp = Math.max(10, (player.hp ?? player.maxHp) - 6);
      }
    }

    // Passive Campaign Boss Progress targets ONLY unlocked undefeated bosses
    const bosses = db.getBosses();
    const activeBoss = bosses.find((b) => b.unlocked && !b.defeated && b.currentHp > 0);
    if (activeBoss && quest.type !== 'recovery') {
      const passiveDmg = Math.max(
        40,
        Math.round(quest.durationMinutes * 5 * (1 + growthBonuses.bossDamageBonusPct / 100))
      );
      activeBoss.currentHp = Math.max(100, activeBoss.currentHp - passiveDmg);
      db.saveBoss(activeBoss);
    }

    // Auto-progress unlocked Minion Wave stage in active unlocked Chapter
    advanceMinionWaveOnQuestComplete(player);

    // Continuous Infinite Skill Power & Small-Task Contribution
    const primaryStatForSkill =
      (Object.keys(quest.statRewards || {})[0] as AttributeKey) || 'AGI';
    const targetSkillId =
      quest.skillId ||
      inferSkillIdForTask(quest.title, quest.description, primaryStatForSkill, skills);
    let contributedSkillName: string | undefined;
    let skillPracticeXpGain = 0;

    if (targetSkillId) {
      const skill = skills.find((s) => s.id === targetSkillId);
      if (skill) {
        skillPracticeXpGain = Math.max(12, Math.round(xpGain * 0.65));
        const { bonusSp } = applyTaskContributionToSkill(skill, {
          dateKey: quest.dateKey || todayKey,
          title: quest.title,
          minutes: effectiveMinutes,
          xpAdded: skillPracticeXpGain,
        });
        if (bonusSp > 0) {
          awardSkillPoints(player, bonusSp);
          spGain += bonusSp;
        }
        db.saveSkill(skill);
        contributedSkillName = skill.name;
      }
    }

    player.rank = computeRankFromMastery(player.masteryScore);
    const rankPromoted = player.rank !== prevRank;
    db.savePlayer(player);

    db.recordDailyProgress({
      dateKey: quest.dateKey || todayKey,
      questsCompleted: 1,
      focusMinutes: effectiveMinutes,
      xpEarned: xpGain,
      masteryEarned: masteryGain,
      energyLevel: player.energyLevel,
    });

    if (quest.goalId) {
      const goals = db.getGoals();
      const goal = goals.find((g) => g.id === quest.goalId);
      if (goal) {
        goal.progress = Math.min(100, goal.progress + 5);
        db.saveGoal(goal);
      }
    }

    db.addMemoryLog({
      id: uid('log'),
      timestamp: new Date().toISOString(),
      agent: quest.agentSource,
      eventType: 'QUEST_COMPLETED',
      summary: `Hoàn thành "${quest.title}" (+${xpGain} XP, +${goldGain}G, +${spGain} SP, +${runestoneGain} Runestone)`,
      insight: proofNote
        ? `Proof-of-Work: "${proofNote.slice(0, 90)}".`
        : `Hoàn thành nhiệm vụ ${effectiveMinutes}m (${quest.scheduledSlot})${contributedSkillName ? ` · +${skillPracticeXpGain} Skill XP (${contributedSkillName})` : ''}.`,
    });

    db.addAuditLog(
      'QUEST_COMPLETED',
      `Hoàn thành Quest "${quest.title}" (+${xpGain} XP, +${spGain} SP, +${goldGain}G)`,
      {
        questId: quest.id,
        xpGain,
        masteryGain,
        goldGain,
        runestoneGain,
        spGain,
        actualDurationMinutes: quest.actualDurationMinutes,
        contributedSkillName,
        skillPracticeXpGain,
      }
    );

    return {
      leveledUp,
      rankPromoted,
      xpGain,
      masteryGain,
      goldGain,
      runestoneGain,
      spGain,
      actualDurationMinutes: quest.actualDurationMinutes,
      contributedSkillName,
      skillPracticeXpGain,
    };
  });

  db.checkpointWal();

  res.json({
    ...result,
    state: buildStatePayload(),
  });
});

// Fail / Miss Quest -> Fair HP Damage + Checkpoint Death Rollback
app.post('/api/quests/:id/fail', (req, res) => {
  const quest = db.getQuestById(req.params.id);
  if (!quest) {
    res.status(404).json({ error: 'Quest not found' });
    return;
  }
  if (quest.status !== 'pending') {
    res.json({ hpDamage: 0, died: false, state: buildStatePayload() });
    return;
  }

  const outcome = db.runTransaction(() => {
    quest.status = 'skipped';
    db.saveQuest(quest);

    const player = db.getPlayer();
    const skills = db.getSkills();
    const inventory = db.getInventory();
    const shadows = db.getShadows();
    const growthBonuses = computePlayerGrowthBonuses(player, skills, inventory, shadows);

    const hpDamage = player.plannedRestMode
      ? 0
      : computeQuestMissDamage(quest, growthBonuses.fatigueReductionPct);

    let died = false;
    let deathReport: DeathReport | undefined;

    if (hpDamage > 0) {
      player.hp = Math.max(0, (player.hp ?? player.maxHp) - hpDamage);
      if (player.hp <= 0) {
        died = true;
        deathReport = triggerPlayerDeathAndCheckpointRollback(
          player,
          [{ title: quest.title, type: quest.type, hpDamage }],
          hpDamage
        );
      }
    }

    db.savePlayer(player);

    db.addAuditLog(
      'QUEST_FAILED_DAMAGE',
      `Bỏ lỡ "${quest.title}" (-${hpDamage} HP${player.plannedRestMode ? ' · Grace Day' : ''})`,
      { questId: quest.id, type: quest.type, rank: quest.rank, hpDamage, died }
    );

    return { hpDamage, died, deathReport };
  });

  res.json({
    ...outcome,
    state: buildStatePayload(),
  });
});

// Reject / Reroll Quest -> Adaptive Replacement
app.post('/api/quests/:id/reject', async (req, res) => {
  try {
    const quest = db.getQuestById(req.params.id);
    if (!quest) {
      res.status(404).json({ error: 'Quest not found' });
      return;
    }

    const { reason } = req.body as { reason: RejectionReason };
    quest.status = 'rejected';
    quest.rejectionReason = reason || 'not_relevant';
    db.saveQuest(quest);

    db.addMemoryLog({
      id: uid('log'),
      timestamp: new Date().toISOString(),
      agent: 'ARCHITECT',
      eventType: 'QUEST_REJECTED',
      summary: `Player từ chối "${quest.title}" (Lý do: ${reason})`,
      insight: `Ghi nhận adaptive telemetry: reason=${reason}, duration=${quest.durationMinutes}m.`,
    });

    const player = db.getPlayer();
    if (reason === 'low_energy') {
      player.energyLevel = Math.min(player.energyLevel, 45);
      db.savePlayer(player);
    }

    const goals = db.getGoals();
    const timetable = db.getTimetableBlocks();
    const skills = db.getSkills();
    const memoryLogs = db.getMemoryLogs(15);
    const aiSettings = db.getAISettings();
    const dayDow = getVnDayOfWeekFromDateKey(quest.dateKey);
    const dayAnalysis = analyzeDaySchedule(timetable, dayDow, player.energyLevel);

    const { quests: candidates } = await runMultiAgentOrchestration(
      player,
      goals,
      dayAnalysis,
      skills,
      memoryLogs,
      aiSettings,
      {
        dateKey: quest.dateKey,
        rejectedContext: { questTitle: quest.title, reason },
      }
    );

    const replacement = candidates.find((c) => c.title !== quest.title) || candidates[0];
    if (replacement) {
      replacement.scheduledSlot = quest.scheduledSlot;
      replacement.reasoning = `[REROLL ADAPTIVE] Đã thay thế nhiệm vụ trước dựa trên lý do "${reason}". ${replacement.reasoning}`;
      db.saveQuest(replacement);
    }

    res.json(buildStatePayload());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Quest reroll failed' });
  }
});

// Boss Stage Verification (Gate-Locked Chapter Progression)
app.post('/api/bosses/:bossId/stages/:stageId/verify', (req, res) => {
  const bosses = db.getBosses();
  const boss = bosses.find((b) => b.id === req.params.bossId);
  if (!boss) {
    res.status(404).json({ error: 'Boss not found' });
    return;
  }

  if (!boss.unlocked) {
    const chapters = db.getChapters();
    const ch = boss.chapterId ? chapters.find((c) => c.id === boss.chapterId) : undefined;
    const msg =
      boss.bossRole === 'chapter_boss' && ch
        ? `Phong ấn "${boss.title}" chưa mở: hãy hạ toàn bộ Mini-Boss của Chương ${ch.chapterNumber} trước.`
        : `"${boss.title}" đang bị khóa: cần hoàn thành Chương trước để mở khóa.`;
    res.status(400).json({ error: msg });
    return;
  }

  const { proofText } = req.body as { proofText: string };
  if (!proofText || proofText.trim().length < 5) {
    res.status(400).json({ error: 'Cần nhập bằng chứng thực tế tối thiểu 5 ký tự để tấn công Boss.' });
    return;
  }

  const stage = boss.stages.find((s) => s.id === req.params.stageId);
  if (!stage) {
    res.status(404).json({ error: 'Stage not found' });
    return;
  }
  if (stage.completed) {
    res.json({ bossDefeated: boss.defeated, state: buildStatePayload() });
    return;
  }

  const outcome = db.runTransaction(() => {
    stage.completed = true;
    stage.proofText = proofText.trim();
    boss.currentHp = Math.max(0, boss.currentHp - stage.hpDamage);

    const player = db.getPlayer();
    player.masteryScore += 85;
    player.currentXp += 180;
    player.runestones += 10;
    player.gold += 120;
    awardSkillPoints(player, 2);
    applyLevelUps(player);

    let bossDefeatedNow = false;
    let unlockedChapterBossTitle: string | undefined;
    let unlockedChapterTitle: string | undefined;

    if (boss.stages.every((s) => s.completed) || boss.currentHp === 0) {
      boss.currentHp = 0;
    }

    db.addAuditLog('BOSS_STRIKE', `Tấn công ${boss.title} (-${stage.hpDamage} HP, +2 SP)`, {
      bossId: boss.id,
      stageId: stage.id,
      damage: stage.hpDamage,
      bossDefeated: boss.currentHp === 0,
    });

    if (boss.currentHp === 0 && !boss.defeated) {
      bossDefeatedNow = true;
      const defeatRes = finalizeBossDefeat(boss, player);
      unlockedChapterBossTitle = defeatRes.unlockedChapterBossTitle;
      unlockedChapterTitle = defeatRes.unlockedChapterTitle;
    } else {
      db.saveBoss(boss);
    }

    player.rank = computeRankFromMastery(player.masteryScore);
    db.savePlayer(player);

    db.recordDailyProgress({
      dateKey: getTodayKey(),
      xpEarned: 180,
      masteryEarned: bossDefeatedNow ? 85 + boss.rewardMastery : 85,
      energyLevel: player.energyLevel,
    });

    db.addMemoryLog({
      id: uid('log'),
      timestamp: new Date().toISOString(),
      agent: 'STRATEGIST',
      eventType: 'BOSS_VERIFIED',
      summary: `Gây ${stage.hpDamage} DMG lên Boss "${boss.title}"`,
      insight: `Proof verified: "${proofText.trim().slice(0, 100)}"${bossDefeatedNow ? ' — BOSS DEFEATED!' : ''}`,
    });

    return { bossDefeatedNow, unlockedChapterBossTitle, unlockedChapterTitle };
  });

  res.json({
    bossDefeated: outcome.bossDefeatedNow,
    unlockedChapterBossTitle: outcome.unlockedChapterBossTitle,
    unlockedChapterTitle: outcome.unlockedChapterTitle,
    state: buildStatePayload(),
  });
});

// ==================== DUAL-GATE + INFINITE ASCENSION SKILL TREE ====================
app.post('/api/skills/:id/unlock', (req, res) => {
  const skills = db.getSkills();
  const skill = skills.find((s) => s.id === req.params.id);
  if (!skill) {
    res.status(404).json({ error: 'Không tìm thấy nút kỹ năng.' });
    return;
  }

  const player = db.getPlayer();

  if (!skill.unlocked) {
    if (!areSkillPrerequisitesMet(skill, skills)) {
      const minLv = skill.minPrereqLevel ?? 1;
      res.status(400).json({
        error: `Chưa đạt điều kiện mở khóa: cần nâng cấp ít nhất Lv.${minLv} cho kỹ năng tiền đề trước.`,
      });
      return;
    }

    const spCost = computeUnlockOrAscendSpCost(skill);
    if ((player.skillPoints ?? 0) < spCost) {
      res.status(400).json({
        error: `Chưa đủ Điểm Kĩ Năng (cần ${spCost} SP, hiện có ${player.skillPoints ?? 0} SP). Hãy hoàn thành Quest hoặc Boss để tích SP!`,
      });
      return;
    }

    db.runTransaction(() => {
      player.skillPoints -= spCost;
      skill.unlocked = true;
      skill.ascensionTier = 1;
      skill.unlockedRankCap = 5;
      skill.maxTier = 5;
      db.saveSkill(skill);
      db.savePlayer(player);
      db.addAuditLog(
        'SKILL_UNLOCKED',
        `Mở khóa nâng cấp "${skill.name}" (Lv.1–5, -${spCost} SP)`,
        { skillId: skill.id, spCost, ascensionTier: 1, unlockedRankCap: 5 }
      );
    });

    res.json(buildStatePayload());
    return;
  }

  const currentCap = skill.unlockedRankCap ?? 5;
  if (skill.masteryTier < currentCap) {
    res.status(400).json({
      error: `Hãy nâng cấp "${skill.name}" bằng Gold/Runestones lên tới Lv.${currentCap} trước khi Phá Giới Hạn tiếp.`,
    });
    return;
  }

  const ascCost = computeUnlockOrAscendSpCost(skill);
  if ((player.skillPoints ?? 0) < ascCost) {
    res.status(400).json({
      error: `Chưa đủ SP để Phá Giới Hạn Vô Cực (cần ${ascCost} SP, hiện có ${player.skillPoints ?? 0} SP).`,
    });
    return;
  }

  db.runTransaction(() => {
    player.skillPoints -= ascCost;
    skill.ascensionTier = (skill.ascensionTier ?? 1) + 1;
    skill.unlockedRankCap = currentCap + 5;
    skill.maxTier = skill.unlockedRankCap;
    db.saveSkill(skill);
    db.savePlayer(player);
    db.addAuditLog(
      'SKILL_ASCENDED',
      `Phá Giới Hạn "${skill.name}" lên Bậc ${skill.ascensionTier} (Trần Lv.${skill.unlockedRankCap}, -${ascCost} SP)`,
      {
        skillId: skill.id,
        ascCost,
        ascensionTier: skill.ascensionTier,
        unlockedRankCap: skill.unlockedRankCap,
      }
    );
  });

  res.json(buildStatePayload());
});

app.post('/api/skills/:id/upgrade', (req, res) => {
  const skills = db.getSkills();
  const skill = skills.find((s) => s.id === req.params.id);
  if (!skill) {
    res.status(404).json({ error: 'Không tìm thấy nút kỹ năng.' });
    return;
  }
  if (!skill.unlocked) {
    res.status(400).json({
      error: `Kỹ năng "${skill.name}" chưa được mở khóa! Hãy dùng ${skill.unlockSpCost ?? 1} Điểm Kĩ Năng (SP) để mở nâng cấp trước.`,
    });
    return;
  }
  const rankCap = skill.unlockedRankCap ?? 5;
  if (skill.masteryTier >= rankCap) {
    const ascCost = computeUnlockOrAscendSpCost(skill);
    res.status(400).json({
      error: `"${skill.name}" đã chạm trần Lv.${rankCap}. Hãy dùng ${ascCost} SP để Phá Giới Hạn +5 Cấp!`,
    });
    return;
  }

  const cost = computeSkillUpgradeCost(skill);
  const player = db.getPlayer();
  if (player.gold < cost.gold) {
    res.status(400).json({
      error: `Không đủ Gold để nâng cấp (cần ${cost.gold} G, hiện có ${player.gold} G).`,
    });
    return;
  }
  if (player.runestones < cost.runestones) {
    res.status(400).json({
      error: `Không đủ Runestones để nâng cấp (cần ${cost.runestones} 💎, hiện có ${player.runestones} 💎).`,
    });
    return;
  }

  db.runTransaction(() => {
    player.gold -= cost.gold;
    player.runestones -= cost.runestones;
    skill.masteryTier += 1;
    db.saveSkill(skill);

    const statGain = skill.masteryTier <= 5 ? 2 : 1;
    player.stats[skill.primaryStat] = (player.stats[skill.primaryStat] || 10) + statGain;
    player.masteryScore += 25;
    const newMaxHp = computePlayerMaxHp(player, db.getSkills());
    const hpDelta = Math.max(0, newMaxHp - (player.maxHp || 100));
    player.maxHp = newMaxHp;
    if (hpDelta > 0) {
      player.hp = Math.min(newMaxHp, (player.hp ?? 100) + hpDelta);
    }
    db.savePlayer(player);

    db.addAuditLog(
      'SKILL_UPGRADED',
      `Nâng cấp "${skill.name}" lên Lv.${skill.masteryTier}/${rankCap} (-${cost.gold}G${cost.runestones > 0 ? `, -${cost.runestones}💎` : ''})`,
      { skillId: skill.id, level: skill.masteryTier, goldCost: cost.gold, runestoneCost: cost.runestones }
    );
  });

  res.json(buildStatePayload());
});

app.post('/api/skills/respec', (_req, res) => {
  const skills = db.getSkills();
  const refund = computeSkillSpentResources(skills);
  if (refund.spentSp === 0 && refund.spentGold === 0 && refund.spentRunestones === 0) {
    res.status(400).json({ error: 'Cây Kĩ Năng chưa có điểm nào để tẩy.' });
    return;
  }

  db.runTransaction(() => {
    const player = db.getPlayer();
    for (const sk of skills) {
      if (!sk.treeBranch) continue;
      sk.unlocked = false;
      sk.ascensionTier = 0;
      sk.unlockedRankCap = 0;
      sk.masteryTier = 0;
      sk.maxTier = 5;
      db.saveSkill(sk);
    }
    player.skillPoints = (player.skillPoints || 0) + refund.spentSp;
    player.gold += refund.spentGold;
    player.runestones += refund.spentRunestones;
    player.masteryScore = Math.max(0, player.masteryScore - refund.masteryRefund);
    for (const [statKey, amount] of Object.entries(refund.statRefunds)) {
      const k = statKey as AttributeKey;
      player.stats[k] = Math.max(10, (player.stats[k] || 10) - amount);
    }
    const newMax = computePlayerMaxHp(player, db.getSkills());
    player.maxHp = newMax;
    player.hp = Math.min(player.hp, newMax);
    db.savePlayer(player);

    db.addAuditLog(
      'SKILL_RESPEC',
      `Tẩy Cây Kĩ Năng: hoàn trả +${refund.spentSp} SP, +${refund.spentGold}G, +${refund.spentRunestones}💎`,
      refund
    );
  });

  res.json(buildStatePayload());
});

// Verify Skill Mastery Tier Upgrade (Legacy / Custom goal skills)
app.post('/api/skills/:id/verify', (req, res) => {
  const skills = db.getSkills();
  const skill = skills.find((s) => s.id === req.params.id);
  if (!skill) {
    res.status(404).json({ error: 'Skill not found' });
    return;
  }
  const { proofNote } = req.body as { proofNote: string };
  if (!proofNote || proofNote.trim().length < 5) {
    res.status(400).json({ error: 'Vui lòng mô tả bằng chứng kiểm chứng kỹ năng.' });
    return;
  }

  db.runTransaction(() => {
    if (skill.masteryTier < skill.maxTier) {
      skill.masteryTier += 1;
      skill.practiceXp = Math.max(0, skill.practiceXp - skill.xpPerTier);
      db.saveSkill(skill);

      const player = db.getPlayer();
      player.masteryScore += 60;
      player.runestones += 8;
      player.gold += 100;
      player.stats[skill.primaryStat] = (player.stats[skill.primaryStat] || 0) + 3;
      player.rank = computeRankFromMastery(player.masteryScore);
      db.savePlayer(player);

      db.recordDailyProgress({
        dateKey: getTodayKey(),
        masteryEarned: 60,
        energyLevel: player.energyLevel,
      });

      db.addMemoryLog({
        id: uid('log'),
        timestamp: new Date().toISOString(),
        agent: 'SCHOLAR',
        eventType: 'BOSS_VERIFIED',
        summary: `Nâng cấp Mastery kỹ năng "${skill.name}" lên Tier ${skill.masteryTier}`,
        insight: `Proof: ${proofNote.trim().slice(0, 100)}`,
      });

      db.addAuditLog(
        'SKILL_VERIFIED',
        `Nâng cấp "${skill.name}" lên Tier ${skill.masteryTier} (+3 ${skill.primaryStat})`,
        { skillId: skill.id, tier: skill.masteryTier, primaryStat: skill.primaryStat }
      );
    }
  });

  res.json(buildStatePayload());
});

// Summon Shadow Soldier
app.post('/api/shadows/:id/summon', (req, res) => {
  const shadows = db.getShadows();
  const shadow = shadows.find((s) => s.id === req.params.id);
  if (!shadow) {
    res.status(404).json({ error: 'Shadow Soldier not found' });
    return;
  }

  shadow.summonCount += 1;
  db.saveShadow(shadow);

  const todayKey = getTodayKey();
  db.saveQuest({
    id: uid('q-sh'),
    dateKey: todayKey,
    type: 'side',
    rank: shadow.rank,
    title: `[ARISE // ${shadow.name}] ${shadow.routineTitle}`,
    description: shadow.routineDescription,
    learningMethod: 'Shadow Automation Routine',
    reasoning: `Triệu hồi Shadow Soldier "${shadow.name}" để kích hoạt buff: ${shadow.passiveBuff}`,
    agentSource: 'ARCHITECT',
    scheduledSlot: 'Flexible Shadow Slot',
    durationMinutes: shadow.routineDurationMinutes,
    xpReward: 70,
    masteryReward: 15,
    goldReward: 50,
    statRewards: shadow.statBonus,
    subtasks: [
      { id: uid('sh-sub-1'), label: 'Thực hiện giao thức tự động hóa cùng Shadow', done: false },
    ],
    status: 'pending',
    requiresProof: false,
    createdAt: new Date().toISOString(),
  });

  res.json(buildStatePayload());
});

// Shop & Inventory Economy
app.post('/api/shop/buy', (req, res) => {
  const { itemId } = req.body as { itemId: string };
  const item = db.getShopItems().find((i) => i.id === itemId);
  if (!item) {
    res.status(404).json({ error: 'Vật phẩm không tồn tại.' });
    return;
  }

  const player = db.getPlayer();
  if (item.currency === 'gold' && player.gold < item.price) {
    res.status(400).json({ error: `Không đủ Gold (cần ${item.price} G, hiện có ${player.gold} G).` });
    return;
  }
  if (item.currency === 'runestones' && player.runestones < item.price) {
    res.status(400).json({ error: `Không đủ Runestones (cần ${item.price} 💎, hiện có ${player.runestones} 💎).` });
    return;
  }

  const inventory = db.getInventory();
  const existingInv = inventory.find((inv) => inv.itemId === item.id);
  if (item.category === 'artifact' && existingInv) {
    res.status(400).json({ error: 'Bạn đã sở hữu trang bị này rồi.' });
    return;
  }

  db.runTransaction(() => {
    if (item.currency === 'gold') {
      player.gold -= item.price;
    } else {
      player.runestones -= item.price;
    }

    if (existingInv) {
      existingInv.quantity += 1;
      db.saveInventoryItem(existingInv);
    } else {
      const slotOccupied =
        item.category === 'artifact' &&
        Boolean(item.slot) &&
        inventory.some((inv) => inv.equipped && inv.slot === item.slot);
      const shouldAutoEquip = item.category === 'artifact' && !slotOccupied;
      db.saveInventoryItem({
        id: uid('inv'),
        itemId: item.id,
        name: item.name,
        description: item.description,
        category: item.category,
        effectCode: item.effectCode,
        effectLabel: item.effectLabel,
        rarity: item.rarity,
        slot: item.slot,
        iconKey: item.iconKey,
        statFocus: item.statFocus,
        quantity: 1,
        equipped: shouldAutoEquip,
        acquiredAt: getTodayKey(),
      });
    }

    player.equippedArtifactIds = db
      .getInventory()
      .filter((i) => i.equipped)
      .map((i) => i.itemId);
    db.savePlayer(player);
    db.addMemoryLog({
      id: uid('log'),
      timestamp: new Date().toISOString(),
      agent: 'ARCHITECT',
      eventType: 'ORCHESTRATION',
      summary: `Mua vật phẩm "${item.name}" (${item.price} ${item.currency === 'gold' ? 'G' : 'Runestones'})`,
      insight: `Đã thêm vào Kho đồ: ${item.effectLabel}.`,
    });
    db.addAuditLog(
      'SHOP_PURCHASE',
      `Mua "${item.name}" (${item.price} ${item.currency === 'gold' ? 'G' : 'Runestones'})`,
      { itemId: item.id, price: item.price, currency: item.currency }
    );
  });

  db.checkpointWal();
  res.json(buildStatePayload());
});

app.post('/api/shop/custom', (req, res) => {
  const { name, description, currency, price, iconKey, rarity } = req.body as {
    name: string;
    description?: string;
    currency: 'gold' | 'runestones';
    price: number;
    iconKey?: string;
    rarity?: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';
  };
  if (!name || !name.trim() || !price || price < 1) {
    res.status(400).json({ error: 'Tên phần thưởng và giá phải hợp lệ.' });
    return;
  }
  db.saveShopItem({
    id: uid('item-custom'),
    name: name.trim(),
    description: description?.trim() || 'Phần thưởng tự thiết lập để tự động viên sau chuỗi ngày nỗ lực.',
    lore: 'Phần thưởng cá nhân giúp duy trì dopamine lành mạnh và kỷ luật bền vững.',
    category: 'real_reward',
    currency: currency === 'runestones' ? 'runestones' : 'gold',
    price: Math.round(price),
    effectCode: 'REDEEM_VOUCHER',
    effectLabel: 'Phần thưởng cá nhân ngoài đời',
    iconKey: iconKey?.trim() || 'gift_box',
    rarity: rarity || 'RARE',
    isCustom: true,
  });
  db.checkpointWal();
  res.json(buildStatePayload());
});

app.delete('/api/shop/custom/:id', (req, res) => {
  const item = db.getShopItems().find((i) => i.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: 'Không tìm thấy phần thưởng.' });
    return;
  }
  if (!item.isCustom) {
    res.status(400).json({ error: 'Không thể xóa vật phẩm mặc định của Hệ thống.' });
    return;
  }
  db.deleteShopItem(item.id);
  db.checkpointWal();
  res.json(buildStatePayload());
});

app.post('/api/inventory/use', (req, res) => {
  const { inventoryId } = req.body as { inventoryId: string };
  const inv = db.getInventory().find((i) => i.id === inventoryId);
  if (!inv) {
    res.status(404).json({ error: 'Không tìm thấy vật phẩm trong kho.' });
    return;
  }

  const message = db.runTransaction(() => {
    const player = db.getPlayer();
    let msg = '';

    if (inv.category === 'artifact') {
      const nextEquipped = !inv.equipped;
      let swappedName: string | null = null;
      if (nextEquipped && inv.slot) {
        for (const other of db.getInventory()) {
          if (other.id !== inv.id && other.equipped && other.slot === inv.slot) {
            other.equipped = false;
            db.saveInventoryItem(other);
            swappedName = other.name;
          }
        }
      }
      inv.equipped = nextEquipped;
      db.saveInventoryItem(inv);
      player.equippedArtifactIds = db
        .getInventory()
        .filter((i) => i.equipped)
        .map((i) => i.itemId);
      db.savePlayer(player);
      msg = inv.equipped
        ? swappedName
          ? `Đã trang bị "${inv.name}" (thay cho "${swappedName}").`
          : `Đã trang bị "${inv.name}" (${inv.effectLabel}).`
        : `Đã tháo trang bị "${inv.name}".`;
    } else {
      if (inv.effectCode === 'USE_HYDRATION') {
        player.hp = Math.min(player.maxHp, (player.hp ?? player.maxHp) + 15);
        player.energyLevel = Math.min(100, player.energyLevel + 15);
        player.fatigue = Math.max(0, player.fatigue - 10);
        msg = 'Đã uống Bình Nước Điện Giải: +15 HP, +15% Energy & -10% Fatigue!';
      } else if (inv.effectCode === 'USE_ESPRESSO') {
        player.energyLevel = Math.min(100, player.energyLevel + 20);
        if (!player.activeBuffs.includes('ESPRESSO_FOCUS')) {
          player.activeBuffs.push('ESPRESSO_FOCUS');
        }
        msg = 'Đã dùng Espresso: +20% Energy & +15% XP cho Quest tiếp theo!';
      } else if (inv.effectCode === 'USE_ELIXIR') {
        player.hp = Math.min(player.maxHp, (player.hp ?? player.maxHp) + 40);
        player.energyLevel = Math.min(100, player.energyLevel + 25);
        player.fatigue = Math.max(0, player.fatigue - 30);
        msg = 'Đã dùng Elixir NSDR: +40 HP, +25% Energy và -30% Fatigue!';
      } else if (inv.effectCode === 'USE_FULL_RESTORE') {
        player.hp = player.maxHp;
        player.energyLevel = 100;
        player.fatigue = 0;
        player.penaltyActive = false;
        msg = 'Linh Dược Phượng Hoàng: Hồi đầy 100% HP & Energy, xóa sạch Fatigue!';
      } else if (inv.effectCode === 'USE_OVERDRIVE') {
        if (!player.activeBuffs.includes('OVERDRIVE_1.5X')) {
          player.activeBuffs.push('OVERDRIVE_1.5X');
        }
        msg = 'Đã kích hoạt Overdrive: Quest kế tiếp nhận x1.5 XP & Gold!';
      } else if (inv.effectCode === 'USE_DOUBLE_XP') {
        if (!player.activeBuffs.includes('DOUBLE_XP_2X')) {
          player.activeBuffs.push('DOUBLE_XP_2X');
        }
        msg = 'Đã kích hoạt Tinh Thể Siêu Tập Trung: x2.0 XP Quest kế tiếp!';
      } else if (inv.effectCode === 'USE_HIDDEN_SCROLL') {
        db.saveQuest({
          id: uid('q-scroll'),
          dateKey: getTodayKey(),
          type: 'hidden',
          rank: 'A',
          title: '[HIDDEN SCROLL] Phiên Tăng Tốc Sâu 45 Phút',
          description: 'Mở khóa từ Cuộn Hidden Quest: chọn kỹ năng quan trọng nhất lúc này và thực hiện 45 phút tập trung có đầu ra kiểm chứng.',
          learningMethod: 'Deep Work + Proof Verification',
          reasoning: 'Được kích hoạt từ vật phẩm Cuộn Triệu Hồi Hidden Quest.',
          agentSource: 'ARCHITECT',
          scheduledSlot: 'Flexible Bonus Slot',
          durationMinutes: 45,
          xpReward: 150,
          masteryReward: 30,
          goldReward: 110,
          statRewards: { INT: 2, PER: 1, AGI: 1 },
          subtasks: [
            { id: uid('sc-1'), label: 'Hoàn thành 45 phút tập trung cao độ', done: false },
            { id: uid('sc-2'), label: 'Ghi chú lại bằng chứng kết quả', done: false },
          ],
          status: 'pending',
          requiresProof: true,
          createdAt: new Date().toISOString(),
        });
        msg = 'Đã mở khóa 1 Hidden Quest mới trong tab Hôm Nay!';
      } else if (inv.effectCode === 'USE_RAID_SCROLL') {
        db.saveQuest({
          id: uid('q-raid'),
          dateKey: getTodayKey(),
          type: 'hidden',
          rank: 'S',
          title: '[RAID SPRINT] Đột Phá 60 Phút Không Khoan Nhượng',
          description: 'Mở khóa từ Ấn Ký Phá Giáp Boss: dồn toàn lực 60 phút cho đầu việc quan trọng nhất để bứt phá cột mốc.',
          learningMethod: 'Ultradian Raid Sprint',
          reasoning: 'Kích hoạt từ Ấn Ký Phá Giáp Boss trong Kho đồ.',
          agentSource: 'ARCHITECT',
          scheduledSlot: 'Flexible Raid Slot',
          durationMinutes: 60,
          xpReward: 220,
          masteryReward: 45,
          goldReward: 160,
          statRewards: { INT: 2, STR: 1, AGI: 2 },
          subtasks: [
            { id: uid('rs-1'), label: 'Tắt toàn bộ thiết bị gây xao nhãng trong 60 phút', done: false },
            { id: uid('rs-2'), label: 'Xuất ra 1 sản phẩm / kết quả kiểm chứng được', done: false },
          ],
          status: 'pending',
          requiresProof: true,
          createdAt: new Date().toISOString(),
        });
        msg = 'Đã triệu hồi Raid Sprint 60p Rank S trong tab Hôm Nay!';
      } else if (inv.effectCode === 'USE_GRACE_SHIELD') {
        player.plannedRestMode = true;
        player.hp = Math.min(player.maxHp, (player.hp ?? player.maxHp) + 25);
        msg = 'Khiên Bảo Hộ đã bật Nghỉ Chủ Động hôm nay & hồi +25 HP!';
      } else if (inv.effectCode === 'USE_SP_SHARD') {
        awardSkillPoints(player, 1);
        player.masteryScore += 30;
        msg = 'Hấp thụ Mảnh Tinh Hoa: +1 Điểm Kĩ Năng (SP) & +30 Mastery!';
      } else {
        msg = `Đã sử dụng phần thưởng "${inv.name}" — Hãy tận hưởng thành quả xứng đáng của bạn!`;
      }

      if (inv.quantity <= 1) {
        db.deleteInventoryItem(inv.id);
      } else {
        inv.quantity -= 1;
        db.saveInventoryItem(inv);
      }
      db.savePlayer(player);
    }

    db.addAuditLog('ITEM_USED', msg, { inventoryId: inv.id, itemId: inv.itemId, effectCode: inv.effectCode });
    return msg;
  });

  db.checkpointWal();
  res.json({ message, state: buildStatePayload() });
});

// AI Settings, Connection Test & Model List
app.put('/api/settings/ai', (req, res) => {
  const body = req.body as Partial<AISettings>;
  const current = db.getAISettings();
  const updated: AISettings = {
    ...current,
    ...body,
  };
  db.saveAISettings(updated);
  res.json(buildStatePayload());
});

app.post('/api/settings/ai/test', async (req, res) => {
  const settings = req.body as AISettings;
  const result = await testLlmConnection(settings);
  res.json(result);
});

app.post('/api/settings/ai/models', async (req, res) => {
  const settings = req.body as AISettings;
  const result = await listProviderModels(settings);
  res.json(result);
});

app.get('/api/system/export', (_req, res) => {
  res.json(db.exportSnapshot());
});

app.post('/api/system/import', (req, res) => {
  try {
    db.importSnapshot(req.body as Record<string, any>);
    res.json(buildStatePayload());
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Import failed' });
  }
});

app.post('/api/system/reset', (req, res) => {
  const { mode, clearChats } = (req.body || {}) as {
    mode?: SystemResetMode;
    clearChats?: boolean;
  };
  const resolvedMode: SystemResetMode =
    mode === 'progress' ? 'progress' : mode === 'sample' ? 'sample' : 'clean';
  db.resetAll(resolvedMode, { clearChats: Boolean(clearChats) });
  res.json(buildStatePayload());
});

// ==================== SMART PC AUTO-START, TRACKER & PROACTIVE ASSISTANT ====================
app.get('/api/assistant/overview', (_req, res) => {
  res.json(assistantDaemon.getOverview(buildStatePayload()));
});

app.put('/api/assistant/settings', (req, res) => {
  const patch = (req.body || {}) as Partial<AssistantSettings>;
  const current = db.getAssistantSettings();
  const updated = db.saveAssistantSettings({
    ...current,
    ...patch,
    customRules: Array.isArray(patch.customRules) ? patch.customRules : current.customRules,
  });
  desktopTracker.restartIfEnabled();
  db.checkpointWal();
  res.json({
    ...assistantDaemon.getOverview(buildStatePayload()),
    settings: updated,
  });
});

app.post('/api/assistant/tracker/toggle', (req, res) => {
  const { enabled } = (req.body || {}) as { enabled?: boolean };
  const current = db.getAssistantSettings();
  const nextEnabled = typeof enabled === 'boolean' ? enabled : !current.trackerEnabled;
  db.saveAssistantSettings({ ...current, trackerEnabled: nextEnabled });
  if (nextEnabled) {
    desktopTracker.start();
  } else {
    desktopTracker.stop();
  }
  db.checkpointWal();
  res.json(assistantDaemon.getOverview(buildStatePayload()));
});

app.post('/api/assistant/startup/install', async (req, res) => {
  try {
    const opts = (req.body || {}) as {
      createDesktopShortcut?: boolean;
      launchTray?: boolean;
    };
    const result = await installWindowsStartup(opts);
    res.json({
      ok: result.ok,
      message: result.message,
      overview: assistantDaemon.getOverview(buildStatePayload()),
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Không thể cài Tự khởi động cùng Windows.',
    });
  }
});

app.post('/api/assistant/startup/uninstall', async (req, res) => {
  try {
    const opts = (req.body || {}) as { removeDesktopShortcut?: boolean };
    const result = await uninstallWindowsStartup(opts);
    res.json({
      ok: result.ok,
      message: result.message,
      overview: assistantDaemon.getOverview(buildStatePayload()),
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Không thể gỡ Tự khởi động cùng Windows.',
    });
  }
});

app.post('/api/assistant/tray/launch', (_req, res) => {
  try {
    res.json(launchSystemTray());
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Không thể khởi chạy Khay Hệ Thống.',
    });
  }
});

app.post('/api/assistant/test-notification', async (_req, res) => {
  const result = await assistantDaemon.sendTestNotification();
  res.json({
    ok: result.ok,
    message: result.message,
    overview: assistantDaemon.getOverview(buildStatePayload()),
  });
});

app.post('/api/assistant/nudge/:id/dismiss', (req, res) => {
  db.dismissAssistantNudge(req.params.id);
  db.checkpointWal();
  res.json(assistantDaemon.getOverview(buildStatePayload()));
});

app.post('/api/assistant/activity/sync-skill', (_req, res) => {
  const syncRes = assistantDaemon.creditUncreditedFocusToSkills();
  const state = buildStatePayload();
  const overview = assistantDaemon.getOverview(state);
  res.json({
    ...syncRes,
    overview,
    state,
  });
});

app.post('/api/assistant/activity/record-sample', (req, res) => {
  const body = (req.body || {}) as {
    processName?: string;
    windowTitle?: string;
    durationSeconds?: number;
    isIdle?: boolean;
  };
  if (!body.processName) {
    res.status(400).json({ error: 'processName is required' });
    return;
  }
  desktopTracker.recordSample({
    processName: body.processName,
    windowTitle: body.windowTitle || '',
    durationSeconds: body.durationSeconds,
    isIdle: body.isIdle,
  });
  db.checkpointWal();
  res.json(assistantDaemon.getOverview(buildStatePayload()));
});

app.post('/api/assistant/activity/reclassify', (req, res) => {
  const { keyword, category, retroactive } = (req.body || {}) as {
    keyword?: string;
    category?: Exclude<ActivityCategory, 'idle'>;
    retroactive?: boolean;
  };

  const cleanKw = (keyword || '').trim().toLowerCase();
  const validCategories: Array<Exclude<ActivityCategory, 'idle'>> = [
    'deep_work',
    'study_research',
    'communication',
    'distraction',
    'other',
  ];
  if (!cleanKw || !category || !validCategories.includes(category)) {
    res.status(400).json({ error: 'Cần nhập từ khóa và nhóm phân loại hợp lệ.' });
    return;
  }

  const current = db.getAssistantSettings();
  const filteredRules = current.customRules.filter(
    (r) => r.keyword.trim().toLowerCase() !== cleanKw
  );
  const nextRules = [{ id: uid('rule'), keyword: cleanKw, category }, ...filteredRules];
  db.saveAssistantSettings({ ...current, customRules: nextRules });

  let updatedRows = 0;
  if (retroactive !== false) {
    updatedRows = db.reclassifyTodayActivityLogs(cleanKw, category, getVnTodayKey());
  }

  db.checkpointWal();

  const overview = assistantDaemon.getOverview(buildStatePayload());
  res.json({
    ok: true,
    updatedRows,
    message: `Đã phân loại "${cleanKw}" → ${category}${updatedRows > 0 ? ` (cập nhật ${updatedRows} bản ghi hôm nay)` : ''}.`,
    overview,
  });
});

app.post('/api/assistant/activity/convert-to-quest', (req, res) => {
  const body = (req.body || {}) as {
    mode?: 'complete_new' | 'credit_pending';
    title?: string;
    questId?: string;
    primaryStat?: AttributeKey;
  };
  const mode = body.mode === 'credit_pending' ? 'credit_pending' : 'complete_new';
  const dateKey = getVnTodayKey();
  const focusLogs = db
    .getActivityLogsByDate(dateKey)
    .filter(
      (l) => !l.creditedToSkill && (l.category === 'deep_work' || l.category === 'study_research')
    );

  const totalSec = focusLogs.reduce((acc, l) => acc + l.durationSeconds, 0);
  const uncreditedMins = Math.floor(totalSec / 60);

  if (mode === 'credit_pending') {
    if (!body.questId) {
      res.status(400).json({ error: 'Thiếu questId để cộng giờ tập trung vào nhiệm vụ.' });
      return;
    }
    const quest = db.getQuestById(body.questId);
    if (!quest || quest.status !== 'pending') {
      res.status(404).json({ error: 'Không tìm thấy nhiệm vụ đang chờ phù hợp.' });
      return;
    }
    if (uncreditedMins < 1) {
      res.status(400).json({ error: 'Chưa có thời gian tập trung mới để cộng vào nhiệm vụ.' });
      return;
    }

    db.runTransaction(() => {
      quest.pausedAccumulatedSeconds = (quest.pausedAccumulatedSeconds || 0) + totalSec;
      quest.verifiedFocusSeconds = (quest.verifiedFocusSeconds || 0) + totalSec;
      const vf = quest.verifiedFocusSeconds || 0;
      const ds = quest.distractionSeconds || 0;
      quest.focusIntegrityPct = vf + ds > 0 ? Math.round((vf / (vf + ds)) * 100) : 100;
      if (!quest.startedAt) {
        quest.isPaused = true;
      }
      db.saveQuest(quest);
      db.markActivityCredited(dateKey);
    });
    db.checkpointWal();

    const state = buildStatePayload();
    res.json({
      ok: true,
      message: `Đã cộng +${uncreditedMins} phút Focus PC vào nhiệm vụ "${quest.title}"!`,
      overview: assistantDaemon.getOverview(state),
      state,
    });
    return;
  }

  if (uncreditedMins < 10) {
    res.status(400).json({
      error: `Cần tối thiểu 10 phút Deep Work / Học tập chưa quy đổi (hiện có ${uncreditedMins}p).`,
    });
    return;
  }

  const outcome = db.runTransaction(() => {
    const player = db.getPlayer();
    const skills = db.getSkills();
    const inventory = db.getInventory();
    const shadows = db.getShadows();
    const growthBonuses = computePlayerGrowthBonuses(player, skills, inventory, shadows);

    const studySec = focusLogs
      .filter((l) => l.category === 'study_research')
      .reduce((acc, l) => acc + l.durationSeconds, 0);
    const deepSec = focusLogs
      .filter((l) => l.category === 'deep_work')
      .reduce((acc, l) => acc + l.durationSeconds, 0);
    const procTotals = new Map<string, number>();
    for (const l of focusLogs) {
      procTotals.set(l.processName, (procTotals.get(l.processName) || 0) + l.durationSeconds);
    }
    const topProc =
      Array.from(procTotals.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'PC Focus';

    const primaryStat: AttributeKey =
      body.primaryStat || (studySec > deepSec ? 'PER' : 'INT');
    const qRank: QuestRank =
      uncreditedMins >= 60 ? 'B' : uncreditedMins >= 35 ? 'C' : 'D';
    const questTitle =
      body.title?.trim() ||
      (studySec > deepSec
        ? `Phiên Nghiên cứu & Học sâu (${topProc} · ${uncreditedMins}p)`
        : `Phiên Deep Work trên ${topProc} (${uncreditedMins}p)`);

    const balanced = computeBalancedQuestRewards({
      durationMinutes: uncreditedMins,
      rank: qRank,
      type: 'daily',
      requiresProof: false,
      primaryStat,
      secondaryStat: 'AGI',
    });

    const targetSkillId =
      inferSkillIdForTask(questTitle, 'pc tracker focus', primaryStat, skills) ||
      (studySec > deepSec ? 'sk-knw-1' : 'sk-int-1');

    const xpMult = 1.0 + growthBonuses.xpBonusPct / 100 + 0.15; // Flow focus integrity 100%
    const goldMult = 1.0 + growthBonuses.goldBonusPct / 100;
    const xpGain = Math.max(15, Math.round(balanced.xpReward * xpMult));
    const goldGain = Math.max(10, Math.round(balanced.goldReward * goldMult));
    let spGain = uncreditedMins >= 45 ? 2 : 1;
    const masteryGain = Math.round(
      balanced.masteryReward * (1.0 + growthBonuses.masteryBonusPct / 100)
    );

    const endHHmm = getVnTimeHHmm();
    const startHHmm = minutesToTime(Math.max(0, getVnNowMinutes() - uncreditedMins));

    const completedQuest: Quest = {
      id: uid('q-pc'),
      dateKey,
      type: 'daily',
      rank: qRank,
      title: questTitle,
      description: `Tự động tạo & nghiệm thu từ ${uncreditedMins} phút tập trung thật trên PC (${topProc}).`,
      learningMethod: 'Verified PC Deep Work Session',
      reasoning: 'Đồng bộ trực tiếp từ Windows Activity Tracker.',
      agentSource: 'ARCHITECT',
      skillId: targetSkillId,
      scheduledSlot: `${startHHmm} - ${endHHmm} (PC Sync)`,
      durationMinutes: uncreditedMins,
      actualDurationMinutes: uncreditedMins,
      actualStartTime: startHHmm,
      actualEndTime: endHHmm,
      verifiedFocusSeconds: totalSec,
      distractionSeconds: 0,
      focusIntegrityPct: 100,
      xpReward: balanced.xpReward,
      masteryReward: balanced.masteryReward,
      goldReward: balanced.goldReward,
      statRewards: balanced.statRewards,
      subtasks: [],
      status: 'completed',
      requiresProof: false,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    db.saveQuest(completedQuest);

    player.currentXp += xpGain;
    player.gold += goldGain;
    player.masteryScore += masteryGain;
    player.runestones += 1;
    awardSkillPoints(player, spGain);

    for (const [k, v] of Object.entries(balanced.statRewards)) {
      const key = k as AttributeKey;
      if (typeof v === 'number') {
        player.stats[key] = (player.stats[key] || 0) + v;
      }
    }

    if (player.streakDays === 0 || player.lastCheckinDate !== dateKey) {
      player.streakDays += 1;
      player.lastCheckinDate = dateKey;
    }

    applyLevelUps(player);

    const targetSkill = skills.find((s) => s.id === targetSkillId) || skills[0];
    if (targetSkill) {
      const skillXp = Math.max(12, Math.round(xpGain * 0.65));
      const { bonusSp } = applyTaskContributionToSkill(targetSkill, {
        dateKey,
        title: questTitle,
        minutes: uncreditedMins,
        xpAdded: skillXp,
      });
      if (bonusSp > 0) {
        awardSkillPoints(player, bonusSp);
        spGain += bonusSp;
      }
      db.saveSkill(targetSkill);
    }

    advanceMinionWaveOnQuestComplete(player);
    player.rank = computeRankFromMastery(player.masteryScore);
    db.savePlayer(player);

    db.recordDailyProgress({
      dateKey,
      questsCompleted: 1,
      focusMinutes: uncreditedMins,
      xpEarned: xpGain,
      masteryEarned: masteryGain,
      energyLevel: player.energyLevel,
    });

    db.markActivityCredited(dateKey);

    db.addAuditLog(
      'QUEST_COMPLETED',
      `Nghiệm thu ${uncreditedMins}p Focus PC thành Quest "${questTitle}" (+${xpGain} XP, +${spGain} SP, +${goldGain}G)`,
      { questId: completedQuest.id, uncreditedMins, xpGain, goldGain, spGain }
    );
    db.addMemoryLog({
      id: uid('log'),
      timestamp: new Date().toISOString(),
      agent: 'ARCHITECT',
      eventType: 'QUEST_COMPLETED',
      summary: `PC Focus → Quest "${questTitle}" (+${xpGain} XP, +${goldGain}G, +${spGain} SP)`,
      insight: `Quy đổi ${uncreditedMins} phút Deep Work/Study xác thực trên PC thành nhiệm vụ hoàn thành.`,
    });

    return {
      xpGain,
      goldGain,
      spGain,
      message: `Đã nghiệm thu ${uncreditedMins}p tập trung PC thành Quest hoàn chỉnh (+${xpGain} XP, +${goldGain}G, +${spGain} SP)!`,
    };
  });

  db.checkpointWal();
  const state = buildStatePayload();
  res.json({
    ok: true,
    ...outcome,
    overview: assistantDaemon.getOverview(state),
    state,
  });
});

const distDir = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`\n[THE SYSTEM // SYS.OS] Neural Core online at http://localhost:${PORT}`);
  desktopTracker.start();
  assistantDaemon.start();
});
