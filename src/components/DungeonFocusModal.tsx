import React, { useEffect, useState } from 'react';
import type { Quest } from '../types/system';
import {
  PixelRivets,
  PxBolt,
  PxBook,
  PxCheck,
  PxClose,
  PxPause,
  PxPlay,
  PxSparkle,
  PxSword,
  PxWarn,
} from './PixelIcons';

interface DungeonFocusModalProps {
  quest: Quest;
  onToggleSubtask: (questId: string, subtaskId: string) => Promise<void>;
  onClearDungeon: (questId: string, proofNote?: string) => Promise<void>;
  onClose: () => void;
}

export const DungeonFocusModal: React.FC<DungeonFocusModalProps> = ({
  quest,
  onToggleSubtask,
  onClearDungeon,
  onClose,
}) => {
  const totalSeconds = Math.max(60, quest.durationMinutes * 60);
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [running, setRunning] = useState(true);
  const [distractions, setDistractions] = useState(0);
  const [proofNote, setProofNote] = useState('');
  const [microGapLeft, setMicroGapLeft] = useState<number | null>(null);
  const [microGapCount, setMicroGapCount] = useState(0);

  useEffect(() => {
    if (!running || microGapLeft !== null) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [running, microGapLeft]);

  useEffect(() => {
    if (microGapLeft === null) return;
    if (microGapLeft <= 0) {
      setMicroGapLeft(null);
      setMicroGapCount((c) => c + 1);
      return;
    }
    const gapTimer = setTimeout(() => {
      setMicroGapLeft((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(gapTimer);
  }, [microGapLeft]);

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');
  const elapsedPct = Math.round(((totalSeconds - secondsLeft) / totalSeconds) * 100);
  const completedSubtasks = quest.subtasks.filter((s) => s.done).length;
  const totalSubtasks = Math.max(1, quest.subtasks.length);
  const progressPct = Math.min(
    100,
    Math.round((completedSubtasks / totalSubtasks) * 65 + elapsedPct * 0.35)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="rpg-window relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-none p-6">
        <PixelRivets />

        <button
          type="button"
          onClick={onClose}
          className="btn-secondary absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-none"
          aria-label="Đóng"
        >
          <PxClose size={13} />
        </button>

        <div className="pr-8 text-center">
          <span className="font-pixel inline-block rounded-none border-2 border-[var(--border-ink)] bg-[var(--px-gold)] px-2.5 py-1 text-[10px] font-bold uppercase text-[#140e04]">
            FOCUS MODE · +25% XP &amp; +SP
          </span>
          <h2 className="mt-2 font-display text-lg font-extrabold text-main">{quest.title}</h2>
          <p className="mt-0.5 text-xs text-sub">{quest.learningMethod}</p>
        </div>

        <div className="my-5 flex flex-col items-center">
          <div className="px-inset flex h-36 w-36 items-center justify-center rounded-none border-2 border-[var(--px-gold)]">
            <div className="text-center">
              <div className="font-mono text-3xl font-extrabold tabular-nums text-main">
                {mins}:{secs}
              </div>
              <span
                className="font-pixel mt-1 inline-block text-[9px]"
                style={{ color: running ? 'var(--px-gold-text)' : 'var(--px-blue-text)' }}
              >
                {running ? 'FOCUS ON' : 'PAUSED'}
              </span>
            </div>
          </div>

          <div className="mt-4 w-full max-w-sm">
            <div className="mb-1 flex justify-between font-mono text-xs text-sub">
              <span>Tiến độ phiên tập trung</span>
              <span className="font-bold text-main">{progressPct}%</span>
            </div>
            <div className="rpg-bar-track h-3 w-full">
              <div
                className="h-full"
                style={{ width: `${progressPct}%`, backgroundColor: 'var(--px-gold)' }}
              />
            </div>
          </div>
        </div>

        {quest.subtasks.length > 0 && (
          <div className="px-inset mb-4 space-y-2 rounded-none p-3.5">
            {quest.subtasks.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => void onToggleSubtask(quest.id, st.id)}
                className="flex w-full items-center gap-2 text-left text-xs text-main"
              >
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-none border-2 border-[var(--border-ink)]"
                  style={{
                    backgroundColor: st.done ? 'var(--px-green)' : 'var(--bg-surface)',
                    color: '#ffffff',
                  }}
                >
                  {st.done && <PxCheck size={10} />}
                </span>
                <span className={st.done ? 'text-dim line-through' : ''}>{st.label}</span>
              </button>
            ))}
          </div>
        )}

        {microGapLeft !== null && (
          <div className="mb-4 rounded-none border-2 border-[var(--px-plum)] bg-[var(--px-plum)]/15 p-3.5 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[var(--px-plum-text)]">
              <PxSparkle size={14} color="var(--px-plum-text)" />
              <span>10s Micro-Gap Neural Replay · 20x Hippocampal Replay</span>
            </div>
            <div className="font-pixel my-1.5 text-2xl font-bold text-[var(--px-plum-text)]">
              {microGapLeft}s
            </div>
            <p className="text-xs text-sub">
              NIH / Huberman: Nhắm mắt thả lỏng 10 giây giữa phiên học giúp hồi hải mã phát lại ký ức nhanh gấp 20 lần.
            </p>
            <button
              type="button"
              onClick={() => setMicroGapLeft(null)}
              className="btn-secondary mt-2 rounded-none px-3 py-1 text-xs"
            >
              Quay lại ngay
            </button>
          </div>
        )}

        {microGapLeft === null && microGapCount > 0 && (
          <div className="mb-3 flex items-center justify-center gap-1.5 rounded-none border-2 border-[var(--px-green)] bg-[var(--px-green)]/15 px-3 py-1.5 text-xs font-semibold text-[var(--px-green-text)]">
            <PxCheck size={13} />
            <span>Đã hoàn tất {microGapCount} chu kỳ Tái tạo Thần kinh 10s (20x Replay).</span>
          </div>
        )}

        <input
          value={proofNote}
          onChange={(e) => setProofNote(e.target.value)}
          placeholder="Ghi ngắn gọn kết quả đạt được sau phiên tập trung..."
          className="w-full rounded-none px-3 py-2 text-xs"
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setRunning((r) => !r)}
              className="btn-secondary flex items-center gap-1.5 rounded-none px-3 py-2 text-xs"
            >
              {running ? <PxPause size={12} /> : <PxPlay size={12} />}
              <span>{running ? 'Tạm dừng' : 'Tiếp tục'}</span>
            </button>
            <button
              type="button"
              onClick={() => setDistractions((d) => d + 1)}
              className="btn-secondary flex items-center gap-1.5 rounded-none px-2.5 py-2 text-xs"
              title="Ghi nhận 1 lần xao nhãng"
            >
              <PxWarn size={13} />
              <span className="font-mono font-bold">{distractions}</span>
            </button>
            <button
              type="button"
              disabled={microGapLeft !== null}
              onClick={() => setMicroGapLeft(10)}
              className="btn-secondary flex items-center gap-1 rounded-none px-2.5 py-2 text-xs text-[var(--px-plum-text)]"
              title="Nghỉ 10 giây Tái tạo Thần kinh — 20x Hippocampal Replay"
            >
              <PxBolt size={13} color="var(--px-plum-text)" />
              <span>Nghỉ 10s</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => void onClearDungeon(quest.id, proofNote)}
            className="btn-primary flex items-center gap-1.5 rounded-none px-4 py-2 text-xs"
          >
            <PxSword size={14} />
            <span>Hoàn thành (+25% XP)</span>
          </button>
        </div>

        <div className="px-inset mt-4 flex items-start gap-2 rounded-none px-3 py-2 text-[11px] text-sub">
          <PxBook size={14} color="var(--px-gold-text)" className="mt-0.5" />
          <span>
            <strong>Focused vs. Diffused Mode (Barbara Oakley):</strong> Tập trung sâu 25–90 phút ở Focused Mode; nếu gặp điểm nghẽn quá 15 phút, hãy tạm rời màn hình đi bộ để não chuyển sang Diffused Mode kết nối ý tưởng.
          </span>
        </div>
      </div>
    </div>
  );
};
