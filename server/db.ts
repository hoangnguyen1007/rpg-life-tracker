import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { buildCampaignBosses, buildCampaignChapters } from './campaign-data.ts';
import {
  buildSkillTreeNodes,
  computePlayerMaxHp,
  computeSkillPowerRating,
} from './skill-tree-data.ts';
import { VN_TIMEZONE, getVnTodayKey } from './time-vn.ts';
import type {
  AIChatMessage,
  AIChatThread,
  AISettings,
  ActivityCategory,
  ActivityLogEntry,
  AgentMemoryLog,
  AssistantNudge,
  AssistantSettings,
  AuditActionType,
  AuditLogEntry,
  BossMission,
  ChatContextScope,
  CouncilDeliberation,
  DailyProgressSnapshot,
  Goal,
  HunterRank,
  InventoryItem,
  PlayerState,
  Quest,
  ShadowSoldier,
  ShopItem,
  SkillNode,
  StorageInfoPayload,
  StoryChapter,
  SuggestedQuestItem,
  SystemResetMode,
  TimetableBlock,
  WeeklyReviewRecord,
} from './types.ts';

export function buildDefaultAssistantSettings(): AssistantSettings {
  return {
    trackerEnabled: process.platform === 'win32' && !process.env.THE_SYSTEM_DB_PATH,
    pollIntervalSeconds: 10,
    idleThresholdSeconds: 180,
    windowsToastEnabled: true,
    distractionGuardEnabled: true,
    distractionThresholdMinutes: 3,
    distractionCooldownMinutes: 15,
    upcomingBlockReminderEnabled: true,
    upcomingReminderLeadMinutes: 5,
    ultradianBreakEnabled: true,
    ultradianBreakMinutes: 80,
    eveningWinddownEnabled: true,
    eveningWinddownTime: '22:30',
    quietHoursStart: '23:30',
    quietHoursEnd: '07:00',
    autoCreditSkillXp: true,
    customRules: [],
    autoPauseQuestOnIdle: true,
    distractionBudgetMinutes: 45,
    dailyFocusGoalMinutes: 180,
    hudVisibleOnStart: true,
    dndUntil: null,
    backupEnabled: true,
    backupDir: '',
    backupRetentionDays: 14,
    lanAccessEnabled: false,
    lanPairToken: '',
    lanPairPin: '',
  };
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
export const DB_PATH = process.env.THE_SYSTEM_DB_PATH
  ? path.resolve(process.env.THE_SYSTEM_DB_PATH)
  : path.join(DATA_DIR, 'the_system.sqlite');

export function getTodayKey(): string {
  return getVnTodayKey();
}

export function computeRankFromMastery(masteryScore: number): HunterRank {
  if (masteryScore >= 2500) return 'National Level';
  if (masteryScore >= 1600) return 'S-Rank';
  if (masteryScore >= 1000) return 'A-Rank';
  if (masteryScore >= 550) return 'B-Rank';
  if (masteryScore >= 250) return 'C-Rank';
  if (masteryScore >= 100) return 'D-Rank';
  return 'E-Rank';
}

export function computeXpToNextLevel(level: number): number {
  return Math.round(250 * Math.pow(1.18, level - 1));
}

function buildCleanPlayer(today: string): PlayerState {
  return {
    id: 'player-01',
    isOnboarded: false,
    profile: {
      name: 'New Player',
      currentRole: '',
      bio: '',
      interests: [],
      strengths: [],
      weaknesses: [],
      targetSkills: [],
      learningStyle: 'Active Recall + Deep Work',
      peakHours: '08:00 - 11:30 & 19:30 - 22:00',
      personalRules: '',
      customSystemPrompt: '',
      aiPersona: 'strategic_mentor',
      avatarStyle: 'shadow_monarch',
    },
    level: 1,
    currentXp: 0,
    xpToNextLevel: computeXpToNextLevel(1),
    masteryScore: 0,
    rank: 'E-Rank',
    hunterClass: 'Unawakened Initiate',
    activeTitle: 'Awakened Player',
    unlockedTitles: ['Awakened Player'],
    stats: {
      INT: 10,
      PER: 10,
      STR: 10,
      VIT: 10,
      AGI: 10,
      CHA: 10,
    },
    hp: 100,
    maxHp: 100,
    skillPoints: 0,
    totalSkillPointsEarned: 0,
    deathCount: 0,
    currentCheckpoint: {
      id: 'cp-ch1-start',
      label: 'Chương I · Cổng Khởi Nguyên',
      chapterId: 'ch-1',
      chapterNumber: 1,
      stageNumber: 1,
      savedAt: today,
      levelAtCheckpoint: 1,
    },
    lastDeathReport: null,
    lastSettledDate: today,
    energyLevel: 85,
    fatigue: 0,
    streakDays: 0,
    gold: 0,
    runestones: 0,
    activeBuffs: [],
    equippedArtifactIds: [],
    plannedRestMode: false,
    penaltyActive: false,
    lastCheckinDate: today,
    achievements: [
      {
        id: 'ach-init',
        title: 'The System Awakening',
        description: 'Khởi tạo The System ở Level 1 — bắt đầu hành trình 8 Chương (24 Boss) lột xác.',
        unlockedAt: today,
        rarity: 'COMMON',
      },
    ],
  };
}

function buildStarterSkills(): SkillNode[] {
  return buildSkillTreeNodes();
}

function buildStarterShopItems(): ShopItem[] {
  return [
    // ==================== 18 GROWTH ARTIFACTS (6 SLOTS × 3 TIERS) ====================
    // WEAPON SLOT
    {
      id: 'item-art-kasaka-dagger',
      name: 'Đoản Kiếm Timebox Kasaka',
      description: 'Cắt gọn nhiệm vụ thành khối thời gian rõ ràng: +12% Focus Bonus khi vào phiên tập trung.',
      lore: 'Sắc bén như ý chí cắt đứt trì hoãn ngay từ phút đầu tiên.',
      category: 'artifact',
      slot: 'weapon',
      rarity: 'RARE',
      iconKey: 'dagger_venom',
      statFocus: 'AGI',
      currency: 'gold',
      price: 320,
      effectCode: 'BUFF_FOCUS_12',
      effectLabel: '+12% Focus Bonus',
    },
    {
      id: 'item-art-igris',
      name: 'Trường Kiếm Tập Trung Igris',
      description: 'Trang bị hỗ trợ Huberman 90m Ultradian Deep Work: nhận thêm +15% XP khi hoàn thành mọi nhiệm vụ.',
      lore: 'Thanh kiếm của kỵ sĩ giữ kỷ luật tuyệt đối trước ngai vàng.',
      category: 'artifact',
      slot: 'weapon',
      rarity: 'EPIC',
      iconKey: 'sword_crimson',
      statFocus: 'INT',
      currency: 'gold',
      price: 450,
      effectCode: 'BUFF_XP_15',
      effectLabel: '+15% XP mọi nhiệm vụ',
    },
    {
      id: 'item-art-demon-katana',
      name: 'Hắc Ảnh Katana Phá Boss',
      description: 'Rèn từ chuỗi Proof-of-Work nghiêm ngặt: +25% sát thương Boss Chương và +10% XP.',
      lore: 'Chém xuyên mọi cột mốc khó nhằn nhất của chiến dịch.',
      category: 'artifact',
      slot: 'weapon',
      rarity: 'LEGENDARY',
      iconKey: 'katana_shadow',
      statFocus: 'INT',
      currency: 'runestones',
      price: 28,
      effectCode: 'BUFF_BOSS_25_XP_10',
      effectLabel: '+25% Boss DMG · +10% XP',
    },

    // HELM SLOT
    {
      id: 'item-art-clarity-glasses',
      name: 'Kính Quang Học Đọc Sâu',
      description: 'Lọc nhiễu thông tin và tăng độ tinh tường khi đọc tài liệu: +10% Mastery mọi nhiệm vụ.',
      lore: 'Mọi trang sách đều hiện rõ cấu trúc cốt lõi.',
      category: 'artifact',
      slot: 'helm',
      rarity: 'COMMON',
      iconKey: 'glasses_clarity',
      statFocus: 'PER',
      currency: 'gold',
      price: 200,
      effectCode: 'BUFF_MASTERY_10',
      effectLabel: '+10% Mastery nhiệm vụ',
    },
    {
      id: 'item-art-circlet-recall',
      name: 'Vương Miện Active Recall',
      description: 'Củng cố truy xuất trí nhớ chủ động (Dunlosky): +18% Focus Bonus và +10% Mastery.',
      lore: 'Vòng nguyệt quế dành cho bộ óc không ngừng tự kiểm chứng.',
      category: 'artifact',
      slot: 'helm',
      rarity: 'EPIC',
      iconKey: 'circlet_arcane',
      statFocus: 'PER',
      currency: 'runestones',
      price: 16,
      effectCode: 'BUFF_FOCUS_18_MASTERY_10',
      effectLabel: '+18% Focus · +10% Mastery',
    },
    {
      id: 'item-art-crown-sovereign',
      name: 'Vương Miện Quân Vương Trí Tuệ',
      description: 'Bảo vật tối thượng dung hợp tư duy, kỷ luật và đầu ra: +15% XP, +15% Mastery và +15% Gold.',
      lore: 'Đỉnh cao của một ngày làm chủ hoàn toàn thời gian và tâm trí.',
      category: 'artifact',
      slot: 'helm',
      rarity: 'MYTHIC',
      iconKey: 'crown_monarch',
      statFocus: 'INT',
      currency: 'runestones',
      price: 42,
      effectCode: 'BUFF_OMNI_15',
      effectLabel: '+15% XP · +15% Mastery · +15% Gold',
    },

    // ARMOR SLOT
    {
      id: 'item-art-tunic-runner',
      name: 'Áo Khoác Bền Bỉ Zone-2',
      description: 'Giữ nhịp vận động & sức bền cơ thể mỗi ngày: +15% hiệu quả Hồi phục và +10 Max HP.',
      lore: 'Nhẹ, thoáng và bền bỉ qua từng dặm đường buổi sáng.',
      category: 'artifact',
      slot: 'armor',
      rarity: 'COMMON',
      iconKey: 'tunic_emerald',
      statFocus: 'STR',
      currency: 'gold',
      price: 240,
      effectCode: 'BUFF_RECOVERY_15_HP_10',
      effectLabel: '+15% Hồi phục · +10 Max HP',
    },
    {
      id: 'item-art-vitality',
      name: 'Áo Giáp Sinh Lực NSDR',
      description: 'Tối ưu phục hồi theo cơ chế NSDR (Huberman): giảm 25% mức Fatigue tích tụ và tăng +20 Max HP (+1 Tim).',
      lore: 'Che chở hệ thần kinh khỏi kiệt sức giữa những tuần cao điểm.',
      category: 'artifact',
      slot: 'armor',
      rarity: 'EPIC',
      iconKey: 'armor_vitality',
      statFocus: 'VIT',
      currency: 'gold',
      price: 500,
      effectCode: 'BUFF_FATIGUE_REDUCE_25',
      effectLabel: '-25% Fatigue · +20 Max HP',
    },
    {
      id: 'item-art-aegis-sleep',
      name: 'Thánh Giáp Giấc Ngủ 23:30',
      description: 'Kỷ luật giấc ngủ vàng giúp tái tạo tối đa: +40 Max HP (+2 Trái Tim) và giảm 20% Fatigue.',
      lore: 'Khi đồng hồ điểm 23:30, tấm khiên hồi sinh tự động kích hoạt.',
      category: 'artifact',
      slot: 'armor',
      rarity: 'LEGENDARY',
      iconKey: 'armor_aegis',
      statFocus: 'VIT',
      currency: 'runestones',
      price: 30,
      effectCode: 'BUFF_HEARTS_2_FATIGUE_20',
      effectLabel: '+40 Max HP (+2 Tim) · -20% Fatigue',
    },

    // ACCESSORY SLOT
    {
      id: 'item-art-coin-amulet',
      name: 'Bùa Hộ Mệnh Đòn Bẩy Vàng',
      description: 'Mọi nhiệm vụ hoàn thành mang về giá trị cao hơn: +20% Gold nhận được.',
      lore: 'Biến từng giờ kỷ luật thành tài sản tích lũy bền vững.',
      category: 'artifact',
      slot: 'accessory',
      rarity: 'RARE',
      iconKey: 'amulet_gold',
      statFocus: 'CHA',
      currency: 'gold',
      price: 300,
      effectCode: 'BUFF_GOLD_20',
      effectLabel: '+20% Gold mọi nhiệm vụ',
    },
    {
      id: 'item-art-scholar',
      name: 'Nhẫn Thông Tuệ Tổng Hợp',
      description: 'Ứng dụng Dunlosky Retrieval Practice & Bjork Spaced Verification: nhận thêm +20% Mastery khi có Proof.',
      lore: 'Chiếc nhẫn khắc ký hiệu liên kết mọi mảnh tri thức rời rạc.',
      category: 'artifact',
      slot: 'accessory',
      rarity: 'EPIC',
      iconKey: 'ring_synthesis',
      statFocus: 'PER',
      currency: 'runestones',
      price: 12,
      effectCode: 'BUFF_MASTERY_20',
      effectLabel: '+20% Mastery khi có Proof',
    },
    {
      id: 'item-art-heart-pendant',
      name: 'Mặt Dây Chuyền Phượng Hoàng',
      description: 'Tái sinh nhanh sau ngày dài căng thẳng: +25% hiệu quả Hồi phục và +15% Gold.',
      lore: 'Ánh lửa dịu dàng giữ ngọn lửa động lực không bao giờ tắt.',
      category: 'artifact',
      slot: 'accessory',
      rarity: 'LEGENDARY',
      iconKey: 'pendant_phoenix',
      statFocus: 'VIT',
      currency: 'runestones',
      price: 24,
      effectCode: 'BUFF_RECOVERY_25_GOLD_15',
      effectLabel: '+25% Hồi phục · +15% Gold',
    },

    // TOME SLOT
    {
      id: 'item-art-pomodoro-orb',
      name: 'Đồng Hồ Cát Pomodoro Pha Lê',
      description: 'Giữ nhịp sprint 25–50 phút đều đặn suốt ngày: +10% XP khi hoàn thành nhiệm vụ.',
      lore: 'Từng hạt cát rơi xuống là một phút tập trung không tạp niệm.',
      category: 'artifact',
      slot: 'tome',
      rarity: 'COMMON',
      iconKey: 'hourglass_crystal',
      statFocus: 'AGI',
      currency: 'gold',
      price: 180,
      effectCode: 'BUFF_XP_10',
      effectLabel: '+10% XP mọi nhiệm vụ',
    },
    {
      id: 'item-art-archmage',
      name: 'Sổ Tay Kiến Trúc Sư',
      description: 'Kết hợp Oakley Focused & Diffused Mode: cộng thêm +1 INT mỗi khi hoàn thành Main hoặc Hidden Quest.',
      lore: 'Những bản vẽ hệ thống tinh xảo nhất bắt đầu từ cuốn sổ này.',
      category: 'artifact',
      slot: 'tome',
      rarity: 'LEGENDARY',
      iconKey: 'tome_architect',
      statFocus: 'INT',
      currency: 'runestones',
      price: 25,
      effectCode: 'BUFF_BONUS_STAT',
      effectLabel: '+1 INT mỗi Main/Hidden Quest',
    },
    {
      id: 'item-art-grimoire-feynman',
      name: 'Cổ Thư Feynman Vô Cực',
      description: 'Diễn giải đơn giản mọi vấn đề phức tạp: +25% Mastery và +15% sát thương Boss Chương.',
      lore: 'Nếu giải thích được cho người mới hiểu, ngươi đã thực sự làm chủ nó.',
      category: 'artifact',
      slot: 'tome',
      rarity: 'MYTHIC',
      iconKey: 'grimoire_void',
      statFocus: 'PER',
      currency: 'runestones',
      price: 38,
      effectCode: 'BUFF_MASTERY_25_BOSS_15',
      effectLabel: '+25% Mastery · +15% Boss DMG',
    },

    // BOOTS SLOT
    {
      id: 'item-art-sandals-2min',
      name: 'Giày Khởi Động 2 Phút',
      description: 'Vượt qua sức ỳ ban đầu theo quy tắc Atomic Habits: +10% Gold và +8% Focus Bonus.',
      lore: 'Chỉ cần xỏ giày vào và bước 2 phút đầu tiên.',
      category: 'artifact',
      slot: 'boots',
      rarity: 'COMMON',
      iconKey: 'boots_leather',
      statFocus: 'AGI',
      currency: 'gold',
      price: 190,
      effectCode: 'BUFF_GOLD_10_FOCUS_8',
      effectLabel: '+10% Gold · +8% Focus',
    },
    {
      id: 'item-art-greaves-flow',
      name: 'Chiến Hài Kênh Flow',
      description: 'Duy trì nhịp làm việc trôi chảy liên tục: +15% Focus Bonus và giảm 10% Fatigue.',
      lore: 'Lướt qua những nhiệm vụ khó mà không mất nhịp thở.',
      category: 'artifact',
      slot: 'boots',
      rarity: 'RARE',
      iconKey: 'boots_swift',
      statFocus: 'AGI',
      currency: 'gold',
      price: 380,
      effectCode: 'BUFF_FOCUS_15_FATIGUE_10',
      effectLabel: '+15% Focus · -10% Fatigue',
    },
    {
      id: 'item-art-boots-shadowstep',
      name: 'Hắc Ảnh Bộ Pháp (Shadow Step)',
      description: 'Tốc độ thực thi cực hạn không xao nhãng: +18% XP và +15% Focus Bonus.',
      lore: 'Hoàn thành xong mục tiêu trước khi cơn lười kịp nhận ra.',
      category: 'artifact',
      slot: 'boots',
      rarity: 'LEGENDARY',
      iconKey: 'boots_shadow',
      statFocus: 'AGI',
      currency: 'runestones',
      price: 26,
      effectCode: 'BUFF_XP_18_FOCUS_15',
      effectLabel: '+18% XP · +15% Focus',
    },

    // ==================== 10 CONSUMABLES ====================
    {
      id: 'item-con-water',
      name: 'Bình Nước Điện Giải Tỉnh Táo',
      description: 'Nạp nước & đánh thức tỉnh táo tức thì giữa phiên học: +15 HP, +15% Energy và -10% Fatigue.',
      lore: 'Đơn giản nhưng cứu sống mọi buổi chiều buồn ngủ.',
      category: 'consumable',
      rarity: 'COMMON',
      iconKey: 'potion_water',
      statFocus: 'VIT',
      currency: 'gold',
      price: 45,
      effectCode: 'USE_HYDRATION',
      effectLabel: '+15 HP · +15% Energy · -10% Fatigue',
    },
    {
      id: 'item-con-coffee-potion',
      name: 'Độc Dược Espresso Tập Trung',
      description: 'Tăng tỉnh táo nhanh cho phiên Deep Work kế tiếp: +20% Energy và +15% XP cho Quest tiếp theo.',
      lore: 'Hương cà phê rang đậm đánh thức mọi neuron.',
      category: 'consumable',
      rarity: 'COMMON',
      iconKey: 'potion_espresso',
      statFocus: 'AGI',
      currency: 'gold',
      price: 75,
      effectCode: 'USE_ESPRESSO',
      effectLabel: '+20% Energy · +15% XP Quest kế',
    },
    {
      id: 'item-con-elixir',
      name: 'Elixir NSDR Phục Hồi Sâu',
      description: 'Hồi phục mạnh mẽ sau phiên làm việc căng thẳng: +40 Sinh lực (HP), +25% Energy & giảm 30% Fatigue.',
      lore: 'Tinh chất của 20 phút nghỉ sâu không ngủ.',
      category: 'consumable',
      rarity: 'RARE',
      iconKey: 'potion_elixir',
      statFocus: 'VIT',
      currency: 'gold',
      price: 120,
      effectCode: 'USE_ELIXIR',
      effectLabel: '+40 HP · +25% Energy · -30% Fatigue',
    },
    {
      id: 'item-con-phoenix-brew',
      name: 'Linh Dược Hồi Đầy Trái Tim',
      description: 'Tái tạo toàn bộ thể trạng ngay lập tức: đầy 100% HP, 100% Energy và xóa sạch Fatigue.',
      lore: 'Một giọt lửa phượng hoàng đưa phong độ trở lại đỉnh cao.',
      category: 'consumable',
      rarity: 'EPIC',
      iconKey: 'potion_phoenix',
      statFocus: 'VIT',
      currency: 'gold',
      price: 240,
      effectCode: 'USE_FULL_RESTORE',
      effectLabel: 'Đầy 100% HP & Energy · 0% Fatigue',
    },
    {
      id: 'item-con-overdrive',
      name: 'Chìa Khóa Deliberate Overdrive',
      description: 'Kích hoạt phiên Ericsson Deliberate Practice cường độ cao: x1.5 XP và x1.5 Gold cho nhiệm vụ tiếp theo.',
      lore: 'Mở khóa giới hạn tập trung trong một nhiệm vụ quan trọng.',
      category: 'consumable',
      rarity: 'RARE',
      iconKey: 'key_overdrive',
      statFocus: 'INT',
      currency: 'gold',
      price: 180,
      effectCode: 'USE_OVERDRIVE',
      effectLabel: 'x1.5 XP & Gold Quest kế tiếp',
    },
    {
      id: 'item-con-focus-crystal',
      name: 'Tinh Thể Siêu Tập Trung (x2 XP)',
      description: 'Cộng hưởng tuyệt đối cho phiên Deep Work lớn nhất trong ngày: x2.0 XP ở Quest kế tiếp.',
      lore: 'Chỉ dùng cho trận đánh lớn nhất đáng giá nhất.',
      category: 'consumable',
      rarity: 'EPIC',
      iconKey: 'crystal_focus',
      statFocus: 'INT',
      currency: 'runestones',
      price: 8,
      effectCode: 'USE_DOUBLE_XP',
      effectLabel: 'x2.0 XP Quest kế tiếp',
    },
    {
      id: 'item-con-scroll',
      name: 'Cuộn Triệu Hồi Hidden Quest',
      description: 'Mở ra ngay 1 Hidden Quest Rank A (45p, +150 XP, +30 Mastery) theo nguyên lý Desirable Difficulty.',
      lore: 'Lời mời thử thách bí mật chỉ hiện ra cho người sẵn sàng.',
      category: 'consumable',
      rarity: 'EPIC',
      iconKey: 'scroll_hidden',
      statFocus: 'PER',
      currency: 'runestones',
      price: 6,
      effectCode: 'USE_HIDDEN_SCROLL',
      effectLabel: 'Sinh 1 Hidden Quest Rank A',
    },
    {
      id: 'item-con-boss-scroll',
      name: 'Ấn Ký Phá Giáp Boss (Raid 60p)',
      description: 'Triệu hồi ngay 1 Raid Sprint 60p Rank S (+220 XP, +45 Mastery, +160G) để bứt phá cột mốc.',
      lore: 'Không gì ngăn cản nổi một giờ làm việc không khoan nhượng.',
      category: 'consumable',
      rarity: 'LEGENDARY',
      iconKey: 'scroll_raid',
      statFocus: 'STR',
      currency: 'runestones',
      price: 10,
      effectCode: 'USE_RAID_SCROLL',
      effectLabel: 'Sinh Raid Sprint 60p Rank S',
    },
    {
      id: 'item-con-shield-grace',
      name: 'Khiên Bảo Hộ Grace Day',
      description: 'Kích hoạt chế độ Nghỉ Chủ Động hôm nay (không trừ HP khi chốt ngày, bảo toàn chuỗi) và hồi +25 HP.',
      lore: 'Chiến binh khôn ngoan biết lúc nào cần lùi một nhịp để giữ đà.',
      category: 'consumable',
      rarity: 'RARE',
      iconKey: 'shield_grace',
      statFocus: 'VIT',
      currency: 'gold',
      price: 160,
      effectCode: 'USE_GRACE_SHIELD',
      effectLabel: 'Bật Nghỉ Chủ Động · +25 HP',
    },
    {
      id: 'item-con-sp-tome',
      name: 'Mảnh Tinh Hoa Kỹ Năng (+1 SP)',
      description: 'Kết tinh từ kinh nghiệm thực chiến: cộng thẳng +1 Điểm Kĩ Năng (SP) & +30 Mastery để mở khóa cây skill.',
      lore: 'Khoảnh khắc ngộ ra nguyên lý mới giúp mở khóa tầng sức mạnh tiếp theo.',
      category: 'consumable',
      rarity: 'LEGENDARY',
      iconKey: 'gem_sp',
      statFocus: 'INT',
      currency: 'runestones',
      price: 14,
      effectCode: 'USE_SP_SHARD',
      effectLabel: '+1 Điểm Kĩ Năng (SP) · +30 Mastery',
    },

    // ==================== 8 REAL-LIFE GUILT-FREE REWARDS ====================
    {
      id: 'item-rew-break',
      name: 'Voucher 45p Giải Trí Không Áy Náy',
      description: 'Phần thưởng xứng đáng sau ngày rèn luyện nghiêm túc: xem 1 tập phim, nghe nhạc hoặc chơi game 45 phút.',
      lore: 'Giải trí có chủ đích giúp não tái nạp dopamine lành mạnh.',
      category: 'real_reward',
      rarity: 'COMMON',
      iconKey: 'gamepad_retro',
      currency: 'gold',
      price: 150,
      effectCode: 'REDEEM_VOUCHER',
      effectLabel: 'Thưởng tinh thần (45p)',
    },
    {
      id: 'item-rew-nap',
      name: 'Quyền Nghỉ Ngơi / Ngủ Trưa 60p',
      description: 'Tặng bản thân 1 giờ nghỉ ngơi hoàn toàn khỏi màn hình và deadline giữa ngày.',
      lore: 'Giấc ngủ ngắn giữa trưa nhân đôi độ minh mẫn buổi chiều.',
      category: 'real_reward',
      rarity: 'COMMON',
      iconKey: 'pillow_rest',
      currency: 'gold',
      price: 110,
      effectCode: 'REDEEM_VOUCHER',
      effectLabel: 'Nghỉ ngơi thư giãn (60p)',
    },
    {
      id: 'item-rew-snack',
      name: 'Voucher Bữa Ăn Ngon Tự Thưởng',
      description: 'Thưởng cho bản thân món ăn yêu thích sau khi hoàn thành trọn vẹn mục tiêu ngày.',
      lore: 'Nạp năng lượng tử tế sau một ngày chiến đấu hết mình.',
      category: 'real_reward',
      rarity: 'COMMON',
      iconKey: 'ramen_bowl',
      currency: 'gold',
      price: 180,
      effectCode: 'REDEEM_VOUCHER',
      effectLabel: 'Ẩm thực tự thưởng',
    },
    {
      id: 'item-rew-coffee',
      name: 'Voucher Cà Phê / Đồ Uống Yêu Thích',
      description: 'Tự thưởng cho bản thân một ly đồ uống ngon khi vượt qua tuần rèn luyện hiệu quả.',
      lore: 'Một ly cà phê ngon giữa không gian yên tĩnh là phần thưởng ngọt ngào.',
      category: 'real_reward',
      rarity: 'COMMON',
      iconKey: 'coffee_cup',
      currency: 'gold',
      price: 260,
      effectCode: 'REDEEM_VOUCHER',
      effectLabel: 'Đồ uống tự thưởng',
    },
    {
      id: 'item-rew-movie',
      name: 'Vé Xem 1 Bộ Phim / Anime Trọn Vẹn',
      description: 'Dành trọn một buổi tối cuối tuần thưởng thức bộ phim yêu thích mà không cảm thấy tội lỗi.',
      lore: 'Câu chuyện hay mở rộng góc nhìn và nuôi dưỡng cảm hứng.',
      category: 'real_reward',
      rarity: 'RARE',
      iconKey: 'movie_ticket',
      currency: 'gold',
      price: 320,
      effectCode: 'REDEEM_VOUCHER',
      effectLabel: 'Buổi tối điện ảnh',
    },
    {
      id: 'item-rew-book',
      name: 'Quỹ Đầu Tư Sách / Khóa Học Mới',
      description: 'Dành Runestones tích lũy từ Proof-of-Work để tự thưởng cho mình 1 cuốn sách hoặc khóa học mới.',
      lore: 'Khoản đầu tư sinh lời cao nhất luôn là tri thức của chính mình.',
      category: 'real_reward',
      rarity: 'RARE',
      iconKey: 'book_stack',
      currency: 'runestones',
      price: 18,
      effectCode: 'REDEEM_VOUCHER',
      effectLabel: 'Đầu tư phát triển bản thân',
    },
    {
      id: 'item-rew-gear',
      name: 'Quỹ Nâng Cấp Gear / Góc Làm Việc',
      description: 'Tích lũy để mua phụ kiện bàn học, tai nghe, bàn phím hoặc đồ công nghệ tăng cảm hứng.',
      lore: 'Không gian gọn gàng, dụng cụ xịn giúp bước vào Flow dễ hơn.',
      category: 'real_reward',
      rarity: 'EPIC',
      iconKey: 'headphones_pixel',
      currency: 'runestones',
      price: 35,
      effectCode: 'REDEEM_VOUCHER',
      effectLabel: 'Nâng cấp góc làm việc',
    },
    {
      id: 'item-rew-dayoff',
      name: 'Thẻ Du Lịch / 1 Ngày Xả Hơi Trọn Vẹn',
      description: 'Phần thưởng lớn sau một chặng đường dài: 1 ngày tự do hoàn toàn, đi chơi hoặc dã ngoại.',
      lore: 'Càng đi xa càng cần những điểm dừng trọn vẹn để quay lại mạnh hơn.',
      category: 'real_reward',
      rarity: 'LEGENDARY',
      iconKey: 'chest_treasure',
      currency: 'gold',
      price: 900,
      effectCode: 'REDEEM_VOUCHER',
      effectLabel: '1 ngày xả hơi trọn vẹn',
    },
  ];
}

class SystemDatabase {
  private db: DatabaseSync;
  private txDepth = 0;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    this.db = new DatabaseSync(DB_PATH);
    this.initSchema();
    this.seedIfEmpty();
  }

  private initSchema(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      PRAGMA temp_store = MEMORY;

      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS timetable_blocks (
        id TEXT PRIMARY KEY,
        day_of_week INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS quests (
        id TEXT PRIMARY KEY,
        date_key TEXT NOT NULL,
        status TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bosses (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chapters (
        id TEXT PRIMARY KEY,
        chapter_number INTEGER NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS shop_items (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS inventory (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        branch TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS shadows (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS memory_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS daily_snapshots (
        date_key TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS transaction_audit_log (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        action_type TEXT NOT NULL,
        summary TEXT NOT NULL,
        payload TEXT
      );

      CREATE TABLE IF NOT EXISTS ai_chat_threads (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        context_scope TEXT NOT NULL DEFAULT 'general',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ai_chat_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        suggested_quests TEXT,
        model_used TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (thread_id) REFERENCES ai_chat_threads(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        date_key TEXT NOT NULL,
        process_name TEXT NOT NULL,
        window_title TEXT NOT NULL,
        category TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        credited_to_skill INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS assistant_nudges (
        id TEXT PRIMARY KEY,
        date_key TEXT NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL,
        dismissed INTEGER NOT NULL DEFAULT 0,
        toast_sent INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS weekly_reviews (
        id TEXT PRIMARY KEY,
        week_start TEXT NOT NULL,
        week_end TEXT NOT NULL,
        grade TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_quests_date_status ON quests(date_key, status);
      CREATE INDEX IF NOT EXISTS idx_timetable_day_start ON timetable_blocks(day_of_week, start_time);
      CREATE INDEX IF NOT EXISTS idx_memory_timestamp ON memory_logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON transaction_audit_log(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON ai_chat_messages(thread_id, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_activity_date ON activity_logs(date_key, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_nudges_date ON assistant_nudges(date_key, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_weekly_reviews_created ON weekly_reviews(created_at DESC);
    `);
  }

  runTransaction<T>(fn: () => T): T {
    const isOuter = this.txDepth === 0;
    const sp = `sp_${this.txDepth}`;
    this.txDepth += 1;
    try {
      if (isOuter) {
        this.db.exec('BEGIN IMMEDIATE');
      } else {
        this.db.exec(`SAVEPOINT ${sp}`);
      }
      const result = fn();
      if (isOuter) {
        this.db.exec('COMMIT');
      } else {
        this.db.exec(`RELEASE SAVEPOINT ${sp}`);
      }
      return result;
    } catch (err) {
      try {
        if (isOuter) {
          this.db.exec('ROLLBACK');
        } else {
          this.db.exec(`ROLLBACK TO SAVEPOINT ${sp}`);
          this.db.exec(`RELEASE SAVEPOINT ${sp}`);
        }
      } catch {
        // Ignore rollback failure
      }
      throw err;
    } finally {
      this.txDepth -= 1;
    }
  }

  private getKV<T>(key: string): T | null {
    const stmt = this.db.prepare('SELECT value FROM kv_store WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.value) as T;
  }

  private touchLastSaved(): void {
    const nowIso = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO kv_store (key, value, updated_at)
         VALUES ('last_saved_at', ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
      .run(JSON.stringify(nowIso), nowIso);
  }

  checkpointWal(truncate = false): void {
    try {
      this.db.exec(truncate ? 'PRAGMA wal_checkpoint(TRUNCATE)' : 'PRAGMA wal_checkpoint(PASSIVE)');
    } catch {
      // Ignore checkpoint failure
    }
  }

  private setKV(key: string, value: unknown): void {
    const stmt = this.db.prepare(`
      INSERT INTO kv_store (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    stmt.run(key, JSON.stringify(value), new Date().toISOString());
    if (key !== 'last_saved_at') {
      this.touchLastSaved();
    }
  }

  private seedIfEmpty(): void {
    const existingPlayer = this.getKV<PlayerState>('player_state');
    if (existingPlayer) {
      // Backfill new RPG & 2D Dungeon fields gracefully if migrating from earlier DB
      let mutated = false;
      if (typeof existingPlayer.runestones !== 'number') {
        existingPlayer.runestones = 0;
        mutated = true;
      }
      if (!Array.isArray(existingPlayer.activeBuffs)) {
        existingPlayer.activeBuffs = [];
        mutated = true;
      }
      if (!Array.isArray(existingPlayer.equippedArtifactIds)) {
        existingPlayer.equippedArtifactIds = [];
        mutated = true;
      }
      if (typeof existingPlayer.maxHp !== 'number' || existingPlayer.maxHp < 100) {
        existingPlayer.maxHp = 100;
        mutated = true;
      }
      if (typeof existingPlayer.hp !== 'number') {
        existingPlayer.hp = existingPlayer.maxHp;
        mutated = true;
      }
      if (typeof existingPlayer.skillPoints !== 'number') {
        existingPlayer.skillPoints = 0;
        mutated = true;
      }
      if (typeof existingPlayer.totalSkillPointsEarned !== 'number') {
        existingPlayer.totalSkillPointsEarned = existingPlayer.skillPoints;
        mutated = true;
      }
      if (!existingPlayer.profile.avatarStyle) {
        existingPlayer.profile.avatarStyle = 'shadow_monarch';
        mutated = true;
      }
      if (typeof existingPlayer.deathCount !== 'number') {
        existingPlayer.deathCount = 0;
        mutated = true;
      }
      if (!existingPlayer.currentCheckpoint) {
        existingPlayer.currentCheckpoint = {
          id: 'cp-ch1-start',
          label: 'Chương I · Cổng Khởi Nguyên',
          chapterId: 'ch-1',
          chapterNumber: 1,
          stageNumber: 1,
          savedAt: getTodayKey(),
          levelAtCheckpoint: existingPlayer.level || 1,
        };
        mutated = true;
      }
      const rawP = existingPlayer as unknown as Record<string, unknown>;
      if (!('lastDeathReport' in rawP)) {
        rawP.lastDeathReport = null;
        mutated = true;
      }
      if (!existingPlayer.lastSettledDate) {
        existingPlayer.lastSettledDate = getTodayKey();
        mutated = true;
      }
      for (const legacyKey of ['monstersSlain', 'chapterMonstersSlain', 'combatCombo']) {
        if (legacyKey in rawP) {
          delete rawP[legacyKey];
          mutated = true;
        }
      }
      if (mutated) this.setKV('player_state', existingPlayer);

      const campaignBossTemplates = buildCampaignBosses();
      const bosses = this.getBosses();
      if (bosses.length === 0 || bosses.some((b) => !b.bossRole)) {
        const customBosses: BossMission[] = bosses
          .filter((b) => Boolean(b.goalId) && !b.id.startsWith('boss-c'))
          .map((b, idx) => ({
            ...b,
            bossRole: 'custom_boss' as const,
            orderIndex: 100 + idx,
            unlocked: true,
            gateLabel: b.gateLabel || 'Mục tiêu Cá nhân',
            archetype: b.archetype || 'sentinel',
          }));
        this.db.exec('DELETE FROM bosses');
        for (const boss of campaignBossTemplates) this.saveBoss(boss);
        for (const cb of customBosses) this.saveBoss(cb);
      } else if (bosses.some((b) => b.id.startsWith('boss-c') && !b.archetype)) {
        const templateMap = new Map(campaignBossTemplates.map((b) => [b.id, b]));
        for (const b of bosses) {
          const tpl = templateMap.get(b.id);
          if (tpl && !b.archetype) {
            b.archetype = tpl.archetype;
            this.saveBoss(b);
          }
        }
      }

      const freshBosses = this.getBosses();
      const chapters = this.getChapters();
      if (
        chapters.length === 0 ||
        chapters.some((c) => !Array.isArray(c.miniBossIds)) ||
        chapters.some((c) => !Array.isArray(c.stages) || c.stages.length < 5)
      ) {
        const existingChapterMap = new Map(chapters.map((c) => [c.id, c]));
        const freshChapters = buildCampaignChapters();
        this.db.exec('DELETE FROM chapters');
        for (const ch of freshChapters) {
          const prev = existingChapterMap.get(ch.id);
          if (prev) {
            ch.unlocked = prev.unlocked;
            ch.completed = prev.completed;
          }
          for (const st of ch.stages) {
            if (st.bossId) {
              const linked = freshBosses.find((b) => b.id === st.bossId);
              if (linked) {
                st.unlocked = linked.unlocked;
                st.completed = linked.defeated;
              }
            } else if (ch.completed) {
              st.unlocked = true;
              st.completed = true;
              st.minionProgress = st.minionCountRequired ?? st.minionProgress;
            } else if (ch.unlocked && st.stageNumber === 1) {
              st.unlocked = true;
            }
          }
          this.saveChapter(ch);
        }
      }

      // Normalize unstarted legacy Chapter 1 so only Stage 1-1 starts unlocked (strict 1-by-1 Fog-of-War)
      const currentChapters = this.getChapters();
      const ch1 = currentChapters.find((c) => c.id === 'ch-1');
      const mb1 = freshBosses.find((b) => b.id === 'boss-c1-m1');
      const mb2 = freshBosses.find((b) => b.id === 'boss-c1-m2');
      const ch1Boss = freshBosses.find((b) => b.id === 'boss-c1-boss');
      const stage11 = ch1?.stages?.find((s) => s.stageNumber === 1);
      if (
        ch1 &&
        !ch1.completed &&
        stage11 &&
        !stage11.completed &&
        (stage11.minionProgress ?? 0) === 0 &&
        mb1?.unlocked &&
        !mb1.defeated &&
        mb1.currentHp === mb1.maxHp &&
        mb2?.unlocked &&
        !mb2.defeated &&
        mb2.currentHp === mb2.maxHp
      ) {
        for (const st of ch1.stages) {
          if (st.stageNumber === 1) {
            st.unlocked = true;
          } else if (!st.completed) {
            st.unlocked = false;
          }
        }
        this.saveChapter(ch1);
        mb1.unlocked = false;
        this.saveBoss(mb1);
        mb2.unlocked = false;
        this.saveBoss(mb2);
        if (ch1Boss && !ch1Boss.defeated && ch1Boss.currentHp === ch1Boss.maxHp && ch1Boss.unlocked) {
          ch1Boss.unlocked = false;
          this.saveBoss(ch1Boss);
        }
      }

      const existingShop = this.getShopItems();
      const customShopItems = existingShop.filter((item) => item.isCustom);
      const starterItems = buildStarterShopItems();
      const starterMap = new Map(starterItems.map((it) => [it.id, it]));
      for (const item of starterItems) {
        this.saveShopItem(item);
      }
      for (const customItem of customShopItems) {
        this.saveShopItem(customItem);
      }

      // Non-destructive backfill of rarity / slot / iconKey / statFocus on existing inventory
      for (const inv of this.getInventory()) {
        const ref = starterMap.get(inv.itemId);
        if (ref && (!inv.iconKey || !inv.rarity || (ref.slot && !inv.slot))) {
          inv.rarity = inv.rarity || ref.rarity;
          inv.slot = inv.slot || ref.slot;
          inv.iconKey = inv.iconKey || ref.iconKey;
          inv.statFocus = inv.statFocus || ref.statFocus;
          this.saveInventoryItem(inv);
        }
      }

      const existingSkills = this.getSkills();
      if (
        existingSkills.length === 0 ||
        !existingSkills.some((s) => s.id === 'sk-int-1') ||
        existingSkills.some((s) => s.id === 'sk-blade-focus')
      ) {
        const customSkills = existingSkills.filter((s) => !s.treeBranch);
        this.db.exec('DELETE FROM skills');
        for (const sk of buildStarterSkills()) this.saveSkill(sk);
        for (const cs of customSkills) this.saveSkill(cs);
      } else {
        for (const sk of existingSkills) {
          let skMutated = false;
          if (typeof sk.totalPracticeXp !== 'number') {
            sk.totalPracticeXp = sk.practiceXp || 0;
            skMutated = true;
          }
          if (typeof sk.totalPracticeMinutes !== 'number') {
            sk.totalPracticeMinutes = 0;
            skMutated = true;
          }
          if (typeof sk.tasksContributedCount !== 'number') {
            sk.tasksContributedCount = 0;
            skMutated = true;
          }
          if (!Array.isArray(sk.recentContributions)) {
            sk.recentContributions = [];
            skMutated = true;
          }
          const expectedPower = computeSkillPowerRating(sk);
          if (typeof sk.powerRating !== 'number' || sk.powerRating !== expectedPower) {
            sk.powerRating = expectedPower;
            skMutated = true;
          }
          if (skMutated) this.saveSkill(sk);
        }
      }

      // Non-destructive upgrade of default morning sleep window 06:30 -> 07:00
      for (const blk of this.getTimetableBlocks()) {
        if (blk.id.startsWith('tt-sleep-morn-') && blk.endTime === '06:30') {
          blk.endTime = '07:00';
          this.saveTimetableBlock(blk);
        }
      }

      // Clean up legacy bogus Idle rows caused by earlier Win32 [ref] bug
      this.db.exec("DELETE FROM activity_logs WHERE process_name = 'Idle' AND category = 'other'");
      return;
    }
    this.seedCleanState(false);
  }

  private seedCleanState(preserveAiSettings = true): void {
    const today = getTodayKey();
    const prevAi = preserveAiSettings ? this.getKV<AISettings>('ai_settings') : null;

    const initialAiSettings: AISettings = prevAi ?? {
      providerName: 'OpenAI-Compatible (Custom)',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-4o-mini',
      temperature: 0.4,
      useLiveLlm: false,
    };

    const cleanPlayer = buildCleanPlayer(today);

    const baseSleepBlocks: TimetableBlock[] = [];
    for (let day = 0; day <= 6; day++) {
      baseSleepBlocks.push(
        {
          id: `tt-sleep-morn-${day}`,
          dayOfWeek: day,
          startTime: '00:00',
          endTime: '07:00',
          title: 'Giờ ngủ (Mặc định)',
          type: 'sleep',
          energyCost: 'NONE',
          isRecurring: true,
        },
        {
          id: `tt-sleep-night-${day}`,
          dayOfWeek: day,
          startTime: '23:30',
          endTime: '23:59',
          title: 'Giờ ngủ (Mặc định)',
          type: 'sleep',
          energyCost: 'NONE',
          isRecurring: true,
        }
      );
    }

    this.setKV('player_state', cleanPlayer);
    this.setKV('ai_settings', initialAiSettings);
    this.setKV('last_deliberation', null);

    for (const b of baseSleepBlocks) this.saveTimetableBlock(b);
    for (const sk of buildStarterSkills()) this.saveSkill(sk);
    for (const ch of buildCampaignChapters()) this.saveChapter(ch);
    for (const boss of buildCampaignBosses()) this.saveBoss(boss);
    for (const item of buildStarterShopItems()) this.saveShopItem(item);

    this.addMemoryLog({
      id: `log-clean-${Date.now()}`,
      timestamp: new Date().toISOString(),
      agent: 'ARCHITECT',
      eventType: 'ORCHESTRATION',
      summary: 'Khởi tạo Hành trình 8 Chương (24 Boss) ở Level 1 / 0 XP.',
      insight: 'Hoàn thành nhiệm vụ hằng ngày và kiểm chứng cột mốc để tích Điểm Kĩ Năng (SP) mở khóa Cây Kĩ Năng 5 Nhánh, nâng cấp bằng Gold/Runestones và chinh phục 8 Chương Boss!',
    });
  }

  getPlayer(): PlayerState {
    const p = this.getKV<PlayerState>('player_state');
    if (!p) throw new Error('Player state missing');
    return p;
  }

  savePlayer(player: PlayerState): PlayerState {
    player.rank = computeRankFromMastery(player.masteryScore);
    player.xpToNextLevel = computeXpToNextLevel(player.level);
    const computedMax = computePlayerMaxHp(player, this.getSkills(), this.getInventory());
    player.maxHp = Math.max(100, computedMax);
    player.hp = Math.max(0, Math.min(player.maxHp, player.hp ?? player.maxHp));
    player.skillPoints = Math.max(0, player.skillPoints ?? 0);
    this.setKV('player_state', player);
    return player;
  }

  getAISettings(): AISettings {
    return (
      this.getKV<AISettings>('ai_settings') ?? {
        providerName: 'OpenAI-Compatible',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-4o-mini',
        temperature: 0.4,
        useLiveLlm: false,
      }
    );
  }

  saveAISettings(settings: AISettings): AISettings {
    this.setKV('ai_settings', settings);
    return settings;
  }

  getLastDeliberation(): CouncilDeliberation | null {
    return this.getKV<CouncilDeliberation | null>('last_deliberation');
  }

  saveLastDeliberation(delib: CouncilDeliberation | null): void {
    this.setKV('last_deliberation', delib);
  }

  getGoals(): Goal[] {
    const rows = this.db.prepare('SELECT data FROM goals ORDER BY created_at DESC').all() as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as Goal);
  }

  saveGoal(goal: Goal): void {
    this.db
      .prepare(
        `INSERT INTO goals (id, data, created_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data`
      )
      .run(goal.id, JSON.stringify(goal), goal.createdAt);
    this.touchLastSaved();
  }

  deleteGoal(id: string): void {
    this.db.prepare('DELETE FROM goals WHERE id = ?').run(id);
    this.touchLastSaved();
  }

  getTimetableBlocks(): TimetableBlock[] {
    const rows = this.db
      .prepare('SELECT data FROM timetable_blocks ORDER BY day_of_week ASC, start_time ASC')
      .all() as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as TimetableBlock);
  }

  saveTimetableBlock(block: TimetableBlock): void {
    this.db
      .prepare(
        `INSERT INTO timetable_blocks (id, day_of_week, start_time, data) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET day_of_week = excluded.day_of_week, start_time = excluded.start_time, data = excluded.data`
      )
      .run(block.id, block.dayOfWeek, block.startTime, JSON.stringify(block));
    this.touchLastSaved();
  }

  deleteTimetableBlock(id: string): void {
    this.db.prepare('DELETE FROM timetable_blocks WHERE id = ?').run(id);
    this.touchLastSaved();
  }

  clearTimetable(dayOfWeek?: number): void {
    if (!process.env.THE_SYSTEM_DB_PATH && this.getKV('player_state') && this.getTimetableBlocks().length > 0) {
      try {
        this.createDiskBackup('auto-safety');
      } catch {
        // Ignore auto-backup failure
      }
    }
    if (typeof dayOfWeek === 'number') {
      this.db.prepare('DELETE FROM timetable_blocks WHERE day_of_week = ?').run(dayOfWeek);
    } else {
      this.db.prepare('DELETE FROM timetable_blocks').run();
    }
    this.touchLastSaved();
  }

  getQuests(dateKey?: string): Quest[] {
    const rows = dateKey
      ? (this.db
          .prepare('SELECT data FROM quests WHERE date_key = ? ORDER BY created_at ASC')
          .all(dateKey) as { data: string }[])
      : (this.db
          .prepare('SELECT data FROM quests ORDER BY date_key DESC, created_at ASC LIMIT 200')
          .all() as { data: string }[]);
    return rows.map((r) => JSON.parse(r.data) as Quest);
  }

  getQuestById(id: string): Quest | null {
    const row = this.db.prepare('SELECT data FROM quests WHERE id = ?').get(id) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as Quest) : null;
  }

  saveQuest(quest: Quest): void {
    this.db
      .prepare(
        `INSERT INTO quests (id, date_key, status, data, created_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET status = excluded.status, data = excluded.data`
      )
      .run(quest.id, quest.dateKey, quest.status, JSON.stringify(quest), quest.createdAt);
    this.touchLastSaved();
  }

  deleteQuest(id: string): void {
    this.db.prepare('DELETE FROM quests WHERE id = ?').run(id);
    this.touchLastSaved();
  }

  clearPendingQuestsForDate(dateKey: string): void {
    this.db.prepare("DELETE FROM quests WHERE date_key = ? AND status = 'pending'").run(dateKey);
    this.touchLastSaved();
  }

  getBosses(): BossMission[] {
    const rows = this.db.prepare('SELECT data FROM bosses').all() as { data: string }[];
    return rows
      .map((r) => JSON.parse(r.data) as BossMission)
      .sort((a, b) => (a.orderIndex ?? 999) - (b.orderIndex ?? 999));
  }

  saveBoss(boss: BossMission): void {
    this.db
      .prepare(
        `INSERT INTO bosses (id, data) VALUES (?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data`
      )
      .run(boss.id, JSON.stringify(boss));
    this.touchLastSaved();
  }

  deleteBoss(id: string): void {
    this.db.prepare('DELETE FROM bosses WHERE id = ?').run(id);
    this.touchLastSaved();
  }

  getChapters(): StoryChapter[] {
    const rows = this.db
      .prepare('SELECT data FROM chapters ORDER BY chapter_number ASC')
      .all() as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as StoryChapter);
  }

  saveChapter(chapter: StoryChapter): void {
    this.db
      .prepare(
        `INSERT INTO chapters (id, chapter_number, data) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET chapter_number = excluded.chapter_number, data = excluded.data`
      )
      .run(chapter.id, chapter.chapterNumber, JSON.stringify(chapter));
    this.touchLastSaved();
  }

  getShopItems(): ShopItem[] {
    const rows = this.db.prepare('SELECT data FROM shop_items').all() as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as ShopItem);
  }

  saveShopItem(item: ShopItem): void {
    this.db
      .prepare(
        `INSERT INTO shop_items (id, data) VALUES (?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data`
      )
      .run(item.id, JSON.stringify(item));
    this.touchLastSaved();
  }

  deleteShopItem(id: string): void {
    this.db.prepare('DELETE FROM shop_items WHERE id = ?').run(id);
    this.touchLastSaved();
  }

  getInventory(): InventoryItem[] {
    const rows = this.db.prepare('SELECT data FROM inventory').all() as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as InventoryItem);
  }

  saveInventoryItem(item: InventoryItem): void {
    this.db
      .prepare(
        `INSERT INTO inventory (id, data) VALUES (?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data`
      )
      .run(item.id, JSON.stringify(item));
    this.touchLastSaved();
  }

  deleteInventoryItem(id: string): void {
    this.db.prepare('DELETE FROM inventory WHERE id = ?').run(id);
    this.touchLastSaved();
  }

  getSkills(): SkillNode[] {
    const rows = this.db.prepare('SELECT data FROM skills ORDER BY branch ASC').all() as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as SkillNode);
  }

  saveSkill(skill: SkillNode): void {
    this.db
      .prepare(
        `INSERT INTO skills (id, branch, data) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET branch = excluded.branch, data = excluded.data`
      )
      .run(skill.id, skill.branch, JSON.stringify(skill));
    this.touchLastSaved();
  }

  getShadows(): ShadowSoldier[] {
    const rows = this.db.prepare('SELECT data FROM shadows').all() as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as ShadowSoldier);
  }

  saveShadow(shadow: ShadowSoldier): void {
    this.db
      .prepare(
        `INSERT INTO shadows (id, data) VALUES (?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data`
      )
      .run(shadow.id, JSON.stringify(shadow));
    this.touchLastSaved();
  }

  getMemoryLogs(limit = 50): AgentMemoryLog[] {
    const rows = this.db
      .prepare('SELECT data FROM memory_logs ORDER BY timestamp DESC LIMIT ?')
      .all(limit) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as AgentMemoryLog);
  }

  addMemoryLog(log: AgentMemoryLog): void {
    this.db
      .prepare(
        `INSERT INTO memory_logs (id, timestamp, data) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data`
      )
      .run(log.id, log.timestamp, JSON.stringify(log));
    this.touchLastSaved();
  }

  getDailySnapshots(limit = 30): DailyProgressSnapshot[] {
    const rows = this.db
      .prepare('SELECT data FROM daily_snapshots ORDER BY date_key DESC LIMIT ?')
      .all(limit) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as DailyProgressSnapshot);
  }

  recordDailyProgress(delta: {
    dateKey: string;
    questsCompleted?: number;
    focusMinutes?: number;
    xpEarned?: number;
    masteryEarned?: number;
    energyLevel: number;
    reflectionNote?: string;
    isRestDay?: boolean;
  }): void {
    const row = this.db
      .prepare('SELECT data FROM daily_snapshots WHERE date_key = ?')
      .get(delta.dateKey) as { data: string } | undefined;

    const existing: DailyProgressSnapshot = row
      ? (JSON.parse(row.data) as DailyProgressSnapshot)
      : {
          dateKey: delta.dateKey,
          questsCompleted: 0,
          focusMinutes: 0,
          xpEarned: 0,
          masteryEarned: 0,
          energyLevel: delta.energyLevel,
        };

    existing.questsCompleted += delta.questsCompleted ?? 0;
    existing.focusMinutes += delta.focusMinutes ?? 0;
    existing.xpEarned += delta.xpEarned ?? 0;
    existing.masteryEarned += delta.masteryEarned ?? 0;
    existing.energyLevel = delta.energyLevel;
    if (typeof delta.reflectionNote === 'string') {
      existing.reflectionNote = delta.reflectionNote;
    }
    if (typeof delta.isRestDay === 'boolean') {
      existing.isRestDay = delta.isRestDay;
    }

    this.db
      .prepare(
        `INSERT INTO daily_snapshots (date_key, data) VALUES (?, ?)
         ON CONFLICT(date_key) DO UPDATE SET data = excluded.data`
      )
      .run(delta.dateKey, JSON.stringify(existing));
    this.touchLastSaved();
  }

  addAuditLog(
    actionType: AuditActionType,
    summary: string,
    payload?: Record<string, unknown>
  ): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: `aud-${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      actionType,
      summary,
      payload,
    };
    this.db
      .prepare(
        `INSERT INTO transaction_audit_log (id, timestamp, action_type, summary, payload)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        entry.id,
        entry.timestamp,
        entry.actionType,
        entry.summary,
        payload ? JSON.stringify(payload) : null
      );
    return entry;
  }

  getAuditLogs(limit = 30): AuditLogEntry[] {
    const rows = this.db
      .prepare(
        'SELECT id, timestamp, action_type, summary, payload FROM transaction_audit_log ORDER BY timestamp DESC LIMIT ?'
      )
      .all(limit) as Array<{
      id: string;
      timestamp: string;
      action_type: AuditActionType;
      summary: string;
      payload: string | null;
    }>;
    return rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      actionType: r.action_type,
      summary: r.summary,
      payload: r.payload ? (JSON.parse(r.payload) as Record<string, unknown>) : undefined,
    }));
  }

  getChatThreads(): AIChatThread[] {
    const threadRows = this.db
      .prepare(
        'SELECT id, title, context_scope, created_at, updated_at FROM ai_chat_threads ORDER BY updated_at DESC'
      )
      .all() as Array<{
      id: string;
      title: string;
      context_scope: ChatContextScope;
      created_at: string;
      updated_at: string;
    }>;

    const msgRows = this.db
      .prepare(
        'SELECT id, thread_id, role, content, suggested_quests, model_used, created_at FROM ai_chat_messages ORDER BY created_at ASC'
      )
      .all() as Array<{
      id: string;
      thread_id: string;
      role: 'user' | 'assistant';
      content: string;
      suggested_quests: string | null;
      model_used: string | null;
      created_at: string;
    }>;

    const byThread = new Map<string, AIChatMessage[]>();
    for (const r of msgRows) {
      let suggestedQuests: SuggestedQuestItem[] | undefined;
      if (r.suggested_quests) {
        try {
          suggestedQuests = JSON.parse(r.suggested_quests) as SuggestedQuestItem[];
        } catch {
          suggestedQuests = undefined;
        }
      }
      const list = byThread.get(r.thread_id) || [];
      list.push({
        id: r.id,
        threadId: r.thread_id,
        role: r.role,
        content: r.content,
        suggestedQuests,
        modelUsed: r.model_used || undefined,
        createdAt: r.created_at,
      });
      byThread.set(r.thread_id, list);
    }

    return threadRows.map((t) => ({
      id: t.id,
      title: t.title,
      contextScope: t.context_scope || 'general',
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      messages: byThread.get(t.id) || [],
    }));
  }

  getChatThreadById(threadId: string): AIChatThread | null {
    return this.getChatThreads().find((t) => t.id === threadId) || null;
  }

  createChatThread(params: {
    id: string;
    title: string;
    contextScope?: ChatContextScope;
    createdAt?: string;
    updatedAt?: string;
  }): AIChatThread {
    const now = params.createdAt || new Date().toISOString();
    const updatedAt = params.updatedAt || now;
    const scope: ChatContextScope = params.contextScope || 'general';
    this.db
      .prepare(
        `INSERT INTO ai_chat_threads (id, title, context_scope, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(params.id, params.title, scope, now, updatedAt);
    this.touchLastSaved();
    return {
      id: params.id,
      title: params.title,
      contextScope: scope,
      createdAt: now,
      updatedAt,
      messages: [],
    };
  }

  updateChatThread(
    threadId: string,
    updates: { title?: string; contextScope?: ChatContextScope }
  ): AIChatThread | null {
    const existing = this.getChatThreadById(threadId);
    if (!existing) return null;
    const nextTitle = updates.title !== undefined ? updates.title.trim() || existing.title : existing.title;
    const nextScope = updates.contextScope ?? existing.contextScope;
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE ai_chat_threads SET title = ?, context_scope = ?, updated_at = ? WHERE id = ?`
      )
      .run(nextTitle, nextScope, now, threadId);
    this.touchLastSaved();
    return this.getChatThreadById(threadId);
  }

  deleteChatThread(threadId: string): void {
    this.db.prepare('DELETE FROM ai_chat_messages WHERE thread_id = ?').run(threadId);
    this.db.prepare('DELETE FROM ai_chat_threads WHERE id = ?').run(threadId);
    this.touchLastSaved();
  }

  addChatMessage(msg: AIChatMessage): void {
    this.db
      .prepare(
        `INSERT INTO ai_chat_messages (id, thread_id, role, content, suggested_quests, model_used, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        msg.id,
        msg.threadId,
        msg.role,
        msg.content,
        msg.suggestedQuests ? JSON.stringify(msg.suggestedQuests) : null,
        msg.modelUsed || null,
        msg.createdAt
      );
    this.db
      .prepare('UPDATE ai_chat_threads SET updated_at = ? WHERE id = ?')
      .run(msg.createdAt, msg.threadId);
    this.touchLastSaved();
  }

  clearChatThreads(): void {
    this.db.exec('DELETE FROM ai_chat_messages; DELETE FROM ai_chat_threads;');
    this.touchLastSaved();
  }

  listDiskBackups(): Array<{ filename: string; sizeBytes: number; createdAt: string }> {
    if (!fs.existsSync(BACKUP_DIR)) return [];
    return fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((filename) => {
        const full = path.join(BACKUP_DIR, filename);
        const st = fs.statSync(full);
        return {
          filename,
          sizeBytes: st.size,
          createdAt: st.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.filename.localeCompare(a.filename));
  }

  createDiskBackup(prefix = 'backup'): {
    filename: string;
    filePath: string;
    sizeBytes: number;
    createdAt: string;
    backupCount: number;
  } {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    let filename = `${prefix}-${stamp}.json`;
    let filePath = path.join(BACKUP_DIR, filename);
    if (fs.existsSync(filePath)) {
      filename = `${prefix}-${stamp}-${String(now.getMilliseconds()).padStart(3, '0')}.json`;
      filePath = path.join(BACKUP_DIR, filename);
    }

    const content = JSON.stringify(this.exportSnapshot(), null, 2);
    fs.writeFileSync(filePath, content, 'utf8');

    // Prune oldest backups beyond 20
    const allBackups = this.listDiskBackups();
    if (allBackups.length > 20) {
      for (const old of allBackups.slice(20)) {
        try {
          fs.unlinkSync(path.join(BACKUP_DIR, old.filename));
        } catch {
          // Ignore prune failure
        }
      }
    }

    const finalBackups = this.listDiskBackups();
    const stat = fs.statSync(filePath);
    const createdAt = stat.mtime.toISOString();

    this.addAuditLog('SYSTEM_BACKUP', `Tạo bản sao lưu ổ cứng "${filename}"`, {
      filename,
      sizeBytes: stat.size,
      backupCount: finalBackups.length,
    });

    return {
      filename,
      filePath,
      sizeBytes: stat.size,
      createdAt,
      backupCount: finalBackups.length,
    };
  }

  getStorageInfo(): StorageInfoPayload {
    const countOf = (table: string) =>
      (this.db.prepare(`SELECT COUNT(*) AS cnt FROM ${table}`).get() as { cnt: number }).cnt;
    const stat = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH) : null;
    const walPath = `${DB_PATH}-wal`;
    const walStat = fs.existsSync(walPath) ? fs.statSync(walPath) : null;

    const journalRow = this.db.prepare('PRAGMA journal_mode').get() as { journal_mode: string } | undefined;
    const syncRow = this.db.prepare('PRAGMA synchronous').get() as { synchronous: number } | undefined;
    const fkRow = this.db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number } | undefined;
    const checkRow = this.db.prepare('PRAGMA quick_check').get() as { quick_check: string } | undefined;

    const syncMap: Record<number, string> = { 0: 'OFF', 1: 'NORMAL', 2: 'FULL', 3: 'EXTRA' };
    const backups = this.listDiskBackups();

    return {
      dbPath: DB_PATH,
      fileSizeBytes: stat?.size ?? 0,
      walSizeBytes: walStat?.size ?? 0,
      journalMode: (journalRow?.journal_mode ?? 'wal').toUpperCase(),
      synchronousMode: syncMap[syncRow?.synchronous ?? 1] ?? 'NORMAL',
      foreignKeysEnabled: fkRow?.foreign_keys === 1,
      integrityOk: (checkRow?.quick_check ?? 'ok').toLowerCase() === 'ok',
      lastBackupAt: backups[0]?.createdAt,
      lastSavedAt: this.getKV<string>('last_saved_at') || stat?.mtime.toISOString(),
      timezone: VN_TIMEZONE,
      backupCount: backups.length,
      tableCounts: {
        goals: countOf('goals'),
        timetableBlocks: countOf('timetable_blocks'),
        quests: countOf('quests'),
        bosses: countOf('bosses'),
        chapters: countOf('chapters'),
        skills: countOf('skills'),
        shadows: countOf('shadows'),
        memoryLogs: countOf('memory_logs'),
        dailySnapshots: countOf('daily_snapshots'),
        auditLogs: countOf('transaction_audit_log'),
      },
    };
  }

  getHealthReport(): {
    ok: boolean;
    integrityCheck: string;
    storageInfo: StorageInfoPayload;
    recentBackups: Array<{ filename: string; sizeBytes: number; createdAt: string }>;
  } {
    const checkRow = this.db.prepare('PRAGMA quick_check').get() as { quick_check: string } | undefined;
    const integrityCheck = checkRow?.quick_check ?? 'ok';
    const storageInfo = this.getStorageInfo();
    const recentBackups = this.listDiskBackups().slice(0, 10);
    return {
      ok: integrityCheck.toLowerCase() === 'ok',
      integrityCheck,
      storageInfo,
      recentBackups,
    };
  }

  exportSnapshot(): Record<string, unknown> {
    return {
      version: 4,
      exportedAt: new Date().toISOString(),
      player: this.getPlayer(),
      goals: this.getGoals(),
      timetable: this.getTimetableBlocks(),
      quests: this.getQuests(),
      bosses: this.getBosses(),
      chapters: this.getChapters(),
      shopItems: this.getShopItems(),
      inventory: this.getInventory(),
      skills: this.getSkills(),
      shadows: this.getShadows(),
      memoryLogs: this.getMemoryLogs(200),
      dailySnapshots: this.getDailySnapshots(1100),
      auditLogs: this.getAuditLogs(200),
      chatThreads: this.getChatThreads(),
    };
  }

  importSnapshot(snapshot: Record<string, any>): void {
    if (!snapshot || typeof snapshot !== 'object' || !snapshot.player) {
      throw new Error('File JSON không đúng định dạng backup của THE SYSTEM.');
    }

    if (!process.env.THE_SYSTEM_DB_PATH && this.getKV('player_state')) {
      try {
        this.createDiskBackup('auto-safety');
      } catch {
        // Ignore auto-backup failure
      }
    }

    this.runTransaction(() => {
      this.clearAllTables(true);

      this.savePlayer(snapshot.player as PlayerState);
      if (Array.isArray(snapshot.goals)) for (const g of snapshot.goals) this.saveGoal(g as Goal);
      if (Array.isArray(snapshot.timetable)) for (const b of snapshot.timetable) this.saveTimetableBlock(b as TimetableBlock);
      if (Array.isArray(snapshot.quests)) for (const q of snapshot.quests) this.saveQuest(q as Quest);
      if (Array.isArray(snapshot.bosses)) for (const boss of snapshot.bosses) this.saveBoss(boss as BossMission);
      if (Array.isArray(snapshot.chapters)) for (const ch of snapshot.chapters) this.saveChapter(ch as StoryChapter);
      if (Array.isArray(snapshot.shopItems)) for (const it of snapshot.shopItems) this.saveShopItem(it as ShopItem);
      if (Array.isArray(snapshot.inventory)) for (const inv of snapshot.inventory) this.saveInventoryItem(inv as InventoryItem);
      if (Array.isArray(snapshot.skills)) for (const sk of snapshot.skills) this.saveSkill(sk as SkillNode);
      if (Array.isArray(snapshot.shadows)) for (const sh of snapshot.shadows) this.saveShadow(sh as ShadowSoldier);
      if (Array.isArray(snapshot.memoryLogs)) for (const lg of snapshot.memoryLogs) this.addMemoryLog(lg as AgentMemoryLog);
      if (Array.isArray(snapshot.dailySnapshots)) {
        for (const snap of snapshot.dailySnapshots as DailyProgressSnapshot[]) {
          this.db
            .prepare(
              `INSERT INTO daily_snapshots (date_key, data) VALUES (?, ?)
               ON CONFLICT(date_key) DO UPDATE SET data = excluded.data`
            )
            .run(snap.dateKey, JSON.stringify(snap));
        }
      }
      if (Array.isArray(snapshot.auditLogs)) {
        for (const aud of snapshot.auditLogs as AuditLogEntry[]) {
          this.db
            .prepare(
              `INSERT INTO transaction_audit_log (id, timestamp, action_type, summary, payload)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(id) DO NOTHING`
            )
            .run(
              aud.id,
              aud.timestamp,
              aud.actionType,
              aud.summary,
              aud.payload ? JSON.stringify(aud.payload) : null
            );
        }
      }
      if (Array.isArray(snapshot.chatThreads)) {
        for (const thread of snapshot.chatThreads as AIChatThread[]) {
          if (!thread?.id) continue;
          this.createChatThread({
            id: thread.id,
            title: thread.title || 'Cuộc trò chuyện',
            contextScope: thread.contextScope || 'general',
            createdAt: thread.createdAt,
            updatedAt: thread.updatedAt,
          });
          if (Array.isArray(thread.messages)) {
            for (const m of thread.messages) {
              this.addChatMessage({
                ...m,
                threadId: thread.id,
              });
            }
            if (thread.updatedAt) {
              this.db
                .prepare('UPDATE ai_chat_threads SET updated_at = ? WHERE id = ?')
                .run(thread.updatedAt, thread.id);
            }
          }
        }
      }
    });
  }

  private clearAllTables(keepAiSettings: boolean): void {
    const prevAi = keepAiSettings ? this.getKV<AISettings>('ai_settings') : null;
    this.db.exec(`
      DELETE FROM kv_store;
      DELETE FROM goals;
      DELETE FROM timetable_blocks;
      DELETE FROM quests;
      DELETE FROM bosses;
      DELETE FROM chapters;
      DELETE FROM shop_items;
      DELETE FROM inventory;
      DELETE FROM skills;
      DELETE FROM shadows;
      DELETE FROM memory_logs;
      DELETE FROM daily_snapshots;
      DELETE FROM transaction_audit_log;
      DELETE FROM ai_chat_messages;
      DELETE FROM ai_chat_threads;
      DELETE FROM activity_logs;
      DELETE FROM assistant_nudges;
    `);
    if (prevAi) {
      this.setKV('ai_settings', prevAi);
    }
  }

  getAssistantSettings(): AssistantSettings {
    const saved = this.getKV<Partial<AssistantSettings>>('assistant_settings');
    const defaults = buildDefaultAssistantSettings();
    const merged: AssistantSettings = {
      ...defaults,
      ...(saved || {}),
      customRules: Array.isArray(saved?.customRules) ? saved.customRules : [],
    };
    let needsPersist = false;
    if (!merged.lanPairToken || merged.lanPairToken.length < 16) {
      merged.lanPairToken = crypto.randomBytes(16).toString('hex');
      needsPersist = true;
    }
    if (!merged.lanPairPin || !/^\d{6}$/.test(merged.lanPairPin)) {
      merged.lanPairPin = String(crypto.randomInt(100000, 1000000));
      needsPersist = true;
    }
    if (needsPersist) {
      this.setKV('assistant_settings', merged);
    }
    return merged;
  }

  saveAssistantSettings(settings: AssistantSettings): AssistantSettings {
    const existing = this.getAssistantSettings();
    const normalized: AssistantSettings = {
      ...buildDefaultAssistantSettings(),
      ...settings,
      lanPairToken: settings.lanPairToken || existing.lanPairToken,
      lanPairPin: settings.lanPairPin || existing.lanPairPin,
      customRules: Array.isArray(settings.customRules) ? settings.customRules : [],
    };
    this.setKV('assistant_settings', normalized);
    return normalized;
  }

  upsertActivityLog(entry: ActivityLogEntry): void {
    this.db
      .prepare(
        `INSERT INTO activity_logs (
          id, date_key, process_name, window_title, category,
          duration_seconds, started_at, ended_at, credited_to_skill
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          process_name = excluded.process_name,
          window_title = excluded.window_title,
          category = excluded.category,
          duration_seconds = excluded.duration_seconds,
          ended_at = excluded.ended_at,
          credited_to_skill = excluded.credited_to_skill`
      )
      .run(
        entry.id,
        entry.dateKey,
        entry.processName,
        entry.windowTitle,
        entry.category,
        Math.max(1, Math.round(entry.durationSeconds)),
        entry.startedAt,
        entry.endedAt,
        entry.creditedToSkill ? 1 : 0
      );
    this.touchLastSaved();
  }

  getActivityLogsByDate(dateKey: string): ActivityLogEntry[] {
    const rows = this.db
      .prepare(
        `SELECT id, date_key, process_name, window_title, category,
                duration_seconds, started_at, ended_at, credited_to_skill
         FROM activity_logs
         WHERE date_key = ?
         ORDER BY started_at DESC`
      )
      .all(dateKey) as Array<{
      id: string;
      date_key: string;
      process_name: string;
      window_title: string;
      category: ActivityCategory;
      duration_seconds: number;
      started_at: string;
      ended_at: string;
      credited_to_skill: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      dateKey: r.date_key,
      processName: r.process_name,
      windowTitle: r.window_title,
      category: r.category,
      durationSeconds: r.duration_seconds,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      creditedToSkill: r.credited_to_skill === 1,
    }));
  }

  markActivityCredited(dateKey: string): void {
    this.db
      .prepare(
        `UPDATE activity_logs
         SET credited_to_skill = 1
         WHERE date_key = ?
           AND category IN ('deep_work', 'study_research')
           AND credited_to_skill = 0`
      )
      .run(dateKey);
    this.touchLastSaved();
  }

  reclassifyTodayActivityLogs(
    keyword: string,
    category: Exclude<ActivityCategory, 'idle'>,
    dateKey: string
  ): number {
    const cleanKw = keyword.trim().toLowerCase();
    if (!cleanKw) return 0;
    const rows = this.getActivityLogsByDate(dateKey);
    const updateStmt = this.db.prepare('UPDATE activity_logs SET category = ? WHERE id = ?');
    let updatedRows = 0;
    for (const row of rows) {
      const procMatch = row.processName.toLowerCase().includes(cleanKw);
      const titleMatch = row.windowTitle.toLowerCase().includes(cleanKw);
      if ((procMatch || titleMatch) && row.category !== category) {
        updateStmt.run(category, row.id);
        updatedRows += 1;
      }
    }
    if (updatedRows > 0) {
      this.touchLastSaved();
    }
    return updatedRows;
  }

  addAssistantNudge(nudge: AssistantNudge): void {
    this.db
      .prepare(
        `INSERT INTO assistant_nudges (
          id, date_key, kind, title, message, created_at, dismissed, toast_sent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          dismissed = excluded.dismissed,
          toast_sent = excluded.toast_sent`
      )
      .run(
        nudge.id,
        nudge.dateKey,
        nudge.kind,
        nudge.title,
        nudge.message,
        nudge.createdAt,
        nudge.dismissed ? 1 : 0,
        nudge.toastSent ? 1 : 0
      );
    this.touchLastSaved();
  }

  getAssistantNudges(limit = 30): AssistantNudge[] {
    const rows = this.db
      .prepare(
        `SELECT id, date_key, kind, title, message, created_at, dismissed, toast_sent
         FROM assistant_nudges
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(limit) as Array<{
      id: string;
      date_key: string;
      kind: AssistantNudge['kind'];
      title: string;
      message: string;
      created_at: string;
      dismissed: number;
      toast_sent: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      dateKey: r.date_key,
      kind: r.kind,
      title: r.title,
      message: r.message,
      createdAt: r.created_at,
      dismissed: r.dismissed === 1,
      toastSent: r.toast_sent === 1,
    }));
  }

  dismissAssistantNudge(id: string): void {
    this.db.prepare('UPDATE assistant_nudges SET dismissed = 1 WHERE id = ?').run(id);
    this.touchLastSaved();
  }

  getActivityLogsRange(startDateKey: string, endDateKey: string): ActivityLogEntry[] {
    const rows = this.db
      .prepare(
        `SELECT id, date_key, process_name, window_title, category,
                duration_seconds, started_at, ended_at, credited_to_skill
         FROM activity_logs
         WHERE date_key >= ? AND date_key <= ?
         ORDER BY date_key ASC, started_at ASC`
      )
      .all(startDateKey, endDateKey) as Array<{
      id: string;
      date_key: string;
      process_name: string;
      window_title: string;
      category: ActivityCategory;
      duration_seconds: number;
      started_at: string;
      ended_at: string;
      credited_to_skill: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      dateKey: r.date_key,
      processName: r.process_name,
      windowTitle: r.window_title,
      category: r.category,
      durationSeconds: r.duration_seconds,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      creditedToSkill: r.credited_to_skill === 1,
    }));
  }

  getDailyProgressRange(days: number): DailyProgressSnapshot[] {
    const limit = Math.max(1, Math.min(365, Math.round(days || 30)));
    return this.getDailySnapshots(limit);
  }

  getWeeklyReviews(limit = 12): WeeklyReviewRecord[] {
    const rows = this.db
      .prepare('SELECT data FROM weekly_reviews ORDER BY created_at DESC LIMIT ?')
      .all(Math.max(1, Math.min(50, limit))) as Array<{ data: string }>;
    return rows.map((r) => JSON.parse(r.data) as WeeklyReviewRecord);
  }

  saveWeeklyReview(review: WeeklyReviewRecord): void {
    this.db
      .prepare(
        `INSERT INTO weekly_reviews (id, week_start, week_end, grade, data, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           week_start = excluded.week_start,
           week_end = excluded.week_end,
           grade = excluded.grade,
           data = excluded.data`
      )
      .run(
        review.id,
        review.weekStart,
        review.weekEnd,
        review.grade,
        JSON.stringify(review),
        review.createdAt
      );
    this.touchLastSaved();
  }

  restoreFromBackupFile(
    sourcePath: string,
    preRestoreBackupPath: string
  ): { preRestoreBackup: string } {
    if (!fs.existsSync(sourcePath)) {
      throw new Error('Không tìm thấy file sao lưu để khôi phục.');
    }
    this.checkpointWal(true);
    const preDir = path.dirname(preRestoreBackupPath);
    if (!fs.existsSync(preDir)) {
      fs.mkdirSync(preDir, { recursive: true });
    }
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, preRestoreBackupPath);
    }

    try {
      this.db.close();
    } catch {
      // Ignore close errors
    }

    for (const suffix of ['-wal', '-shm']) {
      const sidecar = `${DB_PATH}${suffix}`;
      if (fs.existsSync(sidecar)) {
        try {
          fs.unlinkSync(sidecar);
        } catch {
          // Ignore sidecar cleanup error
        }
      }
    }

    fs.copyFileSync(sourcePath, DB_PATH);
    this.db = new DatabaseSync(DB_PATH);
    this.initSchema();
    this.seedIfEmpty();
    this.touchLastSaved();
    this.checkpointWal(false);

    return { preRestoreBackup: path.basename(preRestoreBackupPath) };
  }

  resetAll(mode: SystemResetMode = 'clean', options?: { clearChats?: boolean }): void {
    if (!process.env.THE_SYSTEM_DB_PATH && this.getKV('player_state')) {
      try {
        this.createDiskBackup('auto-safety');
      } catch {
        // Ignore auto-backup failure
      }
    }

    this.runTransaction(() => {
      if (mode === 'progress') {
        const prevPlayer = this.getKV<PlayerState>('player_state');
        const prevAi = this.getKV<AISettings>('ai_settings');
        const prevAssistantSettings = this.getKV<AssistantSettings>('assistant_settings');
        const keptBlocks = this.getTimetableBlocks().filter(
          (b) => !b.id.startsWith('tt-task-') && !b.id.startsWith('tt-ai-')
        );
        const keptGoals = this.getGoals().map((g) => ({ ...g, progress: 0 }));
        const keptCustomBosses = this.getBosses()
          .filter((b) => b.bossRole === 'custom_boss')
          .map((b) => ({
            ...b,
            currentHp: b.maxHp,
            defeated: false,
            stages: b.stages.map((st) => ({ ...st, completed: false, proofText: undefined })),
          }));
        const keptCustomShop = this.getShopItems().filter((it) => it.isCustom);
        const keptCustomSkills = this.getSkills()
          .filter((sk) => !sk.treeBranch)
          .map((sk) => ({
            ...sk,
            practiceXp: 0,
            totalPracticeXp: 0,
            totalPracticeMinutes: 0,
            tasksContributedCount: 0,
            recentContributions: [],
            masteryTier: 0,
            powerRating: 0,
          }));
        const keptChats = options?.clearChats ? [] : this.getChatThreads();

        this.clearAllTables(true);
        this.seedCleanState(true);

        const freshPlayer = buildCleanPlayer(getTodayKey());
        const resetPlayer: PlayerState = {
          ...freshPlayer,
          isOnboarded: true,
          profile: prevPlayer?.profile ?? freshPlayer.profile,
          hunterClass: prevPlayer?.hunterClass || freshPlayer.hunterClass,
        };
        this.savePlayer(resetPlayer);

        if (prevAi) {
          this.setKV('ai_settings', prevAi);
        }
        if (prevAssistantSettings) {
          this.setKV('assistant_settings', prevAssistantSettings);
        }

        if (keptBlocks.length > 0) {
          this.db.exec('DELETE FROM timetable_blocks');
          for (const blk of keptBlocks) {
            this.saveTimetableBlock(blk);
          }
        }

        for (const g of keptGoals) this.saveGoal(g);
        for (const cb of keptCustomBosses) this.saveBoss(cb);
        for (const cs of keptCustomShop) this.saveShopItem(cs);
        for (const sk of keptCustomSkills) this.saveSkill(sk);

        for (const thread of keptChats) {
          this.createChatThread({
            id: thread.id,
            title: thread.title,
            contextScope: thread.contextScope,
            createdAt: thread.createdAt,
            updatedAt: thread.updatedAt,
          });
          for (const msg of thread.messages) {
            this.addChatMessage(msg);
          }
          this.db
            .prepare('UPDATE ai_chat_threads SET updated_at = ? WHERE id = ?')
            .run(thread.updatedAt, thread.id);
        }

        this.addAuditLog(
          'SYSTEM_RESET',
          'Reset tiến trình về Level 1 (giữ Hồ sơ & Thời khóa biểu)',
          { mode, clearChats: Boolean(options?.clearChats) }
        );
      } else {
        this.clearAllTables(true);
        this.seedCleanState(true);
        this.addAuditLog(
          'SYSTEM_RESET',
          'Reset toàn bộ hệ thống về trạng thái ban đầu (Level 1)',
          { mode }
        );
      }
    });

    this.checkpointWal();
  }
}

export const db = new SystemDatabase();
