import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Compass,
  Flag,
  Lock,
  Sparkles,
  Swords,
} from 'lucide-react';
import type {
  BossMission,
  ChapterStageNode,
  MonsterArchetype,
  SkillNode,
  StoryChapter,
} from '../types/system';
import { PixelMonsterSprite } from './DungeonSprites';

interface BossAndSkillsViewProps {
  chapters: StoryChapter[];
  bosses: BossMission[];
  skills: SkillNode[];
  streakDays: number;
  onVerifyBossStage: (bossId: string, stageId: string, proofText: string) => Promise<void>;
  onVerifySkill: (skillId: string, proofNote: string) => Promise<void>;
  onVerifyMinionStage?: (chapterId: string, stageId: string, proofText: string) => Promise<void>;
}

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

  const renderPixelBar = (current: number, max: number, label: string, barColor: string) => {
    const pct = Math.max(0, Math.min(100, Math.round((current / Math.max(1, max)) * 100)));
    return (
      <div>
        <div className="mb-1 flex justify-between font-mono text-xs">
          <span className="font-bold text-sub">{label}</span>
          <span className="font-bold text-main">
            {current.toLocaleString()} / {max.toLocaleString()} ({pct}%)
          </span>
        </div>
        <div
          className="relative h-3 w-full overflow-hidden rounded-[2px] border-2 studio-divider bg-[var(--bg-subtle)]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(15,23,42,0.28) 10px, rgba(15,23,42,0.28) 12px)',
          }}
        >
          <div className={`h-full transition-all duration-300 ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Compact Header + Fog-of-War Chapter Stepper (CH.1..CH.8) */}
      <section className="studio-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 pb-3 studio-divider">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 shrink-0 text-amber-400" />
            <h2 className="font-display text-base font-extrabold text-main">
              Hành Trình Từng Bước
            </h2>
          </div>
          <div className="font-mono text-xs text-dim">
            Đã mở {unlockedChaptersCount}/{chapters.length} Chương · Hoàn thành {completedChaptersCount} · Chuỗi {streakDays} ngày
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
                  className="flex cursor-not-allowed items-center justify-between rounded-[2px] border-2 px-2.5 py-2 text-left opacity-55 studio-subtle studio-divider"
                >
                  <span className="font-pixel text-[10px] font-bold text-dim">
                    CH.{ch.chapterNumber}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-dim">
                    <Lock className="h-3 w-3" /> ???
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
                  className={`flex items-center justify-between rounded-[2px] border-2 px-2.5 py-2 text-left transition ${
                    isSelected
                      ? 'border-emerald-400 bg-emerald-500/20'
                      : 'border-emerald-500/50 bg-emerald-500/10 hover:border-emerald-400'
                  }`}
                >
                  <span className="font-pixel text-[10px] font-bold text-emerald-400">
                    CH.{ch.chapterNumber} ✓
                  </span>
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                </button>
              );
            }

            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setSelectedChapterId(ch.id)}
                className={`flex flex-col justify-between rounded-[2px] border-2 px-2.5 py-2 text-left transition ${
                  isSelected
                    ? 'border-amber-400 bg-amber-500/15'
                    : 'border-amber-500/60 studio-subtle hover:border-amber-400'
                }`}
              >
                <span className="font-pixel text-[9px] font-bold text-amber-400">
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

      {/* Selected Unlocked Chapter: 5-Stage Fog-of-War Stepper + Single Active Stage Focus Pane */}
      {activeChapter && activeChapter.unlocked && (
        <section className="studio-surface overflow-hidden">
          <div className="border-b-2 p-4 sm:p-5 studio-divider">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-mono text-[11px] font-bold text-amber-400">
                  Chương {activeChapter.chapterNumber} · {activeChapter.arcLabel}
                </div>
                <h3 className="mt-0.5 font-display text-lg font-extrabold text-main">
                  {activeChapter.title}
                </h3>
              </div>
              <span className="rounded-[2px] border px-2.5 py-1 font-mono text-xs font-semibold text-main studio-subtle studio-divider">
                {clearedStages.length}/{chapterStages.length} Màn
              </span>
            </div>

            {/* Compact 5-Stage Linear Stepper: Locked upcoming stages render ONLY as 🔒 ??? */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {chapterStages.map((st, idx) => (
                <React.Fragment key={st.id}>
                  {st.completed ? (
                    <span className="inline-flex items-center gap-1 rounded-[2px] border border-emerald-500/50 bg-emerald-500/15 px-2.5 py-1 font-mono text-xs font-bold text-emerald-400">
                      ✓ Màn {st.code}
                    </span>
                  ) : st.unlocked ? (
                    <span className="inline-flex items-center gap-1 rounded-[2px] border-2 border-amber-400 bg-amber-500/15 px-2.5 py-1 font-mono text-xs font-bold text-amber-300">
                      Màn {st.code}
                      {st.isCheckpoint && <Flag className="h-3 w-3 text-amber-400" />}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-[2px] border px-2.5 py-1 font-mono text-xs font-bold text-dim opacity-65 studio-subtle studio-divider">
                      <Lock className="h-3 w-3" /> ???
                    </span>
                  )}

                  {idx < chapterStages.length - 1 && (
                    <span className="font-mono text-xs text-dim" aria-hidden="true">
                      →
                    </span>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Tiny 1-line chip bar for cleared earlier stages */}
            {clearedStages.length > 0 && (
              <div className="mt-2.5 font-mono text-[11px] text-emerald-400">
                Đã vượt qua: {clearedStages.map((s) => `✓ Màn ${s.code}`).join(' · ')}
              </div>
            )}
          </div>

          {/* Single Current Active Stage Focus Pane */}
          <div className="p-4 sm:p-5">
            {activeChapter.completed || !activeStage ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2px] border-2 border-emerald-500/50 bg-emerald-500/10 p-4">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                  <div>
                    <div className="font-display text-sm font-extrabold text-emerald-300">
                      Đã hoàn thành Chương {activeChapter.chapterNumber}: {activeChapter.title}
                    </div>
                    <p className="text-xs text-sub">
                      {activeChapter.realLifeObjective}
                    </p>
                  </div>
                </div>
                <span className="font-pixel rounded-[2px] border border-emerald-400 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                  CLEARED
                </span>
              </div>
            ) : activeStage.kind === 'minion_wave' ? (
              /* Active Minion Wave Stage */
              (() => {
                const req = Math.max(1, activeStage.minionCountRequired ?? 2);
                const prog = Math.min(req, activeStage.minionProgress ?? 0);
                const remaining = Math.max(0, req - prog);

                return (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="shrink-0 rounded-[2px] border-2 p-2 studio-subtle studio-divider">
                        <PixelMonsterSprite
                          archetype={activeStage.archetype}
                          size={56}
                          enraged
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-pixel rounded-[2px] border border-cyan-500/40 bg-cyan-500/15 px-2 py-0.5 text-[9px] font-bold text-cyan-400">
                            CHẶNG HIỆN TẠI · MÀN {activeStage.code}
                          </span>
                          <span className="font-mono text-xs text-dim">
                            +{activeStage.rewardGold} G · +{activeStage.rewardSp} SP · +{activeStage.rewardXp} XP
                          </span>
                        </div>
                        <h4 className="mt-1 font-display text-base font-extrabold text-main">
                          Màn {activeStage.code}: {activeStage.title}
                        </h4>
                        <p className="mt-0.5 text-xs text-sub">
                          Còn <strong>{remaining}</strong> nhiệm vụ hôm nay để vượt qua (tự động cộng khi xong việc).
                        </p>
                      </div>
                    </div>

                    {renderPixelBar(prog, req, activeStage.minionName || 'Tiến độ vượt ải', 'bg-cyan-500')}

                    {onVerifyMinionStage && (
                      <div className="border-t-2 pt-3 studio-divider">
                        {!showMinionQuickProof ? (
                          <button
                            type="button"
                            onClick={() => {
                              setShowMinionQuickProof(true);
                              setMinionProof('');
                            }}
                            className="btn-secondary px-3 py-1.5 text-xs text-cyan-400"
                          >
                            Xác thực nhanh
                          </button>
                        ) : (
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                              value={minionProof}
                              onChange={(e) => setMinionProof(e.target.value)}
                              placeholder="Nhập ghi chú hoàn thành (>= 5 ký tự)..."
                              className="flex-1 px-2.5 py-1.5 text-xs"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  await onVerifyMinionStage(activeChapter.id, activeStage.id, minionProof);
                                  setShowMinionQuickProof(false);
                                  setMinionProof('');
                                }}
                                className="btn-primary px-3 py-1.5 text-xs"
                              >
                                Hoàn thành
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowMinionQuickProof(false)}
                                className="btn-secondary px-3 py-1.5 text-xs"
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
              /* Active Unlocked Mini-Boss or Chapter Boss Stage */
              <div className="space-y-4">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="shrink-0 rounded-[2px] border-2 border-rose-500/50 bg-rose-500/10 p-2">
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
                      <span className="font-pixel rounded-[2px] border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[9px] font-bold text-rose-400">
                        MÀN {activeStage.code} · {activeStageBoss.rank}-RANK
                      </span>
                      {activeStage.isCheckpoint && (
                        <span className="inline-flex items-center gap-1 rounded-[2px] border border-amber-400/50 bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                          <Flag className="h-3 w-3" /> Checkpoint
                        </span>
                      )}
                      <span className="font-mono text-xs text-dim">
                        +{activeStageBoss.rewardGold ?? 180} G · +{activeStageBoss.rewardRunestones ?? 15} 💎
                      </span>
                    </div>
                    <h4 className="mt-1 font-display text-base font-extrabold text-main">
                      Màn {activeStage.code}: {activeStageBoss.title}
                    </h4>
                    <p className="mt-0.5 text-xs text-sub">{activeStageBoss.subtitle}</p>
                  </div>
                </div>

                {renderPixelBar(activeStageBoss.currentHp, activeStageBoss.maxHp, 'Boss HP', 'bg-rose-600')}

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
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                            ) : (
                              <Swords className="h-4 w-4 shrink-0 text-rose-400" />
                            )}
                            <span className={`truncate font-semibold ${st.completed ? 'line-through text-dim' : 'text-main'}`}>
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
                              className="btn-secondary shrink-0 px-2.5 py-1 font-mono text-[11px] text-rose-400"
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
                              className="flex-1 px-2.5 py-1.5 text-xs"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                await onVerifyBossStage(activeStageBoss.id, st.id, bossProof);
                                setActiveStageKey(null);
                                setBossProof('');
                              }}
                              className="btn-primary shrink-0 px-3 py-1.5 text-xs"
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
        <section className="studio-surface overflow-hidden">
          <div className="flex items-center gap-2 border-b-2 px-4 py-3 studio-divider">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <h3 className="font-display text-sm font-extrabold text-main">
              Mục Tiêu Cá Nhân ({customBosses.length})
            </h3>
          </div>
          <div className="divide-y-2 studio-divider">
            {customBosses.map((boss) => {
              const pct = Math.max(0, Math.min(100, Math.round(((boss.maxHp - boss.currentHp) / Math.max(1, boss.maxHp)) * 100)));
              return (
                <div key={boss.id} className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-display text-sm font-bold text-main">{boss.title}</div>
                    <span className="font-mono text-xs text-dim">
                      {boss.defeated ? '✓ Hoàn thành' : `${pct}% · ${boss.deadline || boss.gateLabel}`}
                    </span>
                  </div>
                  {renderPixelBar(boss.currentHp, boss.maxHp, 'HP còn lại', 'bg-amber-500')}
                  {!boss.defeated && (
                    <div className="divide-y studio-divider">
                      {boss.stages.filter((s) => !s.completed).map((st) => {
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
                                className="btn-secondary px-2.5 py-1 text-[11px]"
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
                                  className="flex-1 px-2.5 py-1.5 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await onVerifyBossStage(boss.id, st.id, bossProof);
                                    setActiveStageKey(null);
                                    setBossProof('');
                                  }}
                                  className="btn-primary px-3 py-1.5 text-xs"
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
