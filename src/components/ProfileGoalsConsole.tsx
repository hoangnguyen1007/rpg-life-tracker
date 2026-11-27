import React, { useCallback, useEffect, useState } from 'react';
import type {
  AIPersona,
  Goal,
  HeroAvatarStyle,
  PlayerProfile,
  PlayerState,
} from '../types/system';
import { systemApi } from '../utils/api';
import { HERO_AVATAR_CATALOG, PixelHeroSprite } from './DungeonSprites';
import {
  PixelRivets,
  PxBook,
  PxCheck,
  PxClose,
  PxEdit,
  PxEye,
  PxPlus,
  PxRefresh,
  PxSave,
  PxScroll,
  PxShield,
  PxSparkle,
  PxTarget,
  PxTrash,
  PxWarn,
} from './PixelIcons';
import { BossBannerIllustration } from './VisualIllustrations';
import { WeeklyReviewDossier } from './WeeklyReviewDossier';

interface ProfileGoalsConsoleProps {
  player: PlayerState;
  goals: Goal[];
  initialSubTab?: 'profile' | 'review';
  onSaveProfile: (
    profile: Partial<PlayerProfile> & { hunterClass?: string; activeTitle?: string }
  ) => Promise<void>;
  onAnalyzeGoal: (rawInput: string) => Promise<void>;
  onUpdateGoal?: (id: string, patch: Partial<Goal>) => Promise<void>;
  onDeleteGoal: (id: string) => Promise<void>;
  onSpawnGoalQuest?: (goalId: string, goalTitle: string) => void;
}

const EXAMPLE_GOALS: Array<{ label: string; text: string }> = [
  {
    label: 'Chuyên môn & Sự nghiệp',
    text: 'Làm chủ năng lực chuyên môn cốt lõi và hoàn thành 1 dự án thực chiến có giá trị đo lường được trong 90 ngày.',
  },
  {
    label: 'Ngoại ngữ & Nghiên cứu',
    text: 'Nâng cao khả năng đọc hiểu tài liệu chuyên ngành, tổng hợp 12 nghiên cứu / sách sâu và luyện phản xạ giao tiếp mỗi tuần.',
  },
  {
    label: 'Thể chất & Kỷ luật sống',
    text: 'Thiết lập nhịp ngủ ổn định 7.5 giờ/ngày, rèn luyện thể chất 4 buổi/tuần và duy trì kỷ luật năng lượng bền vững.',
  },
  {
    label: 'Dự án Sáng tạo & Tài chính',
    text: 'Xây dựng một dự án sáng tạo độc lập tạo nguồn thu nhập thứ hai và thiết lập kỷ luật quản lý tài chính cá nhân.',
  },
];

const PROMPT_PRESETS = [
  {
    label: 'Chuyên môn & Sự nghiệp',
    prompt:
      'Ưu tiên các khối Deep Work tạo sản phẩm thực tế có đầu ra kiểm chứng rõ ràng. Chia nhỏ mục tiêu lớn thành phiên 25-50 phút và bảo vệ khung giờ tập trung cao độ.',
  },
  {
    label: 'Ngoại ngữ & Nghiên cứu',
    prompt:
      'Áp dụng Active Recall và Spaced Repetition trong mọi nhiệm vụ học tập. Luôn yêu cầu ghi chú tóm tắt bằng ngôn từ của chính tôi sau mỗi phiên đọc hoặc luyện tập.',
  },
  {
    label: 'Thể chất & Kỷ luật sống',
    prompt:
      'Cân bằng giữa hiệu suất trí óc và hồi phục thể chất. Không xếp nhiệm vụ nặng sau 21:30 để bảo vệ giấc ngủ; ưu tiên thói quen vận động đều đặn.',
  },
  {
    label: 'Dự án Sáng tạo & Tài chính',
    prompt:
      'Tập trung vào tính nhất quán và xuất bản đầu ra nhỏ mỗi tuần. Đánh giá tiến độ theo giá trị thực tế tạo ra và tính bền vững dài hạn.',
  },
  {
    label: 'Chống quá tải & Giữ nhịp',
    prompt:
      'Khi tôi mệt hoặc thiếu thời gian, hãy đề xuất các bước khởi động cực nhỏ (2-15 phút) giúp giữ nhịp kỷ luật thay vì bỏ cuộc hoàn toàn.',
  },
];

export const ProfileGoalsConsole: React.FC<ProfileGoalsConsoleProps> = ({
  player,
  goals,
  initialSubTab = 'profile',
  onSaveProfile,
  onAnalyzeGoal,
  onUpdateGoal,
  onDeleteGoal,
  onSpawnGoalQuest,
}) => {
  const [subTab, setSubTab] = useState<'profile' | 'review'>(initialSubTab);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editGoalTitle, setEditGoalTitle] = useState('');
  const [editGoalDeadline, setEditGoalDeadline] = useState('');
  const [editGoalPriority, setEditGoalPriority] = useState<Goal['priority']>('HIGH');
  const [editGoalProgress, setEditGoalProgress] = useState<number>(0);
  const [editGoalMethod, setEditGoalMethod] = useState('');
  const [editGoalMilestones, setEditGoalMilestones] = useState('');
  const [savingGoalEdit, setSavingGoalEdit] = useState(false);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  const [name, setName] = useState(player.profile.name);
  const [hunterClass, setHunterClass] = useState(player.hunterClass);
  const [avatarStyle, setAvatarStyle] = useState<HeroAvatarStyle>(
    player.profile.avatarStyle || 'shadow_monarch'
  );
  const [currentRole, setCurrentRole] = useState(player.profile.currentRole);
  const [bio, setBio] = useState(player.profile.bio);
  const [strengthsText, setStrengthsText] = useState(player.profile.strengths.join(', '));
  const [weaknessesText, setWeaknessesText] = useState(player.profile.weaknesses.join(', '));
  const [interestsText, setInterestsText] = useState(player.profile.interests.join(', '));
  const [targetSkillsText, setTargetSkillsText] = useState(player.profile.targetSkills.join(', '));
  const [learningStyle, setLearningStyle] = useState(player.profile.learningStyle);
  const [peakHours, setPeakHours] = useState(player.profile.peakHours || '');
  const [personalRules, setPersonalRules] = useState(player.profile.personalRules || '');
  const [aiPersona, setAiPersona] = useState<AIPersona>(
    player.profile.aiPersona || 'strategic_mentor'
  );
  const [customSystemPrompt, setCustomSystemPrompt] = useState(
    player.profile.customSystemPrompt || ''
  );
  const [savingProfile, setSavingProfile] = useState(false);

  const [goalInput, setGoalInput] = useState('');
  const [analyzingGoal, setAnalyzingGoal] = useState(false);

  const [contextPreview, setContextPreview] = useState<{
    systemInstruction: string;
    contextDossier: string;
  } | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [copiedContext, setCopiedContext] = useState(false);
  const [showContextPreview, setShowContextPreview] = useState(false);

  const refreshContextPreview = useCallback(async () => {
    setLoadingContext(true);
    try {
      const res = await systemApi.getAIContextPreview();
      setContextPreview(res);
    } finally {
      setLoadingContext(false);
    }
  }, []);

  useEffect(() => {
    refreshContextPreview();
  }, [refreshContextPreview, player, goals.length]);

  useEffect(() => {
    if (player.profile.avatarStyle) {
      setAvatarStyle(player.profile.avatarStyle);
    }
  }, [player.profile.avatarStyle]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const splitComma = (s: string) =>
        s
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
      await onSaveProfile({
        name: name.trim() || 'Player',
        hunterClass: hunterClass.trim() || player.hunterClass,
        avatarStyle,
        currentRole: currentRole.trim(),
        bio: bio.trim(),
        strengths: splitComma(strengthsText),
        weaknesses: splitComma(weaknessesText),
        interests: splitComma(interestsText),
        targetSkills: splitComma(targetSkillsText),
        learningStyle: learningStyle.trim(),
        peakHours: peakHours.trim(),
        personalRules: personalRules.trim(),
        aiPersona,
        customSystemPrompt: customSystemPrompt.trim(),
      });
      await refreshContextPreview();
    } finally {
      setSavingProfile(false);
    }
  };

  const handleGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalInput.trim()) return;
    setAnalyzingGoal(true);
    try {
      await onAnalyzeGoal(goalInput.trim());
      setGoalInput('');
      await refreshContextPreview();
    } finally {
      setAnalyzingGoal(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Internal 16-Bit 2-Button Sub-Tab Header */}
      <div className="rpg-pane relative flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <PixelRivets />
        <div
          className="flex flex-wrap items-center gap-2"
          role="tablist"
          aria-label="Chuyển mục Hồ sơ và Tổng kết"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'profile'}
            onClick={() => setSubTab('profile')}
            className={`inline-flex items-center gap-2 rounded-none px-3.5 py-2 text-xs ${
              subTab === 'profile' ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            <PxShield size={14} />
            <span>Hồ Sơ &amp; Mục Tiêu</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'review'}
            onClick={() => setSubTab('review')}
            className={`inline-flex items-center gap-2 rounded-none px-3.5 py-2 text-xs ${
              subTab === 'review' ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            <PxScroll size={14} />
            <span>Tổng Kết 7/30 Ngày</span>
          </button>
        </div>
        <span className="font-mono text-[11px] text-dim">
          {subTab === 'profile'
            ? 'Thiết lập mục tiêu, nhân vật & ngữ cảnh AI'
            : 'Heatmap 30 ngày, xu hướng tập trung & chẩn đoán AI'}
        </span>
      </div>

      {subTab === 'review' ? (
        <WeeklyReviewDossier />
      ) : (
        <>
          <section className="rpg-window relative overflow-hidden">
            <PixelRivets />
            <div className="grid grid-cols-1 lg:grid-cols-12">
              {/* Left: Goal Architect + Flat Goals Ledger */}
              <div className="divide-y-2 lg:col-span-6 studio-divider">
                <div className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <PxTarget size={18} color="var(--px-gold-text)" />
                    <h2 className="font-display text-lg font-extrabold text-main">
                      Khởi tạo Mục tiêu bằng ngôn ngữ tự nhiên
                    </h2>
                  </div>

                  <form onSubmit={handleGoalSubmit} className="space-y-3">
                    <textarea
                      rows={3}
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      placeholder="VD: Tôi muốn bứt phá năng lực chuyên môn trong 90 ngày, duy trì rèn luyện thể chất 4 buổi/tuần, hoặc hoàn thành một dự án sáng tạo độc lập..."
                      className="w-full p-3 text-sm"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {EXAMPLE_GOALS.map((ex) => (
                          <button
                            key={ex.label}
                            type="button"
                            onClick={() => setGoalInput(ex.text)}
                            className="btn-secondary rounded-none px-2.5 py-1 text-xs"
                          >
                            + {ex.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="submit"
                        disabled={analyzingGoal || !goalInput.trim()}
                        className="btn-primary flex items-center gap-2 rounded-none px-4 py-2 text-xs"
                      >
                        {analyzingGoal ? (
                          <PxRefresh size={14} color="#140e04" className="animate-spin" />
                        ) : (
                          <PxSparkle size={14} color="#140e04" />
                        )}
                        <span>
                          {analyzingGoal ? 'Đang phân tích...' : 'Phân tích & Tạo Boss'}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>

                <div>
                  <div className="flex items-center gap-2 border-b-2 px-5 py-3.5 studio-divider">
                    <PxTarget size={16} />
                    <h3 className="font-display text-base font-extrabold text-main">
                      Mục tiêu hiện tại ({goals.length})
                    </h3>
                  </div>

                  {goals.length === 0 ? (
                    <div className="p-6 text-center text-sm text-sub">
                      Chưa có mục tiêu nào. Nhập mục tiêu ở khung trên để AI tự chia nhỏ cột mốc, phát hiện kỹ năng còn thiếu và tạo Boss Mission.
                    </div>
                  ) : (
                    <div className="divide-y-2 studio-divider">
                      {goals.map((g) => {
                        const woopGoal = g as Goal & {
                          woopObstacle?: string;
                          ifThenPlan?: string;
                        };
                        return (
                          <div key={g.id} className="space-y-3 p-5">
                            <BossBannerIllustration title={g.title} />
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="rounded-none border-2 border-[var(--border-ink)] bg-[var(--px-gold)] px-2 py-0.5 font-mono text-[10px] font-bold text-[#140e04]">
                                    {g.category}
                                  </span>
                                  <span className="font-mono text-dim">
                                    Deadline: {g.deadline}
                                  </span>
                                </div>
                                <h4 className="mt-1 font-display text-base font-bold text-main">
                                  {g.title}
                                </h4>
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5">
                                {onSpawnGoalQuest && (
                                  <button
                                    type="button"
                                    onClick={() => onSpawnGoalQuest(g.id, g.title)}
                                    className="btn-primary inline-flex items-center gap-1 rounded-none px-2.5 py-1.5 text-xs"
                                    title="Tạo nhiệm vụ hôm nay gắn với Mục tiêu này"
                                  >
                                    <PxPlus size={12} />
                                    <span>Tạo Quest</span>
                                  </button>
                                )}
                                {onUpdateGoal && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (editingGoalId === g.id) {
                                        setEditingGoalId(null);
                                      } else {
                                        setEditingGoalId(g.id);
                                        setEditGoalTitle(g.title);
                                        setEditGoalDeadline(g.deadline);
                                        setEditGoalPriority(g.priority);
                                        setEditGoalProgress(g.progress);
                                        setEditGoalMethod(g.recommendedMethod);
                                        setEditGoalMilestones(g.subMilestones.join('\n'));
                                      }
                                    }}
                                    title="Sửa mục tiêu"
                                    className="btn-secondary rounded-none p-1.5 text-sub hover:text-main"
                                  >
                                    {editingGoalId === g.id ? (
                                      <PxClose size={14} />
                                    ) : (
                                      <PxEdit size={14} />
                                    )}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onDeleteGoal(g.id)}
                                  title="Xóa mục tiêu"
                                  className="btn-secondary rounded-none p-1.5 text-dim hover:text-[var(--px-red-text)]"
                                >
                                  <PxTrash size={14} />
                                </button>
                              </div>
                            </div>

                            {editingGoalId === g.id && onUpdateGoal && (
                              <form
                                onSubmit={async (e) => {
                                  e.preventDefault();
                                  if (!editGoalTitle.trim() || savingGoalEdit) return;
                                  setSavingGoalEdit(true);
                                  try {
                                    await onUpdateGoal(g.id, {
                                      title: editGoalTitle.trim(),
                                      deadline: editGoalDeadline.trim() || g.deadline,
                                      priority: editGoalPriority,
                                      progress: Math.max(0, Math.min(100, Number(editGoalProgress) || 0)),
                                      recommendedMethod: editGoalMethod.trim() || g.recommendedMethod,
                                      subMilestones: editGoalMilestones
                                        .split(/\r?\n/)
                                        .map((s) => s.trim())
                                        .filter(Boolean),
                                    });
                                    setEditingGoalId(null);
                                  } finally {
                                    setSavingGoalEdit(false);
                                  }
                                }}
                                className="px-inset space-y-2.5 border-2 border-[var(--px-gold)] p-3 text-xs"
                              >
                                <div className="font-pixel text-[9.5px] font-bold text-[var(--px-gold-text)]">
                                  CHỈNH SỬA MỤC TIÊU
                                </div>
                                <input
                                  value={editGoalTitle}
                                  onChange={(e) => setEditGoalTitle(e.target.value)}
                                  placeholder="Tên mục tiêu"
                                  className="w-full px-2.5 py-1.5 text-xs font-bold"
                                  required
                                />
                                <div className="grid grid-cols-3 gap-2">
                                  <input
                                    value={editGoalDeadline}
                                    onChange={(e) => setEditGoalDeadline(e.target.value)}
                                    placeholder="Deadline (VD: 2026-12-31)"
                                    className="px-2 py-1.5 font-mono text-xs"
                                  />
                                  <select
                                    value={editGoalPriority}
                                    onChange={(e) =>
                                      setEditGoalPriority(e.target.value as Goal['priority'])
                                    }
                                    className="px-2 py-1.5 text-xs"
                                  >
                                    <option value="CRITICAL">CRITICAL</option>
                                    <option value="HIGH">HIGH</option>
                                    <option value="MEDIUM">MEDIUM</option>
                                  </select>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={editGoalProgress}
                                      onChange={(e) => setEditGoalProgress(Number(e.target.value))}
                                      className="w-full px-2 py-1.5 font-mono text-xs"
                                      title="Tiến độ (%)"
                                    />
                                    <span className="font-mono text-xs">%</span>
                                  </div>
                                </div>
                                <input
                                  value={editGoalMethod}
                                  onChange={(e) => setEditGoalMethod(e.target.value)}
                                  placeholder="Phương pháp đề xuất"
                                  className="w-full px-2.5 py-1.5 text-xs"
                                />
                                <textarea
                                  rows={3}
                                  value={editGoalMilestones}
                                  onChange={(e) => setEditGoalMilestones(e.target.value)}
                                  placeholder="Các cột mốc (mỗi dòng 1 cột mốc)..."
                                  className="w-full p-2 text-xs"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingGoalId(null)}
                                    className="btn-secondary px-3 py-1 text-xs"
                                  >
                                    Hủy
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={savingGoalEdit}
                                    className="btn-primary px-3.5 py-1 text-xs"
                                  >
                                    {savingGoalEdit ? 'Đang lưu...' : 'Lưu Mục tiêu'}
                                  </button>
                                </div>
                              </form>
                            )}
                            <p className="text-xs text-sub">
                              <strong>Phương pháp:</strong> {g.recommendedMethod}
                            </p>
                            {(woopGoal.woopObstacle || woopGoal.ifThenPlan) && (
                              <div className="px-inset space-y-2 border-2 border-[var(--px-gold)] p-3 text-xs">
                                {woopGoal.woopObstacle && (
                                  <div className="flex items-start gap-2 text-sub">
                                    <PxWarn size={14} className="mt-0.5" />
                                    <span>
                                      <strong className="text-main">
                                        Rào cản nội tại (WOOP):
                                      </strong>{' '}
                                      {woopGoal.woopObstacle}
                                    </span>
                                  </div>
                                )}
                                {woopGoal.ifThenPlan && (
                                  <div className="flex items-start gap-2 text-sub">
                                    <PxBook
                                      size={14}
                                      color="var(--px-blue-text)"
                                      className="mt-0.5"
                                    />
                                    <span>
                                      <strong className="text-main">
                                        Kế hoạch Nếu–Thì (Gollwitzer):
                                      </strong>{' '}
                                      {woopGoal.ifThenPlan}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="space-y-1 text-xs text-sub">
                              {g.subMilestones.map((m, idx) => (
                                <div key={idx} className="flex items-start gap-1.5">
                                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-[var(--px-gold)]" />
                                  <span>{m}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Personalization & Custom AI System Prompt */}
              <div className="border-t-2 p-5 lg:col-span-6 lg:border-l-2 lg:border-t-0 studio-divider">
                <div className="mb-4 flex items-center gap-2 border-b-2 pb-3 studio-divider">
                  <PxShield size={18} color="var(--px-gold-text)" />
                  <h2 className="font-display text-lg font-extrabold text-main">
                    Cá nhân hóa Hồ sơ &amp; Chỉ thị AI
                  </h2>
                </div>

                <form onSubmit={handleProfileSave} className="space-y-3.5 text-sm">
                  {/* 6-Hero 2D Pixel Avatar Style Customizer */}
                  <div className="px-inset p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="font-pixel text-[10px] font-bold uppercase tracking-wide text-[var(--px-gold-text)]">
                        Chọn Nhân Vật &amp; Tạo Hình 2D Pixel
                      </span>
                      <span className="font-mono text-[10px] text-dim">
                        Đang chọn:{' '}
                        {HERO_AVATAR_CATALOG.find((a) => a.id === avatarStyle)?.name ||
                          avatarStyle}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {HERO_AVATAR_CATALOG.map((av) => {
                        const isPicked = avatarStyle === av.id;
                        return (
                          <button
                            key={av.id}
                            type="button"
                            onClick={() => setAvatarStyle(av.id)}
                            className={`flex items-center gap-2 rounded-none border-2 p-2 text-left ${
                              isPicked
                                ? 'border-[var(--px-gold)] bg-[var(--accent-soft)]'
                                : 'border-[var(--border-ink)] bg-[var(--bg-surface)] hover:border-[var(--px-gold)]'
                            }`}
                          >
                            <div className="px-inset shrink-0 p-0.5">
                              <PixelHeroSprite
                                avatarStyle={av.id}
                                rank={player.rank}
                                size={40}
                                className="anim-hero-idle"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[11px] font-bold text-main">
                                {av.name}
                              </div>
                              <div className="truncate font-mono text-[9px] font-bold text-[var(--px-gold-text)]">
                                {av.title}
                              </div>
                              <div className="line-clamp-1 text-[10px] text-dim">
                                {av.desc}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-sub">
                        Tên hiển thị
                      </label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-sub">
                        Danh xưng / Class
                      </label>
                      <input
                        value={hunterClass}
                        onChange={(e) => setHunterClass(e.target.value)}
                        className="w-full px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-sub">
                        Vai trò / Lĩnh vực
                      </label>
                      <input
                        value={currentRole}
                        onChange={(e) => setCurrentRole(e.target.value)}
                        placeholder="VD: Kỹ sư, Sinh viên, Nhà nghiên cứu, Creator..."
                        className="w-full px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-sub">
                        Giờ tập trung tốt nhất
                      </label>
                      <input
                        value={peakHours}
                        onChange={(e) => setPeakHours(e.target.value)}
                        className="w-full px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-sub">
                      Tóm tắt bối cảnh cá nhân
                    </label>
                    <textarea
                      rows={2}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="w-full px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-[var(--px-green-text)]">
                        Điểm mạnh
                      </label>
                      <input
                        value={strengthsText}
                        onChange={(e) => setStrengthsText(e.target.value)}
                        className="w-full px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-[var(--px-red-text)]">
                        Điểm yếu / Rào cản
                      </label>
                      <input
                        value={weaknessesText}
                        onChange={(e) => setWeaknessesText(e.target.value)}
                        className="w-full px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-sub">
                        Kỹ năng muốn phát triển
                      </label>
                      <input
                        value={targetSkillsText}
                        onChange={(e) => setTargetSkillsText(e.target.value)}
                        className="w-full px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-sub">
                        Sở thích
                      </label>
                      <input
                        value={interestsText}
                        onChange={(e) => setInterestsText(e.target.value)}
                        className="w-full px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-sub">
                        Phương pháp học ưa thích
                      </label>
                      <input
                        value={learningStyle}
                        onChange={(e) => setLearningStyle(e.target.value)}
                        className="w-full px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-sub">
                        Phong cách AI (Persona)
                      </label>
                      <select
                        value={aiPersona}
                        onChange={(e) => setAiPersona(e.target.value as AIPersona)}
                        className="w-full px-3 py-2 text-sm"
                      >
                        <option value="strategic_mentor">
                          Strategic Mentor (Thực tế, tối ưu)
                        </option>
                        <option value="strict_system">Strict System (Kỷ luật cao)</option>
                        <option value="supportive_coach">
                          Supportive Coach (Đồng hành)
                        </option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-sub">
                      Quy tắc cá nhân cố định
                    </label>
                    <input
                      value={personalRules}
                      onChange={(e) => setPersonalRules(e.target.value)}
                      placeholder="VD: Không xếp việc nặng sau 21:30..."
                      className="w-full px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="border-t-2 pt-3 studio-divider">
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--px-plum-text)]">
                        <PxBook size={13} color="var(--px-plum-text)" />
                        <span>Custom System Prompt cho AI</span>
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {PROMPT_PRESETS.map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => setCustomSystemPrompt(p.prompt)}
                            className="btn-secondary rounded-none px-2 py-0.5 text-[11px]"
                          >
                            + {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      rows={3}
                      value={customSystemPrompt}
                      onChange={(e) => setCustomSystemPrompt(e.target.value)}
                      placeholder="Nhập chỉ thị riêng bạn muốn AI luôn tuân thủ khi phân tích & gợi ý..."
                      className="w-full p-2.5 text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="btn-primary flex w-full items-center justify-center gap-2 rounded-none py-2.5 text-xs"
                  >
                    {savingProfile ? (
                      <PxRefresh size={14} color="#140e04" className="animate-spin" />
                    ) : (
                      <PxSave size={14} color="#140e04" />
                    )}
                    <span>Lưu Hồ Sơ &amp; System Prompt</span>
                  </button>
                </form>
              </div>
            </div>
          </section>

          {/* Collapsible Distilled AI Context Dossier */}
          <section className="rpg-pane relative p-5">
            <PixelRivets />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <PxEye size={16} color="var(--px-gold-text)" />
                <div>
                  <h3 className="font-display text-sm font-bold text-main">
                    Xem Context đang gửi cho AI
                  </h3>
                  <p className="text-xs text-dim">
                    Tự động chắt lọc từ hồ sơ, lịch 7 ngày, mục tiêu và chỉ số của bạn.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowContextPreview((v) => !v)}
                  className="btn-secondary rounded-none px-3 py-1.5 text-xs"
                >
                  {showContextPreview ? 'Ẩn Context' : 'Xem Context'}
                </button>
                {showContextPreview && (
                  <>
                    <button
                      type="button"
                      onClick={refreshContextPreview}
                      disabled={loadingContext}
                      className="btn-secondary flex items-center gap-1.5 rounded-none px-3 py-1.5 text-xs"
                    >
                      <PxRefresh
                        size={13}
                        className={loadingContext ? 'animate-spin' : ''}
                      />
                      <span>Làm mới</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!contextPreview) return;
                        navigator.clipboard.writeText(
                          `${contextPreview.systemInstruction}\n\n${contextPreview.contextDossier}`
                        );
                        setCopiedContext(true);
                        setTimeout(() => setCopiedContext(false), 2000);
                      }}
                      className="btn-secondary flex items-center gap-1.5 rounded-none px-3 py-1.5 text-xs"
                    >
                      {copiedContext ? (
                        <PxCheck size={13} color="var(--px-green-text)" />
                      ) : (
                        <PxScroll size={13} />
                      )}
                      <span>{copiedContext ? 'Đã copy' : 'Copy'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {showContextPreview && contextPreview && (
              <div className="mt-4 grid grid-cols-1 gap-4 border-t-2 pt-4 lg:grid-cols-2 studio-divider">
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-sub">
                    1. System Instruction
                  </p>
                  <pre className="px-inset max-h-60 overflow-y-auto whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed text-main">
                    {contextPreview.systemInstruction}
                  </pre>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-sub">
                    2. Hồ sơ ngữ cảnh chắt lọc
                  </p>
                  <pre className="px-inset max-h-60 overflow-y-auto whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed text-main">
                    {contextPreview.contextDossier}
                  </pre>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
