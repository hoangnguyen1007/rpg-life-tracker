import { db } from './db.ts';
import { computePlayerGrowthBonuses } from './skill-tree-data.ts';
import { getVnNowParts } from './time-vn.ts';
import { getVnWeekBounds } from './weekly-raid.ts';
import type {
  ActivityCategory,
  AISettings,
  CloseoutGrade,
  CloseoutMood,
  CloseoutPendingQuestPreview,
  DailyCloseoutRecord,
  EveningCloseoutPreviewPayload,
  Quest,
} from './types.ts';

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function shiftVnDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = Date.UTC(y || 1970, (m || 1) - 1, (d || 1) + deltaDays);
  const dt = new Date(utc);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
    dt.getUTCDate()
  ).padStart(2, '0')}`;
}

function summarizeTodayActivity(dateKey: string): {
  deepWorkMinutes: number;
  studyMinutes: number;
  focusTotalMinutes: number;
  distractionMinutes: number;
  focusScore: number;
} {
  const logs = db.getActivityLogsByDate(dateKey);
  let deepSec = 0;
  let studySec = 0;
  let commSec = 0;
  let distractionSec = 0;
  let otherSec = 0;

  for (const log of logs) {
    const sec = log.durationSeconds || 0;
    const cat: ActivityCategory = log.category;
    if (cat === 'deep_work') deepSec += sec;
    else if (cat === 'study_research') studySec += sec;
    else if (cat === 'communication') commSec += sec;
    else if (cat === 'distraction') distractionSec += sec;
    else if (cat === 'other') otherSec += sec;
  }

  const activeSec = deepSec + studySec + commSec + distractionSec + otherSec;
  const focusScore =
    activeSec <= 0
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            Math.round(
              ((deepSec * 1.0 + studySec * 0.95 + commSec * 0.55 + otherSec * 0.4) / activeSec) *
                100
            )
          )
        );

  const deepWorkMinutes = Math.round(deepSec / 60);
  const studyMinutes = Math.round(studySec / 60);
  return {
    deepWorkMinutes,
    studyMinutes,
    focusTotalMinutes: deepWorkMinutes + studyMinutes,
    distractionMinutes: Math.round(distractionSec / 60),
    focusScore,
  };
}

export function buildCloseoutPreview(
  dbRef: typeof db,
  computeQuestMissDamageFn: (quest: Quest, fatigueReductionPct: number) => number,
  now: Date = new Date()
): EveningCloseoutPreviewPayload {
  const vnNow = getVnNowParts(now);
  const dateKey = vnNow.dateKey;
  const tomorrowDateKey = shiftVnDateKey(dateKey, 1);

  const player = dbRef.getPlayer();
  const skills = dbRef.getSkills();
  const inventory = dbRef.getInventory();
  const shadows = dbRef.getShadows();
  const growthBonuses = computePlayerGrowthBonuses(player, skills, inventory, shadows);

  const assistantSettings = dbRef.getAssistantSettings();
  const disciplineSettings = dbRef.getDisciplineSettings();
  const distractionBudgetMinutes = Math.max(
    10,
    Number(
      disciplineSettings.distractionBudgetMinutes ??
        assistantSettings.distractionBudgetMinutes ??
        (assistantSettings as { distractionAlertMinutes?: number }).distractionAlertMinutes ??
        45
    )
  );

  const activity = summarizeTodayActivity(dateKey);

  const bounds = getVnWeekBounds(now);
  const raid = dbRef.getWeeklyRaidByWeek(bounds.weekKey);
  const raidDamageToday = (raid?.combatLog || []).reduce((acc, ev) => {
    if (ev.dateKey === dateKey && ev.amount > 0) {
      return acc + ev.amount;
    }
    return acc;
  }, 0);
  const darkRegenTriggered = Boolean(raid?.regenAppliedDates?.includes(dateKey));

  const allQuests = dbRef.getQuests();
  const questsCompleted = allQuests.filter(
    (q) => q.status === 'completed' && q.dateKey === dateKey
  ).length;
  const pendingRaw = allQuests.filter((q) => q.status === 'pending' && q.dateKey <= dateKey);

  const plannedRestMode = Boolean(player.plannedRestMode);
  const shieldWouldProtect =
    disciplineSettings.mode === 'sustainable' ||
    (disciplineSettings.mode === 'balanced' &&
      disciplineSettings.streakShieldsUsedThisWeek < disciplineSettings.streakShieldsPerWeek);

  const pendingQuests: CloseoutPendingQuestPreview[] = pendingRaw.map((q) => ({
    id: q.id,
    title: q.title,
    type: q.type,
    rank: q.rank,
    durationMinutes: q.durationMinutes,
    hpDamage:
      plannedRestMode || shieldWouldProtect
        ? 0
        : computeQuestMissDamageFn(q, growthBonuses.fatigueReductionPct),
    dateKey: q.dateKey,
  }));

  const projectedHpDamage = pendingQuests.reduce((acc, q) => acc + q.hpDamage, 0);
  const playerHp = player.hp ?? player.maxHp;
  const projectedDieRisk = projectedHpDamage > 0 && playerHp - projectedHpDamage <= 0;

  const todayCloseout = dbRef.getDailyCloseout(dateKey);
  const alreadyClosedToday = Boolean(todayCloseout);
  const recentCloseouts = dbRef.getRecentDailyCloseouts(30);

  return {
    dateKey,
    tomorrowDateKey,
    alreadyClosedToday,
    todayCloseout,
    remindEveningBadge: vnNow.hour >= disciplineSettings.eveningCloseoutHour && !alreadyClosedToday,
    metrics: {
      deepWorkMinutes: activity.deepWorkMinutes,
      studyMinutes: activity.studyMinutes,
      focusTotalMinutes: activity.focusTotalMinutes,
      distractionMinutes: activity.distractionMinutes,
      distractionBudgetMinutes,
      focusScore: activity.focusScore,
      questsCompleted,
      questsPending: pendingQuests.length,
      raidDamageToday,
      darkRegenTriggered,
      playerHp,
      playerMaxHp: player.maxHp,
      plannedRestMode,
    },
    pendingQuests,
    projectedHpDamage,
    projectedDieRisk,
    recentCloseouts,
  };
}

export interface EvaluateCloseoutInput {
  dateKey: string;
  deepWorkMinutes: number;
  studyMinutes: number;
  focusTotalMinutes: number;
  distractionMinutes: number;
  distractionBudgetMinutes: number;
  focusScore: number;
  questsCompleted: number;
  questsMissed: number;
  raidDamageToday: number;
  darkRegenTriggered: boolean;
  mood: CloseoutMood;
  bottleneckTags: string[];
  reflectionNote: string;
  carriedOverCount: number;
  carriedOverTitles: string[];
  hpDamageTaken: number;
  died: boolean;
}

function scoreToGrade(score: number): CloseoutGrade {
  if (score >= 88) return 'S';
  if (score >= 74) return 'A';
  if (score >= 58) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

function computeBaselineScore(input: EvaluateCloseoutInput): number {
  const focusGoal = Math.max(90, Number(db.getAssistantSettings().dailyFocusGoalMinutes || 180));
  const focusVolumePts = Math.min(35, Math.round((input.focusTotalMinutes / focusGoal) * 35));

  const hasActivity = input.focusTotalMinutes > 0 || input.distractionMinutes > 0;
  const focusPurityPts = hasActivity
    ? Math.round((Math.max(0, Math.min(100, input.focusScore)) / 100) * 25)
    : 12;

  const totalQuests = input.questsCompleted + input.questsMissed;
  let questPts = 10;
  if (totalQuests > 0) {
    questPts = Math.round((input.questsCompleted / totalQuests) * 25);
  } else if (input.focusTotalMinutes >= 30) {
    questPts = 15;
  }

  let disciplinePts = 15;
  if (input.darkRegenTriggered) {
    disciplinePts -= 10;
  } else if (input.distractionMinutes > 0) {
    const ratio = input.distractionMinutes / Math.max(15, input.distractionBudgetMinutes);
    disciplinePts -= Math.min(9, Math.round(ratio * 6));
  }
  if (input.raidDamageToday >= 300) {
    disciplinePts = Math.min(15, disciplinePts + 3);
  }
  disciplinePts = Math.max(0, disciplinePts);

  return Math.max(0, Math.min(100, focusVolumePts + focusPurityPts + questPts + disciplinePts));
}

function buildLocalFallbackCoaching(
  input: EvaluateCloseoutInput,
  grade: CloseoutGrade,
  score: number
): {
  headline: string;
  strengthSummary: string;
  bottleneckSummary: string;
  tomorrowAdvice: string;
} {
  const moodMap: Record<CloseoutMood, string> = {
    energized: 'Sung sức',
    steady: 'Bình ổn',
    tired: 'Hơi mệt',
    overwhelmed: 'Quá tải',
  };

  let headline = `Tổng kết ${input.dateKey} đạt Hạng ${grade} (${score}/100)`;
  if (grade === 'S') {
    headline = `Ngày kỷ luật xuất sắc · Hạng S (${score}/100)!`;
  } else if (grade === 'A') {
    headline = `Nhịp tập trung vững chắc · Hạng A (${score}/100)`;
  } else if (grade === 'D') {
    headline = `Cần tái lập kỷ luật ngày mai · Hạng D (${score}/100)`;
  }

  const strengthParts: string[] = [];
  if (input.focusTotalMinutes > 0) {
    strengthParts.push(
      `${input.focusTotalMinutes} phút Focus sâu (DW ${input.deepWorkMinutes}p · Học ${input.studyMinutes}p, Focus Score ${input.focusScore}%)`
    );
  }
  if (input.questsCompleted > 0) {
    strengthParts.push(`hoàn thành ${input.questsCompleted} nhiệm vụ`);
  }
  if (input.raidDamageToday > 0) {
    strengthParts.push(`gây ${input.raidDamageToday} DMG lên Raid Boss tuần`);
  }
  const strengthSummary =
    strengthParts.length > 0
      ? `Bạn đã ghi nhận ${strengthParts.join(', ')}.`
      : `Bạn đã chủ động khép lại ngày ${input.dateKey} (${moodMap[input.mood]}) để không bỏ quên dữ liệu kiểm điểm.`;

  const bottleneckParts: string[] = [];
  if (input.questsMissed > 0) {
    bottleneckParts.push(
      `còn ${input.questsMissed} nhiệm vụ chưa xong (-${input.hpDamageTaken} HP${input.died ? ', đã hồi sinh tại Checkpoint' : ''})`
    );
  }
  if (input.darkRegenTriggered) {
    bottleneckParts.push(
      `xao nhãng ${input.distractionMinutes}p vượt ngưỡng ${input.distractionBudgetMinutes}p kích hoạt Dark Regen`
    );
  } else if (input.distractionMinutes > 20) {
    bottleneckParts.push(`xao nhãng tiêu tốn ${input.distractionMinutes}p/${input.distractionBudgetMinutes}p`);
  }
  if (input.bottleneckTags.length > 0) {
    bottleneckParts.push(`yếu tố cản trở: ${input.bottleneckTags.join(', ')}`);
  }
  const bottleneckSummary =
    bottleneckParts.length > 0
      ? `Điểm nghẽn chính: ${bottleneckParts.join('; ')}.`
      : 'Không có điểm nghẽn nghiêm trọng — mức xao nhãng nằm trong tầm kiểm soát.';

  let tomorrowAdvice = 'Khởi động phiên Focus đầu tiên 25 phút ngay khi ngồi vào bàn để khóa nhịp sớm.';
  if (input.carriedOverCount > 0) {
    tomorrowAdvice = `Ưu tiên xử lý ${input.carriedOverCount} việc vừa dời sang ngày mai ngay khung giờ sáng trước khi nhận thêm việc mới.`;
  } else if (input.darkRegenTriggered || input.distractionMinutes >= input.distractionBudgetMinutes * 0.8) {
    tomorrowAdvice = `Bật Focus Arena (ZEN/BATTLE) và giữ xao nhãng dưới ${input.distractionBudgetMinutes}p để chặn Dark Regen của Raid Boss.`;
  } else if (input.mood === 'tired' || input.mood === 'overwhelmed') {
    tomorrowAdvice = 'Ngủ đủ giấc tối nay và chia việc lớn ngày mai thành phiên 25 phút nhẹ đầu tiên.';
  }

  return { headline, strengthSummary, bottleneckSummary, tomorrowAdvice };
}

function extractJsonObject<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced && fenced[1]) {
      try {
        return JSON.parse(fenced[1].trim()) as T;
      } catch {
        return null;
      }
    }
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first !== -1 && last > first) {
      try {
        return JSON.parse(raw.slice(first, last + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

interface AiCloseoutResponse {
  grade?: CloseoutGrade;
  headline?: string;
  strengthSummary?: string;
  bottleneckSummary?: string;
  tomorrowAdvice?: string;
}

async function tryAiCloseoutEvaluation(
  input: EvaluateCloseoutInput,
  baselineScore: number,
  baselineGrade: CloseoutGrade
): Promise<AiCloseoutResponse | null> {
  const aiSettings: AISettings = db.getAISettings();
  if (!aiSettings.useLiveLlm || !aiSettings.baseUrl) return null;
  const isLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(aiSettings.baseUrl);
  if (!aiSettings.apiKey?.trim() && !isLocal) return null;

  const cleanBase = aiSettings.baseUrl.replace(/\/+$/, '');
  const endpoint = cleanBase.endsWith('/chat/completions')
    ? cleanBase
    : `${cleanBase}/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (aiSettings.apiKey.trim()) {
    headers['Authorization'] = `Bearer ${aiSettings.apiKey.trim()}`;
  }

  const systemPrompt = `Bạn là THE SYSTEM AI Coach thực hiện Nghi thức Chốt Ngày bằng tiếng Việt ngắn gọn, trung thực, không nịnh hót và KHÔNG tạo thêm nhiệm vụ mới.
Trả về DUY NHẤT 1 JSON object hợp lệ:
{
  "grade": "S | A | B | C | D",
  "headline": "1 câu tiêu đề tổng kết ngắn (<= 75 ký tự)",
  "strengthSummary": "1-2 câu điểm mạnh dựa đúng trên số liệu thật",
  "bottleneckSummary": "1-2 câu điểm nghẽn chính hôm nay",
  "tomorrowAdvice": "1 câu chiến thuật cụ thể cho ngày mai"
}`;

  const userPrompt = `Ngày ${input.dateKey}. Điểm chuẩn hệ thống: ${baselineScore}/100 (Gợi ý hạng: ${baselineGrade}).
Số liệu thật:
- Focus: ${input.focusTotalMinutes}p (Deep Work ${input.deepWorkMinutes}p, Học ${input.studyMinutes}p), Focus Score ${input.focusScore}%
- Xao nhãng: ${input.distractionMinutes}p / ngân sách ${input.distractionBudgetMinutes}p (Dark Regen: ${input.darkRegenTriggered ? 'CÓ' : 'Không'})
- Nhiệm vụ hoàn thành: ${input.questsCompleted}, bỏ lỡ: ${input.questsMissed} (chịu -${input.hpDamageTaken} HP${input.died ? ', tử trận hồi sinh' : ''})
- Sát thương Raid Boss hôm nay: ${input.raidDamageToday} DMG
- Dời sang ngày mai: ${input.carriedOverCount} việc
- Thể trạng cuối ngày: ${input.mood}; Tag nghẽn: ${input.bottleneckTags.join(', ') || 'Không'}; Ghi chú người chơi: "${input.reflectionNote || 'Không ghi'}"`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: aiSettings.model || 'openai/gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 420,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = extractJsonObject<AiCloseoutResponse>(raw);
    if (!parsed || !parsed.headline || !parsed.strengthSummary || !parsed.tomorrowAdvice) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function evaluateDailyCloseout(
  input: EvaluateCloseoutInput
): Promise<DailyCloseoutRecord> {
  const score = computeBaselineScore(input);
  const baselineGrade = scoreToGrade(score);
  const local = buildLocalFallbackCoaching(input, baselineGrade, score);

  const ai = await tryAiCloseoutEvaluation(input, score, baselineGrade);
  const validGrades = new Set<CloseoutGrade>(['S', 'A', 'B', 'C', 'D']);
  const grade: CloseoutGrade =
    ai?.grade && validGrades.has(ai.grade) ? ai.grade : baselineGrade;

  return {
    id: uid('closeout'),
    dateKey: input.dateKey,
    closedAt: new Date().toISOString(),
    grade,
    score,
    generatedBy: ai ? 'ai' : 'local',
    deepWorkMinutes: input.deepWorkMinutes,
    studyMinutes: input.studyMinutes,
    focusTotalMinutes: input.focusTotalMinutes,
    distractionMinutes: input.distractionMinutes,
    distractionBudgetMinutes: input.distractionBudgetMinutes,
    focusScore: input.focusScore,
    questsCompleted: input.questsCompleted,
    questsMissed: input.questsMissed,
    raidDamageToday: input.raidDamageToday,
    darkRegenTriggered: input.darkRegenTriggered,
    mood: input.mood,
    bottleneckTags: input.bottleneckTags,
    reflectionNote: input.reflectionNote,
    carriedOverCount: input.carriedOverCount,
    carriedOverTitles: input.carriedOverTitles,
    hpDamageTaken: input.hpDamageTaken,
    died: input.died,
    headline: ai?.headline ? String(ai.headline).trim().slice(0, 120) : local.headline,
    strengthSummary: ai?.strengthSummary
      ? String(ai.strengthSummary).trim().slice(0, 320)
      : local.strengthSummary,
    bottleneckSummary: ai?.bottleneckSummary
      ? String(ai.bottleneckSummary).trim().slice(0, 320)
      : local.bottleneckSummary,
    tomorrowAdvice: ai?.tomorrowAdvice
      ? String(ai.tomorrowAdvice).trim().slice(0, 320)
      : local.tomorrowAdvice,
  };
}
