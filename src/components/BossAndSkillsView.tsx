import React, { useEffect, useState } from 'react';
import type {
  BossMission,
  ChapterStageNode,
  MonsterArchetype,
  RaidChestId,
  RaidDifficultyTier,
  SkillNode,
  StoryChapter,
  WeeklyRaidPayload,
} from '../types/system';
import { PixelMonsterSprite } from './DungeonSprites';
import {
  PixelRivets,
  PxCheck,
  PxChevron,
  PxCoin,
  PxGem,
  PxLock,
  PxShield,
  PxSkull,
  PxSparkle,
  PxSword,
} from './PixelIcons';
import { WeeklyRaidBossArena } from './WeeklyRaidBossArena';

interface BossAndSkillsViewProps {
  chapters: StoryChapter[];
  bosses: BossMission[];
  skills: SkillNode[];
  streakDays: number;
  onVerifyBossStage: (bossId: string, stageId: string, proofText: string) => Promise<void>;
  onVerifySkill: (skillId: string, proofNote: string) => Promise<void>;
  onVerifyMinionStage?: (chapterId: string, stageId: string, proofText: string) => Promise<void>;
  weeklyRaid?: WeeklyRaidPayload | null;
  weeklyRaidLoading?: boolean;
  onChangeRaidDifficulty?: (tier: RaidDifficultyTier) => Promise<void>;
  onClaimRaidChest?: (chestId: RaidChestId) => Promise<void>;
  onRegenerateRaidAi?: () => Promise<void>;
  onRefreshRaid?: () => Promise<void>;
}

const noopAsync = async () => {};

const SPRITE_POOL: MonsterArchetype[] = [
  'slime',
  'bat',
  'goblin',
  'skeleton',
  'wraith',
  'golem',
  'spider',
  'sentinel',
];

function getBossSpriteArchetype(boss: BossMission): MonsterArchetype {
  if (boss.archetype) return boss.archetype;
  if (boss.bossRole === 'chapter_boss') return 'sentinel';
  const sum = boss.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return SPRITE_POOL[sum % (SPRITE_POOL.length - 1)];
}

export const BossAndSkillsView: React.FC<BossAndSkillsViewProps> = ({
  chapters,
  bosses,
  streakDays,
  onVerifyBossStage,
  onVerifyMinionStage,
  weeklyRaid,
  weeklyRaidLoading,
  onChangeRaidDifficulty,
  onClaimRaidChest,
  onRegenerateRaidAi,
  onRefreshRaid,
}) => {
  const [activeStageKey, setActiveStageKey] = useState<string | null>(null);
  const [bossProof, setBossProof] = useState('');
  const [showMinionQuickProof, setShowMinionQuickProof] = useState(false);
  const [minionProof, setMinionProof] = useState('');

  const pickDefaultChapterId = (list: StoryChapter[]) =>
    list.find((c) => c.unlocked && !c.completed)?.id ||
    [...list].reverse().find((c) => c.unlocked)?.id ||
    list[0]?.id ||
    '';

  const [selectedChapterId, setSelectedChapterId] = useState<string>(() =>
    pickDefaultChapterId(chapters)
  );

  useEffect(() => {
    const selected = chapters.find((c) => c.id === selectedChapterId);
    if (!selected || !selected.unlocked) {
      setSelectedChapterId(pickDefaultChapterId(chapters));
    }
  }, [chapters, selectedChapterId]);

  const activeChapter =
    chapters.find((c) => c.id === selectedChapterId && c.unlocked) ||
    chapters.find((c) => c.unlocked && !c.completed) ||
    chapters[0];

  const bossById = new Map(bosses.map((b) => [b.id, b]));
  const customBosses = bosses.filter((b) => b.bossRole === 'custom_boss');
  const unlockedChaptersCount = chapters.filter((c) => c.unlocked).length;
  const completedChaptersCount = chapters.filter((c) => c.completed).length;

  const chapterStages: ChapterStageNode[] = activeChapter?.stages ?? [];
  const clearedStages = chapterStages.filter((s) => s.completed);
  const activeStage: ChapterStageNode | undefined = chapterStages.find(
    (s) => s.unlocked && !s.completed
  );
  const activeStageBoss: BossMission | undefined = activeStage?.bossId
    ? bossById.get(activeStage.bossId)
    : undefined;

  const renderPixelBar = (current: number, max: number, label: string, fillVar: string) => {
    const pct = Math.max(0, Math.min(100, Math.round((current / Math.max(1, max)) * 100)));
    return (
      <div>
        <div className="mb-1 flex justify-between font-mono text-xs">
          <span className="font-bold text-sub">{label}</span>
          <span className="font-bold text-main">
            {current.toLocaleString()} / {max.toLocaleString()} ({pct}%)
          </span>
        </div>
        <div className="rpg-bar-track h-3.5 w-full rounded-none">
          <div
            className="h-full border-t border-white/25 transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: fillVar }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 16-Bit Weekly Raid Boss Arena (Embedded Above Campaign Chapters) */}
      {(weeklyRaid !== undefined || Boolean(weeklyRaidLoading)) && (
        <WeeklyRaidBossArena
          data={weeklyRaid ?? null}
          loading={weeklyRaidLoading}
          onChangeDifficulty={onChangeRaidDifficulty ?? noopAsync}
          onClaimChest={onClaimRaidChest ?? noopAsync}
          onRegenerateAi={onRegenerateRaidAi ?? noopAsync}
          onRefresh={onRefreshRaid ?? noopAsync}
        />
      )}

      {/* 16-Bit Campaign Header Plaque + Fog-of-War Chapter Stepper (CH.1..CH.8) */}
      <section className="studio-surface relative rounded-none p-4 sm:p-5">
        <PixelRivets />
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 pb-3 studio-divider">
          <div className="flex items-center gap-2">
            <div className="px-inset flex h-8 w-8 items-center justify-center rounded-none">
              <PxSword size={16} color="var(--px-gold-text)" />
            </div>
            <h2 className="font-display text-base font-extrabold text-main">
              Hành Trình Từng Bước
            </h2>
          </div>
          <div className="px-inset rounded-none px-2.5 py-1 font-mono text-xs text-sub">
            Đã mở <strong className="text-main">{unlockedChaptersCount}/{chapters.length}</strong> Chương
            {' · '}Hoàn thành <strong className="text-[var(--px-green-text)]">{completedChaptersCount}</strong>
            {' · '}Chuỗi <strong className="text-[var(--px-gold-text)]">{streakDays} ngày</strong>
          </div>
        </div>

        {/* Strict Fog-of-War 8-Chapter Stepper: Locked chapters show ONLY CH.X 🔒 ??? */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {chapters.map((ch) => {
            const isSelected = activeChapter?.id === ch.id;

            if (!ch.unlocked) {
              return (
                <button
                  key={ch.id}
                  type="button"
                  disabled
                  className="px-inset flex cursor-not-allowed items-center justify-between rounded-none px-2.5 py-2 text-left opacity-60"
                >
                  <span className="font-pixel text-[10px] font-bold text-dim">
                    CH.{ch.chapterNumber}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-dim">
                    <PxLock size={12} color="var(--text-muted)" /> ???
                  </span>
                </button>
              );
            }

            if (ch.completed) {
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setSelectedChapterId(ch.id)}
                  className="relative flex items-center justify-between rounded-none border-2 border-[var(--border-ink)] bg-[var(--bg-surface-2)] px-2.5 py-2 pt-2.5 text-left transition-transform hover:brightness-105 active:translate-y-[1px]"
                  style={{
                    boxShadow:
                      'inset 2px 2px 0 var(--border-bevel-hi), inset -2px -2px 0 var(--border-bevel-lo)',
                    outline: isSelected ? '2px solid var(--px-green)' : undefined,
                    outlineOffset: isSelected ? '2px' : undefined,
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-0 right-0 top-0 h-[3px]"
                    style={{ backgroundColor: 'var(--px-green)' }}
                  />
                  <span className="font-pixel text-[10px] font-bold text-[var(--px-green-text)]">
                    CH.{ch.chapterNumber}
                  </span>
                  <PxCheck size={14} color="var(--px-green-text)" />
                </button>
              );
            }

            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setSelectedChapterId(ch.id)}
                className="relative flex flex-col justify-between rounded-none border-2 border-[var(--border-ink)] bg-[var(--bg-surface-2)] px-2.5 py-2 pt-2.5 text-left transition-transform hover:brightness-105 active:translate-y-[1px]"
                style={{
                  boxShadow:
                    'inset 2px 2px 0 var(--border-bevel-hi), inset -2px -2px 0 var(--border-bevel-lo)',
                  outline: isSelected ? '2px solid var(--px-rivet)' : undefined,
                  outlineOffset: isSelected ? '2px' : undefined,
                }}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 right-0 top-0 h-[3px]"
                  style={{ backgroundColor: 'var(--px-gold)' }}
                />
                <span className="font-pixel text-[9px] font-bold text-[var(--px-gold-text)]">
                  CH.{ch.chapterNumber} · HIỆN TẠI
                </span>
                <span className="mt-0.5 truncate text-[11px] font-bold text-main">
                  {ch.title}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Selected Unlocked Chapter: 16-Bit Dungeon Banner + 5-Stage Stepper + Active Stage Plaque */}
      {activeChapter && activeChapter.unlocked && (
        <section className="studio-surface relative overflow-hidden rounded-none">
          <PixelRivets />
          <div className="border-b-2 bg-[var(--bg-surface-2)] p-4 sm:p-5 studio-divider">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-[var(--px-gold-text)]">
                  <PxShield size={13} color="var(--px-gold-text)" />
                  <span>
                    Chương {activeChapter.chapterNumber} · {activeChapter.arcLabel}
                  </span>
                </div>
                <h3 className="mt-0.5 font-display text-lg font-extrabold text-main">
                  {activeChapter.title}
                </h3>
              </div>
              <span className="px-inset rounded-none px-2.5 py-1 font-mono text-xs font-bold text-main">
                {clearedStages.length}/{chapterStages.length} Màn
              </span>
            </div>

            {/* Compact 5-Stage Linear Stepper: Locked upcoming stages render ONLY as 🔒 ??? */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {chapterStages.map((st, idx) => (
                <React.Fragment key={st.id}>
                  {st.completed ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-none border-2 border-[var(--border-ink)] bg-[var(--bg-surface)] px-2.5 py-1 font-mono text-xs font-bold text-[var(--px-green-text)]"
                      style={{ borderLeft: '4px solid var(--px-green)' }}
                    >
                      <PxCheck size={12} color="var(--px-green-text)" />
                      <span>Màn {st.code}</span>
                    </span>
                  ) : st.unlocked ? (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-none border-2 border-[var(--border-ink)] px-2.5 py-1 font-mono text-xs font-extrabold"
                      style={{ backgroundColor: 'var(--px-gold)', color: '#140e04' }}
                    >
                      <span>Màn {st.code}</span>
                      {st.isCheckpoint && <PxShield size={12} color="#140e04" />}
                    </span>
                  ) : (
                    <span className="px-inset inline-flex items-center gap-1 rounded-none px-2.5 py-1 font-mono text-xs font-bold text-dim opacity-65">
                      <PxLock size={12} color="var(--text-muted)" /> ???
                    </span>
                  )}

                  {idx < chapterStages.length - 1 && (
                    <PxChevron dir="right" size={12} color="var(--text-muted)" />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Tiny 1-line chip bar for cleared earlier stages */}
            {clearedStages.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1 font-mono text-[11px] font-semibold text-[var(--px-green-text)]">
                <PxCheck size={12} color="var(--px-green-text)" />
                <span>Đã vượt qua: {clearedStages.map((s) => `Màn ${s.code}`).join(' · ')}</span>
              </div>
            )}
          </div>

          {/* Single Current Active Stage Focus Pane */}
          <div className="p-4 sm:p-5">
            {activeChapter.completed || !activeStage ? (
              <div
                className="relative flex flex-wrap items-center justify-between gap-3 rounded-none border-2 border-[var(--border-ink)] bg-[var(--bg-surface-2)] p-4"
                style={{
                  borderLeft: '5px solid var(--px-green)',
                  boxShadow:
                    'inset 2px 2px 0 var(--border-bevel-hi), inset -2px -2px 0 var(--border-bevel-lo)',
                }}
              >
                <PixelRivets />
                <div className="flex items-center gap-3">
                  <div className="px-inset flex h-10 w-10 shrink-0 items-center justify-center rounded-none">
                    <PxCheck size={20} color="var(--px-green-text)" />
                  </div>
                  <div>
                    <div className="font-display text-sm font-extrabold text-[var(--px-green-text)]">
                      Đã hoàn thành Chương {activeChapter.chapterNumber}: {activeChapter.title}
                    </div>
                    <p className="text-xs text-sub">{activeChapter.realLifeObjective}</p>
                  </div>
                </div>
                <span
                  className="font-pixel rounded-none border-2 border-[var(--border-ink)] px-2.5 py-1 text-[10px] font-bold"
                  style={{ backgroundColor: 'var(--px-green)', color: '#ffffff' }}
                >
                  CLEARED
                </span>
              </div>
            ) : activeStage.kind === 'minion_wave' ? (
              /* Active Minion Wave Dungeon Plaque */
              (() => {
                const req = Math.max(1, activeStage.minionCountRequired ?? 2);
                const prog = Math.min(req, activeStage.minionProgress ?? 0);
                const remaining = Math.max(0, req - prog);

                return (
                  <div
                    className="relative space-y-4 rounded-none border-2 border-[var(--border-ink)] bg-[var(--bg-surface-2)] p-4"
                    style={{
                      boxShadow:
                        'inset 2px 2px 0 var(--border-bevel-hi), inset -2px -2px 0 var(--border-bevel-lo)',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-0 right-0 top-0 h-[3px]"
                      style={{ backgroundColor: 'var(--px-blue)' }}
                    />
                    <PixelRivets />

                    <div className="flex flex-wrap items-start gap-4">
                      <div
                        className="px-inset shrink-0 rounded-none p-2"
                        style={{ boxShadow: 'inset 0 0 0 2px var(--px-blue)' }}
                      >
                        <PixelMonsterSprite
                          archetype={activeStage.archetype}
                          size={56}
                          enraged
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="font-pixel inline-flex items-center gap-1 rounded-none border-2 border-[var(--border-ink)] px-2 py-0.5 text-[9px] font-bold"
                            style={{ backgroundColor: 'var(--px-blue)', color: '#ffffff' }}
                          >
                            <PxSword size={11} color="#ffffff" />
                            CHẶNG HIỆN TẠI · MÀN {activeStage.code}
                          </span>
                          <span className="px-inset inline-flex items-center gap-2 rounded-none px-2 py-0.5 font-mono text-xs text-sub">
                            <span className="inline-flex items-center gap-1 font-bold text-[var(--px-gold-text)]">
                              <PxCoin size={12} /> +{activeStage.rewardGold} G
                            </span>
                            <span className="text-dim">·</span>
                            <span className="inline-flex items-center gap-1 font-bold text-[var(--px-plum-text)]">
                              <PxSparkle size={12} color="var(--px-plum-text)" /> +
                              {activeStage.rewardSp} SP
                            </span>
                            <span className="text-dim">·</span>
                            <span className="font-bold text-[var(--px-blue-text)]">
                              +{activeStage.rewardXp} XP
                            </span>
                          </span>
                        </div>
                        <h4 className="mt-1.5 font-display text-base font-extrabold text-main">
                          Màn {activeStage.code}: {activeStage.title}
                        </h4>
                        <p className="mt-0.5 text-xs text-sub">
                          Còn <strong className="text-main">{remaining}</strong> nhiệm vụ hôm nay để
                          vượt qua (tự động cộng khi xong việc).
                        </p>
                      </div>
                    </div>

                    {renderPixelBar(
                      prog,
                      req,
                      activeStage.minionName || 'Tiến độ vượt ải',
                      'var(--px-blue)'
                    )}

                    {onVerifyMinionStage && (
                      <div className="border-t-2 pt-3 studio-divider">
                        {!showMinionQuickProof ? (
                          <button
                            type="button"
                            onClick={() => {
                              setShowMinionQuickProof(true);
                              setMinionProof('');
                            }}
                            className="btn-secondary inline-flex items-center gap-1.5 rounded-none px-3 py-1.5 text-xs text-[var(--px-blue-text)]"
                          >
                            <PxCheck size={13} color="var(--px-blue-text)" />
                            <span>Xác thực nhanh</span>
                          </button>
                        ) : (
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                              value={minionProof}
                              onChange={(e) => setMinionProof(e.target.value)}
                              placeholder="Nhập ghi chú hoàn thành (>= 5 ký tự)..."
                              className="flex-1 rounded-none px-2.5 py-1.5 text-xs"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  await onVerifyMinionStage(
                                    activeChapter.id,
                                    activeStage.id,
                                    minionProof
                                  );
                                  setShowMinionQuickProof(false);
                                  setMinionProof('');
                                }}
                                className="btn-primary rounded-none px-3 py-1.5 text-xs"
                              >
                                Hoàn thành
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowMinionQuickProof(false)}
                                className="btn-secondary rounded-none px-3 py-1.5 text-xs"
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()
            ) : activeStageBoss ? (
              /* Active Unlocked Mini-Boss or Chapter Boss Dungeon Plaque */
              <div
                className="relative space-y-4 rounded-none border-2 border-[var(--border-ink)] bg-[var(--bg-surface-2)] p-4"
                style={{
                  boxShadow:
                    'inset 2px 2px 0 var(--border-bevel-hi), inset -2px -2px 0 var(--border-bevel-lo)',
                }}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 right-0 top-0 h-[4px]"
                  style={{ backgroundColor: 'var(--px-red)' }}
                />
                <PixelRivets />

                <div className="flex flex-wrap items-start gap-4">
                  <div
                    className="px-inset shrink-0 rounded-none p-2"
                    style={{ boxShadow: 'inset 0 0 0 2px var(--px-red)' }}
                  >
                    <PixelMonsterSprite
                      archetype={getBossSpriteArchetype(activeStageBoss)}
                      size={60}
                      isBoss={activeStage.kind === 'chapter_boss'}
                      isElite={activeStage.kind === 'mini_boss'}
                      enraged
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="font-pixel inline-flex items-center gap-1 rounded-none border-2 border-[var(--border-ink)] px-2 py-0.5 text-[9px] font-bold"
                        style={{ backgroundColor: 'var(--px-red)', color: '#ffffff' }}
                      >
                        <PxSkull size={12} color="#ffffff" />
                        MÀN {activeStage.code} · {activeStageBoss.rank}-RANK
                      </span>
                      {activeStage.isCheckpoint && (
                        <span
                          className="inline-flex items-center gap-1 rounded-none border-2 border-[var(--border-ink)] px-2 py-0.5 font-mono text-[10px] font-extrabold"
                          style={{ backgroundColor: 'var(--px-gold)', color: '#140e04' }}
                        >
                          <PxShield size={11} color="#140e04" /> Checkpoint
                        </span>
                      )}
                      <span className="px-inset inline-flex items-center gap-2 rounded-none px-2 py-0.5 font-mono text-xs text-sub">
                        <span className="inline-flex items-center gap-1 font-bold text-[var(--px-gold-text)]">
                          <PxCoin size={12} /> +{activeStageBoss.rewardGold ?? 180} G
                        </span>
                        <span className="text-dim">·</span>
                        <span className="inline-flex items-center gap-1 font-bold text-[var(--px-blue-text)]">
                          <PxGem size={12} /> +{activeStageBoss.rewardRunestones ?? 15}
                        </span>
                      </span>
                    </div>
                    <h4 className="mt-1.5 font-display text-base font-extrabold text-main">
                      Màn {activeStage.code}: {activeStageBoss.title}
                    </h4>
                    <p className="mt-0.5 text-xs text-sub">{activeStageBoss.subtitle}</p>
                  </div>
                </div>

                {renderPixelBar(
                  activeStageBoss.currentHp,
                  activeStageBoss.maxHp,
                  'Boss HP',
                  'var(--px-red)'
                )}

                {/* Concise Proof-of-Work Stage Checklist */}
                <div className="divide-y-2 border-t-2 studio-divider">
                  {activeStageBoss.stages.map((st) => {
                    const key = `${activeStageBoss.id}:${st.id}`;
                    const open = activeStageKey === key;
                    return (
                      <div key={st.id} className="py-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            {st.completed ? (
                              <PxCheck size={14} color="var(--px-green-text)" />
                            ) : (
                              <PxSword size={14} color="var(--px-red-text)" />
                            )}
                            <span
                              className={`truncate font-semibold ${
                                st.completed ? 'line-through text-dim' : 'text-main'
                              }`}
                            >
                              {st.title}
                            </span>
                          </div>
                          {!st.completed && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveStageKey(open ? null : key);
                                setBossProof('');
                              }}
                              className="btn-crimson shrink-0 rounded-none px-2.5 py-1 font-mono text-[11px]"
                            >
                              Hoàn thành (-{st.hpDamage.toLocaleString()} HP)
                            </button>
                          )}
                        </div>

                        {open && !st.completed && (
                          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                            <input
                              value={bossProof}
                              onChange={(e) => setBossProof(e.target.value)}
                              placeholder={st.verificationHint}
                              className="flex-1 rounded-none px-2.5 py-1.5 text-xs"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                await onVerifyBossStage(activeStageBoss.id, st.id, bossProof);
                                setActiveStageKey(null);
                                setBossProof('');
                              }}
                              className="btn-primary shrink-0 rounded-none px-3 py-1.5 text-xs"
                            >
                              Hoàn thành
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      )}

      {/* Compact Personal Goal Bosses (custom_boss) */}
      {customBosses.length > 0 && (
        <section className="studio-surface relative overflow-hidden rounded-none">
          <PixelRivets />
          <div className="flex items-center gap-2 border-b-2 bg-[var(--bg-surface-2)] px-4 py-3 studio-divider">
            <PxSparkle size={15} color="var(--px-gold)" />
            <h3 className="font-display text-sm font-extrabold text-main">
              Mục Tiêu Cá Nhân ({customBosses.length})
            </h3>
          </div>
          <div className="divide-y-2 studio-divider">
            {customBosses.map((boss) => {
              const pct = Math.max(
                0,
                Math.min(
                  100,
                  Math.round(((boss.maxHp - boss.currentHp) / Math.max(1, boss.maxHp)) * 100)
                )
              );
              return (
                <div key={boss.id} className="space-y-2.5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {boss.defeated ? (
                        <PxCheck size={14} color="var(--px-green-text)" />
                      ) : (
                        <PxSkull size={14} color="var(--px-gold-text)" />
                      )}
                      <div className="font-display text-sm font-bold text-main">{boss.title}</div>
                    </div>
                    <span
                      className={`px-inset rounded-none px-2 py-0.5 font-mono text-xs font-bold ${
                        boss.defeated ? 'text-[var(--px-green-text)]' : 'text-sub'
                      }`}
                    >
                      {boss.defeated
                        ? 'Hoàn thành'
                        : `${pct}% · ${boss.deadline || boss.gateLabel}`}
                    </span>
                  </div>
                  {renderPixelBar(boss.currentHp, boss.maxHp, 'HP còn lại', 'var(--px-gold)')}
                  {!boss.defeated && (
                    <div className="divide-y studio-divider">
                      {boss.stages
                        .filter((s) => !s.completed)
                        .map((st) => {
                          const key = `${boss.id}:${st.id}`;
                          const open = activeStageKey === key;
                          return (
                            <div key={st.id} className="py-2 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sub">{st.title}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveStageKey(open ? null : key);
                                    setBossProof('');
                                  }}
                                  className="btn-secondary rounded-none px-2.5 py-1 text-[11px]"
                                >
                                  Hoàn thành
                                </button>
                              </div>
                              {open && (
                                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                  <input
                                    value={bossProof}
                                    onChange={(e) => setBossProof(e.target.value)}
                                    placeholder={st.verificationHint}
                                    className="flex-1 rounded-none px-2.5 py-1.5 text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await onVerifyBossStage(boss.id, st.id, bossProof);
                                      setActiveStageKey(null);
                                      setBossProof('');
                                    }}
                                    className="btn-primary rounded-none px-3 py-1.5 text-xs"
                                  >
                                    Xác nhận
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
