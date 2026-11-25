import { db } from './db.ts';
import { computePlayerGrowthBonuses, computePlayerMaxHp } from './skill-tree-data.ts';
import { computeXpToNextLevel } from './db.ts';
import { timeToMinutes } from './scheduler.ts';
import { getVnNowParts } from './time-vn.ts';
import type {
  ActivityCategory,
  AISettings,
  AttributeKey,
  DeathReport,
  EquipmentSlot,
  Goal,
  InventoryItem,
  ItemRarity,
  PlayerState,
  QuestRank,
  QuestType,
  RaidBossArchetype,
  RaidChest,
  RaidChestId,
  RaidCombatEvent,
  RaidDifficultyTier,
  RaidWeaknessCategory,
  WeeklyRaidBoss,
  WeeklyRaidPayload,
  WeeklyRaidSummary,
} from './types.ts';

export type RaidPlayerDeathHandler = (
  player: PlayerState,
  missedQuests: Array<{ title: string; type: QuestType; hpDamage: number }>,
  totalHpDamage: number,
  customCauseSummary?: string
) => DeathReport;

interface CuratedBossTemplate {
  archetype: RaidBossArchetype;
  name: string;
  title: string;
  lore: string;
  taunt: string;
  rewardTitle: string;
  loot: {
    itemId: string;
    name: string;
    description: string;
    effectCode: string;
    effectLabel: string;
    rarity: ItemRarity;
    slot: EquipmentSlot;
    iconKey: string;
    statFocus: AttributeKey;
  };
}

export const CURATED_RAID_BOSSES: CuratedBossTemplate[] = [
  {
    archetype: 'chronos_lich',
    name: 'Malakor Kẻ Đánh Cắp Giờ Vàng',
    title: 'Lich Đồng Hồ Hư Không',
    lore: 'Sinh ra từ những giờ phút trôi tuột giữa các tab trình duyệt vô định, Malakor tích tụ sức mạnh mỗi khi kế hoạch ngày bị đẩy sang "ngày mai".',
    taunt: '“Một tập nữa thôi... một video ngắn nữa thôi... Rồi cả tuần của ngươi sẽ hóa tro!”',
    rewardTitle: 'Chúa Tể Thời Gian Tuần',
    loot: {
      itemId: 'raid-chronos-circlet',
      name: 'Vương Miện Tĩnh Thời Malakor',
      description: 'Di vật Raid Tuần giúp khóa chặt sự tập trung và cô đọng tinh hoa kiến thức.',
      effectCode: 'BUFF_FOCUS_18_MASTERY_10',
      effectLabel: '+18% Focus XP & +10% Mastery',
      rarity: 'EPIC',
      slot: 'helm',
      iconKey: 'circlet_arcane',
      statFocus: 'PER',
    },
  },
  {
    archetype: 'sloth_behemoth',
    name: 'Belphegor Cự Thú Trì Hoãn',
    title: 'Quái Vật Ngủ Đông Hắc Ám',
    lore: 'Thân hình bọc đá trầm tích của những việc "để sau", Belphegor đè nặng lên ý chí khởi động bằng lớp sương mù mệt mỏi giả tạo.',
    taunt: '“Nghỉ thêm chút nữa đi... Việc khó để tuần sau làm cũng chưa muộn đâu.”',
    rewardTitle: 'Kẻ Phá Xiềng Trì Hoãn',
    loot: {
      itemId: 'raid-sloth-aegis',
      name: 'Giáp Hộ Thể Phá Lười',
      description: 'Chiến giáp nặng rèn từ vỏ đá Belphegor, tăng sinh lực và giảm kiệt sức.',
      effectCode: 'BUFF_HEARTS_2_FATIGUE_20',
      effectLabel: '+20% Max HP & -20% Fatigue',
      rarity: 'EPIC',
      slot: 'armor',
      iconKey: 'armor_aegis',
      statFocus: 'VIT',
    },
  },
  {
    archetype: 'siren_of_feeds',
    name: 'Vespera Mỹ Nhân Ngư Cuộn Vô Tận',
    title: 'Ám Ảnh Bảng Tin Đỏ',
    lore: 'Giọng hát mê hoặc của thuật toán ngắn hạn hóa thành làn sóng ánh sáng xanh, hút cạn dopamine trước khi bạn kịp nhận ra.',
    taunt: '“Chỉ lướt 5 phút giải lao thôi mà... Ngươi xứng đáng được thả trôi tâm trí!”',
    rewardTitle: 'Người Miễn Nhiễm Dopamine Rác',
    loot: {
      itemId: 'raid-siren-ring',
      name: 'Nhẫn Tĩnh Tâm Vespera',
      description: 'Chiếc nhẫn lọc nhiễu giúp tăng độ sâu nhận thức và điểm Mastery.',
      effectCode: 'BUFF_MASTERY_20',
      effectLabel: '+20% Mastery Earned',
      rarity: 'EPIC',
      slot: 'accessory',
      iconKey: 'ring_synthesis',
      statFocus: 'PER',
    },
  },
  {
    archetype: 'obsidian_dragon',
    name: 'Ignis-Vael Hắc Long Tĩnh Lặng',
    title: 'Rồng Đá Đen Lò Rèn Sâu',
    lore: 'Con rồng canh giữ cánh cổng Deep Work thực thụ; chỉ những phiên làm việc không đứt quãng mới xuyên phá được lớp vảy hắc diện thạch của nó.',
    taunt: '“Lửa của sự hời hợt không làm ta sứt mẻ! Cho ta thấy sức nặng kỷ luật của ngươi!”',
    rewardTitle: 'Đồ Long Deep Work',
    loot: {
      itemId: 'raid-obsidian-katana',
      name: 'Hắc Đao Đồ Long Vael',
      description: 'Thanh katana rèn từ vảy hắc long, tăng mạnh sát thương lên Boss và EXP.',
      effectCode: 'BUFF_BOSS_25_XP_10',
      effectLabel: '+25% Boss DMG & +10% XP',
      rarity: 'LEGENDARY',
      slot: 'weapon',
      iconKey: 'katana_shadow',
      statFocus: 'INT',
    },
  },
  {
    archetype: 'phantom_architect',
    name: 'Kaelen Kiến Trúc Sư Bóng Ma',
    title: 'Ảo Ảnh Kế Hoạch Suông',
    lore: 'Kaelen tôn thờ những danh sách dài vô tận nhưng không bao giờ bắt tay vào thực hiện. Nó mạnh lên mỗi khi bạn chỉ lên kế hoạch mà không hành động.',
    taunt: '“Vẽ thêm bản đồ nữa đi! Đừng vội thực thi, kẻo thấy mình còn thiếu sót đấy!”',
    rewardTitle: 'Thực Thi Giả Bất Bại',
    loot: {
      itemId: 'raid-phantom-tome',
      name: 'Mật Điển Thực Thi Kaelen',
      description: 'Cuốn điển tịch chuyển hóa kế hoạch thành kết quả thực thụ và sát thương Boss.',
      effectCode: 'BUFF_MASTERY_25_BOSS_15',
      effectLabel: '+25% Mastery & +15% Boss DMG',
      rarity: 'LEGENDARY',
      slot: 'tome',
      iconKey: 'grimoire_void',
      statFocus: 'INT',
    },
  },
  {
    archetype: 'iron_golem_king',
    name: 'Titanis Vua Đá Kháng Cự',
    title: 'Khổng Lồ Áo Giáp Sức Ì',
    lore: 'Khối thiết thạch khổng lồ chặn ngay cửa ngõ mọi thói quen mới. Chỉ sự bền bỉ từng ngày liên tục mới khiến giáp trụ của nó rạn nứt.',
    taunt: '“Hôm nay nghỉ một buổi thì sao? Chuỗi ngày của ngươi rồi cũng gãy trước ta thôi!”',
    rewardTitle: 'Kẻ Bất Hoại Chuỗi Ngày',
    loot: {
      itemId: 'raid-titan-boots',
      name: 'Chiến Hài Bền Bỉ Titanis',
      description: 'Đôi chiến hài giúp duy trì tốc độ tập trung cao và giảm tích lũy mệt mỏi.',
      effectCode: 'BUFF_FOCUS_15_FATIGUE_10',
      effectLabel: '+15% Focus XP & -10% Fatigue',
      rarity: 'EPIC',
      slot: 'boots',
      iconKey: 'boots_swift',
      statFocus: 'AGI',
    },
  },
  {
    archetype: 'void_hydra',
    name: 'Nihilax Mãng Xà Đa Nhiệm',
    title: 'Hải Xà Phân Mảnh Chú Ý',
    lore: 'Mỗi lần bạn mở thêm một việc dở dang mới, một cái đầu khác của Nihilax lại mọc ra, xé nhỏ năng lượng nhận thức thành từng mảnh vụn.',
    taunt: '“Mở thêm tab nữa đi! Kiểm tra tin nhắn ngay bây giờ đi! Đừng bỏ lỡ gì cả!”',
    rewardTitle: 'Kiếm Sư Đơn Nhiệm',
    loot: {
      itemId: 'raid-hydra-blade',
      name: 'Huyết Kiếm Chém Phân Tâm',
      description: 'Thanh kiếm chặt đứt sự phân mảnh chú ý, gia tăng toàn diện EXP nhận được.',
      effectCode: 'BUFF_XP_15',
      effectLabel: '+15% Quest EXP',
      rarity: 'RARE',
      slot: 'weapon',
      iconKey: 'sword_crimson',
      statFocus: 'STR',
    },
  },
  {
    archetype: 'eclipse_monarch',
    name: 'Sol-Nox Quân Vương Nhật Thực',
    title: 'Chúa Tể Bóng Tối Tuần Lễ',
    lore: 'Thực thể tối thượng hội tụ vào cuối tuần để phán xét mọi cam kết bạn đã đặt ra từ thứ Hai. Hạ gục Sol-Nox chứng minh bạn làm chủ hoàn toàn quỹ thời gian của mình.',
    taunt: '“Bảy ngày trôi qua rất nhanh... Ngươi đã trưởng thành, hay chỉ lặp lại tuần cũ?”',
    rewardTitle: 'Chủ Nhân Nhật Thực',
    loot: {
      itemId: 'raid-eclipse-crown',
      name: 'Vương Miện Nhật Thực Sol-Nox',
      description: 'Thánh vật tối thượng từ chiến thắng Raid Tuần, gia tăng đồng đều mọi chỉ số tăng trưởng.',
      effectCode: 'BUFF_OMNI_15',
      effectLabel: '+15% XP, Gold & Mastery',
      rarity: 'MYTHIC',
      slot: 'helm',
      iconKey: 'crown_monarch',
      statFocus: 'INT',
    },
  },
];

const VALID_ARCHETYPES = new Set<RaidBossArchetype>(
  CURATED_RAID_BOSSES.map((b) => b.archetype)
);

const TIER_CONFIG: Record<RaidDifficultyTier, { hpMult: number; rewardMult: number }> = {
  B: { hpMult: 1.0, rewardMult: 1.0 },
  A: { hpMult: 1.35, rewardMult: 1.4 },
  S: { hpMult: 1.75, rewardMult: 1.9 },
};

const QUEST_RANK_DAMAGE: Record<QuestRank, number> = {
  E: 180,
  D: 260,
  C: 360,
  B: 480,
  A: 650,
  S: 900,
};

const WEAKNESS_LABELS: Record<RaidWeaknessCategory, string> = {
  study: 'Học tập & Nghiên cứu sâu (x1.25 DMG)',
  deep_work: 'Deep Work Tập Trung Sâu (x1.25 DMG)',
  quests: 'Hoàn Thành Nhiệm Vụ Tuần (x1.25 DMG)',
};

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = Date.UTC(y || 1970, (m || 1) - 1, (d || 1) + deltaDays);
  const dt = new Date(utc);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
    dt.getUTCDate()
  ).padStart(2, '0')}`;
}

export function getVnWeekBounds(now: Date = new Date()): {
  weekKey: string;
  weekStartDate: string;
  weekEndDate: string;
  secondsUntilReset: number;
  todayKey: string;
} {
  const parts = getVnNowParts(now);
  const daysSinceMon = parts.dayOfWeek === 0 ? 6 : parts.dayOfWeek - 1;
  const weekStartDate = shiftDateKey(parts.dateKey, -daysSinceMon);
  const weekEndDate = shiftDateKey(weekStartDate, 6);
  const thursdayKey = shiftDateKey(weekStartDate, 3);
  const [ty, tm, td] = thursdayKey.split('-').map(Number);
  const jan1Utc = Date.UTC(ty, 0, 1);
  const thuUtc = Date.UTC(ty, tm - 1, td);
  const dayOfYear = Math.floor((thuUtc - jan1Utc) / 86_400_000) + 1;
  const isoWeekNum = Math.floor((dayOfYear - 1) / 7) + 1;
  const weekKey = `${ty}-W${String(isoWeekNum).padStart(2, '0')}`;

  const nextMondayKey = shiftDateKey(weekStartDate, 7);
  const nextMondayMs = Date.parse(`${nextMondayKey}T00:00:00+07:00`);
  const secondsUntilReset = Math.max(0, Math.floor((nextMondayMs - now.getTime()) / 1000));

  return {
    weekKey,
    weekStartDate,
    weekEndDate,
    secondsUntilReset,
    todayKey: parts.dateKey,
  };
}

function getBossTemplate(archetype: RaidBossArchetype): CuratedBossTemplate {
  return (
    CURATED_RAID_BOSSES.find((b) => b.archetype === archetype) || CURATED_RAID_BOSSES[0]
  );
}

function pickLocalTemplate(weekKey: string, prevArchetype?: RaidBossArchetype): CuratedBossTemplate {
  let hash = 0;
  for (let i = 0; i < weekKey.length; i++) {
    hash = (hash * 31 + weekKey.charCodeAt(i)) >>> 0;
  }
  const idx = hash % CURATED_RAID_BOSSES.length;
  let chosen = CURATED_RAID_BOSSES[idx];
  if (prevArchetype && chosen.archetype === prevArchetype) {
    chosen = CURATED_RAID_BOSSES[(idx + 1) % CURATED_RAID_BOSSES.length];
  }
  return chosen;
}

export function inferGoalWeakness(goals: Goal[]): {
  weaknessCategory: RaidWeaknessCategory;
  weaknessLabel: string;
} {
  const combined = goals
    .map((g) => `${g.title} ${g.rawInput} ${g.category} ${g.targetMetric}`)
    .join(' ')
    .toLowerCase();

  if (/(ielts|english|tiếng anh|toeic|toefl|học|nghiên cứu|study|read|sách|exam|ôn thi)/i.test(combined)) {
    const isEnglish = /(ielts|english|tiếng anh|toeic|toefl)/i.test(combined);
    return {
      weaknessCategory: 'study',
      weaknessLabel: isEnglish
        ? 'Học sâu & Luyện Tiếng Anh / IELTS (Study x1.25)'
        : 'Học tập & Nghiên cứu sâu (Study x1.25)',
    };
  }
  if (/(code|dev|build|project|lập trình|app|system|ai|deep work|thiết kế|design|engineering)/i.test(combined)) {
    return {
      weaknessCategory: 'deep_work',
      weaknessLabel: 'Deep Work & Sáng Tạo Chuyên Sâu (x1.25)',
    };
  }
  return {
    weaknessCategory: 'quests',
    weaknessLabel: WEAKNESS_LABELS.quests,
  };
}

export function computeAdaptiveBaseMaxHp(weekStartDate: string): number {
  const blocks = db.getTimetableBlocks();
  let totalScheduledAwakeMinutes = 0;
  for (const blk of blocks) {
    if (blk.type === 'sleep') continue;
    const s = timeToMinutes(blk.startTime);
    const e = timeToMinutes(blk.endTime);
    const dur = e > s ? e - s : 1440 - s + e;
    totalScheduledAwakeMinutes += Math.min(720, Math.max(0, dur));
  }
  const weeklyAwakeBudgetMins = 7 * 16 * 60;
  const weeklyFreeHours = Math.max(
    8,
    Math.min(70, Math.round((weeklyAwakeBudgetMins - totalScheduledAwakeMinutes) / 60))
  );

  const prevStart = shiftDateKey(weekStartDate, -7);
  const prevEnd = shiftDateKey(weekStartDate, -1);
  const recentRows = db.getActivityMinutesRange(prevStart, prevEnd);
  const recentFocusMinutes = recentRows.reduce(
    (acc, r) => acc + r.deepWorkMinutes + r.studyMinutes,
    0
  );

  // Calibrated around ~8000 HP so ~12-15h Focus + ~10-12 Quests defeats B-Rank cleanly
  const capacityFactor = (weeklyFreeHours - 28) * 55;
  const focusMomentumFactor =
    recentFocusMinutes > 0 ? Math.min(3500, Math.max(-1000, Math.round((recentFocusMinutes - 600) * 2.5))) : 0;

  return Math.max(6000, Math.min(14000, Math.round((8000 + capacityFactor + focusMomentumFactor) / 100) * 100));
}

function buildChestsForTier(
  tier: RaidDifficultyTier,
  archetype: RaidBossArchetype,
  existingChests?: RaidChest[],
  overkillDamage = 0,
  status: 'active' | 'defeated' | 'failed' = 'active',
  currentHp = 8000,
  maxHp = 8000,
  preserveAlreadyUnlocked = true
): RaidChest[] {
  const rMult = TIER_CONFIG[tier].rewardMult;
  const template = getBossTemplate(archetype);
  const hpPct = maxHp > 0 ? (currentHp / maxHp) * 100 : 0;

  const existingMap = new Map<RaidChestId, RaidChest>();
  for (const c of existingChests || []) {
    existingMap.set(c.id, c);
  }

  const defs: Array<Omit<RaidChest, 'unlocked' | 'claimed' | 'claimedAt'>> = [
    {
      id: 'm75',
      label: 'Mốc 75% HP',
      hpThresholdPct: 75,
      gold: Math.round(80 * rMult),
      runestones: 1,
      sp: 1,
    },
    {
      id: 'm50',
      label: 'Mốc 50% HP',
      hpThresholdPct: 50,
      gold: Math.round(140 * rMult),
      runestones: tier === 'S' ? 3 : tier === 'A' ? 2 : 1,
      sp: 1,
    },
    {
      id: 'm25',
      label: 'Mốc 25% HP',
      hpThresholdPct: 25,
      gold: Math.round(220 * rMult),
      runestones: Math.round(2 * rMult),
      sp: tier === 'S' ? 3 : 2,
    },
    {
      id: 'victory',
      label: 'Đại Thắng Tuần',
      hpThresholdPct: 0,
      gold: Math.round(400 * rMult),
      runestones: Math.round(4 * rMult),
      sp: tier === 'S' ? 5 : tier === 'A' ? 4 : 3,
      dropsLootItem: true,
      lootItemName: template.loot.name,
    },
    {
      id: 'overkill',
      label: 'Kho Báu Overkill',
      hpThresholdPct: 0,
      gold: Math.floor(overkillDamage / 15),
      runestones: Math.floor(overkillDamage / 250),
      sp: 0,
    },
  ];

  return defs.map((def) => {
    const prev = existingMap.get(def.id);
    const claimed = Boolean(prev?.claimed);
    const meetsNow =
      def.id === 'overkill'
        ? status === 'defeated' && overkillDamage >= 500
        : def.id === 'victory'
          ? status === 'defeated' || currentHp <= 0
          : status === 'defeated' || hpPct <= def.hpThresholdPct;

    const unlocked = claimed
      ? true
      : preserveAlreadyUnlocked
        ? Boolean(prev?.unlocked) || meetsNow
        : meetsNow;

    if (claimed && prev) {
      return {
        ...prev,
        lootItemName: def.lootItemName ?? prev.lootItemName,
        unlocked: true,
        claimed: true,
      };
    }

    return {
      ...def,
      unlocked,
      claimed: false,
      claimedAt: undefined,
    };
  });
}

interface AiGeneratedRaidSpec {
  archetype: RaidBossArchetype;
  name: string;
  title: string;
  lore: string;
  taunt: string;
  rewardTitle: string;
  weaknessCategory: RaidWeaknessCategory;
  weaknessLabel: string;
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

function isLocalEndpoint(baseUrl: string): boolean {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(baseUrl);
}

async function tryGenerateAiRaidSpec(
  goals: Goal[],
  player: PlayerState,
  weekKey: string,
  prevArchetype?: RaidBossArchetype
): Promise<{ spec: AiGeneratedRaidSpec | null; reason?: string }> {
  const aiSettings: AISettings = db.getAISettings();
  if (!aiSettings.useLiveLlm || !aiSettings.baseUrl) {
    return { spec: null, reason: 'Chưa bật Live LLM trong Cài đặt AI.' };
  }
  if (!aiSettings.apiKey?.trim() && !isLocalEndpoint(aiSettings.baseUrl)) {
    return { spec: null, reason: 'Chưa cấu hình API Key OpenRouter/LLM.' };
  }

  const cleanBase = aiSettings.baseUrl.replace(/\/+$/, '');
  const endpoint = cleanBase.endsWith('/chat/completions')
    ? cleanBase
    : `${cleanBase}/chat/completions`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (aiSettings.apiKey.trim()) {
    headers['Authorization'] = `Bearer ${aiSettings.apiKey.trim()}`;
  }

  const goalsText =
    goals.length > 0
      ? goals.map((g) => `- ${g.title} (${g.targetMetric}, ${g.progress}%)`).join('\n')
      : '- Phát triển kỷ luật, tập trung sâu và hoàn thành mục tiêu cá nhân.';

  const systemPrompt = `Bạn là THE SYSTEM AI Game Master tạo Weekly Raid Boss bằng tiếng Việt (Dark Fantasy RPG kỷ luật bản thân).
Trả về DUY NHẤT 1 JSON object hợp lệ (không markdown thừa) với các trường:
{
  "archetype": "một trong: chronos_lich | sloth_behemoth | siren_of_feeds | obsidian_dragon | phantom_architect | iron_golem_king | void_hydra | eclipse_monarch",
  "name": "Tên Boss tiếng Việt ngầu, ngắn (<=45 ký tự)",
  "title": "Danh hiệu Boss (<=40 ký tự)",
  "lore": "2 câu mô tả nguồn gốc Boss gắn với mục tiêu/điểm yếu thói quen của người chơi",
  "taunt": "1 câu khiêu khích ngắn bằng tiếng Việt trong ngoặc kép",
  "rewardTitle": "Danh hiệu chiến thắng ngắn gọn cho người chơi (<=35 ký tự)",
  "weaknessCategory": "một trong: study | deep_work | quests",
  "weaknessLabel": "Nhãn điểm yếu ngắn gọn kèm (x1.25)"
}`;

  const userPrompt = `Tuần ${weekKey}. Người chơi: ${player.profile.name}, Level ${player.level}, Rank ${player.rank}, Class ${player.hunterClass}, Streak ${player.streakDays} ngày.
Mục tiêu hiện tại:
${goalsText}
Tránh lặp lại archetype "${prevArchetype || 'none'}" nếu có thể. Chọn weaknessCategory khớp nhất với mục tiêu trên.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: aiSettings.model || 'openai/gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 450,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      return { spec: null, reason: `AI HTTP ${res.status}` };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return { spec: null, reason: 'AI trả về rỗng.' };

    const parsed = extractJsonObject<Partial<AiGeneratedRaidSpec>>(raw);
    if (!parsed || !parsed.name || !parsed.lore || !parsed.taunt) {
      return { spec: null, reason: 'JSON Boss AI không đầy đủ.' };
    }

    const fallbackWeakness = inferGoalWeakness(goals);
    const archetype: RaidBossArchetype =
      parsed.archetype && VALID_ARCHETYPES.has(parsed.archetype)
        ? parsed.archetype
        : pickLocalTemplate(weekKey, prevArchetype).archetype;
    const weaknessCategory: RaidWeaknessCategory =
      parsed.weaknessCategory === 'study' ||
      parsed.weaknessCategory === 'deep_work' ||
      parsed.weaknessCategory === 'quests'
        ? parsed.weaknessCategory
        : fallbackWeakness.weaknessCategory;

    return {
      spec: {
        archetype,
        name: String(parsed.name).trim().slice(0, 60),
        title: String(parsed.title || 'Chúa Tể Hầm Ngục Tuần').trim().slice(0, 50),
        lore: String(parsed.lore).trim().slice(0, 260),
        taunt: String(parsed.taunt).trim().slice(0, 180),
        rewardTitle: String(parsed.rewardTitle || 'Chiến Binh Tuần Lễ').trim().slice(0, 45),
        weaknessCategory,
        weaknessLabel: String(
          parsed.weaknessLabel || WEAKNESS_LABELS[weaknessCategory]
        )
          .trim()
          .slice(0, 70),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Timeout/Network error';
    return { spec: null, reason: msg };
  } finally {
    clearTimeout(timer);
  }
}

function computeFocusScoreForDate(dateKey: string): number {
  const logs = db.getActivityLogsByDate(dateKey);
  let deep = 0;
  let study = 0;
  let comm = 0;
  let distraction = 0;
  let other = 0;
  for (const log of logs) {
    const sec = log.durationSeconds || 0;
    const cat: ActivityCategory = log.category;
    if (cat === 'deep_work') deep += sec;
    else if (cat === 'study_research') study += sec;
    else if (cat === 'communication') comm += sec;
    else if (cat === 'distraction') distraction += sec;
    else if (cat === 'other') other += sec;
  }
  const activeSec = deep + study + comm + distraction + other;
  if (activeSec <= 0) return 100;
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(((deep * 1.0 + study * 0.95 + comm * 0.55 + other * 0.4) / activeSec) * 100)
    )
  );
}

function isFocusBridgeQuest(quest: {
  id: string;
  title: string;
  reasoning?: string;
  source?: string;
}): boolean {
  return (
    quest.source === 'focus_bridge' ||
    quest.id.startsWith('q-pc-') ||
    quest.title.startsWith('Phiên Tập trung') ||
    quest.title.startsWith('Phiên Deep Work trên') ||
    quest.title.startsWith('Phiên Nghiên cứu & Học sâu') ||
    quest.reasoning === 'Đồng bộ trực tiếp từ Windows Activity Tracker.'
  );
}

function prependCombatEvent(raid: WeeklyRaidBoss, ev: RaidCombatEvent): void {
  raid.combatLog.unshift(ev);
  if (raid.combatLog.length > 40) {
    raid.combatLog = raid.combatLog.slice(0, 40);
  }
}

function applyDamageToRaid(
  raid: WeeklyRaidBoss,
  amount: number,
  event: Omit<RaidCombatEvent, 'id' | 'timestamp' | 'amount'>,
  nowIso: string
): void {
  if (amount <= 0) return;
  if (raid.status === 'failed') return;

  raid.totalDamageDealt += amount;

  if (raid.status === 'defeated') {
    raid.overkillDamage += amount;
    prependCombatEvent(raid, {
      ...event,
      id: uid('raid-ev'),
      timestamp: nowIso,
      kind: 'overkill',
      amount,
      detail: event.detail ? `${event.detail} · OVERKILL` : 'OVERKILL',
    });
    return;
  }

  if (amount >= raid.currentHp) {
    const excess = amount - raid.currentHp;
    raid.currentHp = 0;
    raid.overkillDamage += excess;
    raid.status = 'defeated';
    raid.defeatedAt = nowIso;
    prependCombatEvent(raid, {
      ...event,
      id: uid('raid-ev'),
      timestamp: nowIso,
      amount,
      detail: `${event.detail ? `${event.detail} · ` : ''}KẾT LIỄU BOSS!${excess > 0 ? ` (+${excess} Overkill)` : ''}`,
    });
    prependCombatEvent(raid, {
      id: uid('raid-ev'),
      timestamp: nowIso,
      dateKey: event.dateKey,
      kind: 'system',
      label: `Đã hạ gục ${raid.name}! Mở rương Đại Thắng Tuần để nhận Loot & Danh hiệu.`,
      amount: 0,
    });
  } else {
    raid.currentHp -= amount;
    prependCombatEvent(raid, {
      ...event,
      id: uid('raid-ev'),
      timestamp: nowIso,
      amount,
    });
  }
}

function applyActivityAndQuestDeltaToRaid(
  raid: WeeklyRaidBoss,
  nowIso: string,
  dateForEvents: string,
  focusScoreToday: number,
  streakDays: number,
  bossDamageBonusPct: number,
  distractionBudgetMinutes: number,
  applyRegenUpToDateKey: string
): boolean {
  let mutated = false;
  const activityRange = db.getActivityMinutesRange(raid.weekStartDate, raid.weekEndDate);

  let totalDeep = 0;
  let totalStudy = 0;
  for (const row of activityRange) {
    totalDeep += row.deepWorkMinutes;
    totalStudy += row.studyMinutes;
  }

  const skillBonusMult = 1 + Math.max(0, bossDamageBonusPct) / 100;
  const isCrit = focusScoreToday >= 80 || streakDays >= 3;
  const critMult = isCrit ? 1.2 : 1.0;

  const deltaDeep = Math.max(0, totalDeep - (raid.appliedDeepWorkMinutes || 0));
  if (deltaDeep > 0) {
    const weaknessMult = raid.weaknessCategory === 'deep_work' ? raid.weaknessMultiplier : 1.0;
    const totalMult = Number((weaknessMult * critMult * skillBonusMult).toFixed(2));
    const dmg = Math.max(1, Math.round(deltaDeep * 6 * weaknessMult * critMult * skillBonusMult));
    applyDamageToRaid(
      raid,
      dmg,
      {
        dateKey: dateForEvents,
        kind: 'deep_work',
        label: `Deep Work PC +${deltaDeep} phút`,
        isCrit,
        multiplier: totalMult,
        detail: `${weaknessMult > 1 ? 'Điểm yếu x1.25 · ' : ''}${isCrit ? 'CRIT x1.2' : 'Chuẩn'}`,
      },
      nowIso
    );
    raid.appliedDeepWorkMinutes += deltaDeep;
    mutated = true;
  }

  const deltaStudy = Math.max(0, totalStudy - (raid.appliedStudyMinutes || 0));
  if (deltaStudy > 0) {
    const weaknessMult = raid.weaknessCategory === 'study' ? raid.weaknessMultiplier : 1.0;
    const totalMult = Number((weaknessMult * critMult * skillBonusMult).toFixed(2));
    const dmg = Math.max(1, Math.round(deltaStudy * 6 * weaknessMult * critMult * skillBonusMult));
    applyDamageToRaid(
      raid,
      dmg,
      {
        dateKey: dateForEvents,
        kind: 'study',
        label: `Nghiên cứu & Học sâu +${deltaStudy} phút`,
        isCrit,
        multiplier: totalMult,
        detail: `${weaknessMult > 1 ? 'Điểm yếu x1.25 · ' : ''}${isCrit ? 'CRIT x1.2' : 'Chuẩn'}`,
      },
      nowIso
    );
    raid.appliedStudyMinutes += deltaStudy;
    mutated = true;
  }

  const appliedQuestSet = new Set(raid.appliedQuestIds || []);
  const weekQuests = db
    .getQuests()
    .filter(
      (q) =>
        q.status === 'completed' &&
        q.dateKey >= raid.weekStartDate &&
        q.dateKey <= raid.weekEndDate &&
        !appliedQuestSet.has(q.id)
    );

  for (const q of weekQuests) {
    const baseDmg = QUEST_RANK_DAMAGE[q.rank] || 180;
    const bridgeFactor = isFocusBridgeQuest(q as { id: string; title: string; reasoning?: string; source?: string })
      ? 0.35
      : 1.0;
    const weaknessMult = raid.weaknessCategory === 'quests' ? raid.weaknessMultiplier : 1.0;
    const totalMult = Number((bridgeFactor * weaknessMult * skillBonusMult).toFixed(2));
    const dmg = Math.max(10, Math.round(baseDmg * bridgeFactor * weaknessMult * skillBonusMult));

    applyDamageToRaid(
      raid,
      dmg,
      {
        dateKey: q.dateKey || dateForEvents,
        kind: 'quest',
        label: `Quest [${q.rank}] "${q.title.slice(0, 42)}"`,
        multiplier: totalMult,
        detail:
          bridgeFactor < 1
            ? 'Focus Bridge (35% bonus)'
            : weaknessMult > 1
              ? 'Điểm yếu Quest x1.25'
              : `Rank ${q.rank}`,
      },
      nowIso
    );
    raid.appliedQuestIds.push(q.id);
    appliedQuestSet.add(q.id);
    mutated = true;
  }

  // Dark Regen: once per dateKey when distraction >= budget, ONLY while raid is active (never heals defeated boss)
  if (raid.status === 'active') {
    const regenSet = new Set(raid.regenAppliedDates || []);
    for (const row of activityRange) {
      if (raid.status !== 'active') break;
      if (row.dateKey < raid.weekStartDate || row.dateKey > applyRegenUpToDateKey) continue;
      if (regenSet.has(row.dateKey)) continue;
      if (row.distractionMinutes >= distractionBudgetMinutes) {
        const pct =
          raid.difficultyTier === 'S' ? 0.08 : raid.difficultyTier === 'A' ? 0.065 : 0.05;
        const healAmount = Math.max(1, Math.round(raid.maxHp * pct));
        const before = raid.currentHp;
        raid.currentHp = Math.min(raid.maxHp, raid.currentHp + healAmount);
        const actualHeal = raid.currentHp - before;
        raid.regenAppliedDates.push(row.dateKey);
        regenSet.add(row.dateKey);
        prependCombatEvent(raid, {
          id: uid('raid-ev'),
          timestamp: nowIso,
          dateKey: row.dateKey,
          kind: 'dark_regen',
          label: `Dark Regen (${row.dateKey}): Xao nhãng ${row.distractionMinutes}p >= ${distractionBudgetMinutes}p`,
          amount: -healAmount,
          detail: `Boss hồi +${actualHeal} HP (${Math.round(pct * 100)}%)`,
        });
        mutated = true;
      }
    }
  }

  const nextChests = buildChestsForTier(
    raid.difficultyTier,
    raid.archetype,
    raid.chests,
    raid.overkillDamage,
    raid.status,
    raid.currentHp,
    raid.maxHp,
    true
  );
  if (JSON.stringify(nextChests) !== JSON.stringify(raid.chests)) {
    raid.chests = nextChests;
    mutated = true;
  }

  if (mutated) {
    raid.updatedAt = nowIso;
  }
  return mutated;
}

function defaultCheckpointDeathRollback(
  player: PlayerState,
  bossName: string,
  hpLost: number,
  todayKey: string,
  nowIso: string
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
  const newMaxHp = computePlayerMaxHp(player, db.getSkills(), db.getInventory());
  player.maxHp = Math.max(100, newMaxHp);
  player.hp = Math.max(15, Math.round(player.maxHp * 0.75));

  const cp = player.currentCheckpoint || {
    id: 'cp-ch1-start',
    label: 'Chương I · Cổng Khởi Nguyên',
    chapterId: 'ch-1',
    chapterNumber: 1,
    stageNumber: 1,
    savedAt: todayKey,
    levelAtCheckpoint: player.level,
  };

  const report: DeathReport = {
    id: uid('death'),
    occurredAt: nowIso,
    causeSummary: `Gục ngã bởi đòn phản kích của Boss Tuần "${bossName}" (-${hpLost} HP)`,
    missedQuests: [{ title: `Weekly Raid: ${bossName}`, type: 'main', hpDamage: hpLost }],
    totalHpDamage: hpLost,
    goldLost,
    xpLost,
    levelDropped,
    respawnedAtCheckpoint: cp.label,
    respawnHp: player.hp,
  };
  player.lastDeathReport = report;
  return report;
}

function settleExpiredWeeklyRaidsInTx(
  currentWeekKey: string,
  todayKey: string,
  nowIso: string,
  focusScoreToday: number,
  bossDamageBonusPct: number,
  distractionBudgetMinutes: number,
  onPlayerDeath?: RaidPlayerDeathHandler
): WeeklyRaidPayload['justSettledPenalty'] {
  const allRaids = db
    .getWeeklyRaids()
    .filter((r) => r.weekKey < currentWeekKey && r.status === 'active')
    .sort((a, b) => a.weekKey.localeCompare(b.weekKey));

  let latestPenalty: WeeklyRaidPayload['justSettledPenalty'] = null;
  if (allRaids.length === 0) return null;

  const player = db.getPlayer();

  for (const past of allRaids) {
    // Credit any unapplied work from that past week before settling!
    applyActivityAndQuestDeltaToRaid(
      past,
      nowIso,
      past.weekEndDate,
      focusScoreToday,
      player.streakDays,
      bossDamageBonusPct,
      distractionBudgetMinutes,
      past.weekEndDate
    );

    if (past.currentHp <= 0 || past.status === 'defeated') {
      past.status = 'defeated';
      past.currentHp = 0;
      past.defeatedAt = past.defeatedAt || nowIso;
      past.settledAt = nowIso;
      past.updatedAt = nowIso;
      db.saveWeeklyRaid(past);
      continue;
    }

    const hpLost = Math.max(1, Math.round(player.maxHp * 0.25));
    const goldLost = Math.max(0, Math.round(player.gold * 0.1));
    player.gold = Math.max(0, player.gold - goldLost);
    player.hp = Math.max(0, (player.hp ?? player.maxHp) - hpLost);

    let died = false;
    if (player.hp <= 0) {
      died = true;
      if (onPlayerDeath) {
        const deathReport = onPlayerDeath(
          player,
          [{ title: `Weekly Raid: ${past.name}`, type: 'daily', hpDamage: hpLost }],
          hpLost,
          `Gục ngã bởi đòn phản kích Boss Tuần "${past.name}" (-${hpLost} HP)`
        );
        player.lastDeathReport = deathReport;
      } else {
        defaultCheckpointDeathRollback(player, past.name, hpLost, todayKey, nowIso);
      }
    }

    past.status = 'failed';
    past.settledAt = nowIso;
    past.penaltySummary = { hpLost, goldLost, died };
    past.updatedAt = nowIso;

    prependCombatEvent(past, {
      id: uid('raid-ev'),
      timestamp: nowIso,
      dateKey: todayKey,
      kind: 'boss_strike',
      label: `Hết tuần chưa hạ ${past.name}: Phản kích -${hpLost} HP & -${goldLost}G${died ? ' (NGÃ XUỐNG)' : ''}`,
      amount: -hpLost,
      detail: 'Phạt thất bại Raid Tuần',
    });

    db.savePlayer(player);
    db.saveWeeklyRaid(past);
    db.addAuditLog(
      'BOSS_STRIKE',
      `Thất bại Weekly Raid "${past.name}" (${past.weekKey}): -${hpLost} HP, -${goldLost}G`,
      { weekKey: past.weekKey, hpLost, goldLost, died }
    );
    db.addMemoryLog({
      id: uid('log'),
      timestamp: nowIso,
      agent: 'VITALITY',
      eventType: 'VITALITY_OVERRIDE',
      summary: `Boss Tuần "${past.name}" (${past.weekKey}) phản kích: -${hpLost} HP, -${goldLost}G`,
      insight: died
        ? 'Sinh mệnh chạm 0 và đã được hồi sinh tại Checkpoint.'
        : 'Hãy hoàn thành Focus & Quest đều đặn để hạ gục Boss Tuần trước Chủ nhật 23:59.',
    });

    latestPenalty = {
      bossName: past.name,
      weekKey: past.weekKey,
      hpLost,
      goldLost,
      died,
    };
  }

  return latestPenalty;
}

function createWeeklyRaidRecord(
  bounds: ReturnType<typeof getVnWeekBounds>,
  goals: Goal[],
  prevArchetype?: RaidBossArchetype,
  aiSpec?: AiGeneratedRaidSpec | null,
  nowIso: string = new Date().toISOString()
): WeeklyRaidBoss {
  const baseMaxHp = computeAdaptiveBaseMaxHp(bounds.weekStartDate);
  const tier: RaidDifficultyTier = 'B';
  const maxHp = Math.round(baseMaxHp * TIER_CONFIG[tier].hpMult);

  let archetype: RaidBossArchetype;
  let name: string;
  let title: string;
  let lore: string;
  let taunt: string;
  let rewardTitle: string;
  let weaknessCategory: RaidWeaknessCategory;
  let weaknessLabel: string;
  let generatedBy: 'ai' | 'local';

  if (aiSpec) {
    archetype = aiSpec.archetype;
    name = aiSpec.name;
    title = aiSpec.title;
    lore = aiSpec.lore;
    taunt = aiSpec.taunt;
    rewardTitle = aiSpec.rewardTitle;
    weaknessCategory = aiSpec.weaknessCategory;
    weaknessLabel = aiSpec.weaknessLabel;
    generatedBy = 'ai';
  } else {
    const tpl = pickLocalTemplate(bounds.weekKey, prevArchetype);
    const weakness = inferGoalWeakness(goals);
    archetype = tpl.archetype;
    name = tpl.name;
    title = tpl.title;
    lore = tpl.lore;
    taunt = tpl.taunt;
    rewardTitle = tpl.rewardTitle;
    weaknessCategory = weakness.weaknessCategory;
    weaknessLabel = weakness.weaknessLabel;
    generatedBy = 'local';
  }

  const chests = buildChestsForTier(tier, archetype, undefined, 0, 'active', maxHp, maxHp, false);

  return {
    id: uid('raid'),
    weekKey: bounds.weekKey,
    weekStartDate: bounds.weekStartDate,
    weekEndDate: bounds.weekEndDate,
    archetype,
    name,
    title,
    lore,
    taunt,
    generatedBy,
    difficultyTier: tier,
    baseMaxHp,
    maxHp,
    currentHp: maxHp,
    totalDamageDealt: 0,
    overkillDamage: 0,
    weaknessCategory,
    weaknessLabel,
    weaknessMultiplier: 1.25,
    rewardTitle,
    chests,
    combatLog: [
      {
        id: uid('raid-ev'),
        timestamp: nowIso,
        dateKey: bounds.todayKey,
        kind: 'system',
        label: `Boss Tuần ${bounds.weekKey} xuất hiện: ${name} (${maxHp.toLocaleString('en-US')} HP)`,
        amount: 0,
        detail: generatedBy === 'ai' ? 'AI Generated' : 'Local Curated Roster',
      },
    ],
    appliedDeepWorkMinutes: 0,
    appliedStudyMinutes: 0,
    appliedQuestIds: [],
    regenAppliedDates: [],
    status: 'active',
    aiRegenCount: generatedBy === 'ai' ? 1 : 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function buildPayload(
  raid: WeeklyRaidBoss,
  bounds: ReturnType<typeof getVnWeekBounds>,
  todayDistractionMinutes: number,
  distractionBudgetMinutes: number,
  bossDamageBonusPct: number,
  focusScoreToday: number,
  streakDays: number,
  justSettledPenalty: WeeklyRaidPayload['justSettledPenalty']
): WeeklyRaidPayload {
  const allRaids = db.getWeeklyRaids();
  const history: WeeklyRaidSummary[] = allRaids
    .filter((r) => r.weekKey !== raid.weekKey && (r.status === 'defeated' || r.status === 'failed'))
    .sort((a, b) => b.weekKey.localeCompare(a.weekKey))
    .slice(0, 12)
    .map((r) => ({
      weekKey: r.weekKey,
      weekStartDate: r.weekStartDate,
      weekEndDate: r.weekEndDate,
      bossName: r.name,
      archetype: r.archetype,
      difficultyTier: r.difficultyTier,
      status: r.status === 'defeated' ? 'defeated' : 'failed',
      maxHp: r.maxHp,
      totalDamageDealt: r.totalDamageDealt,
      overkillDamage: r.overkillDamage,
      chestsClaimed: r.chests.filter((c) => c.claimed).length,
      penaltySummary: r.penaltySummary,
    }));

  return {
    raid,
    history,
    todayDistractionMinutes,
    distractionBudgetMinutes,
    bossDamageBonusPct,
    focusScoreToday,
    streakDays,
    secondsUntilReset: bounds.secondsUntilReset,
    canChangeDifficulty: raid.status === 'active',
    canRegenerateAi: raid.status === 'active' && (raid.aiRegenCount || 0) < 3,
    justSettledPenalty: justSettledPenalty || null,
  };
}

export function syncWeeklyRaidSyncOnly(opts?: {
  now?: Date;
  aiSpec?: AiGeneratedRaidSpec | null;
  onPlayerDeath?: RaidPlayerDeathHandler;
}): WeeklyRaidPayload {
  const now = opts?.now || new Date();
  const nowIso = now.toISOString();
  const bounds = getVnWeekBounds(now);

  return db.runTransaction(() => {
    const player = db.getPlayer();
    const skills = db.getSkills();
    const inventory = db.getInventory();
    const shadows = db.getShadows();
    const goals = db.getGoals();
    const growthBonuses = computePlayerGrowthBonuses(player, skills, inventory, shadows);
    const assistantSettings = db.getAssistantSettings();
    const distractionBudgetMinutes = Math.max(
      10,
      Number(
        assistantSettings.distractionBudgetMinutes ??
          (assistantSettings as { distractionAlertMinutes?: number }).distractionAlertMinutes ??
          45
      )
    );
    const focusScoreToday = computeFocusScoreForDate(bounds.todayKey);

    const justSettledPenalty = settleExpiredWeeklyRaidsInTx(
      bounds.weekKey,
      bounds.todayKey,
      nowIso,
      focusScoreToday,
      growthBonuses.bossDamageBonusPct,
      distractionBudgetMinutes,
      opts?.onPlayerDeath
    );

    const refreshedPlayer = db.getPlayer();
    let currentRaid = db.getWeeklyRaidByWeek(bounds.weekKey);
    let createdNew = false;

    if (!currentRaid) {
      const prevRaid = db
        .getWeeklyRaids()
        .filter((r) => r.weekKey < bounds.weekKey)
        .sort((a, b) => b.weekKey.localeCompare(a.weekKey))[0];
      currentRaid = createWeeklyRaidRecord(
        bounds,
        goals,
        prevRaid?.archetype,
        opts?.aiSpec,
        nowIso
      );
      createdNew = true;
    }

    const updated = applyActivityAndQuestDeltaToRaid(
      currentRaid,
      nowIso,
      bounds.todayKey,
      focusScoreToday,
      refreshedPlayer.streakDays,
      growthBonuses.bossDamageBonusPct,
      distractionBudgetMinutes,
      bounds.todayKey
    );

    if (createdNew || updated) {
      db.saveWeeklyRaid(currentRaid);
    }

    const todayRow = db
      .getActivityMinutesRange(bounds.todayKey, bounds.todayKey)
      .find((r) => r.dateKey === bounds.todayKey);

    return buildPayload(
      currentRaid,
      bounds,
      todayRow?.distractionMinutes || 0,
      distractionBudgetMinutes,
      growthBonuses.bossDamageBonusPct,
      focusScoreToday,
      refreshedPlayer.streakDays,
      justSettledPenalty
    );
  });
}

export async function getOrCreateCurrentWeeklyRaid(opts?: {
  now?: Date;
  onPlayerDeath?: RaidPlayerDeathHandler;
  tryAi?: boolean;
}): Promise<WeeklyRaidPayload> {
  const now = opts?.now || new Date();
  const bounds = getVnWeekBounds(now);
  const existing = db.getWeeklyRaidByWeek(bounds.weekKey);

  let aiSpec: AiGeneratedRaidSpec | null = null;
  if (!existing && opts?.tryAi !== false) {
    const goals = db.getGoals();
    const player = db.getPlayer();
    const prevRaid = db
      .getWeeklyRaids()
      .filter((r) => r.weekKey < bounds.weekKey)
      .sort((a, b) => b.weekKey.localeCompare(a.weekKey))[0];
    const aiResult = await tryGenerateAiRaidSpec(goals, player, bounds.weekKey, prevRaid?.archetype);
    aiSpec = aiResult.spec;
  }

  return syncWeeklyRaidSyncOnly({
    now,
    aiSpec,
    onPlayerDeath: opts?.onPlayerDeath,
  });
}

export function setWeeklyRaidDifficulty(
  tier: RaidDifficultyTier,
  opts?: { now?: Date; onPlayerDeath?: RaidPlayerDeathHandler }
): WeeklyRaidPayload {
  if (tier !== 'B' && tier !== 'A' && tier !== 'S') {
    throw new Error('Độ khó Raid không hợp lệ (chỉ chấp nhận B, A, S).');
  }
  const now = opts?.now || new Date();
  const nowIso = now.toISOString();

  // First ensure settled & current raid exists
  syncWeeklyRaidSyncOnly({ now, onPlayerDeath: opts?.onPlayerDeath });

  const bounds = getVnWeekBounds(now);
  db.runTransaction(() => {
    const raid = db.getWeeklyRaidByWeek(bounds.weekKey);
    if (!raid) {
      throw new Error('Không tìm thấy Weekly Raid hiện tại.');
    }
    if (raid.status !== 'active') {
      throw new Error('Chỉ có thể đổi độ khó khi Boss tuần còn đang chiến đấu.');
    }
    if (raid.difficultyTier === tier) {
      return;
    }

    const nextMaxHp = Math.round(raid.baseMaxHp * TIER_CONFIG[tier].hpMult);
    raid.difficultyTier = tier;
    raid.maxHp = nextMaxHp;

    if (raid.totalDamageDealt >= nextMaxHp) {
      raid.currentHp = 0;
      raid.overkillDamage = raid.totalDamageDealt - nextMaxHp;
      raid.status = 'defeated';
      raid.defeatedAt = nowIso;
    } else {
      raid.currentHp = Math.max(1, nextMaxHp - raid.totalDamageDealt);
    }

    raid.chests = buildChestsForTier(
      tier,
      raid.archetype,
      raid.chests,
      raid.overkillDamage,
      raid.status,
      raid.currentHp,
      raid.maxHp,
      false
    );
    raid.updatedAt = nowIso;

    prependCombatEvent(raid, {
      id: uid('raid-ev'),
      timestamp: nowIso,
      dateKey: bounds.todayKey,
      kind: 'system',
      label: `Chuyển độ khó Raid sang ${tier}-Rank (${nextMaxHp.toLocaleString('en-US')} HP)`,
      amount: 0,
    });

    db.saveWeeklyRaid(raid);
  });

  return syncWeeklyRaidSyncOnly({ now, onPlayerDeath: opts?.onPlayerDeath });
}

export function claimWeeklyRaidChest(
  chestId: RaidChestId,
  opts?: { now?: Date; onPlayerDeath?: RaidPlayerDeathHandler }
): {
  ok: true;
  payload: WeeklyRaidPayload;
  rewardSummary: {
    gold: number;
    runestones: number;
    sp: number;
    lootItemName?: string;
    unlockedTitle?: string;
  };
} {
  const now = opts?.now || new Date();
  const nowIso = now.toISOString();

  syncWeeklyRaidSyncOnly({ now, onPlayerDeath: opts?.onPlayerDeath });
  const bounds = getVnWeekBounds(now);

  const rewardSummary = db.runTransaction(() => {
    const raid = db.getWeeklyRaidByWeek(bounds.weekKey);
    if (!raid) {
      throw new Error('Không tìm thấy Weekly Raid hiện tại.');
    }

    const chest = raid.chests.find((c) => c.id === chestId);
    if (!chest) {
      throw new Error('Không tìm thấy rương phần thưởng yêu cầu.');
    }
    if (!chest.unlocked) {
      throw new Error(`Rương "${chest.label}" chưa được mở khóa!`);
    }
    if (chest.claimed) {
      throw new Error(`Rương "${chest.label}" đã được nhận rồi!`);
    }

    const player = db.getPlayer();
    player.gold += chest.gold;
    player.runestones += chest.runestones;
    if (chest.sp > 0) {
      player.skillPoints = (player.skillPoints || 0) + chest.sp;
      player.totalSkillPointsEarned = (player.totalSkillPointsEarned || 0) + chest.sp;
    }

    let lootItemName: string | undefined;
    let unlockedTitle: string | undefined;

    if (chest.dropsLootItem) {
      const tpl = getBossTemplate(raid.archetype);
      const loot = tpl.loot;
      lootItemName = loot.name;
      const existingInv = db.getInventory().find((inv) => inv.itemId === loot.itemId);
      if (existingInv) {
        existingInv.quantity += 1;
        db.saveInventoryItem(existingInv);
      } else {
        const newInvItem: InventoryItem = {
          id: uid('inv'),
          itemId: loot.itemId,
          name: loot.name,
          description: loot.description,
          category: 'artifact',
          effectCode: loot.effectCode,
          effectLabel: loot.effectLabel,
          rarity: loot.rarity,
          slot: loot.slot,
          iconKey: loot.iconKey,
          statFocus: loot.statFocus,
          quantity: 1,
          equipped: false,
          acquiredAt: nowIso,
        };
        db.saveInventoryItem(newInvItem);
      }

      if (raid.rewardTitle && !player.unlockedTitles.includes(raid.rewardTitle)) {
        player.unlockedTitles.push(raid.rewardTitle);
        unlockedTitle = raid.rewardTitle;
      }
    }

    chest.claimed = true;
    chest.claimedAt = nowIso;
    raid.updatedAt = nowIso;

    prependCombatEvent(raid, {
      id: uid('raid-ev'),
      timestamp: nowIso,
      dateKey: bounds.todayKey,
      kind: 'system',
      label: `Mở "${chest.label}": +${chest.gold}G, +${chest.runestones} Runestone${chest.sp > 0 ? `, +${chest.sp} SP` : ''}${lootItemName ? `, Loot [${lootItemName}]` : ''}`,
      amount: 0,
    });

    db.savePlayer(player);
    db.saveWeeklyRaid(raid);
    db.addAuditLog(
      'MINI_BOSS_DEFEATED',
      `Nhận rương Weekly Raid "${chest.label}" (+${chest.gold}G, +${chest.runestones} Runestones, +${chest.sp} SP)`,
      { weekKey: raid.weekKey, chestId, gold: chest.gold, runestones: chest.runestones, sp: chest.sp, lootItemName, unlockedTitle }
    );

    return {
      gold: chest.gold,
      runestones: chest.runestones,
      sp: chest.sp,
      lootItemName,
      unlockedTitle,
    };
  });

  const payload = syncWeeklyRaidSyncOnly({ now, onPlayerDeath: opts?.onPlayerDeath });
  return { ok: true, payload, rewardSummary };
}

export async function regenerateWeeklyRaidWithAi(opts?: {
  now?: Date;
  onPlayerDeath?: RaidPlayerDeathHandler;
}): Promise<{
  ok: true;
  payload: WeeklyRaidPayload;
  usedAi: boolean;
  note?: string;
}> {
  const now = opts?.now || new Date();
  const nowIso = now.toISOString();

  syncWeeklyRaidSyncOnly({ now, onPlayerDeath: opts?.onPlayerDeath });
  const bounds = getVnWeekBounds(now);
  const current = db.getWeeklyRaidByWeek(bounds.weekKey);
  if (!current) {
    throw new Error('Không tìm thấy Weekly Raid hiện tại.');
  }
  if (current.status !== 'active') {
    throw new Error('Không thể tạo Boss AI mới sau khi Boss tuần đã kết thúc.');
  }
  if ((current.aiRegenCount || 0) >= 3) {
    throw new Error('Đã dùng hết 3 lượt tạo Boss AI cho tuần này.');
  }

  const goals = db.getGoals();
  const player = db.getPlayer();
  const aiResult = await tryGenerateAiRaidSpec(goals, player, bounds.weekKey, current.archetype);

  if (!aiResult.spec) {
    const payload = syncWeeklyRaidSyncOnly({ now, onPlayerDeath: opts?.onPlayerDeath });
    return {
      ok: true,
      payload,
      usedAi: false,
      note: aiResult.reason || 'AI tạm thời không khả dụng; giữ nguyên Boss hiện tại.',
    };
  }

  const spec = aiResult.spec;
  db.runTransaction(() => {
    const raid = db.getWeeklyRaidByWeek(bounds.weekKey);
    if (!raid || raid.status !== 'active') return;
    raid.archetype = spec.archetype;
    raid.name = spec.name;
    raid.title = spec.title;
    raid.lore = spec.lore;
    raid.taunt = spec.taunt;
    raid.rewardTitle = spec.rewardTitle;
    raid.weaknessCategory = spec.weaknessCategory;
    raid.weaknessLabel = spec.weaknessLabel;
    raid.generatedBy = 'ai';
    raid.aiRegenCount = (raid.aiRegenCount || 0) + 1;
    raid.chests = buildChestsForTier(
      raid.difficultyTier,
      raid.archetype,
      raid.chests,
      raid.overkillDamage,
      raid.status,
      raid.currentHp,
      raid.maxHp,
      true
    );
    raid.updatedAt = nowIso;

    prependCombatEvent(raid, {
      id: uid('raid-ev'),
      timestamp: nowIso,
      dateKey: bounds.todayKey,
      kind: 'system',
      label: `AI tái triệu hồi Boss Tuần: ${spec.name} (Điểm yếu: ${spec.weaknessLabel})`,
      amount: 0,
    });

    db.saveWeeklyRaid(raid);
  });

  const payload = syncWeeklyRaidSyncOnly({ now, onPlayerDeath: opts?.onPlayerDeath });
  return { ok: true, payload, usedAi: true };
}

export function applyFocusOvertimeRaidDamage(
  dbRef: Pick<typeof db, 'getWeeklyRaidByWeek' | 'saveWeeklyRaid' | 'runTransaction'>,
  overtimeMinutes: number,
  questTitle: string,
  bossDamageBonusPct: number,
  now: Date = new Date()
): { raidOvertimeDamage: number } {
  const clampedMins = Math.max(0, Math.min(120, Math.round(Number(overtimeMinutes) || 0)));
  if (clampedMins <= 0) {
    return { raidOvertimeDamage: 0 };
  }

  const bounds = getVnWeekBounds(now);
  if (!dbRef.getWeeklyRaidByWeek(bounds.weekKey)) {
    syncWeeklyRaidSyncOnly({ now });
  }

  const nowIso = now.toISOString();
  const raidOvertimeDamage = dbRef.runTransaction(() => {
    const raid = dbRef.getWeeklyRaidByWeek(bounds.weekKey);
    if (!raid || raid.status === 'failed') {
      return 0;
    }

    const dmg = Math.max(1, Math.round(clampedMins * 6 * (1 + Math.max(0, bossDamageBonusPct) / 100)));
    applyDamageToRaid(
      raid,
      dmg,
      {
        dateKey: bounds.todayKey,
        kind: raid.status === 'defeated' ? 'overkill' : 'deep_work',
        label: `Overtime Flow +${clampedMins}p: ${questTitle}`,
        multiplier: Number((1 + Math.max(0, bossDamageBonusPct) / 100).toFixed(2)),
        detail: `Focus Arena +Flow (${clampedMins}p)`,
      },
      nowIso
    );

    raid.chests = buildChestsForTier(
      raid.difficultyTier,
      raid.archetype,
      raid.chests,
      raid.overkillDamage,
      raid.status,
      raid.currentHp,
      raid.maxHp,
      true
    );
    raid.updatedAt = nowIso;
    dbRef.saveWeeklyRaid(raid);
    return dmg;
  });

  return { raidOvertimeDamage };
}
