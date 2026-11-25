import React from 'react';
import type { ShadowSoldier } from '../types/system';
import { ShadowIllustration } from './VisualIllustrations';
import {
  PixelRivets,
  PxBolt,
  PxBook,
  PxGhost,
  PxRefresh,
  PxSparkle,
} from './PixelIcons';

interface ShadowArmyModalProps {
  shadows: ShadowSoldier[];
  onSummonShadow: (shadowId: string) => Promise<void>;
}

export const ShadowArmyModal: React.FC<ShadowArmyModalProps> = ({
  shadows,
  onSummonShadow,
}) => {
  return (
    <div className="space-y-4">
      <section className="studio-surface relative rounded-none p-5">
        <PixelRivets />

        <div className="flex items-start gap-3">
          <div className="px-inset flex h-10 w-10 shrink-0 items-center justify-center rounded-none">
            <PxGhost size={20} color="var(--px-plum-text)" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-extrabold text-main">
              Đội Quân Bóng Tối — Shadow Army ({shadows.length})
            </h2>
            <p className="mt-0.5 text-xs text-sub">
              Mỗi khi hoàn tất các cột mốc của một Boss Chiến dịch bằng Proof-of-Work, bạn chiết xuất được một Shadow Soldier đại diện cho thói quen tinh anh. Triệu hồi Shadow để đưa ngay vào danh sách nhiệm vụ hôm nay.
            </p>
          </div>
        </div>

        <div className="px-inset mt-4 rounded-none border-[var(--px-plum)] p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-none border-2 border-[var(--border-ink)] bg-[var(--px-plum)] text-white">
              <PxBook size={15} />
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-xs font-extrabold uppercase tracking-wide text-[var(--px-plum-text)]">
                  Khoa học Hình thành Thói quen Tự động (Wood / Fogg / Huberman)
                </h3>
                <span className="inline-flex items-center gap-1 rounded-none border border-[var(--px-plum)] bg-[var(--bg-surface)] px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--px-plum-text)]">
                  <PxRefresh size={11} />
                  Cue → Routine → Reward
                </span>
              </div>
              <p className="text-xs leading-relaxed text-sub">
                Theo nghiên cứu hành vi của <strong className="text-main">Wendy Wood</strong>,{' '}
                <strong className="text-main">BJ Fogg</strong> và{' '}
                <strong className="text-main">Andrew Huberman</strong>, việc lặp lại có chủ đích một vòng lặp{' '}
                <strong className="text-main">
                  Tín hiệu kích hoạt (Cue) – Hành động nhỏ (Routine) – Phần thưởng ngay lập tức (Reward)
                </strong>{' '}
                giúp bao myelin hóa (myelination) các đường dẫn truyền thần kinh tại hạch nền (basal ganglia). Khi đủ số lần lặp, thói quen giảm dần ma sát ý chí và tự động vận hành bền bỉ như một Shadow Soldier thực thụ.
              </p>
            </div>
          </div>
        </div>
      </section>

      {shadows.length === 0 ? (
        <section className="studio-surface relative rounded-none p-10 text-center">
          <PixelRivets />
          <div className="mx-auto flex h-12 w-12 items-center justify-center border-2 border-[var(--border-ink)] bg-[var(--px-plum)] text-white">
            <PxSparkle size={22} />
          </div>
          <h3 className="mt-3 font-display text-base font-bold text-main">
            Chưa có Shadow Soldier nào
          </h3>
          <p className="mt-1 text-xs text-sub">
            Hãy chinh phục hoàn toàn một Boss Chương ở tab <strong>Hành Trình</strong> bằng Proof-of-Work để kích hoạt lệnh <strong>ARISE</strong>!
          </p>
        </section>
      ) : (
        <section className="studio-surface relative overflow-hidden rounded-none">
          <PixelRivets />
          <div className="grid grid-cols-1 divide-y-2 md:grid-cols-2 lg:grid-cols-3 lg:divide-x-2 lg:divide-y-0 studio-divider">
            {shadows.map((sh) => (
              <div key={sh.id} className="flex flex-col justify-between p-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <ShadowIllustration name={sh.name} />
                    <div>
                      <span className="font-pixel text-[10px] font-bold text-[var(--px-plum-text)]">
                        {sh.rank}-RANK · {sh.summonCount}x
                      </span>
                      <h3 className="font-display text-sm font-extrabold text-main">
                        {sh.name}
                      </h3>
                      <p className="text-[11px] text-dim">{sh.title}</p>
                    </div>
                  </div>

                  <p className="px-inset rounded-none p-2.5 text-xs text-sub">
                    <strong className="text-[var(--px-plum-text)]">Buff:</strong>{' '}
                    {sh.passiveBuff}
                  </p>

                  <div className="text-xs">
                    <p className="font-bold text-main">{sh.routineTitle}</p>
                    <p className="mt-0.5 text-sub">{sh.routineDescription}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void onSummonShadow(sh.id)}
                  className="btn-arcane mt-4 flex w-full items-center justify-center gap-1.5 rounded-none py-2 text-xs"
                >
                  <PxBolt size={14} color="#ffffff" />
                  <span>Triệu hồi hôm nay</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
