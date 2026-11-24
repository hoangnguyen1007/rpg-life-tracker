import crypto from 'node:crypto';
import type {
  AIConsultResponse,
  AISettings,
  AgentMemoryLog,
  AttributeKey,
  BossMission,
  ChatContextScope,
  CouncilDeliberation,
  DayScheduleAnalysis,
  Goal,
  PlayerState,
  Quest,
  QuestRank,
  QuestType,
  RejectionReason,
  SkillNode,
  StatMap,
  SuggestedQuestItem,
  SystemStatePayload,
  TaskDraftAnalysis,
  TimetableBlock,
  TimetableBlockType,
} from './types.ts';
import {
  SlotAllocator,
  analyzeDaySchedule,
  analyzeFlowAndPacing,
  computeBalancedQuestRewards,
  inferSkillIdForTask,
  minutesToTime,
  parseNaturalLanguageTimetable,
  timeToMinutes,
  type FlowPacingAnalysis,
  type FlowPacingState,
} from './scheduler.ts';
import { getVnNowMinutes, getVnTodayKey } from './time-vn.ts';

interface CompletedReviewCandidate {
  title: string;
  dateKey: string;
  proofNote?: string;
  primaryStat: AttributeKey;
  goalId?: string;
  skillId?: string;
}

interface LlmChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function inferStatFromText(text: string): AttributeKey {
  const lower = text.toLowerCase();
  if (/(giao tiếp|thuyết trình|lãnh đạo|đàm phán|bán hàng|networking|team|mentor|khách hàng|storytelling|charisma)/.test(lower)) {
    return 'CHA';
  }
  if (/(gym|chạy|thể lực|sức mạnh|cơ bắp|workout|thể thao|chống đẩy|cardio|strength|fitness)/.test(lower)) {
    return 'STR';
  }
  if (/(ngủ|hồi phục|nghỉ|sức khỏe|nước|thiền|stress|sleep|vitality|recovery|burnout)/.test(lower)) {
    return 'VIT';
  }
  if (/(tốc độ|thói quen|kỷ luật|timebox|focus|năng suất|tập trung|nhanh|sprint|execution|agility)/.test(lower)) {
    return 'AGI';
  }
  if (/(ngôn ngữ|ngoại ngữ|đọc|nghiên cứu|tổng hợp|quan sát|phản biện|viết|speaking|writing|recall|research|perception)/.test(lower)) {
    return 'PER';
  }
  return 'INT';
}

function resolveGoalStat(goal: Goal): AttributeKey {
  if (goal.category === 'Health & Vitality') {
    return inferStatFromText(`${goal.title} ${goal.rawInput}`) === 'VIT' ? 'VIT' : 'STR';
  }
  if (goal.category === 'Research & Academic' || goal.category === 'Language & IELTS') {
    return 'PER';
  }
  if (goal.category === 'Career & Internship') {
    return inferStatFromText(`${goal.title} ${goal.rawInput}`);
  }
  const inferred = inferStatFromText(`${goal.title} ${goal.rawInput}`);
  return inferred || 'INT';
}

function buildHadesNarrativeBark(params: {
  flowPacing: FlowPacingAnalysis;
  player: PlayerState;
  primaryGoalTitle?: string;
  latestReflection?: string;
  rejectedContext?: { questTitle: string; reason: RejectionReason };
  questsCount: number;
}): string {
  const { flowPacing, player, primaryGoalTitle, latestReflection, rejectedContext, questsCount } = params;
  const persona = player.profile.aiPersona || 'strategic_mentor';
  const goalSnippet = primaryGoalTitle ? ` cho "${primaryGoalTitle.slice(0, 36)}"` : '';
  const streakTag = player.streakDays > 0 ? `Chuỗi ${player.streakDays} ngày` : 'Khởi động ngày mới';

  if (rejectedContext) {
    return `[${flowPacing.state}] Hades Bark — Ngươi vừa lùi một bước khỏi "${rejectedContext.questTitle.slice(0, 32)}" (${rejectedContext.reason}). Hệ thống lập tức rèn lại ${questsCount} thử thách vừa sức hơn — đừng dừng nhịp.`;
  }

  if (player.plannedRestMode) {
    return `[${flowPacing.state} // GRACE DAY] "Take Your Time" — Ngay cả chiến binh bền bỉ nhất cũng cần trở về Nhà của Hades để hồi phục. Hôm nay chỉ giữ ${questsCount} nhịp nhẹ nhàng, streak ${player.streakDays} ngày vẫn được bảo toàn.`;
  }

  if (flowPacing.state === 'RECOVERY_NEEDED') {
    return persona === 'strict_system'
      ? `[${flowPacing.state}] CẢNH BÁO SINH LỰC (${player.energyLevel}% Energy · ${player.fatigue}% Fatigue): Cố lao vào hầm ngục lúc này là tự sát. System khóa bớt tải nặng, ưu tiên ${questsCount} nhiệm vụ hồi phục.`
      : `[${flowPacing.state}] Nhịp thở đang hụt (${player.energyLevel}% Energy). Hãy hạ khiên xuống một nhịp hôm nay — phục hồi xong mới quay lại bứt phá${goalSnippet}.`;
  }

  if (flowPacing.state === 'OVERLOAD_ANXIETY') {
    return `[${flowPacing.state}] Lịch hôm nay đang siết chặt như Cổng Đỏ. Đừng nhìn cả ngọn núi${goalSnippet} — System đã chẻ nhỏ thành ${questsCount} phiên gọn nhẹ. Chỉ cần thắng 2 phút đầu tiên.`;
  }

  if (flowPacing.state === 'FLOW_CHANNEL') {
    const reflectionHint = latestReflection
      ? ` Dư âm suy ngẫm ("${latestReflection.slice(0, 42)}") đang tiếp lửa.`
      : '';
    return `[${flowPacing.state}] ${streakTag} · Energy ${player.energyLevel}% — Kênh Flow đã mở rộng!${reflectionHint} System triển khai ${questsCount} nhiệm vụ đòn bẩy cao${goalSnippet}.`;
  }

  return `[${flowPacing.state}] ${streakTag} — Mỗi viên gạch hôm nay đều tạo đà cho ngày mai. System đã sắp ${questsCount} nhiệm vụ vừa khít các khoảng rảnh thực tế${goalSnippet}.`;
}

function inferScientificProtocol(params: {
  questType: QuestType;
  durationMinutes: number;
  learningMethod?: string;
  title?: string;
}): string {
  const { questType, durationMinutes, learningMethod = '', title = '' } = params;
  const combined = `${learningMethod} ${title}`.toLowerCase();

  if (questType === 'recovery' || combined.includes('nsdr') || combined.includes('sleep') || combined.includes('ngủ')) {
    return 'Huberman NSDR & Walker Sleep Consolidation';
  }
  if (combined.includes('spaced') || combined.includes('bjork') || combined.includes('ôn') || combined.includes('review')) {
    return 'Bjork Desirable Difficulties & Spaced Retrieval';
  }
  if (combined.includes('recall') || combined.includes('feynman') || combined.includes('blurting') || combined.includes('tổng hợp')) {
    return 'Dunlosky (2013) Retrieval Practice & Feynman Synthesis';
  }
  if (combined.includes('diffused') || combined.includes('walk') || combined.includes('đi bộ')) {
    return 'Oakley Focused–Diffused Mode & Zone 2 Mobility';
  }
  if (durationMinutes >= 50 || combined.includes('ultradian')) {
    return 'Huberman 90m Ultradian Deep Work & 10s Micro-Gap Replay';
  }
  if (combined.includes('deliberate') || combined.includes('critique') || combined.includes('phản biện')) {
    return 'Ericsson Deliberate Practice + Feedback Loop';
  }
  return 'Gollwitzer Implementation Intentions & Focused Sprint';
}

function buildIfThenTrigger(params: {
  title: string;
  flowState: FlowPacingState;
  obstacleHint?: string;
}): string {
  const { title, flowState, obstacleHint } = params;
  const cleanTitle = title.slice(0, 36);
  if (obstacleHint && obstacleHint.trim()) {
    return `Nếu ${obstacleHint.trim()} -> Thì kích hoạt quy tắc 2 phút cho "${cleanTitle}" và tắt toàn bộ thông báo ngoài.`;
  }
  if (flowState === 'RECOVERY_NEEDED') {
    return `Nếu cảm thấy uể oải hoặc muốn lướt mạng khi bắt đầu "${cleanTitle}" -> Thì hít thở sâu 3 nhịp, uống 1 ngụm nước và chỉ làm bước đầu tiên trong 2 phút.`;
  }
  if (flowState === 'OVERLOAD_ANXIETY') {
    return `Nếu thấy ngợp trước khối lượng của "${cleanTitle}" -> Thì thu hẹp phạm vi xuống đúng 1 tiểu mục nhỏ nhất và bấm giờ 15 phút không cầu toàn.`;
  }
  return `Nếu đến khung giờ đã xếp mà tay muốn mở điện thoại -> Thì đặt máy sang chế độ máy bay, mở ngay "${cleanTitle}" và chạy 2 phút khởi động.`;
}

async function callOpenAICompatible(
  settings: AISettings,
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  if (!settings.useLiveLlm || !settings.baseUrl) return null;

  const cleanBase = settings.baseUrl.replace(/\/+$/, '');
  const endpoint = cleanBase.endsWith('/chat/completions')
    ? cleanBase
    : `${cleanBase}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (settings.apiKey.trim()) {
    headers['Authorization'] = `Bearer ${settings.apiKey.trim()}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: settings.model || 'gpt-4o-mini',
        temperature: settings.temperature ?? 0.4,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LLM HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as LlmChatResponse;
    return data.choices?.[0]?.message?.content ?? null;
  } finally {
    clearTimeout(timer);
  }
}

function extractJsonBlock<T>(raw: string): T | null {
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
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(raw.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function testLlmConnection(
  settings: AISettings
): Promise<{ ok: boolean; latencyMs: number; reply?: string; error?: string }> {
  const started = Date.now();
  try {
    const cleanBase = settings.baseUrl.replace(/\/+$/, '');
    const endpoint = cleanBase.endsWith('/chat/completions')
      ? cleanBase
      : `${cleanBase}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (settings.apiKey.trim()) {
      headers['Authorization'] = `Bearer ${settings.apiKey.trim()}`;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: settings.model || 'gpt-4o-mini',
        temperature: 0.2,
        max_tokens: 60,
        messages: [
          {
            role: 'system',
            content: 'You are THE SYSTEM from Solo Leveling. Reply in 1 short sentence confirming neural link.',
          },
          { role: 'user', content: 'System Status Check.' },
        ],
      }),
    });

    const latencyMs = Date.now() - started;
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, latencyMs, error: `HTTP ${res.status}: ${txt.slice(0, 240)}` };
    }
    const data = (await res.json()) as LlmChatResponse;
    const reply = data.choices?.[0]?.message?.content?.trim() || 'Connection Verified.';
    return { ok: true, latencyMs, reply };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : 'Unknown connection error',
    };
  }
}

export function buildDistilledPlayerContext(state: SystemStatePayload): {
  systemInstruction: string;
  contextDossier: string;
  statsSummary: Record<string, string | number | boolean>;
  completedReviewCandidates: CompletedReviewCandidate[];
} {
  const { player, goals, todayAnalysis, weeklyAnalysis, quests, bosses, chapters = [], skills, dailySnapshots, memoryLogs, growthBonuses } = state;
  const p = player.profile;
  const todayKey = getVnTodayKey();

  const personaMap: Record<string, string> = {
    strict_system: 'Nghiêm khắc, kỷ luật cao, trực diện kiểu The System trong Solo Leveling — không nuông chiều sự trì hoãn.',
    strategic_mentor: 'Chiến lược gia sắc bén, thực tế, phân tích rõ trade-off và tối ưu đòn bẩy dài hạn.',
    supportive_coach: 'Đồng hành tích cực, cân bằng tâm lý, chia nhỏ bước đi để duy trì động lực bền vững.',
  };
  const personaDesc = personaMap[p.aiPersona || 'strategic_mentor'] || personaMap.strategic_mentor;

  const statEntries = Object.entries(player.stats) as Array<[keyof StatMap, number]>;
  const sortedStats = [...statEntries].sort((a, b) => b[1] - a[1]);
  const strongestStat = sortedStats[0];
  const weakestStat = sortedStats[sortedStats.length - 1];

  const completedCount = quests.filter((q) => q.status === 'completed').length;
  const rejectedQuests = quests.filter((q) => q.status === 'rejected');
  const totalDecided = completedCount + rejectedQuests.length;
  const completionRate = totalDecided > 0 ? Math.round((completedCount / totalDecided) * 100) : 100;

  const rejectionReasonsCount: Record<string, number> = {};
  for (const rq of rejectedQuests) {
    const r = rq.rejectionReason || 'other';
    rejectionReasonsCount[r] = (rejectionReasonsCount[r] || 0) + 1;
  }

  const recentProofs = quests
    .filter((q) => q.status === 'completed' && q.proofNote)
    .slice(0, 5)
    .map(
      (q) =>
        `- "${q.title}"${q.scientificProtocol ? ` [${q.scientificProtocol}]` : ''}: ${q.proofNote}`
    )
    .join('\n');

  const completedReviewCandidates: CompletedReviewCandidate[] = quests
    .filter((q) => {
      if (q.status !== 'completed') return false;
      if (q.title.startsWith('Spaced Retrieval:')) return false;
      const isOlderDay = Boolean(q.dateKey && q.dateKey < todayKey);
      const isOver20h =
        Boolean(q.completedAt) && Date.now() - Date.parse(q.completedAt!) >= 20 * 60 * 60 * 1000;
      return Boolean(q.proofNote?.trim()) || isOlderDay || isOver20h;
    })
    .slice(0, 5)
    .map((q) => {
      const statKeys = Object.keys(q.statRewards || {}) as AttributeKey[];
      return {
        title: q.title,
        dateKey: q.dateKey,
        proofNote: q.proofNote,
        primaryStat: statKeys[0] || inferStatFromText(q.title),
        goalId: q.goalId,
        skillId: q.skillId,
      };
    });

  const activeProtocolsSummary = quests
    .filter((q) => q.scientificProtocol || q.ifThenTrigger)
    .slice(0, 6)
    .map(
      (q) =>
        `- "${q.title}" (${q.status}): Protocol=${q.scientificProtocol || 'N/A'}${q.ifThenTrigger ? ` | If-Then="${q.ifThenTrigger}"` : ''}`
    )
    .join('\n');

  const weekSummary = weeklyAnalysis
    .map((d) => {
      const classes = d.blocks.filter((b) => b.type === 'class_work').map((b) => `${b.startTime}-${b.endTime} ${b.title}`);
      return `  • ${d.dayLabel}: Rảnh ${(d.totalFreeMinutes / 60).toFixed(1)}h | Ngủ ${(d.totalSleepMinutes / 60).toFixed(1)}h | Lịch cố định: ${classes.join(', ') || 'Trống'}`;
    })
    .join('\n');

  const recentSnapshotsText = dailySnapshots
    .slice(0, 7)
    .map((s) => {
      const restTag = s.isRestDay ? ' [REST DAY / GRACE]' : '';
      const reflTag = s.reflectionNote?.trim() ? ` | Reflection: "${s.reflectionNote.trim()}"` : '';
      return `  • ${s.dateKey}${restTag}: ${s.questsCompleted} quests, ${s.focusMinutes}m focus, +${s.xpEarned} XP, +${s.masteryEarned} Mastery${reflTag}`;
    })
    .join('\n');

  const activeChapter =
    chapters.find((c) => c.unlocked && !c.completed) || chapters[chapters.length - 1];
  const activeChapterSummary = activeChapter
    ? (() => {
        const miniIds = activeChapter.miniBossIds || [];
        const miniDefeated = miniIds.filter((id) => bosses.find((b) => b.id === id)?.defeated).length;
        const chBoss = bosses.find((b) => b.id === activeChapter.chapterBossId);
        const chBossStatus = !chBoss
          ? 'N/A'
          : chBoss.defeated
            ? 'ĐÃ HẠ'
            : chBoss.unlocked
              ? `ĐÃ MỞ KHÓA (HP ${chBoss.currentHp}/${chBoss.maxHp})`
              : 'ĐANG PHONG ẤN';
        const activeWave = (activeChapter.stages || []).find(
          (s) => s.kind === 'minion_wave' && s.unlocked && !s.completed
        );
        const waveInfo = activeWave
          ? ` | Đợt quái hiện tại: ${activeWave.title} (${activeWave.minionProgress ?? 0}/${activeWave.minionCountRequired ?? 2})`
          : '';
        return `Chương ${activeChapter.chapterNumber} (${activeChapter.arcLabel}): ${activeChapter.title} | Mini-Boss: ${miniDefeated}/${miniIds.length} | Boss Chương: ${chBossStatus}${waveInfo}`;
      })()
    : 'Chưa có dữ liệu Chương.';

  const unlockedActiveBosses = bosses.filter((b) => b.unlocked && !b.defeated);

  const recentReflections = dailySnapshots
    .filter((s) => Boolean(s.reflectionNote && s.reflectionNote.trim()))
    .slice(0, 5)
    .map((s) => `  • ${s.dateKey}${s.isRestDay ? ' [Rest Day]' : ''}: "${s.reflectionNote!.trim()}"`);

  const flowPacing = analyzeFlowAndPacing({
    player,
    dayAnalysis: todayAnalysis,
    goalsCount: goals.length,
    completionRate,
    recentRejectionsCount: rejectedQuests.length,
  });

  const systemInstruction = [
    `Bạn là THE SYSTEM (AI Personal Growth Operating System) dành riêng cho "${p.name}".`,
    `Phong cách phản hồi & điều phối: ${personaDesc}`,
    player.plannedRestMode
      ? '\n[CHẾ ĐỘ NGHỈ CHỦ ĐỘNG (PLANNED REST / GRACE DAY) ĐANG BẬT]: Tuyệt đối không giao nhiệm vụ nặng; ưu tiên hồi phục, suy ngẫm nhẹ và bảo vệ streak.'
      : '',
    p.customSystemPrompt?.trim()
      ? `\n[CUSTOM SYSTEM PROMPT TỪ USER — BẮT BUỘC TUÂN THỦ]:\n${p.customSystemPrompt.trim()}`
      : '',
    p.personalRules?.trim()
      ? `\n[QUY TẮC CÁ NHÂN]: ${p.personalRules.trim()}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const contextDossier = `=== PLAYER IDENTITY & TELEMETRY ===
- Tên Player: ${p.name} | Class: ${player.hunterClass} | Title: ${player.activeTitle}
- Level: ${player.level} (${player.rank}) | Effort XP: ${player.currentXp}/${player.xpToNextLevel} | Verified Mastery: ${player.masteryScore} | Streak: ${player.streakDays} ngày
- Sinh mệnh Pixel: ${player.hp}/${player.maxHp} HP | Active Checkpoint: ${player.currentCheckpoint?.label || 'Ch.1'} | Số lần ngã xuống: ${player.deathCount ?? 0}
- Chế độ Nghỉ Chủ Động (Planned Rest / Grace Mode): ${player.plannedRestMode ? 'ĐANG BẬT (Ưu tiên hồi phục, giữ streak & 0 sát thương HP)' : 'TẮT (Nhịp rèn luyện bình thường)'}
- Vai trò / Hoàn cảnh: ${p.currentRole || 'Chưa khai báo'}
- Tiểu sử & Định hướng: ${p.bio || 'Chưa khai báo'}
- Điểm mạnh: ${p.strengths.join(', ') || 'Chưa khai báo'}
- Điểm yếu / Rào cản: ${p.weaknesses.join(', ') || 'Chưa khai báo'}
- Kỹ năng muốn phát triển: ${p.targetSkills.join(', ') || 'Chưa khai báo'}
- Sở thích: ${p.interests.join(', ') || 'Chưa khai báo'}
- Phương pháp rèn luyện ưa thích: ${p.learningStyle || 'Chưa khai báo'}
- Khung giờ tập trung cao điểm (Peak Hours): ${p.peakHours || 'Chưa khai báo'}
- Sinh lực hiện tại: Energy ${player.energyLevel}%, Fatigue ${player.fatigue}%
- Chỉ số 6 chiều: ${statEntries.map(([k, v]) => `${k}:${v}`).join(' | ')} (Mạnh nhất: ${strongestStat?.[0]} ${strongestStat?.[1]}, Cần cải thiện: ${weakestStat?.[0]} ${weakestStat?.[1]})

=== FLOW STATE & PERSONA 5 PACING ===
- Trạng thái Flow/Pacing: ${flowPacing.state} (${flowPacing.label})
- Cân bằng Thử thách / Kỹ năng: ${flowPacing.challengeSkillBalance}
- Chỉ dẫn nhịp độ: ${flowPacing.pacingDirective}

=== THỜI KHÓA BIỂU HÔM NAY (${todayAnalysis.dayLabel}) ===
- Lịch cố định hôm nay: ${todayAnalysis.blocks.map((b) => `${b.startTime}-${b.endTime} [${b.type}] ${b.title}`).join(' ; ') || 'Không có'}
- Các cửa sổ rảnh khả dụng: ${todayAnalysis.freeWindows.map((w) => `${w.startTime}-${w.endTime} (${w.durationMinutes}m, ${w.windowQuality})`).join(' ; ') || 'Không có'}
- Ngân sách quest khuyến nghị: ${todayAnalysis.recommendedQuestMinutes} phút | Vùng đệm nghỉ bảo vệ: ${todayAnalysis.reservedBreathingMinutes} phút | Overload Risk: ${todayAnalysis.overloadRisk}

=== TỔNG QUAN TUẦN ===
${weekSummary}

=== MỤC TIÊU, CHƯƠNG CHIẾN DỊCH & BOSS ĐANG MỞ (BAO GỒM WOOP & IF-THEN) ===
- Tiến độ Chiến dịch hiện tại: ${activeChapterSummary}
${goals.map((g) => `- [${g.priority}] ${g.title} (${g.category}, deadline ${g.deadline}, progress ${g.progress}%): Method=${g.recommendedMethod} | Missing=${g.missingSkills.join(', ')}${g.woopObstacle ? ` | WOOP_Obstacle="${g.woopObstacle}"` : ''}${g.ifThenPlan ? ` | IfThen="${g.ifThenPlan}"` : ''}`).join('\n') || '- Chưa có mục tiêu nào.'}
${unlockedActiveBosses.map((b) => `- BOSS [${b.rank} · ${b.gateLabel || b.bossRole}]: ${b.title} (HP: ${b.currentHp}/${b.maxHp})`).join('\n') || '- Hiện không có Boss mở khóa chưa hạ.'}

=== CÂY KỸ NĂNG & CHỈ SỐ TĂNG TRƯỞNG ===
${growthBonuses ? `- Tổng nút đã mở: ${growthBonuses.totalUnlockedNodes}/30 | Tổng cấp kỹ năng: ${growthBonuses.totalSkillLevels} | Bậc Phá Giới Hạn: ${growthBonuses.totalAscensions} | Bonus: +${growthBonuses.xpBonusPct}% XP, +${growthBonuses.goldBonusPct}% Gold, +${growthBonuses.masteryBonusPct}% Mastery, +${growthBonuses.focusBonusPct}% Focus, -${growthBonuses.fatigueReductionPct}% Fatigue, ${growthBonuses.maxHearts} Trái Tim` : ''}
${skills.filter((s) => s.unlocked || !s.treeBranch).map((s) => `- ${s.name} [${s.branch}]: ${s.unlocked ? `Bậc ${s.ascensionTier || 1} · Lv.${s.masteryTier}/${s.unlockedRankCap ?? s.maxTier}` : `Tier ${s.masteryTier}/${s.maxTier}`}`).join('\n') || '- Chưa mở khóa nút Kỹ năng nào (tích SP để mở khóa nhánh phù hợp).'}

=== HÀNH VI, REFLECTION, GIAO THỨC KHOA HỌC & LỊCH SỬ THỰC THI ===
- Tỷ lệ hoàn thành Quest: ${completionRate}% (${completedCount} hoàn thành / ${rejectedQuests.length} từ chối)
- Lý do từ chối thường gặp: ${Object.entries(rejectionReasonsCount).map(([k, v]) => `${k}: ${v}`).join(', ') || 'Chưa có'}
- Nhật ký suy ngẫm (Reflection Notes) gần đây:
${recentReflections.join('\n') || '  (Chưa có)'}
- Giao thức Khoa học & Kế hoạch Nếu–Thì gần đây:
${activeProtocolsSummary || '  (Chưa có)'}
- Ứng viên Bjork Spaced Retrieval (đã hoàn thành có Proof hoặc >=1 ngày trước):
${completedReviewCandidates.map((c) => `  • [${c.dateKey}] "${c.title}"${c.proofNote ? ` — Proof: "${c.proofNote.slice(0, 80)}"` : ''}`).join('\n') || '  (Chưa có)'}
- Proof-of-Work gần đây:
${recentProofs || '  (Chưa có)'}
- Tiến trình 7 ngày gần nhất (bao gồm Rest Days & Reflections):
${recentSnapshotsText || '  (Chưa có)'}
- Ghi chú thích nghi gần nhất: ${memoryLogs.slice(0, 4).map((l) => l.insight).join(' | ') || 'Không có'}`;

  return {
    systemInstruction,
    contextDossier,
    statsSummary: {
      completionRate,
      goalsCount: goals.length,
      skillsCount: skills.length,
      freeMinutesToday: todayAnalysis.totalFreeMinutes,
      weakestStat: weakestStat ? `${weakestStat[0]} (${weakestStat[1]})` : 'N/A',
      hasCustomPrompt: Boolean(p.customSystemPrompt?.trim()),
      plannedRestMode: Boolean(player.plannedRestMode),
      flowPacingState: flowPacing.state,
      recentReflectionsCount: recentReflections.length,
      spacedReviewCandidatesCount: completedReviewCandidates.length,
    },
    completedReviewCandidates,
  };
}

export async function listProviderModels(
  settings: AISettings
): Promise<{ ok: boolean; models: string[]; error?: string }> {
  try {
    const cleanBase = settings.baseUrl.replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
    const endpoint = `${cleanBase}/models`;
    const headers: Record<string, string> = {};
    if (settings.apiKey.trim()) {
      headers['Authorization'] = `Bearer ${settings.apiKey.trim()}`;
    }

    const res = await fetch(endpoint, { headers });
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, models: [], error: `HTTP ${res.status}: ${txt.slice(0, 180)}` };
    }
    const json = (await res.json()) as { data?: Array<{ id?: string }> };
    const models = (json.data || [])
      .map((m) => m.id)
      .filter((id): id is string => Boolean(id))
      .slice(0, 60);
    return { ok: true, models };
  } catch (err) {
    return {
      ok: false,
      models: [],
      error: err instanceof Error ? err.message : 'Không lấy được danh sách model.',
    };
  }
}

export async function parseTimetableWithAI(
  rawText: string,
  settings: AISettings
): Promise<{ blocks: Omit<TimetableBlock, 'id'>[]; mode: 'LIVE_LLM' | 'SMART_HEURISTIC' }> {
  if (settings.useLiveLlm && settings.baseUrl) {
    try {
      const systemPrompt = `You are CHRONOS, the schedule parser for THE SYSTEM.
Convert the user's natural language weekly schedule (work shifts, classes, study blocks, training sessions, sleep, meals, habits) into JSON.
dayOfWeek: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday.
If sleep crosses midnight (e.g. 23:30-06:30), split into 23:30-23:59 on day D and 00:00-06:30 on (D+1)%7.
Return ONLY JSON:
{
  "blocks": [
    {
      "dayOfWeek": 1,
      "startTime": "08:00",
      "endTime": "12:00",
      "title": "Khối Công việc / Học tập",
      "type": "class_work" | "sleep" | "commute_meal" | "fixed_habit" | "rest_buffer" | "adhoc_event",
      "energyCost": "NONE" | "LOW" | "MEDIUM" | "HIGH",
      "isRecurring": true
    }
  ]
}`;

      const raw = await callOpenAICompatible(settings, systemPrompt, rawText);
      const parsed = raw ? extractJsonBlock<{ blocks?: Array<Record<string, any>> }>(raw) : null;
      if (parsed && Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
        const validBlocks: Omit<TimetableBlock, 'id'>[] = parsed.blocks
          .filter((b) => b.startTime && b.endTime && typeof b.dayOfWeek === 'number')
          .map((b) => ({
            dayOfWeek: Math.max(0, Math.min(6, Number(b.dayOfWeek))),
            startTime: String(b.startTime),
            endTime: String(b.endTime),
            title: String(b.title || 'Lịch cố định'),
            type: (['sleep', 'class_work', 'commute_meal', 'fixed_habit', 'rest_buffer', 'adhoc_event'].includes(
              b.type
            )
              ? b.type
              : 'class_work') as TimetableBlockType,
            energyCost: (['NONE', 'LOW', 'MEDIUM', 'HIGH'].includes(b.energyCost)
              ? b.energyCost
              : 'MEDIUM') as TimetableBlock['energyCost'],
            isRecurring: b.isRecurring !== false,
          }));
        if (validBlocks.length > 0) {
          return { blocks: validBlocks, mode: 'LIVE_LLM' };
        }
      }
    } catch (err) {
      console.warn('[CHRONOS] Live LLM timetable parse failed, using deterministic parser:', err);
    }
  }

  return {
    blocks: parseNaturalLanguageTimetable(rawText),
    mode: 'SMART_HEURISTIC',
  };
}

interface AnalyzedGoalResult {
  goal: Goal;
  suggestedBoss: BossMission | null;
  suggestedSkills: SkillNode[];
  mode: 'LIVE_LLM' | 'SMART_HEURISTIC';
}

export async function analyzeNaturalLanguageGoal(
  rawInput: string,
  player: PlayerState,
  existingSkills: SkillNode[],
  settings: AISettings,
  distilled?: { systemInstruction: string; contextDossier: string }
): Promise<AnalyzedGoalResult> {
  const today = getVnTodayKey();

  if (settings.useLiveLlm && settings.baseUrl) {
    try {
      const systemPrompt = `${distilled?.systemInstruction ? distilled.systemInstruction + '\n\n' : ''}You are THE SYSTEM's Strategist Agent (Solo Leveling AI Personal Growth OS).
Analyze the user's natural language goal in the context of their complete profile, schedule, and skill gaps.
Return ONLY valid JSON with this exact schema:
{
  "title": "concise Vietnamese/English title",
  "category": "Engineering & Tech" | "Language & IELTS" | "Career & Internship" | "Research & Academic" | "Health & Vitality" | "Personal Mastery",
  "horizon": "short_term" | "long_term",
  "priority": "CRITICAL" | "HIGH" | "MEDIUM",
  "deadline": "YYYY-MM-DD",
  "targetMetric": "measurable outcome",
  "recommendedMethod": "evidence-based learning/training method",
  "subMilestones": ["milestone 1", "milestone 2", "milestone 3"],
  "missingSkills": ["skill gap 1", "skill gap 2"],
  "woopObstacle": "Oettingen WOOP inner psychological/habit obstacle (e.g. perfectionism, phone distraction, fatigue before starting)",
  "ifThenPlan": "Gollwitzer Implementation Intention in Vietnamese: Nếu [rào cản cụ thể] -> Thì [hành động 2 phút cụ thể]",
  "bossTitle": "Epic Solo Leveling Boss Gate Name",
  "bossRank": "C" | "B" | "A" | "S",
  "bossStages": [
    { "title": "Stage 1", "description": "concrete deliverable", "verificationHint": "what proof is required" },
    { "title": "Stage 2", "description": "concrete deliverable", "verificationHint": "what proof is required" }
  ],
  "newSkill": {
    "name": "Skill Name",
    "branch": "Engineering & AI" | "IELTS & Research" | "Vitality & Athletics" | "Career & Soft Skills",
    "description": "why this skill matters",
    "verificationCriteria": "proof required to level up mastery",
    "primaryStat": "INT" | "PER" | "STR" | "VIT" | "AGI" | "CHA"
  }
}`;

      const userPrompt = `${distilled?.contextDossier ? distilled.contextDossier + '\n\n' : ''}Current Date: ${today}
User Goal Input: "${rawInput}"`;

      const raw = await callOpenAICompatible(settings, systemPrompt, userPrompt);
      const parsed = raw ? extractJsonBlock<Record<string, any>>(raw) : null;

      if (parsed && parsed.title) {
        const goalId = uid('goal');
        const goal: Goal = {
          id: goalId,
          rawInput,
          title: String(parsed.title),
          category: parsed.category || 'Personal Mastery',
          horizon: parsed.horizon === 'short_term' ? 'short_term' : 'long_term',
          priority: parsed.priority || 'HIGH',
          deadline: parsed.deadline || '2027-03-30',
          targetMetric: parsed.targetMetric || 'Hoàn thành 100% các cột mốc kiểm chứng',
          recommendedMethod: parsed.recommendedMethod || 'Deliberate Practice + Active Recall',
          subMilestones: Array.isArray(parsed.subMilestones) ? parsed.subMilestones.slice(0, 5) : [],
          missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills.slice(0, 4) : [],
          woopObstacle:
            typeof parsed.woopObstacle === 'string' && parsed.woopObstacle.trim()
              ? parsed.woopObstacle.trim()
              : 'Dễ trì hoãn hoặc bị xao nhãng bởi điện thoại khi bước vào phiên tập trung đầu tiên.',
          ifThenPlan:
            typeof parsed.ifThenPlan === 'string' && parsed.ifThenPlan.trim()
              ? parsed.ifThenPlan.trim()
              : `Nếu thấy ngần ngại khi bắt đầu "${String(parsed.title).slice(0, 32)}" -> Thì bật chế độ máy bay và làm bước nhỏ nhất đúng 2 phút.`,
          progress: 0,
          createdAt: today,
        };

        const stages =
          Array.isArray(parsed.bossStages) && parsed.bossStages.length > 0
            ? parsed.bossStages.map((st: any, idx: number) => ({
                id: uid(`bs-${idx + 1}`),
                title: String(st.title || `Stage ${idx + 1}`),
                description: String(st.description || 'Hoàn thành thử thách giai đoạn'),
                hpDamage: 1000,
                completed: false,
                verificationHint: String(st.verificationHint || 'Nhập tóm tắt kết quả thực tế'),
              }))
            : [
                {
                  id: uid('bs-1'),
                  title: 'Stage 1: Foundation & First Deliverable',
                  description: goal.subMilestones[0] || 'Xây dựng nền tảng và hoàn thành đầu ra đầu tiên.',
                  hpDamage: 1200,
                  completed: false,
                  verificationHint: 'Ghi rõ kết quả kiểm chứng bạn đã tạo ra.',
                },
              ];

        const maxHp = stages.length * 1000;
        const suggestedBoss: BossMission = {
          id: uid('boss'),
          title: String(parsed.bossTitle || `GATE: ${goal.title.toUpperCase()}`),
          subtitle: `Boss được AI kiến tạo từ mục tiêu: ${goal.title}`,
          rank: (['C', 'B', 'A', 'S'].includes(parsed.bossRank) ? parsed.bossRank : 'B') as QuestRank,
          goalId,
          bossRole: 'custom_boss',
          orderIndex: 100,
          unlocked: true,
          gateLabel: 'Mục tiêu Cá nhân',
          maxHp,
          currentHp: maxHp,
          deadline: goal.deadline,
          stages,
          rewardTitle: `Conqueror of ${goal.title.slice(0, 24)}`,
          rewardMastery: 300,
          rewardGold: 250,
          rewardRunestones: 20,
          rewardShadowName: `Shadow of ${goal.title.slice(0, 18)}`,
          defeated: false,
        };

        const suggestedSkills: SkillNode[] = [];
        if (parsed.newSkill && parsed.newSkill.name) {
          const exists = existingSkills.some(
            (s) => s.name.toLowerCase() === String(parsed.newSkill.name).toLowerCase()
          );
          if (!exists) {
            suggestedSkills.push({
              id: uid('sk'),
              name: String(parsed.newSkill.name),
              branch: parsed.newSkill.branch || 'Engineering & AI',
              description: String(parsed.newSkill.description || goal.recommendedMethod),
              practiceXp: 0,
              xpPerTier: 180,
              masteryTier: 0,
              maxTier: 5,
              verificationCriteria: String(parsed.newSkill.verificationCriteria || goal.targetMetric),
              prerequisiteIds: [],
              primaryStat: parsed.newSkill.primaryStat || 'INT',
            });
          }
        }

        return { goal, suggestedBoss, suggestedSkills, mode: 'LIVE_LLM' };
      }
    } catch (err) {
      console.warn('[AI Orchestrator] Live LLM Goal Analysis failed, falling back to Smart Heuristic:', err);
    }
  }

  // Zero-config Smart Domain Heuristic Engine
  const lower = rawInput.toLowerCase();
  const goalId = uid('goal');

  let category: Goal['category'] = 'Personal Mastery';
  let branch: SkillNode['branch'] = 'Career & Soft Skills';
  let primaryStat: keyof StatMap = inferStatFromText(rawInput);
  let rank: QuestRank = 'B';
  let method = 'Deliberate Practice + Active Recall + Weekly Proof-of-Work Review';
  let milestones = [
    'Phân rã tài liệu cốt lõi & thiết lập baseline hiện tại trong 7 ngày',
    'Thực hành có phản hồi (Deliberate Practice) tối thiểu 4 phiên/tuần',
    'Hoàn thành bài kiểm tra tổng hợp / sản phẩm thực tế có thể kiểm chứng',
  ];
  let missingSkills = ['Structured Output Verification', 'Deep Work Timeboxing'];
  let bossTitle = 'GATE OF ASCENSION';
  let shadowName = 'Vanguard — Focus Protocol';
  let woopObstacle =
    'Dễ bị cuốn vào thông báo hoặc do dự vì muốn mọi thứ hoàn hảo ngay lần đầu (Perfectionism Friction).';
  let ifThenPlan =
    'Nếu cảm thấy ngần ngại hoặc muốn kiểm tra điện thoại trước giờ làm -> Thì cất điện thoại sang phòng khác và chạy đúng 2 phút khởi động đầu tiên.';

  if (
    lower.includes('ngoại ngữ') ||
    lower.includes('english') ||
    lower.includes('tiếng ') ||
    lower.includes('language') ||
    lower.includes('speaking') ||
    lower.includes('writing') ||
    lower.includes('ielts') ||
    lower.includes('toeic') ||
    lower.includes('jlpt')
  ) {
    category = 'Language & IELTS';
    branch = 'Knowledge & Synthesis' as SkillNode['branch'];
    primaryStat = 'PER';
    rank = 'A';
    method = 'Shadowing 15m + Spaced Repetition + Timed Output Critique';
    milestones = [
      'Chuẩn hóa phản xạ nghe-nói và tư duy trực tiếp bằng ngôn ngữ mục tiêu',
      'Xây dựng kho cấu trúc diễn đạt & lập luận logic có phản hồi chi tiết',
      'Thực chiến 6 bài đánh giá bấm giờ và phân tích lỗi sai hệ thống',
    ];
    missingSkills = ['Spontaneous Expression', 'Precision & Structure'];
    bossTitle = 'AZURE CITADEL: LANGUAGE MASTERY';
    shadowName = 'Beru — Linguistic Synthesizer';
    woopObstacle = 'Sợ nói/viết sai nên né tránh luyện đầu ra chủ động, chỉ đọc hoặc nghe thụ động.';
    ifThenPlan =
      'Nếu phát hiện bản thân chỉ xem/đọc thụ động quá 10 phút -> Thì dừng lại ngay, đóng nguồn và tự nói/viết lại 3 ý chính bằng Active Recall.';
  } else if (
    lower.includes('intern') ||
    lower.includes('sự nghiệp') ||
    lower.includes('việc') ||
    lower.includes('career') ||
    lower.includes('nghề') ||
    lower.includes('kỹ thuật') ||
    lower.includes('engineer') ||
    lower.includes('code') ||
    lower.includes('sản phẩm') ||
    lower.includes('dự án') ||
    lower.includes('ai')
  ) {
    category =
      lower.includes('intern') || lower.includes('việc') || lower.includes('sự nghiệp') || lower.includes('career')
        ? 'Career & Internship'
        : 'Engineering & Tech';
    branch = 'Cognitive & System Craft' as SkillNode['branch'];
    primaryStat = 'INT';
    rank = 'A';
    method = 'First-Principles Problem Solving + Trade-off Analysis + Real Deliverable Building';
    milestones = [
      'Củng cố năng lực nền tảng & tư duy giải quyết vấn đề dưới áp lực thời gian',
      'Xây dựng 1 sản phẩm hoặc hồ sơ năng lực hoàn chỉnh có tiêu chí đo lường rõ ràng',
      'Thực hành phản biện / phỏng vấn tình huống STAR và tối ưu Portfolio thực tế',
    ];
    missingSkills = ['System & Trade-off Thinking', 'Structured Storytelling'];
    bossTitle = 'IRON MONARCH: MASTERY TRIAL';
    shadowName = 'Igris — Architect Blade';
    woopObstacle = 'Sa đà vào xem hướng dẫn (tutorial loop) hoặc bị phân tâm khi gặp vấn đề khó chưa giải ngay được.';
    ifThenPlan =
      'Nếu bị kẹt quá 10 phút ở một lỗi/bài toán khó -> Thì chuyển sang Oakley Diffused Mode (đi bộ 5 phút không màn hình) rồi quay lại viết giả thuyết kiểm chứng.';
  } else if (
    lower.includes('nghiên cứu') ||
    lower.includes('research') ||
    lower.includes('paper') ||
    lower.includes('luận văn') ||
    lower.includes('học thuật') ||
    lower.includes('đọc sách')
  ) {
    category = 'Research & Academic';
    branch = 'Knowledge & Synthesis' as SkillNode['branch'];
    primaryStat = 'PER';
    rank = 'A';
    method = '3-Pass Reading + Hypothesis Matrix + Reproducible Synthesis Log';
    milestones = [
      'Đọc và tổng hợp 10 tài liệu nền tảng theo ma trận Problem-Method-Gap',
      'Đề xuất giả thuyết cải tiến hoặc khung phân tích kiểm chứng được',
      'Viết báo cáo tổng hợp / bản thảo hoàn chỉnh và phản biện đa chiều',
    ];
    missingSkills = ['Critical Literature Synthesis', 'Analytical Rigor'];
    bossTitle = 'ARCANE ARCHIVE: RESEARCH GATE';
    shadowName = 'Tusk — Knowledge Weaver';
    woopObstacle = 'Đọc lan man nhiều tài liệu nhưng không tổng hợp lại, dẫn đến quên nhanh sau 24 giờ.';
    ifThenPlan =
      'Nếu vừa đọc xong 1 chương hoặc 1 tài liệu -> Thì gấp lại ngay 5 phút để viết 3 luận điểm cốt lõi theo giao thức Dunlosky Retrieval Practice.';
  } else if (
    lower.includes('sức khỏe') ||
    lower.includes('gym') ||
    lower.includes('chạy') ||
    lower.includes('ngủ') ||
    lower.includes('fitness') ||
    lower.includes('thể chất') ||
    lower.includes('giảm cân') ||
    lower.includes('thiền')
  ) {
    category = 'Health & Vitality';
    branch = 'Vitality & Athletics';
    primaryStat = lower.includes('ngủ') || lower.includes('thiền') ? 'VIT' : 'STR';
    rank = 'C';
    method = 'Progressive Overload + Sleep Anchor Protocol + Zone 2 Cardio';
    milestones = [
      'Thiết lập kỷ luật giờ ngủ cố định & đủ nước 14 ngày liên tiếp',
      'Hoàn thành lịch tập 3-4 buổi/tuần đúng kỹ thuật và ghi nhận chỉ số tiến bộ',
      'Đạt cột mốc sức bền hoặc thể lực mục tiêu mà không chấn thương',
    ];
    missingSkills = ['Recovery Optimization', 'Consistent Load Progression'];
    bossTitle = 'TITAN SANCTUARY: VITALITY TRIAL';
    shadowName = 'Iron — Endurance Shield';
    woopObstacle = 'Mệt mỏi cuối ngày hoặc thức khuya dùng màn hình khiến buổi tập và giấc ngủ ngày hôm sau bị phá vỡ.';
    ifThenPlan =
      'Nếu đến 22:30 hoặc thấy uể oải trước buổi tập -> Thì bật Digital Sunset (đặt điện thoại xa giường) hoặc chỉ mặc đồ tập và vận động nhẹ 10 phút.';
  } else if (
    lower.includes('lãnh đạo') ||
    lower.includes('giao tiếp') ||
    lower.includes('thuyết trình') ||
    lower.includes('tài chính') ||
    lower.includes('kinh doanh') ||
    lower.includes('sáng tạo')
  ) {
    category = 'Personal Mastery';
    branch = 'Career & Soft Skills';
    primaryStat = 'CHA';
    rank = 'B';
    method = 'Feedback-Driven Rehearsal + Case Synthesis + Weekly Public Output';
    milestones = [
      'Xác định chuẩn đầu ra rõ ràng và thiết lập hệ thống đo lường hàng tuần',
      'Thực hành tạo đầu ra thực tế (bài viết, thuyết trình, kế hoạch) ít nhất 3 lần/tuần',
      'Thu thập phản hồi thực tế từ mentor/đối tác và tinh chỉnh chiến lược',
    ];
    missingSkills = ['Persuasive Framing', 'Consistent Output Cadence'];
    bossTitle = 'SOVEREIGN CITADEL: INFLUENCE GATE';
    shadowName = 'Bellion — Strategic Vanguard';
    woopObstacle = 'Ngại phản hồi trực diện hoặc trì hoãn công bố sản phẩm vì sợ chưa đủ hoàn hảo.';
    ifThenPlan =
      'Nếu chần chừ không dám gửi bản nháp / trình bày ý tưởng -> Thì áp dụng quy tắc "bản nháp thô 20 phút" và xin phản hồi có cấu trúc ngay trong ngày.';
  }

  const cleanTitle = rawInput.length > 56 ? `${rawInput.slice(0, 53)}...` : rawInput;
  const goal: Goal = {
    id: goalId,
    rawInput,
    title: cleanTitle,
    category,
    horizon: lower.includes('tuần') || lower.includes('tháng này') ? 'short_term' : 'long_term',
    priority: 'HIGH',
    deadline: '2027-03-30',
    targetMetric: `Đạt 100% các mốc kiểm chứng của "${cleanTitle}"`,
    recommendedMethod: method,
    subMilestones: milestones,
    missingSkills,
    woopObstacle,
    ifThenPlan,
    progress: 0,
    createdAt: today,
  };

  const bossStages = milestones.map((m, idx) => ({
    id: uid(`bs-${idx + 1}`),
    title: `Phase ${idx + 1}: ${m.slice(0, 48)}`,
    description: m,
    hpDamage: 1000,
    completed: false,
    verificationHint: 'Mô tả bằng chứng thực tế hoặc chỉ số bạn đạt được ở giai đoạn này.',
  }));

  const suggestedBoss: BossMission = {
    id: uid('boss'),
    title: bossTitle,
    subtitle: `Boss Mission tạo tự động cho: ${cleanTitle}`,
    rank,
    goalId,
    bossRole: 'custom_boss',
    orderIndex: 100,
    unlocked: true,
    gateLabel: 'Mục tiêu Cá nhân',
    maxHp: bossStages.length * 1000,
    currentHp: bossStages.length * 1000,
    deadline: goal.deadline,
    stages: bossStages,
    rewardTitle: `Master of ${cleanTitle.slice(0, 20)}`,
    rewardMastery: 280,
    rewardGold: 250,
    rewardRunestones: 20,
    rewardShadowName: shadowName,
    defeated: false,
  };

  const suggestedSkills: SkillNode[] = [];
  const candidateSkillName = missingSkills[0];
  if (
    candidateSkillName &&
    !existingSkills.some((s) => s.name.toLowerCase() === candidateSkillName.toLowerCase())
  ) {
    suggestedSkills.push({
      id: uid('sk'),
      name: candidateSkillName,
      branch,
      description: `Kỹ năng còn thiếu được [STRATEGIST AGENT] phát hiện từ mục tiêu "${cleanTitle}".`,
      practiceXp: 0,
      xpPerTier: 180,
      masteryTier: 0,
      maxTier: 5,
      verificationCriteria: milestones[0],
      prerequisiteIds: [],
      primaryStat,
    });
  }

  return { goal, suggestedBoss, suggestedSkills, mode: 'SMART_HEURISTIC' };
}

export interface OrchestrateOptions {
  dateKey: string;
  focusNote?: string;
  rejectedContext?: { questTitle: string; reason: RejectionReason };
  recentQuests?: Quest[];
  distilled?: {
    systemInstruction: string;
    contextDossier: string;
    completedReviewCandidates?: CompletedReviewCandidate[];
  };
}

export async function runMultiAgentOrchestration(
  player: PlayerState,
  goals: Goal[],
  dayAnalysis: DayScheduleAnalysis,
  skills: SkillNode[],
  memoryLogs: AgentMemoryLog[],
  settings: AISettings,
  options: OrchestrateOptions
): Promise<{ quests: Quest[]; deliberation: CouncilDeliberation }> {
  const allocator = new SlotAllocator(dayAnalysis.freeWindows);

  const recentRejections = memoryLogs
    .filter((l) => l.eventType === 'QUEST_REJECTED')
    .slice(0, 5)
    .map((l) => l.insight);

  const latestReflectionLog = memoryLogs.find((l) =>
    l.insight.startsWith('Reflection của Player:')
  )?.insight;

  const flowPacing = analyzeFlowAndPacing({
    player,
    dayAnalysis,
    goalsCount: goals.length,
    recentRejectionsCount: options.rejectedContext
      ? recentRejections.length + 1
      : recentRejections.length,
  });

  const lowEnergy = flowPacing.state === 'RECOVERY_NEEDED';
  const freeDayExpansion =
    dayAnalysis.isFreeDayExpansion && flowPacing.state === 'FLOW_CHANNEL';

  const fixedClassBlocks = dayAnalysis.blocks.filter(
    (b) => b.type === 'class_work' || b.type === 'fixed_habit'
  );
  const fixedBlocksText =
    fixedClassBlocks.map((b) => `${b.startTime}-${b.endTime}: ${b.title}`).join('; ') ||
    'Không có lịch cố định';

  const customDirectiveNote = player.profile.customSystemPrompt?.trim()
    ? ` (Ưu tiên định hướng riêng: "${player.profile.customSystemPrompt.trim().slice(0, 80)}")`
    : '';

  const priorityRank: Record<Goal['priority'], number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
  };
  const prioritizedGoals = [...goals].sort(
    (a, b) => priorityRank[a.priority] - priorityRank[b.priority] || a.progress - b.progress
  );

  // Attempt Live LLM Multi-Agent Council if enabled
  if (settings.useLiveLlm && settings.baseUrl) {
    try {
      const systemPrompt = `${options.distilled?.systemInstruction ? options.distilled.systemInstruction + '\n\n' : ''}You are THE ARCHITECT — Central Orchestrator of THE SYSTEM (Solo Leveling AI Personal Growth OS).
You coordinate 4 specialized agents:
1. [STRATEGIST]: Finds highest-leverage tasks aligned with the user's actual goals, target skills, and weakest growth dimensions (INT, PER, AGI, STR, VIT, CHA).
2. [CHRONOS]: Reads today's FIXED SCHEDULE (work shifts, classes, study blocks, training, sleep) and maps quests strictly into FREE WINDOWS without duplicating effort already spent in fixed blocks.
3. [SCHOLAR]: Injects proven learning/execution methods (Feynman, Active Recall, Deliberate Practice, Deep Work Timeboxing).
4. [VITALITY]: Protects sleep, recovery, and Planned Rest Mode (Grace Day). Evaluates Csíkszentmihályi Flow State & Persona 5 Pacing: current state is ${flowPacing.state} (${flowPacing.label}).

Return ONLY valid JSON matching this schema:
{
  "agentNotes": [
    { "agent": "STRATEGIST", "message": "..." },
    { "agent": "CHRONOS", "message": "..." },
    { "agent": "SCHOLAR", "message": "..." },
    { "agent": "VITALITY", "message": "..." }
  ],
  "systemDirective": "1 crisp Hades-style Adaptive Narrative Bark in Vietnamese prefixed with [${flowPacing.state}]",
  "quests": [
    {
      "type": "daily" | "main" | "side" | "hidden" | "recovery",
      "rank": "E" | "D" | "C" | "B" | "A" | "S",
      "title": "Actionable quest title in Vietnamese",
      "description": "Concrete step-by-step description in Vietnamese",
      "learningMethod": "Method used (e.g. Active Recall, Deep Work Timeboxing)",
      "reasoning": "Why the AI chose this for the player today (referencing their schedule, flow state, reflections & goals)",
      "agentSource": "STRATEGIST" | "CHRONOS" | "SCHOLAR" | "CAREER" | "VITALITY" | "ARCHITECT",
      "durationMinutes": 20 | 25 | 30 | 45 | 60,
      "xpReward": 60,
      "masteryReward": 15,
      "goldReward": 40,
      "primaryStat": "INT" | "PER" | "STR" | "VIT" | "AGI" | "CHA",
      "requiresProof": true | false,
      "scientificProtocol": "Peer-reviewed protocol name (e.g. Dunlosky Retrieval Practice, Bjork Spaced Retrieval, Ericsson Deliberate Practice, Huberman 90m Ultradian + NSDR, Oakley Focused-Diffused Mode, Gollwitzer If-Then)",
      "ifThenTrigger": "Nếu [rào cản cụ thể] -> Thì [hành động 2 phút cụ thể]",
      "subtasks": ["subtask 1", "subtask 2", "subtask 3"]
    }
  ]
}
Keep total quest duration <= ${flowPacing.recommendedQuestMinutes} minutes. Generate between 1 and ${flowPacing.recommendedMaxQuests} quests.`;

      const userPrompt = `${options.distilled?.contextDossier || ''}

=== YÊU CẦU ĐIỀU PHỐI HÔM NAY (${options.dateKey}) ===
Flow State & Pacing: ${flowPacing.state} — ${flowPacing.pacingDirective}
Planned Rest Mode (Grace Day): ${player.plannedRestMode ? 'ACTIVE' : 'OFF'}
User Focus Note Today: "${options.focusNote || 'Optimize balanced daily progression'}"
${options.distilled?.completedReviewCandidates?.length ? `Bjork Spaced Retrieval Candidates: ${options.distilled.completedReviewCandidates.map((c) => `"${c.title}" (${c.dateKey})`).join(', ')}` : ''}
${options.rejectedContext ? `User just rejected "${options.rejectedContext.questTitle}" due to: ${options.rejectedContext.reason}. Adapt immediately.` : ''}`;

      const raw = await callOpenAICompatible(settings, systemPrompt, userPrompt);
      const parsed = raw ? extractJsonBlock<Record<string, any>>(raw) : null;

      if (parsed && Array.isArray(parsed.quests) && parsed.quests.length > 0) {
        let remainingBudget = Math.max(30, flowPacing.recommendedQuestMinutes);
        const quests: Quest[] = [];

        for (const q of parsed.quests.slice(0, flowPacing.recommendedMaxQuests)) {
          const dur = Math.max(15, Math.min(90, Number(q.durationMinutes) || 30));
          if (quests.length >= 1 && remainingBudget < dur) continue;
          remainingBudget -= dur;

          const statKey = (['INT', 'PER', 'STR', 'VIT', 'AGI', 'CHA'].includes(q.primaryStat)
            ? q.primaryStat
            : inferStatFromText(`${q.title} ${q.description}`)) as AttributeKey;

          const matchedGoal = prioritizedGoals.find(
            (g) =>
              q.title?.toLowerCase().includes(g.title.toLowerCase().slice(0, 6)) ||
              resolveGoalStat(g) === statKey
          );

          const matchedSkill = skills.find((s) => s.primaryStat === statKey);

          const qType = (['daily', 'main', 'side', 'hidden', 'recovery'].includes(q.type)
            ? q.type
            : 'main') as QuestType;
          const qTitle = String(q.title);
          const qMethod = String(q.learningMethod || 'Deliberate Practice');

          quests.push({
            id: uid('q'),
            dateKey: options.dateKey,
            type: qType,
            rank: (['E', 'D', 'C', 'B', 'A', 'S'].includes(q.rank) ? q.rank : 'C') as QuestRank,
            title: qTitle,
            description: String(q.description),
            learningMethod: qMethod,
            reasoning: String(
              q.reasoning || 'Được điều phối dựa trên trạng thái Flow, lịch trình và mục tiêu trọng tâm.'
            ),
            agentSource: q.agentSource || 'ARCHITECT',
            goalId: matchedGoal?.id,
            skillId: matchedSkill?.id,
            scheduledSlot: allocator.allocate(dur, dur >= 45),
            durationMinutes: dur,
            xpReward: Number(q.xpReward) || Math.round(dur * 1.8),
            masteryReward: q.requiresProof ? Number(q.masteryReward) || 20 : 0,
            goldReward: Number(q.goldReward) || Math.round(dur * 1.1),
            statRewards: { [statKey]: dur >= 45 ? 2 : 1 },
            subtasks: Array.isArray(q.subtasks)
              ? q.subtasks.slice(0, 4).map((lbl: any, idx: number) => ({
                  id: uid(`sub-${idx}`),
                  label: String(lbl),
                  done: false,
                }))
              : [
                  { id: uid('sub-1'), label: 'Chuẩn bị môi trường & tắt thông báo nhiễu', done: false },
                  { id: uid('sub-2'), label: 'Thực hiện phiên tập trung trọn vẹn', done: false },
                ],
            status: 'pending',
            requiresProof: Boolean(q.requiresProof),
            scientificProtocol:
              typeof q.scientificProtocol === 'string' && q.scientificProtocol.trim()
                ? q.scientificProtocol.trim()
                : inferScientificProtocol({
                    questType: qType,
                    durationMinutes: dur,
                    learningMethod: qMethod,
                    title: qTitle,
                  }),
            ifThenTrigger:
              typeof q.ifThenTrigger === 'string' && q.ifThenTrigger.trim()
                ? q.ifThenTrigger.trim()
                : matchedGoal?.ifThenPlan ||
                  buildIfThenTrigger({
                    title: qTitle,
                    flowState: flowPacing.state,
                    obstacleHint: matchedGoal?.woopObstacle,
                  }),
            createdAt: new Date().toISOString(),
          });
        }

        if (quests.length > 0) {
          const rawDirective = String(parsed.systemDirective || '').trim();
          const hasStateTag = rawDirective.includes(flowPacing.state);
          const systemDirective = rawDirective
            ? hasStateTag
              ? rawDirective
              : `[${flowPacing.state}] ${rawDirective}`
            : buildHadesNarrativeBark({
                flowPacing,
                player,
                primaryGoalTitle: prioritizedGoals[0]?.title,
                latestReflection: latestReflectionLog,
                rejectedContext: options.rejectedContext,
                questsCount: quests.length,
              });

          const deliberation: CouncilDeliberation = {
            dateKey: options.dateKey,
            generatedAt: new Date().toISOString(),
            mode: 'LIVE_LLM',
            modelUsed: settings.model || 'OpenAI-Compatible',
            agentNotes: Array.isArray(parsed.agentNotes)
              ? parsed.agentNotes
              : [
                  { agent: 'ARCHITECT', message: 'Đã tổng hợp đề xuất từ hội đồng Agent qua Live LLM.' },
                ],
            systemDirective,
          };
          return { quests, deliberation };
        }
      }
    } catch (err) {
      console.warn('[AI Orchestrator] Live LLM Orchestration fallback:', err);
    }
  }

  // Deterministic + Schedule-Content-Aware + Flow-Pacing Smart Heuristic Engine
  const agentNotes: CouncilDeliberation['agentNotes'] = [];
  const quests: Quest[] = [];
  let budget = Math.max(30, flowPacing.recommendedQuestMinutes);

  const rejectedTooHard =
    options.rejectedContext?.reason === 'too_hard' ||
    options.rejectedContext?.reason === 'low_energy' ||
    recentRejections.some((r) => r.includes('too_hard') || r.includes('low_energy'));

  const rejectedNoTime = options.rejectedContext?.reason === 'no_time';

  // 1. VITALITY & PLANNED REST GUARDIAN
  if (flowPacing.state === 'RECOVERY_NEEDED') {
    agentNotes.push({
      agent: 'VITALITY',
      message: player.plannedRestMode
        ? `Chế độ Nghỉ Chủ Động (Grace Day) đang bật — Persona 5 Pacing: giảm tải tối đa để bảo vệ nhịp bền vững và giữ streak ${player.streakDays} ngày.`
        : `Cảnh báo [${flowPacing.state}]: Energy ${player.energyLevel}%, Fatigue ${player.fatigue}%. Kích hoạt Burnout Shield — ưu tiên phục hồi thần kinh & giấc ngủ.`,
    });

    const dur = 20;
    budget -= dur;
    quests.push({
      id: uid('q'),
      dateKey: options.dateKey,
      type: 'recovery',
      rank: 'D',
      title: player.plannedRestMode
        ? 'Grace Day Sanctuary: Hồi phục Chủ động & Suy ngẫm Nhẹ'
        : 'Giao thức Hồi phục Thể chất & Ngắt nhiễu Thần kinh',
      description: player.plannedRestMode
        ? 'Thực hiện 15 phút vận động nhẹ hoặc đi dạo không màn hình, uống đủ nước và viết 1 dòng Reflection tổng kết để bảo toàn đà tiến.'
        : 'Đi bộ nhẹ ngoài trời hoặc giãn cơ 15 phút, uống đủ nước và thực hiện 5 phút thở sâu không màn hình để kéo Fatigue xuống.',
      learningMethod: 'NSDR / Active Parasympathetic Recovery',
      reasoning: player.plannedRestMode
        ? '[PLANNED REST MODE] Nghỉ ngơi có chủ đích giúp duy trì hành trình chinh phục các Chương mà không kiệt sức.'
        : `Energy (${player.energyLevel}%) đang thấp. Cố ép Deep Work lúc này sẽ làm giảm hiệu suất ghi nhớ.`,
      agentSource: 'VITALITY',
      skillId: skills.find((s) => s.primaryStat === 'VIT')?.id,
      scheduledSlot: allocator.allocate(dur, false),
      durationMinutes: dur,
      xpReward: 65,
      masteryReward: 10,
      goldReward: 40,
      statRewards: { VIT: 2, AGI: 1 },
      subtasks: [
        { id: uid('s1'), label: 'Rời khỏi màn hình & bổ sung 400ml nước', done: false },
        { id: uid('s2'), label: '15 phút đi bộ / giãn cơ cổ vai gáy', done: false },
        { id: uid('s3'), label: 'Chốt giờ đi ngủ sớm hơn 30 phút tối nay', done: false },
      ],
      status: 'pending',
      requiresProof: false,
      scientificProtocol: 'Huberman NSDR & Walker Sleep Consolidation',
      ifThenTrigger: buildIfThenTrigger({
        title: player.plannedRestMode ? 'Grace Day Sanctuary' : 'Phục hồi Thần kinh',
        flowState: flowPacing.state,
        obstacleHint: 'muốn mở công việc nặng hoặc lướt mạng xã hội trong giờ nghỉ',
      }),
      createdAt: new Date().toISOString(),
    });
  } else {
    agentNotes.push({
      agent: 'VITALITY',
      message: `Flow/Pacing: ${flowPacing.state} (${player.energyLevel}% Energy, ${Math.round((dayAnalysis.totalSleepMinutes / 60) * 10) / 10}h ngủ). ${flowPacing.pacingDirective}`,
    });
  }

  // 2. CHRONOS SCHEDULE ANALYSIS
  agentNotes.push({
    agent: 'CHRONOS',
    message: `Lịch cố định hôm nay: [${fixedBlocksText}]. Có ${dayAnalysis.freeWindows.length} cửa sổ rảnh (${dayAnalysis.totalFreeMinutes}m tổng) — ngân sách điều phối ${flowPacing.recommendedQuestMinutes}m.`,
  });

  // 3. UNIVERSAL TIMETABLE-AWARE ACTIVE RECALL SYNTHESIS (when user has fixed blocks today)
  const primaryWorkStudyBlock = dayAnalysis.blocks.find((b) => b.type === 'class_work');
  if (
    primaryWorkStudyBlock &&
    !player.plannedRestMode &&
    budget >= 25 &&
    quests.length < flowPacing.recommendedMaxQuests
  ) {
    const dur = 25;
    budget -= dur;
    const blockStat = inferStatFromText(primaryWorkStudyBlock.title);
    quests.push({
      id: uid('q'),
      dateKey: options.dateKey,
      type: 'daily',
      rank: flowPacing.state === 'OVERLOAD_ANXIETY' ? 'D' : 'C',
      title: `Active Recall Synthesis: Tổng hợp sau "${primaryWorkStudyBlock.title}"`,
      description: `Sau khối lịch cố định "${primaryWorkStudyBlock.title}" (${primaryWorkStudyBlock.startTime}–${primaryWorkStudyBlock.endTime}), dành 25 phút gấp tài liệu lại và tóm tắt 3 ý cốt lõi + 1 câu hỏi mở cần giải quyết tiếp.${customDirectiveNote}`,
      learningMethod: 'Feynman Technique + Blurting Synthesis',
      reasoning: `[CHRONOS & SCHOLAR] Chuyển hóa thời gian cố định ("${primaryWorkStudyBlock.title}") thành trí nhớ dài hạn và đầu ra rõ ràng mà không gây quá tải.`,
      agentSource: 'SCHOLAR',
      skillId: skills.find((s) => s.primaryStat === 'PER' || s.primaryStat === blockStat)?.id,
      scheduledSlot: allocator.allocate(dur, false),
      durationMinutes: dur,
      xpReward: 65,
      masteryReward: 15,
      goldReward: 40,
      statRewards: { PER: 2, [blockStat === 'PER' ? 'INT' : blockStat]: 1 },
      subtasks: [
        { id: uid('s1'), label: 'Đóng nguồn tham khảo, viết lại 3 điểm cốt lõi trong 10 phút', done: false },
        { id: uid('s2'), label: 'Đối chiếu lại để lấp lỗ hổng hoặc chốt 1 hành động tiếp theo', done: false },
      ],
      status: 'pending',
      requiresProof: true,
      scientificProtocol: 'Dunlosky (2013) Retrieval Practice & Feynman Synthesis',
      ifThenTrigger: buildIfThenTrigger({
        title: `Tổng hợp sau "${primaryWorkStudyBlock.title}"`,
        flowState: flowPacing.state,
        obstacleHint: `vừa kết thúc "${primaryWorkStudyBlock.title}" và thấy ngại viết lại`,
      }),
      createdAt: new Date().toISOString(),
    });
  }

  // 4. GOAL-DRIVEN DEEP WORK QUESTS (Tailored to user's actual goals & Flow state)
  if (!player.plannedRestMode) {
    const goalLimit = flowPacing.state === 'FLOW_CHANNEL' ? 2 : 1;
    for (const goal of prioritizedGoals.slice(0, goalLimit)) {
      if (quests.length >= flowPacing.recommendedMaxQuests) break;
      const dur =
        lowEnergy || rejectedNoTime || rejectedTooHard || flowPacing.state === 'OVERLOAD_ANXIETY'
          ? 25
          : flowPacing.state === 'FLOW_CHANNEL'
            ? 50
            : 35;
      if (budget < dur) break;
      budget -= dur;

      const statKey = resolveGoalStat(goal);
      const matchedSkill = skills.find((s) => s.primaryStat === statKey);

      quests.push({
        id: uid('q'),
        dateKey: options.dateKey,
        type: quests.length === 0 ? 'daily' : 'main',
        rank:
          flowPacing.state === 'OVERLOAD_ANXIETY' || lowEnergy
            ? 'D'
            : goal.priority === 'CRITICAL'
              ? 'B'
              : 'C',
        title: `Deep Work: ${goal.title}`,
        description: `Thực hiện phiên tập trung ${dur} phút cho mục tiêu "${goal.title}" theo phương pháp: ${goal.recommendedMethod}. Mốc hướng tới: ${goal.subMilestones[0] || goal.targetMetric}.${options.focusNote ? ` Ghi chú hôm nay: ${options.focusNote}.` : ''}${customDirectiveNote}`,
        learningMethod: goal.recommendedMethod,
        reasoning: `[${flowPacing.state}] Đóng góp trực tiếp vào mục tiêu ưu tiên ${goal.priority} (${goal.category}) trong cửa sổ rảnh thực tế.`,
        agentSource: 'STRATEGIST',
        goalId: goal.id,
        skillId: matchedSkill?.id,
        scheduledSlot: allocator.allocate(dur, dur >= 45),
        durationMinutes: dur,
        xpReward: Math.round(dur * 2.1),
        masteryReward: 25,
        goldReward: Math.round(dur * 1.3),
        statRewards: { [statKey]: 2, AGI: 1 },
        subtasks: [
          { id: uid('s1'), label: `Chốt 1 đầu ra cụ thể cho "${goal.title}" (2 phút khởi động)`, done: false },
          { id: uid('s2'), label: `Hoàn thành ${dur} phút tập trung không xao nhãng`, done: false },
          { id: uid('s3'), label: 'Ghi lại bằng chứng hoàn thành (Proof-of-Work)', done: false },
        ],
        status: 'pending',
        requiresProof: true,
        scientificProtocol:
          dur >= 50
            ? 'Huberman Ultradian Deep Work & Ericsson Deliberate Practice'
            : 'Ericsson Deliberate Practice + Gollwitzer Implementation Intention',
        ifThenTrigger:
          goal.ifThenPlan ||
          buildIfThenTrigger({
            title: goal.title,
            flowState: flowPacing.state,
            obstacleHint: goal.woopObstacle,
          }),
        createdAt: new Date().toISOString(),
      });
    }
  }

  // 5. UNIVERSAL DYNAMIC QUESTS (When no goals configured yet OR filling balanced Deep Work / Active Recall / Vitality)
  if (prioritizedGoals.length === 0 && !player.plannedRestMode) {
    const focusAnchor =
      options.focusNote?.trim() ||
      player.profile.targetSkills[0] ||
      player.profile.currentRole ||
      'Lĩnh vực ưu tiên của bạn';
    const anchorStat = inferStatFromText(
      `${options.focusNote || ''} ${player.profile.targetSkills.join(' ')} ${player.profile.customSystemPrompt || ''}`
    );

    if (budget >= 30 && quests.length < flowPacing.recommendedMaxQuests) {
      const dur = flowPacing.state === 'FLOW_CHANNEL' ? 40 : 30;
      budget -= dur;
      quests.push({
        id: uid('q'),
        dateKey: options.dateKey,
        type: 'daily',
        rank: 'E',
        title: `Deep Work Sprint: Tạo đầu ra cho "${focusAnchor.slice(0, 38)}"`,
        description: `Dành ${dur} phút tập trung sâu hoàn toàn (tắt thông báo) để hoàn thành 1 đầu việc có giá trị đo lường cho "${focusAnchor}".${customDirectiveNote}`,
        learningMethod: player.profile.learningStyle || 'Deep Work Timeboxing + 2-Minute Start',
        reasoning: `[${flowPacing.state}] Tạo nhịp thực thi cốt lõi ngay cả khi bạn chưa khóa danh sách mục tiêu dài hạn.`,
        agentSource: 'STRATEGIST',
        skillId: skills.find((s) => s.primaryStat === anchorStat || s.primaryStat === 'AGI')?.id,
        scheduledSlot: allocator.allocate(dur, dur >= 40),
        durationMinutes: dur,
        xpReward: Math.round(dur * 2),
        masteryReward: 20,
        goldReward: Math.round(dur * 1.2),
        statRewards: { [anchorStat]: 2, AGI: 1 },
        subtasks: [
          { id: uid('s1'), label: 'Dùng quy tắc 2 phút để mở tài liệu / công cụ và bắt đầu ngay', done: false },
          { id: uid('s2'), label: `Hoàn tất ${dur} phút làm việc đơn nhiệm (Single-Tasking)`, done: false },
          { id: uid('s3'), label: 'Ghi lại 1 dòng kết quả đạt được sau phiên', done: false },
        ],
        status: 'pending',
        requiresProof: true,
        scientificProtocol:
          dur >= 40
            ? 'Oakley Focused Mode & Huberman Ultradian Sprint'
            : 'Gollwitzer Implementation Intentions & 2-Minute Micro-Start',
        ifThenTrigger: buildIfThenTrigger({
          title: focusAnchor,
          flowState: flowPacing.state,
        }),
        createdAt: new Date().toISOString(),
      });
    }

    if (budget >= 20 && quests.length < flowPacing.recommendedMaxQuests && !primaryWorkStudyBlock) {
      const dur = 20;
      budget -= dur;
      quests.push({
        id: uid('q'),
        dateKey: options.dateKey,
        type: 'side',
        rank: 'E',
        title: 'Active Recall Synthesis & Định hình Lộ trình Cá nhân',
        description:
          'Dành 20 phút tổng hợp lại 3 điều quan trọng nhất bạn học hoặc làm gần đây theo phương pháp Feynman, đồng thời thêm ít nhất 1 mục tiêu cá nhân vào tab ARCHITECT.',
        learningMethod: 'Active Recall + Goal Decomposition',
        reasoning:
          'Kết hợp tổng hợp tri thức chủ động với việc nạp mục tiêu thật để Hội đồng AI cá nhân hóa lộ trình sâu hơn.',
        agentSource: 'SCHOLAR',
        skillId: skills.find((s) => s.primaryStat === 'PER')?.id,
        scheduledSlot: allocator.allocate(dur, false),
        durationMinutes: dur,
        xpReward: 55,
        masteryReward: 15,
        goldReward: 35,
        statRewards: { PER: 1, CHA: 1 },
        subtasks: [
          { id: uid('s1'), label: 'Viết lại 3 ý cốt lõi bạn rút ra trong tuần này', done: false },
          { id: uid('s2'), label: 'Nhập 1 mục tiêu thực tế vào tab ARCHITECT & kiểm tra lịch CHRONOS', done: false },
        ],
        status: 'pending',
        requiresProof: false,
        scientificProtocol: 'Dunlosky (2013) Retrieval Practice & Oettingen WOOP Framing',
        ifThenTrigger: buildIfThenTrigger({
          title: 'Active Recall Synthesis',
          flowState: flowPacing.state,
          obstacleHint: 'chưa biết bắt đầu từ đâu khi tổng hợp kiến thức',
        }),
        createdAt: new Date().toISOString(),
      });
    }
  }

  // 6. VITALITY ANCHOR QUEST (when not already in recovery and budget & slots remain)
  const hasVitalityQuest = quests.some((q) => q.type === 'recovery' || q.agentSource === 'VITALITY');
  if (
    !hasVitalityQuest &&
    !player.plannedRestMode &&
    budget >= 20 &&
    quests.length < flowPacing.recommendedMaxQuests
  ) {
    const dur = 20;
    budget -= dur;
    const isStrengthFocus = player.stats.STR <= player.stats.VIT;
    quests.push({
      id: uid('q'),
      dateKey: options.dateKey,
      type: 'side',
      rank: 'D',
      title: isStrengthFocus
        ? 'Vitality & Strength: 20m Vận động Thể chất Chủ động'
        : 'Vitality Anchor: 20m Phục hồi Nhịp Sinh học & Mobility',
      description: isStrengthFocus
        ? 'Thực hiện 20 phút vận động nâng nhịp tim (đi bộ nhanh, chạy bộ, hít đất hoặc giãn cơ toàn thân) để tăng nền tảng Energy và sức bền.'
        : 'Dành 20 phút giãn cơ, hít thở sâu ngoài trời sáng/chiều và thiết lập điểm ngắt màn hình trước giờ ngủ.',
      learningMethod: 'Zone 2 Conditioning + Sleep Anchor',
      reasoning: '[VITALITY] Năng lượng và sức bền thể chất là bệ phóng cho trí tuệ và kỷ luật trong hành trình chinh phục các Chương.',
      agentSource: 'VITALITY',
      skillId: skills.find((s) => s.primaryStat === (isStrengthFocus ? 'STR' : 'VIT'))?.id,
      scheduledSlot: allocator.allocate(dur, false),
      durationMinutes: dur,
      xpReward: 55,
      masteryReward: 10,
      goldReward: 35,
      statRewards: { [isStrengthFocus ? 'STR' : 'VIT']: 2 },
      subtasks: [
        { id: uid('s1'), label: 'Bổ sung nước và khởi động 3 phút', done: false },
        { id: uid('s2'), label: 'Hoàn thành 15-20 phút vận động / giãn cơ không xao nhãng', done: false },
      ],
      status: 'pending',
      requiresProof: false,
      scientificProtocol: isStrengthFocus
        ? 'Bjork Desirable Difficulties & Zone 2 Conditioning'
        : 'Huberman NSDR & Circadian Sleep Anchor',
      ifThenTrigger: buildIfThenTrigger({
        title: isStrengthFocus ? 'Vận động Thể chất 20m' : 'Phục hồi Nhịp Sinh học',
        flowState: flowPacing.state,
        obstacleHint: 'cơ thể ỳ ạch muốn bỏ qua giờ vận động hoặc ngủ muộn',
      }),
      createdAt: new Date().toISOString(),
    });
  }

  // 6B. BJORK SPACED RETRIEVAL CHECK (from recently completed quests with proofNote or >= 1 day old)
  const spacedCandidatesFromOptions: CompletedReviewCandidate[] =
    options.distilled?.completedReviewCandidates ||
    (options.recentQuests || [])
      .filter((q) => {
        if (q.status !== 'completed' || q.title.startsWith('Spaced Retrieval:')) return false;
        return Boolean(q.proofNote?.trim()) || (q.dateKey && q.dateKey < options.dateKey);
      })
      .map((q) => ({
        title: q.title,
        dateKey: q.dateKey,
        proofNote: q.proofNote,
        primaryStat: (Object.keys(q.statRewards || {})[0] as AttributeKey) || inferStatFromText(q.title),
        goalId: q.goalId,
        skillId: q.skillId,
      }));

  const fallbackLogCandidate = memoryLogs.find(
    (l) =>
      l.eventType === 'QUEST_COMPLETED' &&
      !l.summary.includes('Spaced Retrieval:') &&
      (l.insight.includes('Proof-of-Work:') || l.timestamp.slice(0, 10) < options.dateKey)
  );
  const topSpacedCandidate: CompletedReviewCandidate | undefined =
    spacedCandidatesFromOptions[0] ||
    (fallbackLogCandidate
      ? {
          title:
            fallbackLogCandidate.summary.match(/"([^"]+)"/)?.[1] ||
            fallbackLogCandidate.summary.slice(0, 48),
          dateKey: fallbackLogCandidate.timestamp.slice(0, 10),
          proofNote: fallbackLogCandidate.insight.replace(/^Proof-of-Work:\s*/i, ''),
          primaryStat: 'PER',
        }
      : undefined);

  if (
    topSpacedCandidate &&
    !player.plannedRestMode &&
    budget >= 20 &&
    quests.length < flowPacing.recommendedMaxQuests &&
    !quests.some((q) => q.title.startsWith('Spaced Retrieval:'))
  ) {
    const dur = 20;
    budget -= dur;
    const shortPrev = topSpacedCandidate.title.slice(0, 34);
    quests.push({
      id: uid('q'),
      dateKey: options.dateKey,
      type: 'side',
      rank: 'C',
      title: `Spaced Retrieval: Truy xuất lại "${shortPrev}"`,
      description: `Ứng dụng Bjork Desirable Difficulties: không mở lại ghi chú cũ từ "${topSpacedCandidate.title}" (${topSpacedCandidate.dateKey}), hãy tự nhớ và viết lại 3 ý cốt lõi + 1 điểm nâng cấp.${topSpacedCandidate.proofNote ? ` Mỏ neo Proof trước đó: ${topSpacedCandidate.proofNote.slice(0, 80)}.` : ''}`,
      learningMethod: 'Bjork Spaced Retrieval + Testing Effect',
      reasoning:
        '[SCHOLAR // SPACED RETRIEVAL] Khoảng cách thời gian tạo ra "khó khăn mong muốn" (Desirable Difficulty), giúp nhân đôi độ bền trí nhớ dài hạn.',
      agentSource: 'SCHOLAR',
      goalId: topSpacedCandidate.goalId,
      skillId: topSpacedCandidate.skillId || skills.find((s) => s.primaryStat === 'PER')?.id,
      scheduledSlot: allocator.allocate(dur, false),
      durationMinutes: dur,
      xpReward: 70,
      masteryReward: 20,
      goldReward: 45,
      statRewards: { PER: 2, [topSpacedCandidate.primaryStat === 'PER' ? 'INT' : topSpacedCandidate.primaryStat]: 1 },
      subtasks: [
        { id: uid('s1'), label: 'Tự truy xuất 3 luận điểm / thao tác cốt lõi không nhìn tài liệu (8 phút)', done: false },
        { id: uid('s2'), label: 'Đối chiếu Proof-of-Work cũ và sửa lại 1 điểm còn mơ hồ', done: false },
      ],
      status: 'pending',
      requiresProof: true,
      scientificProtocol: 'Bjork Desirable Difficulties & Spaced Retrieval',
      ifThenTrigger: buildIfThenTrigger({
        title: `Spaced Retrieval "${shortPrev}"`,
        flowState: flowPacing.state,
        obstacleHint: 'thấy quên và muốn mở ngay tài liệu cũ lên xem lại',
      }),
      createdAt: new Date().toISOString(),
    });
  }

  // 7. FLOW-CHANNEL FREE-DAY EXPANSION HIDDEN QUEST (Universal)
  if (
    freeDayExpansion &&
    budget >= 40 &&
    quests.length < flowPacing.recommendedMaxQuests
  ) {
    const dur = 40;
    budget -= dur;
    const topGoal = prioritizedGoals[0];
    const targetSubject =
      topGoal?.title ||
      options.focusNote?.trim() ||
      player.profile.targetSkills[0] ||
      'Kỹ năng Trọng tâm';
    const statKey = topGoal ? resolveGoalStat(topGoal) : inferStatFromText(targetSubject);

    quests.push({
      id: uid('q'),
      dateKey: options.dateKey,
      type: 'hidden',
      rank: 'A',
      title: `Hidden Quest: Breakthrough Synthesis — ${targetSubject.slice(0, 32)}`,
      description: `Tận dụng ngày rộng thời gian & trạng thái FLOW_CHANNEL: hoàn thành 1 đầu ra chất lượng cao cho "${targetSubject}", sau đó tự phản biện và lập danh sách 3 điểm tối ưu cho lần tới.`,
      learningMethod: 'Deliberate Practice + Error & Critique Log',
      reasoning: '[FLOW_CHANNEL // FREE-DAY EXPANSION] Quỹ thời gian rảnh >= 4 giờ và sinh lực cao — mở khóa thử thách đòn bẩy lớn.',
      agentSource: 'STRATEGIST',
      goalId: topGoal?.id,
      skillId: skills.find((s) => s.primaryStat === statKey)?.id,
      scheduledSlot: allocator.allocate(dur, true),
      durationMinutes: dur,
      xpReward: 140,
      masteryReward: 35,
      goldReward: 100,
      statRewards: { [statKey]: 2, AGI: 2 },
      subtasks: [
        { id: uid('s1'), label: 'Hoàn thành sản phẩm / bài luyện tập cốt lõi trong 30 phút', done: false },
        { id: uid('s2'), label: 'Dành 10 phút phản biện kết quả và ghi lại bài học rút ra', done: false },
      ],
      status: 'pending',
      requiresProof: true,
      scientificProtocol: 'Ericsson Deliberate Practice & Oakley Diffused-to-Focused Synthesis',
      ifThenTrigger:
        topGoal?.ifThenPlan ||
        buildIfThenTrigger({
          title: `Breakthrough "${targetSubject.slice(0, 28)}"`,
          flowState: flowPacing.state,
          obstacleHint: topGoal?.woopObstacle,
        }),
      createdAt: new Date().toISOString(),
    });
  }

  agentNotes.push({
    agent: 'SCHOLAR',
    message: options.focusNote
      ? `Đã lồng ghép trọng tâm hôm nay ("${options.focusNote}") cùng Active Recall & Deep Work vào ${quests.length} nhiệm vụ.`
      : `Đã tối ưu ${quests.length} nhiệm vụ theo trạng thái ${flowPacing.state} và tránh trùng với các khối lịch cố định.`,
  });

  agentNotes.push({
    agent: 'STRATEGIST',
    message: `Csíkszentmihályi & Persona 5 Pacing: ${flowPacing.state} — ${flowPacing.challengeSkillBalance}`,
  });

  const systemDirective = buildHadesNarrativeBark({
    flowPacing,
    player,
    primaryGoalTitle: prioritizedGoals[0]?.title || options.focusNote,
    latestReflection: latestReflectionLog,
    rejectedContext: options.rejectedContext,
    questsCount: quests.length,
  });

  return {
    quests,
    deliberation: {
      dateKey: options.dateKey,
      generatedAt: new Date().toISOString(),
      mode: 'SMART_HEURISTIC',
      modelUsed: 'SYS.OS Universal Flow & Schedule Engine v3.0',
      agentNotes,
      systemDirective,
    },
  };
}

const SCOPE_DIRECTIVES: Record<ChatContextScope, string> = {
  general: 'Tư vấn tổng hợp cân bằng giữa lịch trình hôm nay, mục tiêu dài hạn, năng lượng và chỉ số.',
  timetable: 'Tập trung sâu vào Thời khóa biểu, khung giờ trống, tránh xung đột lịch cố định và bảo toàn giấc ngủ 23:30-07:00.',
  goals: 'Tập trung sâu vào chiến lược chinh phục Mục tiêu dài hạn, chia cột mốc (WOOP / If-Then) và bước hành động cụ thể.',
  skills: 'Tập trung sâu vào Cây Kĩ Năng, nâng cấp chỉ số (INT/PER/AGI/STR/VIT/CHA) và luyện tập có chủ đích.',
  review: 'Tập trung sâu vào Phản tư, phục hồi sinh lực/tâm trí, tìm nguyên nhân trì hoãn và điều chỉnh nhịp độ bền vững.',
};

function parseConsultLlmOutput(raw: string): {
  reply: string;
  suggestedQuests: SuggestedQuestItem[];
} {
  let suggestedQuests: SuggestedQuestItem[] = [];
  let text = raw.replace(/\r\n/g, '\n').trim();

  // 1. Extract optional ```suggested_quests [...] ``` fenced block
  const sqMatch = text.match(/```suggested_quests\s*([\s\S]*?)```/i);
  if (sqMatch) {
    try {
      const arr = JSON.parse(sqMatch[1].trim()) as unknown;
      if (Array.isArray(arr)) {
        suggestedQuests = arr.filter(
          (q): q is SuggestedQuestItem =>
            Boolean(q && typeof q === 'object' && typeof (q as SuggestedQuestItem).title === 'string')
        );
      }
    } catch {
      // Ignore malformed suggested_quests block
    }
    text = text.replace(sqMatch[0], '').trim();
  }

  // 2. Fallback: unwrap legacy JSON object { "reply": "...", "suggestedQuests": [...] }
  if (/^\s*(?:```json\s*)?\{[\s\S]*"reply"\s*:/i.test(text)) {
    const parsed = extractJsonBlock<{
      reply?: string;
      suggestedQuests?: SuggestedQuestItem[];
    }>(text);
    if (parsed?.reply) {
      text = parsed.reply;
      if (!text.includes('\n') && text.includes('\\n')) {
        text = text.replace(/\\n/g, '\n').replace(/\\t/g, '  ');
      }
      if (suggestedQuests.length === 0 && Array.isArray(parsed.suggestedQuests)) {
        suggestedQuests = parsed.suggestedQuests;
      }
    }
  }

  // 3. Strip stray outer ```markdown / ```md fence if entire reply was wrapped
  const outerMd = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  if (outerMd) {
    text = outerMd[1].trim();
  }

  return {
    reply: text.trim(),
    suggestedQuests,
  };
}

export async function consultSystemAI(
  prompt: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  state: SystemStatePayload,
  contextScope: ChatContextScope = 'general'
): Promise<AIConsultResponse> {
  const { player, goals, todayAnalysis, aiSettings } = state;
  const distilled = buildDistilledPlayerContext(state);
  const scopeInstruction = SCOPE_DIRECTIVES[contextScope] || SCOPE_DIRECTIVES.general;

  if (aiSettings.useLiveLlm && aiSettings.baseUrl) {
    try {
      const systemPrompt = `${distilled.systemInstruction}

Ngữ cảnh phiên chat hiện tại (${contextScope}): ${scopeInstruction}

Hồ sơ chắt lọc thực tế của Player (lịch trình, thời gian rảnh, mục tiêu, chỉ số, trạng thái Flow/Pacing & lịch sử hành vi):
${distilled.contextDossier}

Quy tắc định dạng câu trả lời:
- Trả lời trực tiếp bằng tiếng Việt, rõ ràng, thực tế, cá nhân hóa sâu dựa trên đúng bối cảnh trên.
- Trình bày bằng Markdown chuẩn sạch đẹp: dùng tiêu đề \`###\`, danh sách \`- \`, **in đậm** ý chính, bảng Markdown khi so sánh phương án/khung giờ, block code khi cần.
- TUYỆT ĐỐI KHÔNG bọc toàn bộ câu trả lời trong JSON hay \`\`\`markdown.
- Chỉ khi hữu ích, nối thêm ở CUỐI CÙNG khối \`\`\`suggested_quests chứa mảng JSON 1-2 nhiệm vụ cụ thể (title, description, type: "side"|"main"|"daily", rank: "D"|"C"|"B"|"A", durationMinutes, learningMethod, primaryStat: "INT"|"PER"|"STR"|"VIT"|"AGI"|"CHA").`;

      const cleanBase = aiSettings.baseUrl.replace(/\/+$/, '');
      const endpoint = cleanBase.endsWith('/chat/completions')
        ? cleanBase
        : `${cleanBase}/chat/completions`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (aiSettings.apiKey.trim()) {
        headers['Authorization'] = `Bearer ${aiSettings.apiKey.trim()}`;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: aiSettings.model || 'gpt-4o-mini',
          temperature: aiSettings.temperature ?? 0.4,
          messages: [
            { role: 'system', content: systemPrompt },
            ...history.slice(-12),
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as LlmChatResponse;
        const raw = data.choices?.[0]?.message?.content || '';
        const cleaned = parseConsultLlmOutput(raw);
        if (cleaned.reply) {
          return {
            reply: cleaned.reply,
            mode: 'LIVE_LLM',
            modelUsed: aiSettings.model,
            suggestedQuests: cleaned.suggestedQuests,
          };
        }
      }
    } catch (err) {
      console.warn('[AI Consult] Live LLM failed, using Smart Heuristic Advisor:', err);
    }
  }

  // Heuristic Advisor fallback (clean Markdown)
  const freeSummary = todayAnalysis.freeWindows
    .map((w) => `${w.startTime}–${w.endTime} (${w.durationMinutes}p)`)
    .join(', ');
  const fixedClasses = todayAnalysis.blocks
    .filter((b) => b.type === 'class_work')
    .map((b) => `${b.startTime}–${b.endTime}: ${b.title}`)
    .join('; ');

  const suggestedQuests: SuggestedQuestItem[] = [
    {
      title: `Focused Action: ${prompt.slice(0, 42)}`,
      description: `Dành 30 phút thực thi trực tiếp cho yêu cầu "${prompt}" trong khoảng thời gian rảnh tốt nhất hôm nay.`,
      type: 'side',
      rank: 'C',
      durationMinutes: 30,
      learningMethod: 'Timeboxed Deliberate Practice',
      primaryStat: inferStatFromText(prompt),
    },
  ];

  const restStatus = player.plannedRestMode ? 'Đang bật (ưu tiên nhịp nhẹ)' : 'Bình thường';
  const reply = [
    `### Đề xuất (${contextScope.toUpperCase()})`,
    `- **Lịch hôm nay (${todayAnalysis.dayLabel})**: ${fixedClasses || 'Chưa có lịch cố định'}.`,
    `- **Khung rảnh khả dụng**: ${freeSummary || 'Không còn khoảng rảnh lớn'}.`,
    `- **Trạng thái**: ${restStatus} · Energy **${player.energyLevel}%**.`,
    `- **Mục tiêu**: ${goals.map((g) => g.title).join(', ') || 'Chưa đặt mục tiêu'}.`,
    '',
    `### Gợi ý hành động`,
    `Với yêu cầu **"${prompt}"**, hãy chốt **1 phiên tập trung 30 phút** vào khung rảnh dài nhất hôm nay (nhấn **+ Thêm Quest** ngay bên dưới để đưa thẳng vào danh sách việc cần làm).`,
  ].join('\n');

  return {
    reply,
    mode: 'SMART_HEURISTIC',
    modelUsed: 'Local Advisor',
    suggestedQuests,
  };
}

const SECONDARY_STAT_PAIR: Record<AttributeKey, AttributeKey> = {
  INT: 'AGI',
  PER: 'INT',
  AGI: 'PER',
  STR: 'VIT',
  VIT: 'AGI',
  CHA: 'PER',
};

const STAT_REASON_LABELS: Record<AttributeKey, string> = {
  INT: 'Tư duy logic, phân tích hệ thống & giải quyết vấn đề',
  PER: 'Đọc sâu, ngoại ngữ, Active Recall & quan sát tổng hợp',
  AGI: 'Kỷ luật thực thi, tốc độ hành động & giữ nhịp timebox',
  STR: 'Thể lực, sức bền cơ bắp & vận động cường độ cao',
  VIT: 'Phục hồi sinh lực, giấc ngủ & ổn định thần kinh',
  CHA: 'Giao tiếp, thuyết trình, hợp tác & tạo ảnh hưởng',
};

function buildStatReason(
  primaryStat: AttributeKey,
  secondaryStat: AttributeKey | undefined,
  skillName: string | undefined,
  title: string
): string {
  const secPart = secondaryStat && secondaryStat !== primaryStat ? ` + ${secondaryStat}` : '';
  const skillPart = skillName ? ` → cộng XP luyện tập vào "${skillName}"` : '';
  return `"${title.slice(0, 36)}" rèn ${primaryStat} (${STAT_REASON_LABELS[primaryStat]})${secPart}${skillPart}.`;
}

function findUpcomingFreeSlot(state: SystemStatePayload, durationMinutes: number): string {
  const nowMin = getVnNowMinutes();
  const upcomingWindows = state.todayAnalysis.freeWindows
    .map((w) => {
      const start = timeToMinutes(w.startTime);
      const end = timeToMinutes(w.endTime);
      const clampedStart = Math.max(start, Math.min(end, nowMin));
      return { start: clampedStart, end };
    })
    .filter((w) => w.end - w.start >= Math.min(15, durationMinutes))
    .map((w) => ({
      startTime: minutesToTime(w.start),
      endTime: minutesToTime(w.end),
      durationMinutes: w.end - w.start,
      windowQuality: (w.end - w.start >= 60
        ? 'DEEP_WORK_PRIME'
        : w.end - w.start >= 30
          ? 'STANDARD_FOCUS'
          : 'MICRO_SPRINT') as 'DEEP_WORK_PRIME' | 'STANDARD_FOCUS' | 'MICRO_SPRINT',
    }));

  const windowsToUse =
    upcomingWindows.length > 0 ? upcomingWindows : state.todayAnalysis.freeWindows;
  return new SlotAllocator(windowsToUse).allocate(durationMinutes, durationMinutes >= 45);
}

export async function analyzeTaskDraft(
  input: {
    title: string;
    description?: string;
    durationMinutes?: number;
    type?: QuestType;
  },
  state: SystemStatePayload
): Promise<TaskDraftAnalysis> {
  const cleanTitle = input.title.trim();
  const combinedText = `${cleanTitle} ${input.description || ''}`;
  let suggestedTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
  let durationMinutes = Math.max(10, Math.min(240, Math.round(Number(input.durationMinutes) || 30)));
  let primaryStat: AttributeKey = inferStatFromText(combinedText);
  let secondaryStat: AttributeKey | undefined = SECONDARY_STAT_PAIR[primaryStat];
  let type: QuestType =
    input.type ||
    (primaryStat === 'VIT' && /(ngủ|thiền|nghỉ|nsdr|walk|đi bộ)/i.test(combinedText)
      ? 'recovery'
      : 'daily');
  let rank: QuestRank = durationMinutes >= 60 ? 'B' : durationMinutes >= 35 ? 'C' : 'D';
  let requiresProof = false;
  let mode: 'LIVE_LLM' | 'SMART_HEURISTIC' = 'SMART_HEURISTIC';
  let statReason = '';

  const validStats: AttributeKey[] = ['INT', 'PER', 'STR', 'VIT', 'AGI', 'CHA'];
  const validRanks: QuestRank[] = ['E', 'D', 'C', 'B', 'A', 'S'];
  const validTypes: QuestType[] = ['daily', 'main', 'side', 'hidden', 'recovery'];

  if (state.aiSettings.useLiveLlm && state.aiSettings.baseUrl) {
    try {
      const systemPrompt = `You are THE SYSTEM's Task & Stat Classifier.
Given a user's quick task draft, classify the best growth stats (INT, PER, STR, VIT, AGI, CHA), Quest rank/type, and explain concisely in Vietnamese why those stats apply.
Return ONLY valid JSON:
{
  "suggestedTitle": "clean concise title",
  "type": "daily" | "main" | "side" | "recovery",
  "rank": "D" | "C" | "B" | "A",
  "durationMinutes": 30,
  "primaryStat": "INT" | "PER" | "STR" | "VIT" | "AGI" | "CHA",
  "secondaryStat": "INT" | "PER" | "STR" | "VIT" | "AGI" | "CHA",
  "statReason": "1 concise Vietnamese sentence explaining stat & skill mapping",
  "requiresProof": false
}`;
      const raw = await callOpenAICompatible(
        state.aiSettings,
        systemPrompt,
        `Task: "${cleanTitle}"\nDescription: "${input.description || ''}"\nEstimated Minutes: ${durationMinutes}`
      );
      const parsed = raw ? extractJsonBlock<Record<string, any>>(raw) : null;
      if (parsed) {
        mode = 'LIVE_LLM';
        if (typeof parsed.suggestedTitle === 'string' && parsed.suggestedTitle.trim()) {
          suggestedTitle = parsed.suggestedTitle.trim();
        }
        if (validStats.includes(parsed.primaryStat)) {
          primaryStat = parsed.primaryStat;
        }
        if (validStats.includes(parsed.secondaryStat) && parsed.secondaryStat !== primaryStat) {
          secondaryStat = parsed.secondaryStat;
        } else {
          secondaryStat = SECONDARY_STAT_PAIR[primaryStat];
        }
        if (validTypes.includes(parsed.type)) {
          type = parsed.type;
        }
        if (validRanks.includes(parsed.rank)) {
          rank = parsed.rank;
        }
        if (typeof parsed.durationMinutes === 'number' && parsed.durationMinutes >= 10) {
          durationMinutes = Math.max(10, Math.min(240, Math.round(parsed.durationMinutes)));
        }
        if (typeof parsed.statReason === 'string' && parsed.statReason.trim()) {
          statReason = parsed.statReason.trim();
        }
        if (typeof parsed.requiresProof === 'boolean') {
          requiresProof = parsed.requiresProof;
        }
      }
    } catch (err) {
      console.warn('[Task Draft Analyzer] Live LLM failed, using heuristic:', err);
    }
  }

  const skillId = inferSkillIdForTask(suggestedTitle, input.description, primaryStat, state.skills);
  const matchedSkill = state.skills.find((s) => s.id === skillId);
  if (!statReason) {
    statReason = buildStatReason(primaryStat, secondaryStat, matchedSkill?.name, suggestedTitle);
  }

  const rewards = computeBalancedQuestRewards({
    durationMinutes,
    rank,
    type,
    requiresProof,
    primaryStat,
    secondaryStat,
  });

  const scheduledSlot = findUpcomingFreeSlot(state, durationMinutes);

  return {
    mode,
    suggestedTitle,
    type,
    rank,
    durationMinutes,
    primaryStat,
    secondaryStat,
    statRewards: rewards.statRewards,
    statReason,
    skillId,
    skillName: matchedSkill?.name,
    xpReward: rewards.xpReward,
    goldReward: rewards.goldReward,
    masteryReward: rewards.masteryReward,
    spReward: rewards.spReward,
    scheduledSlot,
    requiresProof,
  };
}

type DayPeriodHint = 'morning' | 'noon' | 'afternoon' | 'evening' | 'any';

interface ParsedDayActivity {
  title: string;
  durationMinutes: number;
  period: DayPeriodHint;
  preferredStartMin?: number;
  type: TimetableBlockType;
  energyCost: TimetableBlock['energyCost'];
}

function inferActivityMeta(text: string): {
  type: TimetableBlockType;
  energyCost: TimetableBlock['energyCost'];
} {
  const lower = text.toLowerCase();
  if (/(ngủ|sleep|chợp mắt)/.test(lower)) {
    return { type: 'sleep', energyCost: 'NONE' };
  }
  if (/(ăn|cơm|lunch|dinner|breakfast|di chuyển|commute)/.test(lower)) {
    return { type: 'commute_meal', energyCost: 'NONE' };
  }
  if (/(nghỉ|thư giãn|nsdr|thiền|rest)/.test(lower)) {
    return { type: 'rest_buffer', energyCost: 'NONE' };
  }
  if (/(lớp|học|tiếng anh|ielts|ngoại ngữ|code|dự án|project|làm việc|meeting|họp|ôn thi)/.test(lower)) {
    return { type: 'class_work', energyCost: 'HIGH' };
  }
  return { type: 'fixed_habit', energyCost: 'MEDIUM' };
}

function parseDayActivitiesHeuristic(prompt: string): ParsedDayActivity[] {
  const clauses = prompt
    .split(/[\n;+]+|,\s*|(?:\s+(?:và|rồi|sau đó)\s+)/i)
    .map((c) => c.trim())
    .filter((c) => c.length >= 2);

  const activities: ParsedDayActivity[] = [];

  for (const rawClause of clauses) {
    let working = rawClause;
    let durationMinutes = 45;
    let preferredStartMin: number | undefined;
    let period: DayPeriodHint = 'any';

    // Explicit range like 17:00-18:30 or 19h-20h30
    const rangeMatch = working.match(
      /(\d{1,2})[:h](\d{1,2})?\s*(?:-|–|đến|to)\s*(\d{1,2})[:h](\d{1,2})?/i
    );
    if (rangeMatch) {
      const sh = Number(rangeMatch[1]);
      const sm = Number(rangeMatch[2] || 0);
      const eh = Number(rangeMatch[3]);
      const em = Number(rangeMatch[4] || 0);
      if (sh <= 23 && eh <= 24 && sm < 60 && em < 60) {
        const sMin = sh * 60 + sm;
        const eMin = eh === 24 ? 1439 : eh * 60 + em;
        if (eMin > sMin) {
          preferredStartMin = sMin;
          durationMinutes = Math.max(15, Math.min(240, eMin - sMin));
          working = working.replace(rangeMatch[0], ' ');
        }
      }
    } else {
      // Duration like 1.5h, 1h30, 2 tiếng, 45p, 60 phút
      const hmMatch = working.match(
        /(\d+(?:[.,]\d+)?)\s*(?:tiếng|giờ|hr|hrs|h)(?:\s*(\d{1,2})\s*(?:phút|p|m|min)?)?/i
      );
      if (hmMatch) {
        const hours = Number(hmMatch[1].replace(',', '.'));
        const extraMins = hmMatch[2] ? Number(hmMatch[2]) : 0;
        durationMinutes = Math.max(15, Math.min(240, Math.round(hours * 60 + extraMins)));
        working = working.replace(hmMatch[0], ' ');
      } else {
        const minMatch = working.match(/(\d{1,3})\s*(?:phút|p|min|m)\b/i);
        if (minMatch) {
          durationMinutes = Math.max(15, Math.min(240, Number(minMatch[1])));
          working = working.replace(minMatch[0], ' ');
        }
      }

      // Single start time like "lúc 15h" or "16:30"
      const atMatch = working.match(/(?:lúc|at)?\s*\b(\d{1,2})[:h](\d{1,2})?\b/i);
      if (atMatch && (atMatch[0].includes(':') || atMatch[0].toLowerCase().includes('h'))) {
        const h = Number(atMatch[1]);
        const m = Number(atMatch[2] || 0);
        if (h >= 7 && h <= 23 && m < 60) {
          preferredStartMin = h * 60 + m;
          working = working.replace(atMatch[0], ' ');
        }
      }
    }

    const lower = rawClause.toLowerCase();
    if (/(sáng|morning)/.test(lower)) period = 'morning';
    else if (/(trưa|noon)/.test(lower)) period = 'noon';
    else if (/(chiều|afternoon)/.test(lower)) period = 'afternoon';
    else if (/(tối|đêm|evening|night)/.test(lower)) period = 'evening';

    const cleanedTitle = working
      .replace(/\b(buổi\s+sáng|buổi\s+trưa|buổi\s+chiều|buổi\s+tối|sáng|trưa|chiều|tối|lúc\s+rảnh|khi\s+rảnh|rảnh|khoảng|trong|vào|lúc)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const title =
      cleanedTitle.length >= 2
        ? cleanedTitle.charAt(0).toUpperCase() + cleanedTitle.slice(1)
        : rawClause.slice(0, 48);

    const meta = inferActivityMeta(rawClause);
    activities.push({
      title,
      durationMinutes,
      period,
      preferredStartMin,
      type: meta.type,
      energyCost: meta.energyCost,
    });
  }

  return activities;
}

function periodBounds(period: DayPeriodHint): [number, number] {
  switch (period) {
    case 'morning':
      return [7 * 60, 12 * 60];
    case 'noon':
      return [12 * 60, 14 * 60];
    case 'afternoon':
      return [13 * 60 + 30, 18 * 60];
    case 'evening':
      return [18 * 60 + 30, 23 * 60 + 30];
    default:
      return [7 * 60, 23 * 60 + 30];
  }
}

function allocateSliceForActivity(
  slices: Array<{ start: number; end: number }>,
  act: ParsedDayActivity
): { start: number; end: number } | null {
  const dur = Math.max(15, Math.min(240, act.durationMinutes));
  const [pStart, pEnd] = periodBounds(act.period);

  const tryAllocate = (
    checkPreferredTime: boolean,
    checkPeriod: boolean,
    allowPartial: boolean
  ): { start: number; end: number } | null => {
    for (let i = 0; i < slices.length; i++) {
      const s = slices[i];
      const windowStart = checkPeriod ? Math.max(s.start, pStart) : s.start;
      const windowEnd = checkPeriod ? Math.min(s.end, pEnd) : s.end;
      if (windowEnd - windowStart < (allowPartial ? 20 : dur)) continue;

      let chosenStart = windowStart;
      if (checkPreferredTime && typeof act.preferredStartMin === 'number') {
        if (act.preferredStartMin >= windowStart && act.preferredStartMin + dur <= windowEnd) {
          chosenStart = act.preferredStartMin;
        } else {
          continue;
        }
      }

      const actualDur = allowPartial ? Math.min(dur, windowEnd - chosenStart) : dur;
      const chosenEnd = chosenStart + actualDur;

      // Split slice around [chosenStart, chosenEnd + 10m buffer]
      const nextSlices: Array<{ start: number; end: number }> = [];
      if (chosenStart - s.start >= 15) {
        nextSlices.push({ start: s.start, end: chosenStart });
      }
      if (s.end - (chosenEnd + 10) >= 15) {
        nextSlices.push({ start: chosenEnd + 10, end: s.end });
      }
      slices.splice(i, 1, ...nextSlices);
      return { start: chosenStart, end: chosenEnd };
    }
    return null;
  };

  return (
    tryAllocate(true, true, false) ||
    tryAllocate(true, false, false) ||
    tryAllocate(false, true, false) ||
    tryAllocate(false, false, false) ||
    tryAllocate(false, false, true)
  );
}

export async function planDayScheduleWithAI(params: {
  prompt: string;
  dayOfWeek: number;
  state: SystemStatePayload;
}): Promise<{
  mode: 'LIVE_LLM' | 'SMART_HEURISTIC';
  dayOfWeek: number;
  dayLabel: string;
  summary: string;
  addedBlocks: TimetableBlock[];
}> {
  const { prompt, dayOfWeek, state } = params;
  const dayAnalysis = analyzeDaySchedule(state.timetable, dayOfWeek, state.player.energyLevel);

  // Strictly clamp available free windows inside awake hours 07:00-23:30 unless sleep overridden
  const slices: Array<{ start: number; end: number }> = dayAnalysis.freeWindows
    .map((w) => ({
      start: Math.max(7 * 60, timeToMinutes(w.startTime)),
      end: Math.min(23 * 60 + 30, timeToMinutes(w.endTime)),
    }))
    .filter((s) => s.end - s.start >= 15);

  let mode: 'LIVE_LLM' | 'SMART_HEURISTIC' = 'SMART_HEURISTIC';
  let activities: ParsedDayActivity[] = [];
  let llmSummary = '';

  if (state.aiSettings.useLiveLlm && state.aiSettings.baseUrl) {
    try {
      const freeList = slices
        .map((s) => `${minutesToTime(s.start)}-${minutesToTime(s.end)}`)
        .join(', ');
      const systemPrompt = `You are CHRONOS, the non-overlapping Day Scheduler for THE SYSTEM.
The user wants to schedule tasks on ${dayAnalysis.dayLabel}.
Existing free windows (respecting classes and 23:30-07:00 sleep): ${freeList || 'None'}.
Extract each requested activity with durationMinutes and preferred period.
Return ONLY valid JSON:
{
  "summary": "1 concise Vietnamese sentence summarizing what was placed",
  "activities": [
    {
      "title": "Concise activity title",
      "durationMinutes": 60,
      "period": "morning" | "noon" | "afternoon" | "evening" | "any",
      "preferredStartHHmm": "optional HH:mm",
      "type": "fixed_habit" | "class_work" | "rest_buffer" | "commute_meal",
      "energyCost": "NONE" | "LOW" | "MEDIUM" | "HIGH"
    }
  ]
}`;
      const raw = await callOpenAICompatible(state.aiSettings, systemPrompt, prompt);
      const parsed = raw ? extractJsonBlock<Record<string, any>>(raw) : null;
      if (parsed && Array.isArray(parsed.activities) && parsed.activities.length > 0) {
        mode = 'LIVE_LLM';
        if (typeof parsed.summary === 'string') llmSummary = parsed.summary.trim();
        activities = parsed.activities
          .filter((a: any) => a && typeof a.title === 'string' && a.title.trim())
          .map((a: any) => ({
            title: String(a.title).trim(),
            durationMinutes: Math.max(15, Math.min(240, Number(a.durationMinutes) || 45)),
            period: (['morning', 'noon', 'afternoon', 'evening', 'any'].includes(a.period)
              ? a.period
              : 'any') as DayPeriodHint,
            preferredStartMin:
              typeof a.preferredStartHHmm === 'string' && /^\d{1,2}:\d{2}$/.test(a.preferredStartHHmm)
                ? timeToMinutes(a.preferredStartHHmm)
                : undefined,
            type: (['class_work', 'commute_meal', 'fixed_habit', 'rest_buffer'].includes(a.type)
              ? a.type
              : inferActivityMeta(String(a.title)).type) as TimetableBlockType,
            energyCost: (['NONE', 'LOW', 'MEDIUM', 'HIGH'].includes(a.energyCost)
              ? a.energyCost
              : 'MEDIUM') as TimetableBlock['energyCost'],
          }));
      }
    } catch (err) {
      console.warn('[CHRONOS AI Day Plan] Live LLM failed, using heuristic:', err);
    }
  }

  if (activities.length === 0) {
    activities = parseDayActivitiesHeuristic(prompt);
  }

  const addedBlocks: TimetableBlock[] = [];
  for (const act of activities) {
    const slot = allocateSliceForActivity(slices, act);
    if (!slot) continue;
    addedBlocks.push({
      id: uid('tt-ai'),
      dayOfWeek,
      startTime: minutesToTime(slot.start),
      endTime: minutesToTime(slot.end),
      title: act.title,
      type: act.type,
      energyCost: act.energyCost,
      isRecurring: false,
      notes: 'AI Tự Xếp Lịch',
    });
  }

  const summary =
    addedBlocks.length === 0
      ? `Không còn khoảng rảnh đủ dài (>=20p) trong ${dayAnalysis.dayLabel} ngoài giờ học/ngủ 23:30–07:00.`
      : llmSummary ||
        `Đã xếp ${addedBlocks.length} hoạt động vào ${dayAnalysis.dayLabel} (tránh giờ cố định & ngủ 23:30–07:00): ${addedBlocks
          .map((b) => `${b.startTime}–${b.endTime} ${b.title}`)
          .join(' · ')}.`;

  return {
    mode,
    dayOfWeek,
    dayLabel: dayAnalysis.dayLabel,
    summary,
    addedBlocks,
  };
}
