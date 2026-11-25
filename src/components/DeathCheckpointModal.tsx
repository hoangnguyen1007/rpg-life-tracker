import React, { useState } from 'react';
import type { DeathReport } from '../types/system';
import { PixelCheckpointCrystal, PixelTombstone } from './DungeonSprites';
import {
  PixelRivets,
  PxCoin,
  PxRefresh,
  PxShield,
  PxSkull,
  PxSparkle,
} from './PixelIcons';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="rpg-window relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-none border-[var(--px-red)] p-6">
        <PixelRivets />

        <div className="flex items-center gap-3 border-b-2 border-[var(--px-red)] pb-4">
          <div className="px-inset flex h-12 w-12 shrink-0 items-center justify-center rounded-none border-2 border-[var(--px-red)]">
            <PixelTombstone size={34} />
          </div>
          <div>
            <p className="font-pixel flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-[var(--px-red-text)]">
              <PxSkull size={12} color="var(--px-red-text)" />
              <span>CHECKPOINT ROLLBACK</span>
            </p>
            <h2 className="font-display text-base font-extrabold text-main sm:text-lg">
              KIỆT SỨC TRONG HẦM NGỤC · QUAY VỀ CHECKPOINT
            </h2>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-sub">{deathReport.causeSummary}</p>

        {/* Missed Quests List */}
        {deathReport.missedQuests.length > 0 && (
          <div className="px-inset mt-4 rounded-none p-3">
            <p className="mb-2 font-display text-xs font-bold text-[var(--px-red-text)]">
              Nhiệm vụ bỏ lỡ gây sát thương (-{deathReport.totalHpDamage} HP):
            </p>
            <div className="max-h-36 space-y-1.5 overflow-y-auto text-xs">
              {deathReport.missedQuests.map((mq, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 border-b pb-1 last:border-b-0 last:pb-0 rpg-divider"
                >
                  <span className="truncate text-main">{mq.title}</span>
                  <span className="shrink-0 font-mono font-bold text-[var(--px-red-text)]">
                    -{mq.hpDamage} HP
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Penalties & Checkpoint Respawn Grid */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
          <div className="px-inset rounded-none border-[var(--px-red)] p-3">
            <div className="flex items-center gap-1.5 font-semibold text-[var(--px-red-text)]">
              <PxCoin size={13} />
              <span>Gold bị mất (-25%)</span>
            </div>
            <div className="mt-1 font-mono text-base font-extrabold text-main">
              -{deathReport.goldLost} G
            </div>
          </div>

          <div className="px-inset rounded-none border-[var(--px-gold)] p-3">
            <div className="flex items-center gap-1.5 font-semibold text-[var(--px-gold-text)]">
              <PxSparkle size={13} />
              <span>EXP bị mất (-30%)</span>
            </div>
            <div className="mt-1 font-mono text-base font-extrabold text-main">
              -{deathReport.xpLost} XP
            </div>
          </div>
        </div>

        {/* Respawn Checkpoint */}
        <div className="mt-4 flex items-center gap-3 rounded-none border-2 border-[var(--px-blue)] bg-[var(--px-blue)]/15 p-3.5">
          <PixelCheckpointCrystal size={28} />
          <div className="min-w-0 flex-1 text-xs">
            <div className="font-bold text-[var(--px-blue-text)]">
              Điểm hồi sinh: {deathReport.respawnedAtCheckpoint}
            </div>
            <div className="mt-0.5 text-sub">
              Hồi sinh với{' '}
              <strong className="font-mono text-[var(--px-green-text)]">
                {deathReport.respawnHp} HP (75%)
              </strong>
            </div>
          </div>
        </div>

        <div className="px-inset mt-3 flex items-start gap-2 rounded-none p-2.5 text-[11px] text-sub">
          <PxShield size={15} color="var(--px-green-text)" className="mt-0.5" />
          <span>
            <strong>Bảo toàn thành quả:</strong> Cây Kĩ Năng, Điểm Kĩ Năng (SP), Runestones và các Chương đã mở khóa vẫn an toàn 100%.
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
          className="btn-primary mt-5 flex w-full items-center justify-center gap-2 rounded-none py-2.5 text-xs font-extrabold"
        >
          {busy ? (
            <PxRefresh size={15} className="animate-spin" />
          ) : (
            <PixelCheckpointCrystal size={16} />
          )}
          <span>Hồi Sinh Tại Checkpoint</span>
        </button>
      </div>
    </div>
  );
};
