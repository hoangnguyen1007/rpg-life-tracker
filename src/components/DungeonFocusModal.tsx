import React, { useEffect, useState } from 'react';
import {
  Brain,
  CheckCircle2,
  CheckSquare,
  Lightbulb,
  Pause,
  Play,
  ShieldAlert,
  Square,
  Swords,
  X,
  Zap,
} from 'lucide-react';
import type { Quest } from '../types/system';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="rpg-window relative max-h-[92vh] w-full max-w-lg overflow-y-auto p-6">
        <button onClick={onClose} className="absolute right-4 top-4 p-1.5 text-dim hover:text-main">
          <X className="h-5 w-5" />
        </button>

        <div className="text-center">
          <span className="font-pixel border border-amber-500/50 bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-600 dark:text-amber-300 rounded-[2px]">
            FOCUS MODE · +25% XP &amp; +SP
          </span>
          <h2 className="mt-2 font-display text-lg font-extrabold text-main">{quest.title}</h2>
          <p className="mt-0.5 text-xs text-sub">{quest.learningMethod}</p>
        </div>

        <div className="my-5 flex flex-col items-center">
          <div className="flex h-36 w-36 items-center justify-center border-4 border-amber-500/85 bg-[#0d111d] rounded-[2px]">
            <div className="text-center">
              <div className="font-mono text-3xl font-extrabold text-white">
                {mins}:{secs}
              </div>
              <span className="font-pixel text-[9px] text-amber-400">
                {running ? 'FOCUS ON' : 'PAUSED'}
              </span>
            </div>
          </div>

          <div className="mt-4 w-full max-w-sm">
            <div className="mb-1 flex justify-between font-mono text-xs text-sub">
              <span>Tiến độ phiên tập trung</span>
              <span>{progressPct}%</span>
            </div>
            <div className="rpg-bar-track h-2.5 w-full">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {quest.subtasks.length > 0 && (
          <div className="mb-4 space-y-2 border-2 p-3.5 studio-subtle rpg-divider rounded-[2px]">
            {quest.subtasks.map((st) => (
              <button
                key={st.id}
                onClick={() => onToggleSubtask(quest.id, st.id)}
                className="flex w-full items-center gap-2 text-left text-xs text-main"
              >
                {st.done ? (
                  <CheckSquare className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <Square className="h-4 w-4 shrink-0 text-dim" />
                )}
                <span className={st.done ? 'line-through text-dim' : ''}>{st.label}</span>
              </button>
            ))}
          </div>
        )}

        {microGapLeft !== null && (
          <div className="mb-4 border-2 border-violet-500/60 bg-violet-500/15 p-3.5 text-center rounded-[2px]">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-violet-600 dark:text-violet-300">
              <Brain className="h-4 w-4 animate-pulse" />
              <span>10s Micro-Gap Neural Replay · 20x Hippocampal Replay</span>
            </div>
            <div className="font-pixel my-1.5 text-2xl font-bold text-violet-600 dark:text-violet-200">
              {microGapLeft}s
            </div>
            <p className="text-xs text-sub">
              NIH / Huberman: Nhắm mắt thả lỏng 10 giây giữa phiên học giúp hồi hải mã phát lại ký ức nhanh gấp 20 lần.
            </p>
            <button
              type="button"
              onClick={() => setMicroGapLeft(null)}
              className="btn-secondary mt-2 px-3 py-1 text-xs"
            >
              Quay lại ngay
            </button>
          </div>
        )}

        {microGapLeft === null && microGapCount > 0 && (
          <div className="mb-3 flex items-center justify-center gap-1.5 border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-300 rounded-[2px]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Đã hoàn tất {microGapCount} chu kỳ Tái tạo Thần kinh 10s (20x Replay).</span>
          </div>
        )}

        <input
          value={proofNote}
          onChange={(e) => setProofNote(e.target.value)}
          placeholder="Ghi ngắn gọn kết quả đạt được sau phiên tập trung..."
          className="w-full px-3 py-2 text-xs"
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setRunning((r) => !r)} className="btn-secondary flex items-center gap-1.5 px-3 py-2 text-xs">
              {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{running ? 'Tạm dừng' : 'Tiếp tục'}</span>
            </button>
            <button onClick={() => setDistractions((d) => d + 1)} className="btn-secondary flex items-center gap-1 px-2.5 py-2 text-xs">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
              <span>{distractions}</span>
            </button>
            <button
              type="button"
              disabled={microGapLeft !== null}
              onClick={() => setMicroGapLeft(10)}
              className="btn-secondary flex items-center gap-1 px-2.5 py-2 text-xs text-violet-600 dark:text-violet-300"
              title="Nghỉ 10 giây Tái tạo Thần kinh — 20x Hippocampal Replay"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Nghỉ 10s</span>
            </button>
          </div>

          <button onClick={() => onClearDungeon(quest.id, proofNote)} className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs">
            <Swords className="h-4 w-4" />
            <span>Hoàn thành (+25% XP)</span>
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2 border-2 px-3 py-2 text-[11px] text-sub studio-subtle rpg-divider rounded-[2px]">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span>
            <strong>Focused vs. Diffused Mode (Barbara Oakley):</strong> Tập trung sâu 25–90 phút ở Focused Mode; nếu gặp điểm nghẽn quá 15 phút, hãy tạm rời màn hình đi bộ để não chuyển sang Diffused Mode kết nối ý tưởng.
          </span>
        </div>
      </div>
    </div>
  );
};
