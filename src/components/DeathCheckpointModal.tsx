import React, { useState } from 'react';
import { Coins, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import type { DeathReport } from '../types/system';
import { PixelCheckpointCrystal, PixelTombstone } from './DungeonSprites';

interface DeathCheckpointModalProps {
  deathReport: DeathReport;
  onAcknowledge: () => Promise<void>;
}

export const DeathCheckpointModal: React.FC<DeathCheckpointModalProps> = ({
  deathReport,
  onAcknowledge,
}) => {
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div className="rpg-window relative max-h-[92vh] w-full max-w-lg overflow-y-auto border-rose-500/80 p-6">
        <div className="flex items-center gap-3 border-b-2 border-rose-500/40 pb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-rose-500/60 bg-rose-950/60 rounded-[2px]">
            <PixelTombstone size={34} />
          </div>
          <div>
            <p className="font-pixel text-[10px] font-bold tracking-wider text-rose-400">
              CHECKPOINT ROLLBACK
            </p>
            <h2 className="font-display text-base font-extrabold text-main sm:text-lg">
              KIỆT SỨC TRONG HẦM NGỤC · QUAY VỀ CHECKPOINT
            </h2>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-sub">{deathReport.causeSummary}</p>

        {/* Missed Quests List */}
        {deathReport.missedQuests.length > 0 && (
          <div className="mt-4 border-2 p-3 studio-subtle rpg-divider rounded-[2px]">
            <p className="mb-2 font-display text-xs font-bold text-rose-400">
              Nhiệm vụ bỏ lỡ gây sát thương (-{deathReport.totalHpDamage} HP):
            </p>
            <div className="max-h-36 space-y-1.5 overflow-y-auto text-xs">
              {deathReport.missedQuests.map((mq, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 border-b pb-1 last:border-b-0 last:pb-0 rpg-divider"
                >
                  <span className="truncate text-main">{mq.title}</span>
                  <span className="shrink-0 font-mono font-bold text-rose-400">
                    -{mq.hpDamage} HP
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Penalties & Checkpoint Respawn Grid */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
          <div className="border-2 border-rose-500/40 bg-rose-500/10 p-3 rounded-[2px]">
            <div className="flex items-center gap-1.5 font-semibold text-rose-400">
              <Coins className="h-3.5 w-3.5" />
              <span>Gold bị mất (-25%)</span>
            </div>
            <div className="mt-1 font-mono text-base font-extrabold text-main">
              -{deathReport.goldLost} G
            </div>
          </div>

          <div className="border-2 border-amber-500/40 bg-amber-500/10 p-3 rounded-[2px]">
            <div className="flex items-center gap-1.5 font-semibold text-amber-400">
              <Sparkles className="h-3.5 w-3.5" />
              <span>EXP bị mất (-30%)</span>
            </div>
            <div className="mt-1 font-mono text-base font-extrabold text-main">
              -{deathReport.xpLost} XP
            </div>
          </div>
        </div>

        {/* Respawn Checkpoint */}
        <div className="mt-4 flex items-center gap-3 border-2 border-cyan-500/45 bg-cyan-500/10 p-3.5 rounded-[2px]">
          <PixelCheckpointCrystal size={28} />
          <div className="min-w-0 flex-1 text-xs">
            <div className="font-bold text-cyan-600 dark:text-cyan-300">
              Điểm hồi sinh: {deathReport.respawnedAtCheckpoint}
            </div>
            <div className="mt-0.5 text-sub">
              Hồi sinh với <strong className="font-mono text-emerald-500">{deathReport.respawnHp} HP (75%)</strong>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 border p-2.5 text-[11px] text-sub studio-subtle rpg-divider rounded-[2px]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <span>
            <strong>Bảo toàn thành quả:</strong> Cây Kĩ Năng, Điểm Kĩ Năng (SP), Runestones 💎 và các Chương đã mở khóa vẫn an toàn 100%.
          </span>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onAcknowledge();
            } finally {
              setBusy(false);
            }
          }}
          className="btn-primary mt-5 flex w-full items-center justify-center gap-2 py-2.5 text-xs font-extrabold"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PixelCheckpointCrystal size={16} />}
          <span>Hồi Sinh Tại Checkpoint</span>
        </button>
      </div>
    </div>
  );
};
