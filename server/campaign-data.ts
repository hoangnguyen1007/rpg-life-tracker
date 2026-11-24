import type {
  BossMission,
  BossStage,
  ChapterStageNode,
  MonsterArchetype,
  QuestRank,
  StoryChapter,
} from './types.ts';

interface StageBlueprint {
  id: string;
  title: string;
  description: string;
  verificationHint: string;
}

function buildBossStages(maxHp: number, blueprints: StageBlueprint[]): BossStage[] {
  const count = blueprints.length;
  const baseDamage = Math.floor(maxHp / count);
  const remainder = maxHp - baseDamage * count;
  return blueprints.map((bp, idx) => ({
    id: bp.id,
    title: bp.title,
    description: bp.description,
    hpDamage: idx === count - 1 ? baseDamage + remainder : baseDamage,
    completed: false,
    verificationHint: bp.verificationHint,
  }));
}

function makeMiniBoss(params: {
  id: string;
  chapterId: string;
  orderIndex: number;
  gateLabel: string;
  archetype: MonsterArchetype;
  unlocked: boolean;
  title: string;
  subtitle: string;
  rank: QuestRank;
  maxHp: number;
  rewardTitle: string;
  rewardMastery: number;
  rewardShadowName: string;
  stages: StageBlueprint[];
}): BossMission {
  return {
    id: params.id,
    chapterId: params.chapterId,
    bossRole: 'mini_boss',
    orderIndex: params.orderIndex,
    unlocked: params.unlocked,
    gateLabel: params.gateLabel,
    archetype: params.archetype,
    title: params.title,
    subtitle: params.subtitle,
    rank: params.rank,
    maxHp: params.maxHp,
    currentHp: params.maxHp,
    stages: buildBossStages(params.maxHp, params.stages),
    rewardTitle: params.rewardTitle,
    rewardMastery: params.rewardMastery,
    rewardGold: 180,
    rewardRunestones: 15,
    rewardShadowName: params.rewardShadowName,
    defeated: false,
  };
}

function makeChapterBoss(params: {
  id: string;
  chapterId: string;
  orderIndex: number;
  gateLabel: string;
  archetype: MonsterArchetype;
  title: string;
  subtitle: string;
  rank: QuestRank;
  maxHp: number;
  rewardTitle: string;
  rewardMastery: number;
  rewardShadowName: string;
  stages: StageBlueprint[];
}): BossMission {
  return {
    id: params.id,
    chapterId: params.chapterId,
    bossRole: 'chapter_boss',
    orderIndex: params.orderIndex,
    unlocked: false,
    gateLabel: params.gateLabel,
    archetype: params.archetype,
    title: params.title,
    subtitle: params.subtitle,
    rank: params.rank,
    maxHp: params.maxHp,
    currentHp: params.maxHp,
    stages: buildBossStages(params.maxHp, params.stages),
    rewardTitle: params.rewardTitle,
    rewardMastery: params.rewardMastery,
    rewardGold: 400,
    rewardRunestones: 40,
    rewardShadowName: params.rewardShadowName,
    defeated: false,
  };
}

function makeFiveStages(params: {
  chNum: number;
  unlocked: boolean;
  wave1: {
    title: string;
    subtitle: string;
    lore: string;
    archetype: MonsterArchetype;
    minionName: string;
  };
  mini1: {
    title: string;
    subtitle: string;
    lore: string;
    archetype: MonsterArchetype;
    bossId: string;
  };
  wave2: {
    title: string;
    subtitle: string;
    lore: string;
    archetype: MonsterArchetype;
    minionName: string;
  };
  mini2: {
    title: string;
    subtitle: string;
    lore: string;
    archetype: MonsterArchetype;
    bossId: string;
  };
  boss: {
    title: string;
    subtitle: string;
    lore: string;
    archetype: MonsterArchetype;
    bossId: string;
  };
}): ChapterStageNode[] {
  const { chNum, unlocked, wave1, mini1, wave2, mini2, boss } = params;
  const goldWave1 = 55 + chNum * 15;
  const goldWave2 = 75 + chNum * 20;
  const xpWave1 = 70 + chNum * 20;
  const xpWave2 = 95 + chNum * 25;

  return [
    {
      id: `st-ch${chNum}-1`,
      stageNumber: 1,
      code: `${chNum}-1`,
      kind: 'minion_wave',
      title: `Màn ${chNum}-1: ${wave1.title}`,
      subtitle: wave1.subtitle,
      lore: wave1.lore,
      archetype: wave1.archetype,
      minionName: wave1.minionName,
      minionCountRequired: 2,
      minionProgress: 0,
      rewardGold: goldWave1,
      rewardSp: 1,
      rewardXp: xpWave1,
      unlocked,
      completed: false,
    },
    {
      id: `st-ch${chNum}-2`,
      stageNumber: 2,
      code: `${chNum}-2`,
      kind: 'mini_boss',
      title: `Màn ${chNum}-2: ${mini1.title}`,
      subtitle: mini1.subtitle,
      lore: mini1.lore,
      archetype: mini1.archetype,
      bossId: mini1.bossId,
      isCheckpoint: true,
      rewardGold: 180,
      rewardSp: 4,
      rewardXp: 180,
      unlocked: false,
      completed: false,
    },
    {
      id: `st-ch${chNum}-3`,
      stageNumber: 3,
      code: `${chNum}-3`,
      kind: 'minion_wave',
      title: `Màn ${chNum}-3: ${wave2.title}`,
      subtitle: wave2.subtitle,
      lore: wave2.lore,
      archetype: wave2.archetype,
      minionName: wave2.minionName,
      minionCountRequired: 3,
      minionProgress: 0,
      rewardGold: goldWave2,
      rewardSp: 1,
      rewardXp: xpWave2,
      unlocked: false,
      completed: false,
    },
    {
      id: `st-ch${chNum}-4`,
      stageNumber: 4,
      code: `${chNum}-4`,
      kind: 'mini_boss',
      title: `Màn ${chNum}-4: ${mini2.title}`,
      subtitle: mini2.subtitle,
      lore: mini2.lore,
      archetype: mini2.archetype,
      bossId: mini2.bossId,
      isCheckpoint: true,
      rewardGold: 180,
      rewardSp: 4,
      rewardXp: 180,
      unlocked: false,
      completed: false,
    },
    {
      id: `st-ch${chNum}-5`,
      stageNumber: 5,
      code: `${chNum}-5`,
      kind: 'chapter_boss',
      title: `Màn ${chNum}-5: ${boss.title}`,
      subtitle: boss.subtitle,
      lore: boss.lore,
      archetype: boss.archetype,
      bossId: boss.bossId,
      isCheckpoint: true,
      rewardGold: 400,
      rewardSp: 4,
      rewardXp: 360,
      unlocked: false,
      completed: false,
    },
  ];
}

export function buildCampaignChapters(): StoryChapter[] {
  return [
    {
      id: 'ch-1',
      chapterNumber: 1,
      arcLabel: 'Hồi I · Khởi Nguyên',
      title: 'Chương I: Sự Thức Tỉnh (Double Dungeon)',
      subtitle: 'Story Circle 1 (You & Comfort Zone) — Thoát khỏi trì hoãn, thiết lập kỷ luật sinh học & quy tắc WOOP',
      lore: 'Cánh cổng đầu tiên không đòi hỏi sức mạnh phi thường, mà buộc bạn đối diện với sự trì hoãn và xao nhãng trong chính nhịp sống hằng ngày.',
      realLifeObjective: 'Ổn định nhịp ngủ-thức, thắng 2 phút khởi đầu và hoàn thành chuỗi Focus Mode nền tảng.',
      targetRank: 'D-Rank',
      themeArchetype: 'wolf',
      miniBossIds: ['boss-c1-m1', 'boss-c1-m2'],
      chapterBossId: 'boss-c1-boss',
      bossIds: ['boss-c1-m1', 'boss-c1-m2', 'boss-c1-boss'],
      gateCondition: 'Hạ 2 Mini-Boss Chương I để phá phong ấn Thủ Lĩnh Lycan.',
      rewardSummary: 'Mở khóa Chương II · Shadow Tank · +400 G · +40 Runestones',
      unlocked: true,
      completed: false,
      stages: makeFiveStages({
        chNum: 1,
        unlocked: true,
        wave1: {
          title: 'Đàn Slime Lười Biếng',
          subtitle: 'Hoàn thành 2 Quest thực tế hoặc kiểm chứng để dọn sạch quán tính đầu ngày.',
          lore: 'Những khối Slime nhầy nhụa bám chặt lấy đôi chân trước mỗi lần bắt đầu — chỉ hành động 2 phút mới cắt đứt được chúng.',
          archetype: 'slime',
          minionName: 'Đàn Slime Lười Biếng',
        },
        mini1: {
          title: 'Tượng Thần Lười Biếng',
          subtitle: 'Mini-Boss 1 · Phá vỡ sức ỳ khởi động & neo giờ ngủ-thức.',
          lore: 'Bức tượng khổng lồ thử thách ý chí đứng dậy khỏi vùng an toàn.',
          archetype: 'golem',
          bossId: 'boss-c1-m1',
        },
        wave2: {
          title: 'Bầy Dơi Xao Nhãng',
          subtitle: 'Hoàn thành 3 Quest thực tế để xua tan nhiễu thông báo & giữ tập trung.',
          lore: 'Bầy dơi rít lên từ bóng tối mỗi khi bạn mở điện thoại giữa phiên làm việc.',
          archetype: 'bat',
          minionName: 'Bầy Dơi Xao Nhãng',
        },
        mini2: {
          title: 'Kasaka: Mãnh Xà Xao Nhãng',
          subtitle: 'Mini-Boss 2 · Cắt đứt nhiễu số & hoàn tất 8 phiên Focus đơn nhiệm.',
          lore: 'Con mãnh xà ẩn mình trong những tab trình duyệt thừa và thói quen đa nhiệm.',
          archetype: 'goblin',
          bossId: 'boss-c1-m2',
        },
        boss: {
          title: 'Thủ Lĩnh Lycan: Cánh Cổng Kỷ Luật',
          subtitle: 'Boss Chương I · Chứng minh thể lực & nhật ký suy ngẫm nhất quán.',
          lore: 'Thủ lĩnh bầy sói canh giữ cánh cổng chuyển tiếp sang Lò Luyện Nền Tảng.',
          archetype: 'wolf',
          bossId: 'boss-c1-boss',
        },
      }),
    },
    {
      id: 'ch-2',
      chapterNumber: 2,
      arcLabel: 'Hồi I · Khởi Nguyên',
      title: 'Chương II: Lò Luyện Nền Tảng (Instant Dungeon)',
      subtitle: 'Story Circle 2 (Need) — Biến thói quen rời rạc thành hệ thống Active Recall & Timeboxing chủ động',
      lore: 'Khi đã thức tỉnh, bạn bước vào hầm ngục luyện tập cá nhân: mỗi khối thời gian đều có mục đích và mỗi buổi học đều có truy xuất đầu ra.',
      realLifeObjective: 'Xây dựng sổ tay Active Recall, làm chủ ma trận thời gian và chứng minh năng lực nền tảng cốt lõi.',
      targetRank: 'C-Rank',
      themeArchetype: 'skeleton',
      miniBossIds: ['boss-c2-m1', 'boss-c2-m2'],
      chapterBossId: 'boss-c2-boss',
      bossIds: ['boss-c2-m1', 'boss-c2-m2', 'boss-c2-boss'],
      gateCondition: 'Hạ 2 Mini-Boss Chương II để mở cổng Lãnh Chúa Vulcan.',
      rewardSummary: 'Mở khóa Chương III · Shadow Kasaka Blade · +400 G · +40 Runestones',
      unlocked: false,
      completed: false,
      stages: makeFiveStages({
        chNum: 2,
        unlocked: false,
        wave1: {
          title: 'Đội Xương Thụ Động',
          subtitle: 'Hoàn thành 2 Quest để thay việc đọc lướt bằng Active Recall.',
          lore: 'Những bộ xương lặp lại động tác vô hồn giống hệt cách đọc ghi chú mà không tự kiểm tra.',
          archetype: 'skeleton',
          minionName: 'Đội Xương Thụ Động',
        },
        mini1: {
          title: 'Cerberus: Cổng Chủ Động',
          subtitle: 'Mini-Boss 1 · Dunlosky Retrieval Practice & Feynman Synthesis.',
          lore: 'Chó ba đầu canh giữ ranh giới giữa biết mơ hồ và hiểu thấu đáo.',
          archetype: 'wolf',
          bossId: 'boss-c2-m1',
        },
        wave2: {
          title: 'Nhện Nhỏ Lịch Rối',
          subtitle: 'Hoàn thành 3 Quest để dọn sạch các khoảng thời gian chồng chéo.',
          lore: 'Mạng nhện giăng kín ngày làm việc nếu bạn không khóa các khối thời gian rõ ràng.',
          archetype: 'spider',
          minionName: 'Nhện Nhỏ Lịch Rối',
        },
        mini2: {
          title: 'Nhện Khổng Lồ: Mạng Lưới Thời Gian',
          subtitle: 'Mini-Boss 2 · Bảo vệ nhịp Ultradian & kế hoạch Nếu–Thì WOOP.',
          lore: 'Chúa nhện ẩn trong những lịch trình dày đặc không có vùng đệm nghỉ ngơi.',
          archetype: 'spider',
          bossId: 'boss-c2-m2',
        },
        boss: {
          title: 'Lãnh Chúa Vulcan: Kỹ Năng Gốc',
          subtitle: 'Boss Chương II · Nâng cấp kỹ năng nền tảng & hoàn thiện đầu ra đầu tiên.',
          lore: 'Người rèn giũa nền móng thép trước khi bước vào kỳ Khảo Hạch Chuyển Chức.',
          archetype: 'golem',
          bossId: 'boss-c2-boss',
        },
      }),
    },
    {
      id: 'ch-3',
      chapterNumber: 3,
      arcLabel: 'Hồi II · Vượt Ngưỡng',
      title: 'Chương III: Thử Thách Chuyển Chức (Job Change Quest)',
      subtitle: 'Story Circle 3 (Go — Vượt Ngưỡng) — Rời vùng an toàn, chuyển hóa tri thức thành đầu ra đo lường được',
      lore: 'System kích hoạt Khảo hạch Chuyển Chức. Chỉ những năng lực vượt qua bài kiểm tra thực tế và phản biện khắt khe mới được công nhận.',
      realLifeObjective: 'Hoàn thiện 1 sản phẩm/dự án/bài kiểm chứng độc lập và vượt qua bài test sức bền nhận thức.',
      targetRank: 'C-Rank',
      themeArchetype: 'sentinel',
      miniBossIds: ['boss-c3-m1', 'boss-c3-m2'],
      chapterBossId: 'boss-c3-boss',
      bossIds: ['boss-c3-m1', 'boss-c3-m2', 'boss-c3-boss'],
      gateCondition: 'Hạ 2 Mini-Boss Chương III để đối đầu Huyết Kỵ Sĩ Igris.',
      rewardSummary: 'Mở khóa Chương IV · Shadow Igris · +400 G · +40 Runestones',
      unlocked: false,
      completed: false,
      stages: makeFiveStages({
        chNum: 3,
        unlocked: false,
        wave1: {
          title: 'Bóng Ma Ảo Giác',
          subtitle: 'Hoàn thành 2 Quest kiểm chứng đầu ra không trợ giúp.',
          lore: 'Những bóng ma thì thầm rằng bạn đã sẵn sàng dù chưa từng bấm giờ tự kiểm tra.',
          archetype: 'wraith',
          minionName: 'Bóng Ma Ảo Giác',
        },
        mini1: {
          title: 'Pháp Sư Hắc Ám: Ảo Giác Năng Lực',
          subtitle: 'Mini-Boss 1 · Đập tan Illusion of Competence bằng Mock Benchmark.',
          lore: 'Tên pháp sư tạo ra sương mù tự mãn che lấp lỗ hổng kiến thức thật.',
          archetype: 'mage',
          bossId: 'boss-c3-m1',
        },
        wave2: {
          title: 'Lính Gác Sức Ỳ',
          subtitle: 'Hoàn thành 3 Quest tập trung sâu để giữ bền bỉ nhận thức.',
          lore: 'Đội quân giáp nặng thử thách sức bền tinh thần qua các phiên Deep Work liên tục.',
          archetype: 'skeleton',
          minionName: 'Lính Gác Sức Ỳ',
        },
        mini2: {
          title: 'Đội Cận Vệ Thép: Sức Bền Nhận Thức',
          subtitle: 'Mini-Boss 2 · Chu kỳ Ultradian Deep Work 90p & phục hồi NSDR.',
          lore: 'Bức tường thép chỉ nhượng bộ trước kỷ luật nhịp sinh học chuẩn xác.',
          archetype: 'golem',
          bossId: 'boss-c3-m2',
        },
        boss: {
          title: 'Huyết Kỵ Sĩ Igris: Định Hình Bản Sắc',
          subtitle: 'Boss Chuyển Chức · Hoàn thiện sản phẩm đầu tay & bảo vệ phản biện.',
          lore: 'Kiếm sĩ đỏ đứng giữa đại sảnh ngai vàng — phép thử danh dự của Chương III.',
          archetype: 'sentinel',
          bossId: 'boss-c3-boss',
        },
      }),
    },
    {
      id: 'ch-4',
      chapterNumber: 4,
      arcLabel: 'Hồi II · Vượt Ngưỡng',
      title: 'Chương IV: Cổng Đỏ Băng Giá (Red Gate)',
      subtitle: 'Story Circle 4 (Search — Rèn luyện Flow) — Thực chiến dưới áp lực thật & Bjork Desirable Difficulties',
      lore: 'Cánh cổng đỏ đóng sầm sau lưng. Không còn bài tập giả lập — bạn bước vào đấu trường thật nơi phản hồi trực diện và độ khó cao tôi luyện Flow State.',
      realLifeObjective: 'Tham gia môi trường thực chiến (vai trò, dự án thật, thi đấu hoặc đánh giá ngoài) và giữ phong độ ổn định.',
      targetRank: 'B-Rank',
      themeArchetype: 'ice_bear',
      miniBossIds: ['boss-c4-m1', 'boss-c4-m2'],
      chapterBossId: 'boss-c4-boss',
      bossIds: ['boss-c4-m1', 'boss-c4-m2', 'boss-c4-boss'],
      gateCondition: 'Hạ 2 Mini-Boss Chương IV để mở khóa đấu trường Baruka.',
      rewardSummary: 'Mở khóa Chương V · Shadow Iron · +400 G · +40 Runestones',
      unlocked: false,
      completed: false,
      stages: makeFiveStages({
        chNum: 4,
        unlocked: false,
        wave1: {
          title: 'Bầy Cú Áp Lực',
          subtitle: 'Hoàn thành 2 Quest trong điều kiện thời hạn thực tế.',
          lore: 'Cái lạnh của Cổng Đỏ thổi bay mọi kế hoạch trên giấy, chỉ giữ lại phản xạ thật.',
          archetype: 'bat',
          minionName: 'Bầy Cú Áp Lực',
        },
        mini1: {
          title: 'Gấu Băng Alpha: Áp Lực Môi Trường Thật',
          subtitle: 'Mini-Boss 1 · Phỏng vấn, phản biện & đấu trường ngoài vùng an toàn.',
          lore: 'Quái thú tuyết lao ra khi bạn lần đầu chịu đánh giá trực diện từ thế giới thật.',
          archetype: 'ice_bear',
          bossId: 'boss-c4-m1',
        },
        wave2: {
          title: 'Yêu Tinh Cám Dỗ',
          subtitle: 'Hoàn thành 3 Quest nhắm thẳng vào điểm yếu khó nhất.',
          lore: 'Lũ yêu tinh dụ bạn quay về làm những việc dễ để trốn tránh khó khăn mong muốn.',
          archetype: 'goblin',
          minionName: 'Yêu Tinh Cám Dỗ',
        },
        mini2: {
          title: 'Sát Thủ Băng Tuyết: Khó Khăn Mong Muốn',
          subtitle: 'Mini-Boss 2 · Deliberate Practice tại rìa giới hạn năng lực.',
          lore: 'Tốc độ thích nghi quyết định kẻ sống sót trong bão tuyết.',
          archetype: 'wraith',
          bossId: 'boss-c4-m2',
        },
        boss: {
          title: 'Baruka: Đấu Trường Thực Chiến',
          subtitle: 'Boss Chương IV · Hoàn tất chu kỳ thực chiến & tối ưu phối hợp.',
          lore: 'Chúa tể Băng Tinh linh hoạt — biểu tượng của bản lĩnh giữ Flow dưới áp lực.',
          archetype: 'ice_bear',
          bossId: 'boss-c4-boss',
        },
      }),
    },
    {
      id: 'ch-5',
      chapterNumber: 5,
      arcLabel: 'Hồi III · Chiều Sâu',
      title: 'Chương V: Hang Ổ High Orc (Guild Gate)',
      subtitle: 'Story Circle 5 (Find — Đột phá) — Làm chủ đa luồng đầu việc, tư duy hệ thống & tạo tác động thực tế',
      lore: 'Quy mô thử thách tăng vọt. Bạn học cách điều phối nhiều mục tiêu song song mà không đánh mất chất lượng lẫn nhịp hồi phục.',
      realLifeObjective: 'Bàn giao các cột mốc quy mô lớn, phối hợp hiệu quả và chứng minh tác động đo lường được.',
      targetRank: 'A-Rank',
      themeArchetype: 'orc',
      miniBossIds: ['boss-c5-m1', 'boss-c5-m2'],
      chapterBossId: 'boss-c5-boss',
      bossIds: ['boss-c5-m1', 'boss-c5-m2', 'boss-c5-boss'],
      gateCondition: 'Hạ 2 Mini-Boss Chương V để mở phong ấn Kargalgan.',
      rewardSummary: 'Mở khóa Chương VI · Shadow Tusk · +400 G · +40 Runestones',
      unlocked: false,
      completed: false,
      stages: makeFiveStages({
        chNum: 5,
        unlocked: false,
        wave1: {
          title: 'Trinh Sát Đa Luồng',
          subtitle: 'Hoàn thành 2 Quest phân tách ưu tiên rõ ràng.',
          lore: 'Khi nhiều đầu việc cùng ập đến, chỉ thứ tự ưu tiên sắc bén mới giữ bạn không kiệt sức.',
          archetype: 'goblin',
          minionName: 'Trinh Sát Đa Luồng',
        },
        mini1: {
          title: 'Tướng Quân High Orc: Quản Trị Đa Luồng',
          subtitle: 'Mini-Boss 1 · Cân bằng mục tiêu song song & loại bỏ nhiễu ít đòn bẩy.',
          lore: 'Chiến tướng Orc đòi hỏi kỷ luật nói "Không" với những đầu việc vô nghĩa.',
          archetype: 'orc',
          bossId: 'boss-c5-m1',
        },
        wave2: {
          title: 'Tà Binh Rối Loạn',
          subtitle: 'Hoàn thành 3 Quest áp dụng tư duy nguyên lý & quy trình hóa.',
          lore: 'Những lỗi lặp lại biến thành đội quân tà binh nếu thiếu hệ thống kiểm soát.',
          archetype: 'skeleton',
          minionName: 'Tà Binh Rối Loạn',
        },
        mini2: {
          title: 'Pháp Sư Huyết Chú: Tư Duy Hệ Thống',
          subtitle: 'Mini-Boss 2 · First Principles & Checklist chuẩn hóa.',
          lore: 'Nhìn xuyên qua bề mặt triệu chứng để chạm đúng vòng phản hồi cốt lõi.',
          archetype: 'mage',
          bossId: 'boss-c5-m2',
        },
        boss: {
          title: 'Kargalgan: Quy Mô & Tác Động',
          subtitle: 'Boss Chương V · Bàn giao cột mốc quy mô lớn có tác động định lượng.',
          lore: 'Đại pháp sư Tusk chỉ khuất phục trước giá trị thực tế đã được kiểm chứng.',
          archetype: 'orc',
          bossId: 'boss-c5-boss',
        },
      }),
    },
    {
      id: 'ch-6',
      chapterNumber: 6,
      arcLabel: 'Hồi III · Chiều Sâu',
      title: 'Chương VI: Lâu Đài Quỷ (Demon Castle)',
      subtitle: 'Story Circle 6 (Take — Vượt Áp lực) — Tổng hợp tri thức bậc cao, tối ưu hóa & chiều sâu chuyên gia',
      lore: 'Tầng cao của Tháp Tri Thức đòi hỏi sự kết hợp nhuần nhuyễn giữa Oakley Focused Mode đào sâu và Diffused Mode kết nối đột phá.',
      realLifeObjective: 'Tổng hợp tài liệu chuyên sâu thành mô hình riêng và tối ưu một quy trình/hệ thống có đối chứng số liệu.',
      targetRank: 'A-Rank',
      themeArchetype: 'demon_lord',
      miniBossIds: ['boss-c6-m1', 'boss-c6-m2'],
      chapterBossId: 'boss-c6-boss',
      bossIds: ['boss-c6-m1', 'boss-c6-m2', 'boss-c6-boss'],
      gateCondition: 'Hạ 2 Mini-Boss Chương VI để thách đấu Quỷ Vương Baran.',
      rewardSummary: 'Mở khóa Chương VII · Shadow Kaisel · +400 G · +40 Runestones',
      unlocked: false,
      completed: false,
      stages: makeFiveStages({
        chNum: 6,
        unlocked: false,
        wave1: {
          title: 'Ảo Ảnh Tri Thức',
          subtitle: 'Hoàn thành 2 Quest tổng hợp chuyên sâu ở tầng kiến thức cao.',
          lore: 'Biển thông tin ở tầng cao dễ nhấn chìm người học thiếu khung tổng hợp.',
          archetype: 'wraith',
          minionName: 'Ảo Ảnh Tri Thức',
        },
        mini1: {
          title: 'Quỷ Tướng Metus: Tổng Hợp Tri Thức Sâu',
          subtitle: 'Mini-Boss 1 · Chắt lọc 12 nguồn chuyên sâu & đóng gói tài liệu chia sẻ.',
          lore: 'Kẻ gác cổng kho tàng tri thức bậc cao của Lâu Đài Quỷ.',
          archetype: 'mage',
          bossId: 'boss-c6-m1',
        },
        wave2: {
          title: 'Ác Dơi Cổ Chai',
          subtitle: 'Hoàn thành 3 Quest đo lường & gỡ nút thắt hiệu suất.',
          lore: 'Những điểm nghẽn nhỏ tích tụ sẽ chặn đứng toàn bộ tốc độ leo tháp.',
          archetype: 'bat',
          minionName: 'Ác Dơi Cổ Chai',
        },
        mini2: {
          title: 'Kaisellin: Tốc Độ & Tối Ưu Hóa',
          subtitle: 'Mini-Boss 2 · Benchmark trước–sau & nâng kỹ năng lên Tier 3+.',
          lore: 'Loài rồng phi hành chỉ thuộc về người biết đo lường và tối ưu chuẩn xác.',
          archetype: 'spider',
          bossId: 'boss-c6-m2',
        },
        boss: {
          title: 'Quỷ Vương Baran: Đỉnh Tháp Chuyên Môn',
          subtitle: 'Boss Chương VI · Giải bài toán mở & bảo toàn thể lực đường dài.',
          lore: 'Quân vương Bạch Diễm trên tầng 100 — thử thách bản lĩnh chuyên gia độc lập.',
          archetype: 'demon_lord',
          bossId: 'boss-c6-boss',
        },
      }),
    },
    {
      id: 'ch-7',
      chapterNumber: 7,
      arcLabel: 'Hồi IV · Đột Phá',
      title: 'Chương VII: Đảo Khủng Hoảng & Tái Khảo Hạch',
      subtitle: 'Story Circle 7 (Return — Thuần hóa Shadow) — Phá bỏ nút thắt, dẫn dắt khủng hoảng & tự chủ hoàn toàn',
      lore: 'Bạn quay trở lại với bản lĩnh hoàn toàn khác: các vòng lặp Cue–Routine–Reward đã trở thành phản xạ tự động như Đội Quân Bóng Tối.',
      realLifeObjective: 'Dẫn dắt một sáng kiến đầu-cuối vượt qua biến cố và đóng gói Playbook vận hành tự chủ cá nhân.',
      targetRank: 'S-Rank',
      themeArchetype: 'ant_king',
      miniBossIds: ['boss-c7-m1', 'boss-c7-m2'],
      chapterBossId: 'boss-c7-boss',
      bossIds: ['boss-c7-m1', 'boss-c7-m2', 'boss-c7-boss'],
      gateCondition: 'Hạ 2 Mini-Boss Chương VII để đối diện Kiến Trúc Sư The System.',
      rewardSummary: 'Mở khóa Chương VIII · Shadow Beru · +400 G · +40 Runestones',
      unlocked: false,
      completed: false,
      stages: makeFiveStages({
        chNum: 7,
        unlocked: false,
        wave1: {
          title: 'Đội Kiến Nút Thắt',
          subtitle: 'Hoàn thành 2 Quest tháo gỡ trở ngại phối hợp hoặc kỹ thuật lớn.',
          lore: 'Từng bầy kiến đột biến đại diện cho các vấn đề liên đới không thể giải lẻ tẻ.',
          archetype: 'spider',
          minionName: 'Đội Kiến Nút Thắt',
        },
        mini1: {
          title: 'Nữ Hoàng Kiến: Phá Bỏ Nút Thắt',
          subtitle: 'Mini-Boss 1 · Dẫn dắt đội ngũ vượt khủng hoảng & vòng lặp hậu kiểm.',
          lore: 'Trung tâm điều phối bầy đàn — buộc bạn rèn năng lực lãnh đạo điềm tĩnh.',
          archetype: 'ant_king',
          bossId: 'boss-c7-m1',
        },
        wave2: {
          title: 'Bóng Đêm Biến Cố',
          subtitle: 'Hoàn thành 3 Quest học nhanh & ứng dụng kỹ năng mới.',
          lore: 'Khi bối cảnh thay đổi đột ngột, tốc độ Meta-Learning là vũ khí sinh tồn.',
          archetype: 'wraith',
          minionName: 'Bóng Đêm Biến Cố',
        },
        mini2: {
          title: 'Vua Kiến Beru: Thích Nghi Tuyệt Đối',
          subtitle: 'Mini-Boss 2 · Meta-Learning siêu tốc & kết nối liên ngành.',
          lore: 'Thực thể tiến hóa nhanh nhất Đảo Jeju — thử thách khả năng thích nghi tối thượng.',
          archetype: 'ant_king',
          bossId: 'boss-c7-m2',
        },
        boss: {
          title: 'Kiến Trúc Sư The System: Tự Chủ Hoàn Toàn',
          subtitle: 'Boss Chương VII · Cột mốc bước ngoặt & Playbook tự vận hành.',
          lore: 'Người tạo ra Hệ Thống bước ra kiểm chứng xem bạn đã vượt qua công cụ chưa.',
          archetype: 'architect',
          bossId: 'boss-c7-boss',
        },
      }),
    },
    {
      id: 'ch-8',
      chapterNumber: 8,
      arcLabel: 'Hồi IV · Đỉnh Cao',
      title: 'Chương VIII: Chiến Tranh Các Quân Vương (Monarch War)',
      subtitle: 'Story Circle 8 (Change — Tiến hóa Rank) — Hợp nhất 6 chiều INT · PER · AGI · STR · VIT · CHA & Di sản',
      lore: 'Chặng cuối cùng không còn đối thủ nào lớn hơn giới hạn cũ của chính bạn. Đánh bại Antares để khép lại vòng tròn chuyển hóa toàn diện.',
      realLifeObjective: 'Hợp nhất sức khỏe bền vững, năng lực chuyên môn đỉnh cao và lan tỏa tài sản tri thức giá trị cho cộng đồng.',
      targetRank: 'National Level',
      themeArchetype: 'dragon',
      miniBossIds: ['boss-c8-m1', 'boss-c8-m2'],
      chapterBossId: 'boss-c8-boss',
      bossIds: ['boss-c8-m1', 'boss-c8-m2', 'boss-c8-boss'],
      gateCondition: 'Hạ 2 Mini-Boss Chương VIII để mở cổng Long Đế Antares.',
      rewardSummary: 'Hoàn tất Chiến dịch 8 Chương · Shadow Bellion · National Level Title',
      unlocked: false,
      completed: false,
      stages: makeFiveStages({
        chNum: 8,
        unlocked: false,
        wave1: {
          title: 'Dư Chấn Hỗn Mang',
          subtitle: 'Hoàn thành 2 Quest duy trì nhịp cân bằng đỉnh cao.',
          lore: 'Những đợt dư chấn cuối cùng thử thách sự điềm tĩnh trước giờ quyết chiến.',
          archetype: 'slime',
          minionName: 'Dư Chấn Hỗn Mang',
        },
        mini1: {
          title: 'Song Quân Vương Băng & Thú: Bản Lĩnh Bền Vững',
          subtitle: 'Mini-Boss 1 · Thể lực & nội lực tinh thần bền vững ở đỉnh cao.',
          lore: 'Hai Quân Vương hợp lực kiểm tra xem nền móng sức khỏe của bạn có thực sự vững.',
          archetype: 'ice_bear',
          bossId: 'boss-c8-m1',
        },
        wave2: {
          title: 'Cận Vệ Hoàng Gia',
          subtitle: 'Hoàn thành 3 Quest đóng gói & trao truyền tri thức thực chiến.',
          lore: 'Đội quân tinh nhuệ bảo vệ ngai vàng cuối cùng của tri thức và di sản.',
          archetype: 'sentinel',
          minionName: 'Cận Vệ Hoàng Gia',
        },
        mini2: {
          title: 'Quân Vương Sắt Thép: Dấu Ấn Di Sản',
          subtitle: 'Mini-Boss 2 · Xuất bản tài sản tri thức & dẫn dắt người đi sau.',
          lore: 'Giá trị bền vững nhất là ngọn đuốc bạn trao lại cho cộng đồng.',
          archetype: 'architect',
          bossId: 'boss-c8-m2',
        },
        boss: {
          title: 'Antares: Long Đế Hủy Diệt — Vượt Qua Chính Mình',
          subtitle: 'Trùm Cuối Chiến Dịch 8 Chương · Hợp nhất toàn diện 6 chiều phát triển.',
          lore: 'Hắc Long Hủy Diệt — ranh giới cuối cùng trước danh hiệu National Level Sovereign.',
          archetype: 'dragon',
          bossId: 'boss-c8-boss',
        },
      }),
    },
  ];
}

export function buildCampaignBosses(): BossMission[] {
  return [
    // ==================== CHƯƠNG I ====================
    makeMiniBoss({
      id: 'boss-c1-m1',
      chapterId: 'ch-1',
      orderIndex: 11,
      gateLabel: 'Chương I · Mini-Boss 1',
      archetype: 'golem',
      unlocked: false,
      title: 'CH1 // TƯỢNG THẦN LƯỜI BIẾNG',
      subtitle: 'Phá vỡ sức ỳ khởi động & thiết lập kỷ luật Implementation Intentions (AGI · VIT)',
      rank: 'E',
      maxHp: 1000,
      rewardTitle: 'Breaker of Inertia',
      rewardMastery: 80,
      rewardShadowName: 'Statuette Spark — Khởi Động 2 Phút',
      stages: [
        {
          id: 'st-c1-m1-1',
          title: 'Stage 1: Chuỗi khởi động 2 phút không trì hoãn',
          description: 'Thực hiện thành công 5 lần quy tắc 2 phút (Micro-Start) cho các đầu việc bạn thường né tránh.',
          verificationHint: 'Ghi lại 5 việc bạn đã bấm khởi động ngay thay vì trì hoãn.',
        },
        {
          id: 'st-c1-m1-2',
          title: 'Stage 2: Neo nhịp ngủ-thức ổn định',
          description: 'Duy trì khung giờ đi ngủ và thức dậy nhất quán liên tiếp trong một chu kỳ tuần.',
          verificationHint: 'Nêu khung giờ ngủ/thức thực tế và mức Energy trung bình.',
        },
      ],
    }),
    makeMiniBoss({
      id: 'boss-c1-m2',
      chapterId: 'ch-1',
      orderIndex: 12,
      gateLabel: 'Chương I · Mini-Boss 2',
      archetype: 'goblin',
      unlocked: false,
      title: 'CH1 // KASAKA: MÃNH XÀ XAO NHÃNG',
      subtitle: 'Cắt đứt nhiễu kỹ thuật số & hoàn thành các phiên Focus đơn nhiệm đầu tiên (AGI · PER)',
      rank: 'E',
      maxHp: 1200,
      rewardTitle: 'Noise Slayer',
      rewardMastery: 90,
      rewardShadowName: 'Kasaka Fang — Đơn Nhiệm Tuyệt Đối',
      stages: [
        {
          id: 'st-c1-m2-1',
          title: 'Stage 1: Môi trường sạch nhiễu (Digital Sunset)',
          description: 'Loại bỏ thông báo gây xao nhãng trong ít nhất 6 phiên tập trung sâu.',
          verificationHint: 'Mô tả cách bạn cô lập điện thoại/tab thừa khi vào phiên Focus.',
        },
        {
          id: 'st-c1-m2-2',
          title: 'Stage 2: 8 phiên Focus Mode hoàn chỉnh',
          description: 'Hoàn tất tối thiểu 8 phiên tập trung >= 25 phút kèm ghi chú kết quả đầu ra.',
          verificationHint: 'Liệt kê 3 đầu ra cụ thể bạn đã tạo được qua các phiên Focus.',
        },
      ],
    }),
    makeChapterBoss({
      id: 'boss-c1-boss',
      chapterId: 'ch-1',
      orderIndex: 13,
      gateLabel: 'Chương I · Boss Chương',
      archetype: 'wolf',
      title: 'CH1 // THỦ LĨNH LYCAN: CÁNH CỔNG KỶ LUẬT',
      subtitle: 'Boss Chương I — Chứng minh nền tảng Sinh lực, Vận động & Tập trung ổn định (STR · VIT · AGI)',
      rank: 'D',
      maxHp: 2000,
      rewardTitle: 'Lycan Alpha',
      rewardMastery: 160,
      rewardShadowName: 'Tank — Hộ Vệ Thể Lực & Kỷ Luật',
      stages: [
        {
          id: 'st-c1-b-1',
          title: 'Stage 1: Vận động thể chất có kỷ luật (STR · VIT)',
          description: 'Hoàn thành tối thiểu 12 buổi rèn luyện thể lực hoặc vận động Zone 2 có ghi chép.',
          verificationHint: 'Ghi rõ bộ môn tập luyện và cải thiện về sức bền/giấc ngủ.',
        },
        {
          id: 'st-c1-b-2',
          title: 'Stage 2: Chuỗi thực thi kèm Reflection nhất quán',
          description: 'Duy trì nhật ký suy ngẫm (Reflection Note) và hoàn thành đủ Daily Quests cốt lõi.',
          verificationHint: 'Tóm tắt 1 bài học kỷ luật lớn nhất rút ra từ Chương I.',
        },
      ],
    }),

    // ==================== CHƯƠNG II ====================
    makeMiniBoss({
      id: 'boss-c2-m1',
      chapterId: 'ch-2',
      orderIndex: 21,
      gateLabel: 'Chương II · Mini-Boss 1',
      archetype: 'wolf',
      unlocked: false,
      title: 'CH2 // CERBERUS: CỔNG CHỦ ĐỘNG',
      subtitle: 'Chuyển từ tiếp thu thụ động sang Dunlosky Retrieval Practice & Feynman Synthesis (PER · INT)',
      rank: 'D',
      maxHp: 1800,
      rewardTitle: 'Recall Seeker',
      rewardMastery: 120,
      rewardShadowName: 'Cerberus Pulse — Truy Xuất Chủ Động',
      stages: [
        {
          id: 'st-c2-m1-1',
          title: 'Stage 1: 6 phiên Feynman Blurting không nhìn tài liệu',
          description: 'Sau mỗi phiên học/nghiên cứu, đóng nguồn và viết lại 3 ý cốt lõi bằng lời của chính bạn.',
          verificationHint: 'Trích dẫn 2 chủ đề bạn đã tóm tắt bằng Active Recall.',
        },
        {
          id: 'st-c2-m1-2',
          title: 'Stage 2: Xử lý lỗi sai bằng Spaced Retrieval',
          description: 'Lập sổ theo dõi điểm yếu và tự kiểm tra lại sau khoảng nghỉ ít nhất 24 giờ.',
          verificationHint: 'Nêu 3 lỗi/lỗ hổng cũ bạn đã tự phát hiện và sửa triệt để.',
        },
      ],
    }),
    makeMiniBoss({
      id: 'boss-c2-m2',
      chapterId: 'ch-2',
      orderIndex: 22,
      gateLabel: 'Chương II · Mini-Boss 2',
      archetype: 'spider',
      unlocked: false,
      title: 'CH2 // NHỆN KHỔNG LỒ: MẠNG LƯỚI THỜI GIAN',
      subtitle: 'Làm chủ thời khóa biểu thực tế, vùng đệm hồi phục & kế hoạch WOOP Nếu–Thì (AGI · VIT)',
      rank: 'D',
      maxHp: 1800,
      rewardTitle: 'Chronos Weaver',
      rewardMastery: 120,
      rewardShadowName: 'Arachnid Grid — Ma Trận Thời Gian',
      stages: [
        {
          id: 'st-c2-m2-1',
          title: 'Stage 1: Bảo vệ vùng đệm nghỉ & nhịp Ultradian',
          description: 'Sắp xếp lịch làm việc/học tập tôn trọng thời gian ngủ và khoảng nghỉ phục hồi.',
          verificationHint: 'Mô tả cấu trúc khung giờ tập trung cao điểm của bạn hiện tại.',
        },
        {
          id: 'st-c2-m2-2',
          title: 'Stage 2: Áp dụng 5 lần kế hoạch Nếu–Thì (WOOP)',
          description: 'Xác định rõ rào cản nội tại và kích hoạt phản xạ Nếu–Thì khi gặp trở ngại.',
          verificationHint: 'Nêu 2 kịch bản Nếu–Thì đã giúp bạn giữ nhịp trong tuần.',
        },
      ],
    }),
    makeChapterBoss({
      id: 'boss-c2-boss',
      chapterId: 'ch-2',
      orderIndex: 23,
      gateLabel: 'Chương II · Boss Chương',
      archetype: 'golem',
      title: 'CH2 // LÃNH CHÚA VULCAN: KỸ NĂNG GỐC',
      subtitle: 'Boss Chương II — Xây nền móng vững chắc ở kỹ năng mục tiêu trọng tâm (INT · PER · STR)',
      rank: 'C',
      maxHp: 3000,
      rewardTitle: 'Foundation Forger',
      rewardMastery: 220,
      rewardShadowName: 'Kasaka Blade — Lưỡi Kiếm Nền Tảng',
      stages: [
        {
          id: 'st-c2-b-1',
          title: 'Stage 1: Nâng cấp ít nhất 2 kỹ năng nền tảng lên Tier 1+',
          description: 'Đáp ứng tiêu chí kiểm chứng thực tế để nâng hạng trong Cây Kỹ năng.',
          verificationHint: 'Ghi rõ tên 2 kỹ năng và bằng chứng kiểm chứng đã đạt.',
        },
        {
          id: 'st-c2-b-2',
          title: 'Stage 2: Hoàn thành 1 bài tổng hợp nền tảng có đầu ra',
          description: 'Tạo ra một bản ghi, bài tập hoặc sản phẩm sơ cấp hoàn chỉnh từ A đến Z.',
          verificationHint: 'Mô tả đầu ra thực tế đầu tiên bạn hoàn thành ở Chương II.',
        },
      ],
    }),

    // ==================== CHƯƠNG III ====================
    makeMiniBoss({
      id: 'boss-c3-m1',
      chapterId: 'ch-3',
      orderIndex: 31,
      gateLabel: 'Chương III · Mini-Boss 1',
      archetype: 'mage',
      unlocked: false,
      title: 'CH3 // PHÁP SƯ HẮC ÁM: ẢO GIÁC NĂNG LỰC',
      subtitle: 'Đập tan "Illusion of Competence" bằng bài kiểm tra bấm giờ không trợ giúp (PER · INT)',
      rank: 'C',
      maxHp: 2400,
      rewardTitle: 'Illusion Breaker',
      rewardMastery: 160,
      rewardShadowName: 'Truth Lens — Kiểm Chứng Khách Quan',
      stages: [
        {
          id: 'st-c3-m1-1',
          title: 'Stage 1: 3 bài kiểm tra/đánh giá bấm giờ thực tế',
          description: 'Tự đặt mình vào điều kiện thi/đánh giá chuẩn mực không tra cứu để đo trình độ thật.',
          verificationHint: 'Ghi lại kết quả đo lường khách quan của 3 lần tự kiểm tra.',
        },
        {
          id: 'st-c3-m1-2',
          title: 'Stage 2: Phân tích nguyên nhân gốc rễ (Error Log)',
          description: 'Phân loại lỗi sai thành lỗ hổng kiến thức, sai chiến lược hay mất tập trung.',
          verificationHint: 'Nêu 2 lỗ hổng lớn nhất bạn đã khoanh vùng và khắc phục.',
        },
      ],
    }),
    makeMiniBoss({
      id: 'boss-c3-m2',
      chapterId: 'ch-3',
      orderIndex: 32,
      gateLabel: 'Chương III · Mini-Boss 2',
      archetype: 'golem',
      unlocked: false,
      title: 'CH3 // ĐỘI CẬN VỆ THÉP: SỨC BỀN NHẬN THỨC',
      subtitle: 'Duy trì các khối Deep Work 90 phút Ultradian + NSDR phục hồi (INT · VIT)',
      rank: 'C',
      maxHp: 2400,
      rewardTitle: 'Iron Focus',
      rewardMastery: 160,
      rewardShadowName: 'Vanguard Shield — Sức Bền Nhận Thức',
      stages: [
        {
          id: 'st-c3-m2-1',
          title: 'Stage 1: Hoàn thành 6 chu kỳ Ultradian Deep Work',
          description: 'Thực hiện các phiên tập trung sâu kéo dài 60–90 phút kết hợp Micro-Gap 10 giây.',
          verificationHint: 'Nêu các phiên Deep Work dài nhất và chất lượng đầu ra thu được.',
        },
        {
          id: 'st-c3-m2-2',
          title: 'Stage 2: Chuẩn hóa phục hồi NSDR sau phiên nặng',
          description: 'Áp dụng nghỉ ngơi không màn hình (NSDR / đi bộ) để giữ Fatigue dưới ngưỡng quá tải.',
          verificationHint: 'Mô tả thói quen phục hồi hiệu quả nhất giúp bạn tỉnh táo vào buổi chiều/tối.',
        },
      ],
    }),
    makeChapterBoss({
      id: 'boss-c3-boss',
      chapterId: 'ch-3',
      orderIndex: 33,
      gateLabel: 'Chương III · Boss Chương',
      archetype: 'sentinel',
      title: 'CH3 // HUYẾT KỴ SĨ IGRIS: ĐỊNH HÌNH BẢN SẮC',
      subtitle: 'Boss Chuyển Chức — Kiểm chứng năng lực thực chất qua Benchmark, Sản phẩm & Phản biện (INT · PER · CHA)',
      rank: 'B',
      maxHp: 4500,
      rewardTitle: 'Shadow Knight',
      rewardMastery: 300,
      rewardShadowName: 'Igris — Kiếm Sĩ Deep Work',
      stages: [
        {
          id: 'st-c3-b-1',
          title: 'Stage 1: Vượt ải Đánh giá Năng lực / Mock Benchmark',
          description: 'Đạt cột mốc điểm số hoặc tiêu chuẩn đánh giá trung hạn trong lĩnh vực mục tiêu.',
          verificationHint: 'Ghi lại điểm số, tiêu chí đạt được hoặc chỉ số cải thiện thực tế.',
        },
        {
          id: 'st-c3-b-2',
          title: 'Stage 2: Hoàn thiện 1 Dự án / Tác phẩm / Công trình hoàn chỉnh',
          description: 'Sản phẩm có cấu trúc rõ ràng, tự chạy hoặc chứng minh giá trị sử dụng thực tế.',
          verificationHint: 'Mô tả kiến trúc/đóng góp chính của sản phẩm bạn đã hoàn thành.',
        },
        {
          id: 'st-c3-b-3',
          title: 'Stage 3: Tự bảo vệ & phản biện thành quả trước người khác',
          description: 'Trình bày mạch lạc, trả lời các câu hỏi phản biện về lựa chọn và đánh đổi của mình.',
          verificationHint: 'Tóm tắt phản hồi quan trọng nhất bạn nhận được khi trình bày.',
        },
      ],
    }),

    // ==================== CHƯƠNG IV ====================
    makeMiniBoss({
      id: 'boss-c4-m1',
      chapterId: 'ch-4',
      orderIndex: 41,
      gateLabel: 'Chương IV · Mini-Boss 1',
      archetype: 'ice_bear',
      unlocked: false,
      title: 'CH4 // GẤU BĂNG ALPHA: ÁP LỰC MÔI TRƯỜNG THẬT',
      subtitle: 'Bước vào đấu trường thực tế: phản biện, phỏng vấn hoặc cạnh tranh thật (CHA · AGI)',
      rank: 'B',
      maxHp: 3000,
      rewardTitle: 'Frost Challenger',
      rewardMastery: 200,
      rewardShadowName: 'Alpha Hide — Vững Vàng Trước Áp Lực',
      stages: [
        {
          id: 'st-c4-m1-1',
          title: 'Stage 1: 5 buổi thực chiến mô phỏng / phản biện trực diện',
          description: 'Đối mặt các tình huống hóc búa và giữ phong thái bình tĩnh, lập luận chặt chẽ.',
          verificationHint: 'Liệt kê 3 tình huống áp lực cao bạn đã xử lý tốt.',
        },
        {
          id: 'st-c4-m1-2',
          title: 'Stage 2: Tham gia 1 cơ hội thực tế ngoài vùng an toàn',
          description: 'Ứng tuyển, nhận dự án thật, thi đấu hoặc đảm nhận trách nhiệm có kỳ vọng cao.',
          verificationHint: 'Ghi lại bối cảnh thực chiến và bài học tuần đầu tiên.',
        },
      ],
    }),
    makeMiniBoss({
      id: 'boss-c4-m2',
      chapterId: 'ch-4',
      orderIndex: 42,
      gateLabel: 'Chương IV · Mini-Boss 2',
      archetype: 'wraith',
      unlocked: false,
      title: 'CH4 // SÁT THỦ BĂNG TUYẾT: KHÓ KHĂN MONG MUỐN',
      subtitle: 'Luyện tập tại rìa giới hạn (Bjork Desirable Difficulties & Ericsson Deliberate Practice) (INT · STR)',
      rank: 'B',
      maxHp: 3000,
      rewardTitle: 'Edge Runner',
      rewardMastery: 200,
      rewardShadowName: 'Frost Step — Thích Nghi Trong Khó Khăn',
      stages: [
        {
          id: 'st-c4-m2-1',
          title: 'Stage 1: 8 phiên luyện tập có chủ đích nhắm thẳng vào điểm yếu',
          description: 'Không lặp lại phần đã giỏi; chủ động chọn bài tập/nhiệm vụ ở mức thử thách cao hơn.',
          verificationHint: 'Nêu rõ điểm yếu bạn đã trực tiếp tấn công và mức tiến bộ đo được.',
        },
        {
          id: 'st-c4-m2-2',
          title: 'Stage 2: Duy trì chỉ số sinh lực & thể chất qua giai đoạn căng thẳng',
          description: 'Không đánh đổi giấc ngủ và vận động khi cường độ thực chiến tăng lên.',
          verificationHint: 'Ghi lại cách bạn giữ cân bằng Energy trong những tuần áp lực cao.',
        },
      ],
    }),
    makeChapterBoss({
      id: 'boss-c4-boss',
      chapterId: 'ch-4',
      orderIndex: 43,
      gateLabel: 'Chương IV · Boss Chương',
      archetype: 'ice_bear',
      title: 'CH4 // BARUKA: ĐẤU TRƯỜNG THỰC CHIẾN',
      subtitle: 'Boss Chương IV — Khẳng định bản lĩnh Red Gate Survivor và giữ Flow State giữa biến động (AGI · CHA · INT)',
      rank: 'B',
      maxHp: 5200,
      rewardTitle: 'Red Gate Survivor',
      rewardMastery: 350,
      rewardShadowName: 'Iron — Chiến Binh Bền Bỉ',
      stages: [
        {
          id: 'st-c4-b-1',
          title: 'Stage 1: Hoàn tất 1 chu kỳ thực chiến trọn vẹn',
          description: 'Đứng vững trong môi trường thật với kết quả được đồng nghiệp, mentor hoặc khách hàng ghi nhận.',
          verificationHint: 'Ghi lại kết quả thực tế và minh chứng năng lực ở môi trường thật.',
        },
        {
          id: 'st-c4-b-2',
          title: 'Stage 2: Tối ưu quy trình giao tiếp & phối hợp (CHA)',
          description: 'Chủ động báo cáo tiến độ, đặt câu hỏi sắc bén và tiếp thu phản hồi nhanh.',
          verificationHint: 'Nêu 1 tình huống giao tiếp/phối hợp mang lại kết quả tích cực rõ rệt.',
        },
      ],
    }),

    // ==================== CHƯƠNG V ====================
    makeMiniBoss({
      id: 'boss-c5-m1',
      chapterId: 'ch-5',
      orderIndex: 51,
      gateLabel: 'Chương V · Mini-Boss 1',
      archetype: 'orc',
      unlocked: false,
      title: 'CH5 // TƯỚNG QUÂN HIGH ORC: QUẢN TRỊ ĐA LUỒNG',
      subtitle: 'Điều phối nhiều luồng công việc song song mà không rối loạn ưu tiên (AGI · CHA)',
      rank: 'B',
      maxHp: 3600,
      rewardTitle: 'Thread Commander',
      rewardMastery: 240,
      rewardShadowName: 'Orc Vanguard — Điều Phối Đa Luồng',
      stages: [
        {
          id: 'st-c5-m1-1',
          title: 'Stage 1: Cân bằng 2+ mục tiêu song song có deadline rõ ràng',
          description: 'Phân bổ thời gian hợp lý giữa công việc chính, phát triển chuyên môn và sức khỏe.',
          verificationHint: 'Mô tả nguyên tắc ưu tiên đã giúp bạn hoàn thành đúng hạn các luồng việc.',
        },
        {
          id: 'st-c5-m1-2',
          title: 'Stage 2: Nói "Không" với các đầu việc nhiễu ít đòn bẩy',
          description: 'Loại bỏ hoặc ủy quyền các tác vụ tiêu hao năng lượng nhưng không phục vụ mục tiêu lõi.',
          verificationHint: 'Nêu 2 việc không cần thiết bạn đã dứt khoát cắt bỏ để bảo vệ Deep Work.',
        },
      ],
    }),
    makeMiniBoss({
      id: 'boss-c5-m2',
      chapterId: 'ch-5',
      orderIndex: 52,
      gateLabel: 'Chương V · Mini-Boss 2',
      archetype: 'mage',
      unlocked: false,
      title: 'CH5 // PHÁP SƯ HUYẾT CHÚ: TƯ DUY HỆ THỐNG',
      subtitle: 'Nhìn thấy cấu trúc, vòng phản hồi & hệ quả bậc hai trong mọi vấn đề phức tạp (INT · PER)',
      rank: 'A',
      maxHp: 4000,
      rewardTitle: 'System Seer',
      rewardMastery: 260,
      rewardShadowName: 'Crimson Rune — Tư Duy Nguyên Lý',
      stages: [
        {
          id: 'st-c5-m2-1',
          title: 'Stage 1: Phân tích 3 bài toán phức tạp theo First Principles',
          description: 'Tìm nguyên nhân gốc rễ và chỉ ra các điểm đánh đổi (trade-off) rõ ràng.',
          verificationHint: 'Tóm tắt 1 quyết định đánh đổi quan trọng và lý do đằng sau.',
        },
        {
          id: 'st-c5-m2-2',
          title: 'Stage 2: Xây dựng checklist/quy trình chuẩn cho công việc lặp lại',
          description: 'Giảm sai sót thủ công bằng hệ thống hóa quy trình.',
          verificationHint: 'Mô tả quy trình/checklist bạn đã tạo và hiệu quả tiết kiệm thời gian.',
        },
      ],
    }),
    makeChapterBoss({
      id: 'boss-c5-boss',
      chapterId: 'ch-5',
      orderIndex: 53,
      gateLabel: 'Chương V · Boss Chương',
      archetype: 'orc',
      title: 'CH5 // KARGALGAN: QUY MÔ & TÁC ĐỘNG',
      subtitle: 'Boss Chương V — Bàn giao cột mốc quy mô lớn có tác động đo lường được trong thực tế (INT · AGI · CHA)',
      rank: 'A',
      maxHp: 6400,
      rewardTitle: 'Tusk Commander',
      rewardMastery: 420,
      rewardShadowName: 'Tusk — Học Giả Chiến Lược',
      stages: [
        {
          id: 'st-c5-b-1',
          title: 'Stage 1: Bàn giao 1 đầu ra quy mô lớn từ thiết kế đến hoàn thiện',
          description: 'Chịu trách nhiệm chất lượng cao cho một sản phẩm, báo cáo hoặc sáng kiến quan trọng.',
          verificationHint: 'Ghi lại phạm vi công việc và kết quả định lượng bạn đạt được.',
        },
        {
          id: 'st-c5-b-2',
          title: 'Stage 2: Đánh giá tác động thực tế & phản hồi từ người thụ hưởng',
          description: 'Chứng minh đầu ra tạo giá trị thật cho đội ngũ, tổ chức hoặc cộng đồng.',
          verificationHint: 'Nêu số liệu tác động hoặc nhận xét cụ thể từ mentor/đồng đội/khách hàng.',
        },
      ],
    }),

    // ==================== CHƯƠNG VI ====================
    makeMiniBoss({
      id: 'boss-c6-m1',
      chapterId: 'ch-6',
      orderIndex: 61,
      gateLabel: 'Chương VI · Mini-Boss 1',
      archetype: 'mage',
      unlocked: false,
      title: 'CH6 // QUỶ TƯỚNG METUS: TỔNG HỢP TRI THỨC SÂU',
      subtitle: 'Đào sâu tài liệu bậc cao & kết hợp Oakley Focused–Diffused Mode (PER · INT)',
      rank: 'A',
      maxHp: 4600,
      rewardTitle: 'Deep Synthesizer',
      rewardMastery: 300,
      rewardShadowName: 'Metus Tome — Kho Tri Thức Sâu',
      stages: [
        {
          id: 'st-c6-m1-1',
          title: 'Stage 1: Nghiên cứu & tổng hợp 12 tài liệu / case study bậc cao',
          description: 'Xây dựng kho tri thức chuyên sâu vượt xa mức phổ thông trong lĩnh vực của bạn.',
          verificationHint: 'Nêu 3 tư tưởng/mô hình cốt lõi bạn đã chắt lọc và áp dụng.',
        },
        {
          id: 'st-c6-m1-2',
          title: 'Stage 2: Đóng gói 1 bài viết/tài liệu chia sẻ tri thức chuyên sâu',
          description: 'Diễn giải kiến thức phức tạp thành hệ thống rõ ràng cho người khác học theo.',
          verificationHint: 'Ghi tên chủ đề và cấu trúc luận điểm chính bạn đã tổng hợp.',
        },
      ],
    }),
    makeMiniBoss({
      id: 'boss-c6-m2',
      chapterId: 'ch-6',
      orderIndex: 62,
      gateLabel: 'Chương VI · Mini-Boss 2',
      archetype: 'spider',
      unlocked: false,
      title: 'CH6 // KAISELLIN: TỐC ĐỘ & TỐI ƯU HÓA',
      subtitle: 'Đo lường hiệu suất trước–sau và tối ưu nút thắt cổ chai (AGI · INT)',
      rank: 'A',
      maxHp: 4600,
      rewardTitle: 'Sky Optimizer',
      rewardMastery: 300,
      rewardShadowName: 'Sky Wing — Tối Ưu Tốc Độ',
      stages: [
        {
          id: 'st-c6-m2-1',
          title: 'Stage 1: Benchmark & tối ưu 1 quy trình/hệ thống phức tạp',
          description: 'Đo đạc chỉ số trước khi sửa, xác định điểm nghẽn và chứng minh cải thiện sau tối ưu.',
          verificationHint: 'Nêu số liệu đối chứng trước/sau và bài học tối ưu hóa.',
        },
        {
          id: 'st-c6-m2-2',
          title: 'Stage 2: Nâng cấp kỹ năng chuyên môn lên Mastery Tier 3+',
          description: 'Đạt ngưỡng thành thạo vững chắc trên Cây Kỹ năng thông qua thực hành liên tục.',
          verificationHint: 'Liệt kê các kỹ năng đã đạt Tier cao và ứng dụng thực tế.',
        },
      ],
    }),
    makeChapterBoss({
      id: 'boss-c6-boss',
      chapterId: 'ch-6',
      orderIndex: 63,
      gateLabel: 'Chương VI · Boss Chương',
      archetype: 'demon_lord',
      title: 'CH6 // QUỶ VƯƠNG BARAN: ĐỈNH THÁP CHUYÊN MÔN',
      subtitle: 'Boss Chương VI — Khẳng định trình độ Chuyên gia độc lập & sức bền tinh thần (INT · PER · STR)',
      rank: 'S',
      maxHp: 8400,
      rewardTitle: 'Demon Tower Conqueror',
      rewardMastery: 520,
      rewardShadowName: 'Kaisel — Cánh Chim Tăng Tốc',
      stages: [
        {
          id: 'st-c6-b-1',
          title: 'Stage 1: Giải quyết 1 bài toán mở chưa có lời giải sẵn',
          description: 'Tự nghiên cứu, thử nghiệm nhiều phương án và đưa ra giải pháp khả thi.',
          verificationHint: 'Mô tả bài toán mở và quá trình bạn tìm ra phương án tối ưu.',
        },
        {
          id: 'st-c6-b-2',
          title: 'Stage 2: Kiểm chứng chất lượng bởi chuyên gia hoặc tiêu chuẩn cao',
          description: 'Đầu ra vượt qua đánh giá khắt khe của cộng đồng chuyên môn hoặc thị trường.',
          verificationHint: 'Ghi lại kết quả nghiệm thu hoặc đánh giá khách quan nhận được.',
        },
        {
          id: 'st-c6-b-3',
          title: 'Stage 3: Bảo toàn sức bền thể lực qua chặng leo tháp dài',
          description: 'Hoàn thành giai đoạn cường độ cao mà vẫn duy trì thói quen vận động & ngủ đủ.',
          verificationHint: 'Tổng kết cách bạn duy trì kỷ luật sức khỏe song hành với chuyên môn.',
        },
      ],
    }),

    // ==================== CHƯƠNG VII ====================
    makeMiniBoss({
      id: 'boss-c7-m1',
      chapterId: 'ch-7',
      orderIndex: 71,
      gateLabel: 'Chương VII · Mini-Boss 1',
      archetype: 'ant_king',
      unlocked: false,
      title: 'CH7 // NỮ HOÀNG KIẾN: PHÁ BỎ NÚT THẮT',
      subtitle: 'Giải quyết khủng hoảng đa chiều & nâng tầm năng lực dẫn dắt (CHA · INT)',
      rank: 'S',
      maxHp: 6000,
      rewardTitle: 'Crisis Breaker',
      rewardMastery: 380,
      rewardShadowName: 'Royal Crest — Phá Vỡ Nút Thắt',
      stages: [
        {
          id: 'st-c7-m1-1',
          title: 'Stage 1: Dẫn dắt hoặc điều phối 1 nhóm/sáng kiến vượt trở ngại lớn',
          description: 'Thống nhất mục tiêu, phân công rõ ràng và giữ tinh thần đội ngũ ổn định.',
          verificationHint: 'Mô tả tình huống khó khăn và cách bạn dẫn dắt nhóm vượt qua.',
        },
        {
          id: 'st-c7-m1-2',
          title: 'Stage 2: Xây dựng cơ chế phản hồi & tự sửa sai nhanh',
          description: 'Thiết lập vòng lặp hậu kiểm (post-mortem) không đổ lỗi để cải tiến liên tục.',
          verificationHint: 'Nêu 1 quy trình cải tiến thực tế rút ra từ sai sót hoặc khủng hoảng.',
        },
      ],
    }),
    makeMiniBoss({
      id: 'boss-c7-m2',
      chapterId: 'ch-7',
      orderIndex: 72,
      gateLabel: 'Chương VII · Mini-Boss 2',
      archetype: 'ant_king',
      unlocked: false,
      title: 'CH7 // VUA KIẾN BERU: THÍCH NGHI TUYỆT ĐỐI',
      subtitle: 'Học kỹ năng mới siêu tốc bằng Meta-Learning & giải quyết vấn đề chưa từng gặp (PER · AGI)',
      rank: 'S',
      maxHp: 6400,
      rewardTitle: 'Apex Adapter',
      rewardMastery: 400,
      rewardShadowName: 'Apex Instinct — Thích Nghi Tuyệt Đối',
      stages: [
        {
          id: 'st-c7-m2-1',
          title: 'Stage 1: Làm chủ 1 năng lực/công cụ hoàn toàn mới trong thời gian ngắn',
          description: 'Áp dụng phương pháp phân rã kỹ năng + Deliberate Practice để đạt mức thực chiến nhanh.',
          verificationHint: 'Ghi tên năng lực mới và sản phẩm đầu tiên bạn tạo ra bằng nó.',
        },
        {
          id: 'st-c7-m2-2',
          title: 'Stage 2: Kết nối liên ngành tạo giải pháp độc đáo',
          description: 'Phối hợp kiến thức từ ít nhất 2 lĩnh vực khác nhau để tạo lợi thế cạnh tranh riêng.',
          verificationHint: 'Mô tả sự kết hợp liên ngành đã giúp bạn giải quyết vấn đề hiệu quả hơn.',
        },
      ],
    }),
    makeChapterBoss({
      id: 'boss-c7-boss',
      chapterId: 'ch-7',
      orderIndex: 73,
      gateLabel: 'Chương VII · Boss Chương',
      archetype: 'architect',
      title: 'CH7 // KIẾN TRÚC SƯ THE SYSTEM: TỰ CHỦ HOÀN TOÀN',
      subtitle: 'Boss Chương VII — Thuần hóa toàn bộ thói quen thành Shadow tự vận hành & đạt cột mốc S-Rank (INT · AGI · CHA)',
      rank: 'S',
      maxHp: 12000,
      rewardTitle: 'S-Rank Sovereign',
      rewardMastery: 650,
      rewardShadowName: 'Beru — Thống Lĩnh Tối Thượng',
      stages: [
        {
          id: 'st-c7-b-1',
          title: 'Stage 1: Chinh phục cột mốc bước ngoặt lớn của hành trình',
          description: 'Đạt thành tựu mang tính khẳng định vị thế trong sự nghiệp, học thuật hoặc dự án độc lập.',
          verificationHint: 'Ghi lại cột mốc quan trọng bạn vừa chinh phục và bằng chứng đi kèm.',
        },
        {
          id: 'st-c7-b-2',
          title: 'Stage 2: Hệ thống hóa Playbook vận hành cá nhân (Cue–Routine–Reward)',
          description: 'Các thói quen lõi chạy tự động, không phụ thuộc vào cảm hứng nhất thời.',
          verificationHint: 'Tóm tắt 3 quy tắc vận hành cốt lõi trong Playbook cá nhân của bạn.',
        },
        {
          id: 'st-c7-b-3',
          title: 'Stage 3: Duy trì trạng thái Flow & cân bằng 6 chỉ số',
          description: 'Chứng minh bạn có thể bứt phá mạnh mẽ mà không rơi vào kiệt sức.',
          verificationHint: 'Đánh giá mức cân bằng hiện tại giữa trí tuệ, sự nghiệp và sức khỏe.',
        },
      ],
    }),

    // ==================== CHƯƠNG VIII ====================
    makeMiniBoss({
      id: 'boss-c8-m1',
      chapterId: 'ch-8',
      orderIndex: 81,
      gateLabel: 'Chương VIII · Mini-Boss 1',
      archetype: 'ice_bear',
      unlocked: false,
      title: 'CH8 // SONG QUÂN VƯƠNG BĂNG & THÚ: BẢN LĨNH BỀN VỮNG',
      subtitle: 'Kiểm chứng sức khỏe, nội lực tinh thần & kỷ luật dài hạn ở đỉnh cao (VIT · STR · AGI)',
      rank: 'S',
      maxHp: 8000,
      rewardTitle: 'Unbreakable Vessel',
      rewardMastery: 500,
      rewardShadowName: 'Twin Fangs — Nội Lực Bền Bỉ',
      stages: [
        {
          id: 'st-c8-m1-1',
          title: 'Stage 1: Thể lực & sinh lực ở trạng thái tối ưu bền vững',
          description: 'Duy trì nền tảng sức khỏe, giấc ngủ và vận động ổn định như một phần bản sắc.',
          verificationHint: 'Tổng kết các chỉ số sức khỏe, thể lực và nhịp sinh hoạt hiện tại.',
        },
        {
          id: 'st-c8-m1-2',
          title: 'Stage 2: Vững vàng tâm lý trước thành công lẫn biến cố',
          description: 'Giữ được sự điềm tĩnh, khả năng tự phản tư và điều chỉnh nhịp độ linh hoạt.',
          verificationHint: 'Chia sẻ cách bạn tự hiệu chỉnh bản thân khi đối diện thay đổi lớn.',
        },
      ],
    }),
    makeMiniBoss({
      id: 'boss-c8-m2',
      chapterId: 'ch-8',
      orderIndex: 82,
      gateLabel: 'Chương VIII · Mini-Boss 2',
      archetype: 'architect',
      unlocked: false,
      title: 'CH8 // QUÂN VƯƠNG SẮT THÉP: DẤU ẤN DI SẢN',
      subtitle: 'Chuyển hóa kinh nghiệm thành tài sản tri thức & nâng đỡ người đi sau (CHA · PER)',
      rank: 'S',
      maxHp: 8000,
      rewardTitle: 'Legacy Architect',
      rewardMastery: 500,
      rewardShadowName: 'Sovereign Standard — Chuẩn Mực Di Sản',
      stages: [
        {
          id: 'st-c8-m2-1',
          title: 'Stage 1: Xuất bản / chia sẻ hệ thống tri thức giá trị cho cộng đồng',
          description: 'Biến bài học cá nhân thành tài liệu, bài giảng, mã nguồn hoặc mentoring hữu ích.',
          verificationHint: 'Ghi lại tài sản tri thức hoặc đóng góp cộng đồng bạn đã tạo ra.',
        },
        {
          id: 'st-c8-m2-2',
          title: 'Stage 2: Dẫn dắt hoặc truyền cảm hứng trực tiếp cho ít nhất 1 người khác',
          description: 'Hỗ trợ người khác rút ngắn đường cong học tập bằng kinh nghiệm thực tế của bạn.',
          verificationHint: 'Tóm tắt quá trình đồng hành và kết quả bạn giúp người khác đạt được.',
        },
      ],
    }),
    makeChapterBoss({
      id: 'boss-c8-boss',
      chapterId: 'ch-8',
      orderIndex: 83,
      gateLabel: 'Chương VIII · Boss Chương',
      archetype: 'dragon',
      title: 'CH8 // ANTARES: LONG ĐẾ HỦY DIỆT — VƯỢT QUA CHÍNH MÌNH',
      subtitle: 'Trùm Cuối Chiến Dịch 8 Chương — Hợp nhất 6 chiều INT · PER · AGI · STR · VIT · CHA (National Level)',
      rank: 'S',
      maxHp: 18000,
      rewardTitle: 'Shadow Monarch (Sovereign)',
      rewardMastery: 1200,
      rewardShadowName: 'Bellion — Đại Nguyên Soái Bóng Tối',
      stages: [
        {
          id: 'st-c8-b-1',
          title: 'Phase 1: Hợp nhất 6 chiều phát triển không đánh đổi kiệt sức',
          description: 'Trí tuệ, nhận thức, tốc độ thực thi, sức mạnh, sinh lực và ảnh hưởng cùng tăng trưởng hài hòa.',
          verificationHint: 'Tổng kết sự trưởng thành trên cả 6 chỉ số so với ngày khởi đầu Level 1.',
        },
        {
          id: 'st-c8-b-2',
          title: 'Phase 2: Tự chủ chuyên môn, sự nghiệp & giá trị thực tế vững vàng',
          description: 'Đứng vững bằng năng lực thực chất được kiểm chứng qua từng Chương.',
          verificationHint: 'Mô tả vị thế hiện tại và giá trị cốt lõi bạn đã kiến tạo.',
        },
        {
          id: 'st-c8-b-3',
          title: 'Phase 3: Khép lại Story Circle & mở chu kỳ tiến hóa mới',
          description: 'Định hình tầm nhìn tiếp theo với tâm thế người kiến tạo tự do và kỷ luật.',
          verificationHint: 'Viết tuyên ngôn cho chu kỳ phát triển tiếp theo của chính bạn.',
        },
      ],
    }),
  ];
}
