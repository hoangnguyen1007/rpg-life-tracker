import type {
  AttributeKey,
  InventoryItem,
  PlayerGrowthBonuses,
  PlayerState,
  ShadowSoldier,
  SkillBranchId,
  SkillEffectCode,
  SkillNode,
} from './types.ts';

interface NodeSeed {
  id: string;
  name: string;
  branch: string;
  treeBranch: SkillBranchId;
  tier: number;
  slot: 'center' | 'left' | 'right';
  icon: string;
  description: string;
  effectSummary: string;
  effectCode: SkillEffectCode;
  primaryStat: AttributeKey;
  prerequisiteIds: string[];
  requireAnyPrerequisite?: boolean;
  minPrereqLevel?: number;
  isInfiniteApex?: boolean;
  baseGoldCost: number;
  baseRunestoneCost: number;
  verificationCriteria: string;
}

function makeNode(seed: NodeSeed): SkillNode {
  return {
    id: seed.id,
    name: seed.name,
    branch: seed.branch,
    treeBranch: seed.treeBranch,
    tier: seed.tier,
    slot: seed.slot,
    icon: seed.icon,
    description: seed.description,
    effectSummary: seed.effectSummary,
    effectCode: seed.effectCode,
    isInfiniteApex: seed.isInfiniteApex,
    ascensionTier: 0,
    unlockedRankCap: 0,
    minPrereqLevel: seed.minPrereqLevel,
    unlocked: false,
    unlockSpCost: seed.tier, // Tier 1=1 SP .. Tier 5=5 SP
    baseGoldCost: seed.baseGoldCost,
    baseRunestoneCost: seed.baseRunestoneCost,
    requireAnyPrerequisite: seed.requireAnyPrerequisite,
    practiceXp: 0,
    xpPerTier: 120 + seed.tier * 40,
    totalPracticeXp: 0,
    totalPracticeMinutes: 0,
    tasksContributedCount: 0,
    powerRating: 0,
    recentContributions: [],
    masteryTier: 0,
    maxTier: 5,
    verificationCriteria: seed.verificationCriteria,
    prerequisiteIds: seed.prerequisiteIds,
    primaryStat: seed.primaryStat,
  };
}

export function buildSkillTreeNodes(): SkillNode[] {
  const specs: NodeSeed[] = [
    // ==================== 1. TRÍ TUỆ & HỆ THỐNG (INTELLECT - INT) ====================
    {
      id: 'sk-int-1',
      name: 'Phân Rã Nguyên Lý',
      branch: 'Trí Tuệ & Hệ Thống',
      treeBranch: 'intellect',
      tier: 1,
      slot: 'center',
      icon: 'cpu',
      description: 'Tách bài toán lớn thành các nguyên lý gốc (First Principles) trước khi bắt tay thực thi.',
      effectSummary: '+4% XP & +4% Mastery khi xong Quest (+2 INT/cấp)',
      effectCode: 'STAT_SURGE',
      primaryStat: 'INT',
      prerequisiteIds: [],
      baseGoldCost: 50,
      baseRunestoneCost: 0,
      verificationCriteria: 'Chia nhỏ 1 mục tiêu lớn thành các bước đo lường được.',
    },
    {
      id: 'sk-int-2l',
      name: 'Tư Duy Phân Tích',
      branch: 'Trí Tuệ & Hệ Thống',
      treeBranch: 'intellect',
      tier: 2,
      slot: 'left',
      icon: 'search',
      description: 'Đọc dữ liệu, nhận diện mô thức (pattern) và phát hiện sai lệch nhanh.',
      effectSummary: '+8% XP từ mọi phiên học & làm việc (+2 INT/cấp)',
      effectCode: 'XP_GAIN',
      primaryStat: 'INT',
      prerequisiteIds: ['sk-int-1'],
      minPrereqLevel: 1,
      baseGoldCost: 85,
      baseRunestoneCost: 0,
      verificationCriteria: 'Phân tích 3 vấn đề phức tạp bằng số liệu hoặc bằng chứng.',
    },
    {
      id: 'sk-int-2r',
      name: 'Giải Quyết Vấn Đề',
      branch: 'Trí Tuệ & Hệ Thống',
      treeBranch: 'intellect',
      tier: 2,
      slot: 'right',
      icon: 'wrench',
      description: 'Thực hành có chủ đích (Ericsson Deliberate Practice) ngay tại rìa năng lực.',
      effectSummary: '+8% Tiến độ Boss từ nỗ lực hằng ngày (+2 INT/cấp)',
      effectCode: 'BOSS_PROGRESS',
      primaryStat: 'INT',
      prerequisiteIds: ['sk-int-1'],
      minPrereqLevel: 1,
      baseGoldCost: 85,
      baseRunestoneCost: 0,
      verificationCriteria: 'Hoàn thành các phiên sửa lỗi hoặc giải quyết nút thắt khó.',
    },
    {
      id: 'sk-int-3',
      name: 'Kiến Trúc & Chiến Lược',
      branch: 'Trí Tuệ & Hệ Thống',
      treeBranch: 'intellect',
      tier: 3,
      slot: 'center',
      icon: 'compass',
      description: 'Thiết kế hệ thống bền vững, đánh giá trade-off và lựa chọn đòn bẩy cao nhất.',
      effectSummary: '+8% Mastery & +6% Focus Bonus (+2 INT/cấp)',
      effectCode: 'MASTERY_GAIN',
      primaryStat: 'INT',
      prerequisiteIds: ['sk-int-2l', 'sk-int-2r'],
      requireAnyPrerequisite: true,
      minPrereqLevel: 1,
      baseGoldCost: 130,
      baseRunestoneCost: 1,
      verificationCriteria: 'Lập lộ trình dài hạn và tối ưu đánh đổi giữa các phương án.',
    },
    {
      id: 'sk-int-4',
      name: 'Tư Duy Đột Phá',
      branch: 'Trí Tuệ & Hệ Thống',
      treeBranch: 'intellect',
      tier: 4,
      slot: 'center',
      icon: 'sparkles',
      description: 'Kết hợp Oakley Focused & Diffused Mode để tìm ra giải pháp vượt chuẩn thông thường.',
      effectSummary: '+10% Gold & +8% Tiến độ Boss (+2 INT/cấp)',
      effectCode: 'GOLD_GAIN',
      primaryStat: 'INT',
      prerequisiteIds: ['sk-int-3'],
      minPrereqLevel: 2,
      baseGoldCost: 190,
      baseRunestoneCost: 2,
      verificationCriteria: 'Tạo đầu ra sáng tạo hoặc tối ưu vượt trội.',
    },
    {
      id: 'sk-int-5',
      name: 'Đại Sư Trí Tuệ',
      branch: 'Trí Tuệ & Hệ Thống',
      treeBranch: 'intellect',
      tier: 5,
      slot: 'center',
      icon: 'crown',
      description: 'Đỉnh cao vô hạn nhánh Trí Tuệ: khuếch đại toàn diện tốc độ học, tổng hợp và giải pháp.',
      effectSummary: '+5% XP, +5% Gold, +5% Mastery, +4% Focus, +4% Boss/cấp (∞)',
      effectCode: 'OMNI_GROWTH',
      primaryStat: 'INT',
      prerequisiteIds: ['sk-int-4'],
      minPrereqLevel: 3,
      isInfiniteApex: true,
      baseGoldCost: 260,
      baseRunestoneCost: 3,
      verificationCriteria: 'Phá giới hạn vô cực bằng SP để tiếp tục thăng tiến không trần.',
    },

    // ==================== 2. TRI THỨC & HỌC SÂU (KNOWLEDGE - PER) ====================
    {
      id: 'sk-knw-1',
      name: 'Ghi Nhớ Chủ Động',
      branch: 'Tri Thức & Học Sâu',
      treeBranch: 'knowledge',
      tier: 1,
      slot: 'center',
      icon: 'book',
      description: 'Dunlosky (2013) Retrieval Practice: tự truy xuất kiến thức không nhìn nguồn.',
      effectSummary: '+8% Mastery từ Proof-of-Work (+2 PER/cấp)',
      effectCode: 'MASTERY_GAIN',
      primaryStat: 'PER',
      prerequisiteIds: [],
      baseGoldCost: 50,
      baseRunestoneCost: 0,
      verificationCriteria: 'Thực hiện Active Recall sau mỗi phiên đọc hoặc học.',
    },
    {
      id: 'sk-knw-2l',
      name: 'Ôn Tập Giãn Cách',
      branch: 'Tri Thức & Học Sâu',
      treeBranch: 'knowledge',
      tier: 2,
      slot: 'left',
      icon: 'repeat',
      description: 'Bjork Desirable Difficulties & Spaced Retrieval: ôn lại đúng thời điểm sắp quên.',
      effectSummary: '+8% XP & +4% Mastery mỗi cấp (+2 PER/cấp)',
      effectCode: 'XP_GAIN',
      primaryStat: 'PER',
      prerequisiteIds: ['sk-knw-1'],
      minPrereqLevel: 1,
      baseGoldCost: 85,
      baseRunestoneCost: 0,
      verificationCriteria: 'Hoàn thành các phiên Spaced Retrieval cách ngày.',
    },
    {
      id: 'sk-knw-2r',
      name: 'Diễn Giải Feynman',
      branch: 'Tri Thức & Học Sâu',
      treeBranch: 'knowledge',
      tier: 2,
      slot: 'right',
      icon: 'feather',
      description: 'Giải thích khái niệm phức tạp bằng ngôn ngữ giản dị để phơi bày lỗ hổng hiểu biết.',
      effectSummary: '+4% XP & +4% Mastery mỗi cấp (+2 PER/cấp)',
      effectCode: 'STAT_SURGE',
      primaryStat: 'PER',
      prerequisiteIds: ['sk-knw-1'],
      minPrereqLevel: 1,
      baseGoldCost: 85,
      baseRunestoneCost: 0,
      verificationCriteria: 'Tóm tắt lại chủ đề khó bằng ngôn ngữ tự nhiên không nhìn sách.',
    },
    {
      id: 'sk-knw-3',
      name: 'Tổng Hợp Liên Ngành',
      branch: 'Tri Thức & Học Sâu',
      treeBranch: 'knowledge',
      tier: 3,
      slot: 'center',
      icon: 'layers',
      description: 'Kết nối mô hình từ nhiều lĩnh vực khác nhau tạo thành khung tư duy đa chiều.',
      effectSummary: '+6% Focus Bonus & +4% Mastery mỗi cấp (+2 PER/cấp)',
      effectCode: 'FOCUS_BONUS',
      primaryStat: 'PER',
      prerequisiteIds: ['sk-knw-2l', 'sk-knw-2r'],
      requireAnyPrerequisite: true,
      minPrereqLevel: 1,
      baseGoldCost: 130,
      baseRunestoneCost: 1,
      verificationCriteria: 'Liên kết kiến thức từ ít nhất 2 mảng kỹ năng khác nhau.',
    },
    {
      id: 'sk-knw-4',
      name: 'Nghiên Cứu & Phản Biện',
      branch: 'Tri Thức & Học Sâu',
      treeBranch: 'knowledge',
      tier: 4,
      slot: 'center',
      icon: 'microscope',
      description: 'Đánh giá nguồn tin phản biện, kiểm chứng giả thuyết và tạo tài sản tri thức gốc.',
      effectSummary: '+8% Tiến độ Boss & +6% Mastery mỗi cấp (+2 PER/cấp)',
      effectCode: 'BOSS_PROGRESS',
      primaryStat: 'PER',
      prerequisiteIds: ['sk-knw-3'],
      minPrereqLevel: 2,
      baseGoldCost: 190,
      baseRunestoneCost: 2,
      verificationCriteria: 'Viết tổng hợp phân tích chuyên sâu có đối chứng.',
    },
    {
      id: 'sk-knw-5',
      name: 'Học Giả Vô Hạn',
      branch: 'Tri Thức & Học Sâu',
      treeBranch: 'knowledge',
      tier: 5,
      slot: 'center',
      icon: 'crown',
      description: 'Đỉnh cao vô hạn nhánh Tri Thức: biến mọi trải nghiệm thành Mastery tinh khiết.',
      effectSummary: '+5% XP, +5% Gold, +5% Mastery, +4% Focus, +4% Boss/cấp (∞)',
      effectCode: 'OMNI_GROWTH',
      primaryStat: 'PER',
      prerequisiteIds: ['sk-knw-4'],
      minPrereqLevel: 3,
      isInfiniteApex: true,
      baseGoldCost: 260,
      baseRunestoneCost: 3,
      verificationCriteria: 'Phá giới hạn vô cực bằng SP để tiếp tục thăng tiến không trần.',
    },

    // ==================== 3. KỶ LUẬT & THỰC THI (EXECUTION - AGI) ====================
    {
      id: 'sk-exe-1',
      name: 'Khởi Động 2 Phút',
      branch: 'Kỷ Luật & Thực Thi',
      treeBranch: 'execution',
      tier: 1,
      slot: 'center',
      icon: 'zap',
      description: 'Atomic Habits: thu nhỏ rào cản khởi đầu xuống 2 phút để thắng quán tính trì hoãn.',
      effectSummary: '+6% Focus Bonus khi hoàn thành phiên tập trung (+2 AGI/cấp)',
      effectCode: 'FOCUS_BONUS',
      primaryStat: 'AGI',
      prerequisiteIds: [],
      baseGoldCost: 50,
      baseRunestoneCost: 0,
      verificationCriteria: 'Dùng nút Khởi động 2 phút đều đặn trước mỗi đầu việc.',
    },
    {
      id: 'sk-exe-2l',
      name: 'Timeboxing Chính Xác',
      branch: 'Kỷ Luật & Thực Thi',
      treeBranch: 'execution',
      tier: 2,
      slot: 'left',
      icon: 'clock',
      description: 'Khóa khối thời gian cụ thể trên lịch thực tế và bảo vệ ranh giới tập trung.',
      effectSummary: '+10% Gold từ kỷ luật hoàn thành đúng lịch (+2 AGI/cấp)',
      effectCode: 'GOLD_GAIN',
      primaryStat: 'AGI',
      prerequisiteIds: ['sk-exe-1'],
      minPrereqLevel: 1,
      baseGoldCost: 85,
      baseRunestoneCost: 0,
      verificationCriteria: 'Hoàn thành nhiệm vụ khớp các cửa sổ rảnh trong Thời khóa biểu.',
    },
    {
      id: 'sk-exe-2r',
      name: 'Phản Xạ Nếu–Thì',
      branch: 'Kỷ Luật & Thực Thi',
      treeBranch: 'execution',
      tier: 2,
      slot: 'right',
      icon: 'git-branch',
      description: 'Gollwitzer Implementation Intentions: lập trình sẵn phản ứng khi gặp cám dỗ xao nhãng.',
      effectSummary: '-6% Fatigue tích tụ & giữ nhịp ổn định (+2 AGI/cấp)',
      effectCode: 'FATIGUE_SHIELD',
      primaryStat: 'AGI',
      prerequisiteIds: ['sk-exe-1'],
      minPrereqLevel: 1,
      baseGoldCost: 85,
      baseRunestoneCost: 0,
      verificationCriteria: 'Áp dụng kịch bản Nếu–Thì mỗi khi gặp trở ngại khởi đầu.',
    },
    {
      id: 'sk-exe-3',
      name: 'Chu Kỳ Ultradian Deep Work',
      branch: 'Kỷ Luật & Thực Thi',
      treeBranch: 'execution',
      tier: 3,
      slot: 'center',
      icon: 'target',
      description: 'Huberman 90m Ultradian Cycle + Micro-Gap 10 giây tái tạo hồi hải mã.',
      effectSummary: '+8% Tiến độ Boss & +6% Focus Bonus (+2 AGI/cấp)',
      effectCode: 'BOSS_PROGRESS',
      primaryStat: 'AGI',
      prerequisiteIds: ['sk-exe-2l', 'sk-exe-2r'],
      requireAnyPrerequisite: true,
      minPrereqLevel: 1,
      baseGoldCost: 130,
      baseRunestoneCost: 1,
      verificationCriteria: 'Thực hiện trọn vẹn các phiên Focus Mode dài không phân tâm.',
    },
    {
      id: 'sk-exe-4',
      name: 'Trạng Thái Flow Toàn Phần',
      branch: 'Kỷ Luật & Thực Thi',
      treeBranch: 'execution',
      tier: 4,
      slot: 'center',
      icon: 'flame',
      description: 'Csíkszentmihályi Flow Channel: cân bằng hoàn hảo giữa độ khó thử thách và kỹ năng.',
      effectSummary: '+8% XP & +6% Focus Bonus mỗi cấp (+2 AGI/cấp)',
      effectCode: 'XP_GAIN',
      primaryStat: 'AGI',
      prerequisiteIds: ['sk-exe-3'],
      minPrereqLevel: 2,
      baseGoldCost: 190,
      baseRunestoneCost: 2,
      verificationCriteria: 'Duy trì hiệu suất cao nhiều ngày liên tiếp mà không quá tải.',
    },
    {
      id: 'sk-exe-5',
      name: 'Bậc Thầy Thực Thi',
      branch: 'Kỷ Luật & Thực Thi',
      treeBranch: 'execution',
      tier: 5,
      slot: 'center',
      icon: 'crown',
      description: 'Đỉnh cao vô hạn nhánh Thực Thi: tốc độ chuyển hóa ý định thành kết quả không ma sát.',
      effectSummary: '+5% XP, +5% Gold, +5% Mastery, +4% Focus, +4% Boss/cấp (∞)',
      effectCode: 'OMNI_GROWTH',
      primaryStat: 'AGI',
      prerequisiteIds: ['sk-exe-4'],
      minPrereqLevel: 3,
      isInfiniteApex: true,
      baseGoldCost: 260,
      baseRunestoneCost: 3,
      verificationCriteria: 'Phá giới hạn vô cực bằng SP để tiếp tục thăng tiến không trần.',
    },

    // ==================== 4. THỂ LỰC & SINH LỰC (VITALITY - STR / VIT) ====================
    {
      id: 'sk-vit-1',
      name: 'Neo Giấc Ngủ Sinh Học',
      branch: 'Thể Lực & Sinh Lực',
      treeBranch: 'vitality',
      tier: 1,
      slot: 'center',
      icon: 'heart',
      description: 'Walker Sleep Consolidation: giữ giờ ngủ-thức cố định, mở rộng trần Trái Tim Sinh Lực trên HUD.',
      effectSummary: '+1 Trái Tim (+20 Max HP) & +2 VIT mỗi cấp',
      effectCode: 'MAX_HEARTS',
      primaryStat: 'VIT',
      prerequisiteIds: [],
      baseGoldCost: 50,
      baseRunestoneCost: 0,
      verificationCriteria: 'Ngủ đủ giấc và giữ nhịp sinh học ổn định qua từng tuần.',
    },
    {
      id: 'sk-vit-2l',
      name: 'Tải Trọng Tăng Tiến',
      branch: 'Thể Lực & Sinh Lực',
      treeBranch: 'vitality',
      tier: 2,
      slot: 'left',
      icon: 'dumbbell',
      description: 'Progressive Overload & Zone 2 Conditioning: nâng sức mạnh thể chất và ngưỡng chịu tải.',
      effectSummary: '+8% Tiến độ Boss & +2 STR mỗi cấp',
      effectCode: 'BOSS_PROGRESS',
      primaryStat: 'STR',
      prerequisiteIds: ['sk-vit-1'],
      minPrereqLevel: 1,
      baseGoldCost: 85,
      baseRunestoneCost: 0,
      verificationCriteria: 'Hoàn thành các buổi vận động thể chất đều đặn.',
    },
    {
      id: 'sk-vit-2r',
      name: 'Phục Hồi NSDR',
      branch: 'Thể Lực & Sinh Lực',
      treeBranch: 'vitality',
      tier: 2,
      slot: 'right',
      icon: 'sun',
      description: 'Huberman Non-Sleep Deep Rest: tái tạo dopamine và hạ cortisol giữa ngày.',
      effectSummary: '+10% Hiệu quả Hồi phục Sinh lực & Trái Tim (+2 VIT/cấp)',
      effectCode: 'RECOVERY_BOOST',
      primaryStat: 'VIT',
      prerequisiteIds: ['sk-vit-1'],
      minPrereqLevel: 1,
      baseGoldCost: 85,
      baseRunestoneCost: 0,
      verificationCriteria: 'Thực hiện nghỉ ngơi không màn hình hoặc NSDR 15 phút.',
    },
    {
      id: 'sk-vit-3',
      name: 'Quản Trị Năng Lượng',
      branch: 'Thể Lực & Sinh Lực',
      treeBranch: 'vitality',
      tier: 3,
      slot: 'center',
      icon: 'shield',
      description: 'Cân đối tải công việc với vùng đệm nghỉ ngơi, ngăn chặn suy kiệt mãn tính.',
      effectSummary: '-6% Fatigue tích tụ sau mỗi phiên tập trung (+2 VIT/cấp)',
      effectCode: 'FATIGUE_SHIELD',
      primaryStat: 'VIT',
      prerequisiteIds: ['sk-vit-2l', 'sk-vit-2r'],
      requireAnyPrerequisite: true,
      minPrereqLevel: 1,
      baseGoldCost: 130,
      baseRunestoneCost: 1,
      verificationCriteria: 'Duy trì Energy ổn định và biết dùng Grace Day đúng lúc.',
    },
    {
      id: 'sk-vit-4',
      name: 'Sức Bền Chống Kiệt Sức',
      branch: 'Thể Lực & Sinh Lực',
      treeBranch: 'vitality',
      tier: 4,
      slot: 'center',
      icon: 'activity',
      description: 'Sức bền thể chất – tinh thần dài hạn giúp đi đường dài qua các Chương khó nhất.',
      effectSummary: '+10% Hồi phục & -6% Fatigue mỗi cấp (+2 STR/cấp)',
      effectCode: 'RECOVERY_BOOST',
      primaryStat: 'STR',
      prerequisiteIds: ['sk-vit-3'],
      minPrereqLevel: 2,
      baseGoldCost: 190,
      baseRunestoneCost: 2,
      verificationCriteria: 'Giữ vững phong độ sức khỏe qua giai đoạn áp lực cao.',
    },
    {
      id: 'sk-vit-5',
      name: 'Thân Thể Bất Bại',
      branch: 'Thể Lực & Sinh Lực',
      treeBranch: 'vitality',
      tier: 5,
      slot: 'center',
      icon: 'crown',
      description: 'Đỉnh cao vô hạn nhánh Sinh Lực: nguồn năng lượng dồi dào nuôi sống mọi tham vọng.',
      effectSummary: '+5% XP, +5% Gold, +5% Mastery, +4% Focus, +4% Boss/cấp (∞)',
      effectCode: 'OMNI_GROWTH',
      primaryStat: 'VIT',
      prerequisiteIds: ['sk-vit-4'],
      minPrereqLevel: 3,
      isInfiniteApex: true,
      baseGoldCost: 260,
      baseRunestoneCost: 3,
      verificationCriteria: 'Phá giới hạn vô cực bằng SP để tiếp tục thăng tiến không trần.',
    },

    // ==================== 5. GIAO TIẾP & DI SẢN (INFLUENCE - CHA) ====================
    {
      id: 'sk-inf-1',
      name: 'Diễn Đạt Mạch Lạc',
      branch: 'Giao Tiếp & Di Sản',
      treeBranch: 'influence',
      tier: 1,
      slot: 'center',
      icon: 'message',
      description: 'Cấu trúc hóa thông điệp rõ ràng, ngắn gọn và đúng trọng tâm người nghe.',
      effectSummary: '+10% Gold từ giá trị đầu ra & giao tiếp (+2 CHA/cấp)',
      effectCode: 'GOLD_GAIN',
      primaryStat: 'CHA',
      prerequisiteIds: [],
      baseGoldCost: 50,
      baseRunestoneCost: 0,
      verificationCriteria: 'Viết hoặc trình bày 1 ý tưởng rõ ràng, có cấu trúc.',
    },
    {
      id: 'sk-inf-2l',
      name: 'Lắng Nghe & Thấu Cảm',
      branch: 'Giao Tiếp & Di Sản',
      treeBranch: 'influence',
      tier: 2,
      slot: 'left',
      icon: 'users',
      description: 'Nắm bắt đúng nhu cầu ẩn sau lời nói và tạo không gian tin cậy khi hợp tác.',
      effectSummary: '+10% Hồi phục tinh thần & kết nối (+2 CHA/cấp)',
      effectCode: 'RECOVERY_BOOST',
      primaryStat: 'CHA',
      prerequisiteIds: ['sk-inf-1'],
      minPrereqLevel: 1,
      baseGoldCost: 85,
      baseRunestoneCost: 0,
      verificationCriteria: 'Tóm tắt lại đúng quan điểm của đối tác trước khi phản hồi.',
    },
    {
      id: 'sk-inf-2r',
      name: 'Thuyết Phục & Phản Biện',
      branch: 'Giao Tiếp & Di Sản',
      treeBranch: 'influence',
      tier: 2,
      slot: 'right',
      icon: 'award',
      description: 'Lập luận dựa trên bằng chứng, tự tin bảo vệ quan điểm trước câu hỏi hóc búa.',
      effectSummary: '+8% Mastery từ Proof & phản biện (+2 CHA/cấp)',
      effectCode: 'MASTERY_GAIN',
      primaryStat: 'CHA',
      prerequisiteIds: ['sk-inf-1'],
      minPrereqLevel: 1,
      baseGoldCost: 85,
      baseRunestoneCost: 0,
      verificationCriteria: 'Bảo vệ thành công 1 đề xuất hoặc sản phẩm bằng dẫn chứng.',
    },
    {
      id: 'sk-inf-3',
      name: 'Dẫn Dắt & Kết Nối',
      branch: 'Giao Tiếp & Di Sản',
      treeBranch: 'influence',
      tier: 3,
      slot: 'center',
      icon: 'compass',
      description: 'Điều phối đội ngũ, căn chỉnh kỳ vọng và giải quyết xung đột xây dựng.',
      effectSummary: '+4% XP & +4% Mastery mỗi cấp (+2 CHA/cấp)',
      effectCode: 'STAT_SURGE',
      primaryStat: 'CHA',
      prerequisiteIds: ['sk-inf-2l', 'sk-inf-2r'],
      requireAnyPrerequisite: true,
      minPrereqLevel: 1,
      baseGoldCost: 130,
      baseRunestoneCost: 1,
      verificationCriteria: 'Chủ động điều phối 1 buổi làm việc hoặc sáng kiến chung.',
    },
    {
      id: 'sk-inf-4',
      name: 'Kiến Tạo Giá Trị Thực',
      branch: 'Giao Tiếp & Di Sản',
      treeBranch: 'influence',
      tier: 4,
      slot: 'center',
      icon: 'star',
      description: 'Đóng gói tri thức thành tài sản hữu ích, mentoring và tạo ảnh hưởng tích cực bền vững.',
      effectSummary: '+10% Gold & +8% Tiến độ Boss mỗi cấp (+2 CHA/cấp)',
      effectCode: 'GOLD_GAIN',
      primaryStat: 'CHA',
      prerequisiteIds: ['sk-inf-3'],
      minPrereqLevel: 2,
      baseGoldCost: 190,
      baseRunestoneCost: 2,
      verificationCriteria: 'Chia sẻ hoặc chuyển giao tri thức tạo giá trị cho người khác.',
    },
    {
      id: 'sk-inf-5',
      name: 'Quân Vương Ảnh Hưởng',
      branch: 'Giao Tiếp & Di Sản',
      treeBranch: 'influence',
      tier: 5,
      slot: 'center',
      icon: 'crown',
      description: 'Đỉnh cao vô hạn nhánh Di Sản: mở rộng tầm ảnh hưởng và giá trị trao đi không giới hạn.',
      effectSummary: '+5% XP, +5% Gold, +5% Mastery, +4% Focus, +4% Boss/cấp (∞)',
      effectCode: 'OMNI_GROWTH',
      primaryStat: 'CHA',
      prerequisiteIds: ['sk-inf-4'],
      minPrereqLevel: 3,
      isInfiniteApex: true,
      baseGoldCost: 260,
      baseRunestoneCost: 3,
      verificationCriteria: 'Phá giới hạn vô cực bằng SP để tiếp tục thăng tiến không trần.',
    },
  ];

  return specs.map(makeNode);
}

export function computeUnlockOrAscendSpCost(skill: SkillNode): number {
  if (!skill.unlocked) return skill.unlockSpCost ?? 1;
  return (skill.unlockSpCost ?? 1) + (skill.ascensionTier ?? 1);
}

export function computeSkillUpgradeCost(skill: SkillNode): { gold: number; runestones: number } {
  const lv = skill.masteryTier || 0;
  const gold = Math.round((skill.baseGoldCost ?? 60) * Math.pow(1.24, lv));
  const runestones =
    (skill.tier ?? 1) >= 3 || lv >= 5
      ? Math.max(1, Math.round((skill.baseRunestoneCost ?? 1) + Math.floor(lv / 3)))
      : (skill.baseRunestoneCost ?? 0);
  return { gold, runestones };
}

export function areSkillPrerequisitesMet(skill: SkillNode, allSkills: SkillNode[]): boolean {
  if (!skill.prerequisiteIds || skill.prerequisiteIds.length === 0) return true;
  const map = new Map(allSkills.map((s) => [s.id, s]));
  const minLv = skill.minPrereqLevel ?? 1;
  if (skill.requireAnyPrerequisite) {
    return skill.prerequisiteIds.some((pid) => (map.get(pid)?.masteryTier ?? 0) >= minLv);
  }
  return skill.prerequisiteIds.every((pid) => (map.get(pid)?.masteryTier ?? 0) >= minLv);
}

export function computePlayerMaxHp(player: PlayerState, skills: SkillNode[]): number {
  const maxHeartsLevels = skills
    .filter((s) => s.effectCode === 'MAX_HEARTS' || s.id === 'sk-vit-1')
    .reduce((sum, s) => sum + (s.masteryTier ?? 0), 0);
  // Base 100 HP (5 hearts * 20 HP). Every 2 player levels adds +10 HP; each MAX_HEARTS level adds +20 HP (1 full Heart).
  const levelBonus = Math.floor(Math.max(0, player.level - 1) / 2) * 10;
  return 100 + levelBonus + maxHeartsLevels * 20;
}

export function computePlayerGrowthBonuses(
  player: PlayerState,
  skills: SkillNode[],
  inventory: InventoryItem[],
  shadows: ShadowSoldier[]
): PlayerGrowthBonuses {
  let xpBonusPct = 0;
  let goldBonusPct = 0;
  let masteryBonusPct = 0;
  let focusBonusPct = 0;
  let fatigueReductionPct = 0;
  let bossDamageBonusPct = 0;
  let recoveryBonusPct = 0;
  let totalSkillLevels = 0;
  let totalUnlockedNodes = 0;
  let totalAscensions = 0;

  for (const sk of skills) {
    if (!sk.treeBranch) continue;
    const lv = sk.masteryTier || 0;
    if (sk.unlocked) totalUnlockedNodes += 1;
    totalSkillLevels += lv;
    if ((sk.ascensionTier ?? 0) > 1) {
      totalAscensions += (sk.ascensionTier ?? 1) - 1;
    }
    if (lv <= 0) continue;

    switch (sk.effectCode) {
      case 'XP_GAIN':
        xpBonusPct += lv * 8;
        if (sk.id === 'sk-knw-2l') masteryBonusPct += lv * 4;
        break;
      case 'GOLD_GAIN':
        goldBonusPct += lv * 10;
        if (sk.id === 'sk-inf-4') bossDamageBonusPct += lv * 8;
        break;
      case 'MASTERY_GAIN':
        masteryBonusPct += lv * 8;
        if (sk.id === 'sk-int-3') focusBonusPct += lv * 6;
        break;
      case 'FOCUS_BONUS':
        focusBonusPct += lv * 6;
        if (sk.id === 'sk-knw-3') masteryBonusPct += lv * 4;
        break;
      case 'FATIGUE_SHIELD':
        fatigueReductionPct += lv * 6;
        break;
      case 'BOSS_PROGRESS':
        bossDamageBonusPct += lv * 8;
        if (sk.id === 'sk-knw-4') masteryBonusPct += lv * 6;
        break;
      case 'RECOVERY_BOOST':
        recoveryBonusPct += lv * 10;
        if (sk.id === 'sk-vit-4') fatigueReductionPct += lv * 6;
        break;
      case 'STAT_SURGE':
        xpBonusPct += lv * 4;
        masteryBonusPct += lv * 4;
        break;
      case 'OMNI_GROWTH':
        xpBonusPct += lv * 5;
        goldBonusPct += lv * 5;
        masteryBonusPct += lv * 5;
        focusBonusPct += lv * 4;
        bossDamageBonusPct += lv * 4;
        break;
      default:
        break;
    }
  }

  const equippedEffects = new Set(
    inventory.filter((i) => i.equipped).map((i) => i.effectCode)
  );
  if (equippedEffects.has('BUFF_XP_15')) xpBonusPct += 15;
  if (equippedEffects.has('BUFF_MASTERY_20')) masteryBonusPct += 20;
  if (equippedEffects.has('BUFF_FATIGUE_REDUCE_25')) fatigueReductionPct += 25;

  masteryBonusPct += shadows.length * 2;
  fatigueReductionPct = Math.min(65, fatigueReductionPct);

  const maxHp = computePlayerMaxHp(player, skills);
  const maxHearts = Math.max(5, Math.round(maxHp / 20));

  return {
    xpBonusPct,
    goldBonusPct,
    masteryBonusPct,
    focusBonusPct,
    fatigueReductionPct,
    bossDamageBonusPct,
    recoveryBonusPct,
    maxHearts,
    totalSkillLevels,
    totalUnlockedNodes,
    totalAscensions,
  };
}

export function computeSkillSpentResources(skills: SkillNode[]): {
  spentSp: number;
  spentGold: number;
  spentRunestones: number;
  statRefunds: Record<string, number>;
  masteryRefund: number;
} {
  let spentSp = 0;
  let spentGold = 0;
  let spentRunestones = 0;
  let masteryRefund = 0;
  const statRefunds: Record<string, number> = {};

  for (const sk of skills) {
    if (!sk.treeBranch) continue;
    if (sk.unlocked) {
      const unlockCost = sk.unlockSpCost ?? 1;
      spentSp += unlockCost;
      const ascTier = sk.ascensionTier ?? 1;
      for (let a = 1; a < ascTier; a++) {
        spentSp += unlockCost + a;
      }
    }
    const lv = sk.masteryTier || 0;
    for (let cur = 0; cur < lv; cur++) {
      const stepCost = computeSkillUpgradeCost({ ...sk, masteryTier: cur });
      spentGold += stepCost.gold;
      spentRunestones += stepCost.runestones;
      const statPerLv = cur < 5 ? 2 : 1;
      statRefunds[sk.primaryStat] = (statRefunds[sk.primaryStat] || 0) + statPerLv;
      masteryRefund += 25;
    }
  }

  return { spentSp, spentGold, spentRunestones, statRefunds, masteryRefund };
}

export function computeSkillPowerRating(skill: SkillNode): number {
  return Math.round(
    (skill.masteryTier || 0) * 120 * (1 + (skill.ascensionTier || 0) * 0.25) +
      Math.sqrt(skill.totalPracticeXp || 0) * 8 +
      (skill.tasksContributedCount || 0) * 15
  );
}

export function applyTaskContributionToSkill(
  skill: SkillNode,
  entry: { dateKey: string; title: string; minutes: number; xpAdded: number }
): { bonusSp: number } {
  const safeXp = Math.max(0, Math.round(entry.xpAdded));
  const safeMinutes = Math.max(1, Math.round(entry.minutes));

  skill.practiceXp = (skill.practiceXp || 0) + safeXp;
  skill.totalPracticeXp = (skill.totalPracticeXp || 0) + safeXp;
  skill.totalPracticeMinutes = (skill.totalPracticeMinutes || 0) + safeMinutes;
  skill.tasksContributedCount = (skill.tasksContributedCount || 0) + 1;

  const existing = Array.isArray(skill.recentContributions) ? skill.recentContributions : [];
  skill.recentContributions = [
    {
      dateKey: entry.dateKey,
      title: entry.title,
      minutes: safeMinutes,
      xpAdded: safeXp,
    },
    ...existing,
  ].slice(0, 6);

  let bonusSp = 0;
  let xpPerTier = Math.max(50, skill.xpPerTier || 160);
  while (skill.practiceXp >= xpPerTier) {
    skill.practiceXp -= xpPerTier;
    bonusSp += 1;
    xpPerTier = Math.round(xpPerTier * 1.15);
  }
  skill.xpPerTier = xpPerTier;
  skill.powerRating = computeSkillPowerRating(skill);

  return { bonusSp };
}
