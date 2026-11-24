import React from 'react';
import { Brain, Ghost, Repeat, Sparkles, Zap } from 'lucide-react';
import type { ShadowSoldier } from '../types/system';
import { ShadowIllustration } from './VisualIllustrations';

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
      <section className="studio-surface p-5">
        <div className="flex items-start gap-3">
          <Ghost className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-extrabold text-main">
              Đội Quân Bóng Tối — Shadow Army ({shadows.length})
            </h2>
            <p className="mt-0.5 text-xs text-sub">
              Mỗi khi hoàn tất các cột mốc của một Boss Chiến dịch bằng Proof-of-Work, bạn chiết xuất được một Shadow Soldier đại diện cho thói quen tinh anh. Triệu hồi Shadow để đưa ngay vào danh sách nhiệm vụ hôm nay.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-[2px] border-2 border-violet-500/40 bg-violet-500/10 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-[2px] border border-violet-500/40 bg-violet-500/15 p-2 text-violet-300">
              <Brain className="h-4 w-4" />
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-xs font-extrabold uppercase tracking-wide text-violet-300">
                  Khoa học Hình thành Thói quen Tự động (Wood / Fogg / Huberman)
                </h3>
                <span className="inline-flex items-center gap-1 rounded-[2px] border border-violet-500/40 px-2 py-0.5 font-mono text-[10px] font-bold text-violet-300 studio-subtle">
                  <Repeat className="h-3 w-3" />
                  Cue → Routine → Reward
                </span>
              </div>
              <p className="text-xs leading-relaxed text-sub">
                Theo nghiên cứu hành vi của <strong className="text-main">Wendy Wood</strong>, <strong className="text-main">BJ Fogg</strong> và <strong className="text-main">Andrew Huberman</strong>, việc lặp lại có chủ đích một vòng lặp{' '}
                <strong className="text-main">Tín hiệu kích hoạt (Cue) – Hành động nhỏ (Routine) – Phần thưởng ngay lập tức (Reward)</strong> giúp bao myelin hóa (myelination) các đường dẫn truyền thần kinh tại hạch nền (basal ganglia). Khi đủ số lần lặp, thói quen giảm dần ma sát ý chí và tự động vận hành bền bỉ như một Shadow Soldier thực thụ.
              </p>
            </div>
          </div>
        </div>
      </section>

      {shadows.length === 0 ? (
        <section className="studio-surface p-10 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-violet-400" />
          <h3 className="mt-3 font-display text-base font-bold text-main">
            Chưa có Shadow Soldier nào
          </h3>
          <p className="mt-1 text-xs text-sub">
            Hãy chinh phục hoàn toàn một Boss Chương ở tab <strong>Chiến Dịch</strong> bằng Proof-of-Work để kích hoạt lệnh <strong>ARISE</strong>!
          </p>
        </section>
      ) : (
        <section className="studio-surface overflow-hidden">
          <div className="grid grid-cols-1 divide-y-2 md:grid-cols-2 lg:grid-cols-3 lg:divide-x-2 lg:divide-y-0 studio-divider">
            {shadows.map((sh) => (
              <div key={sh.id} className="flex flex-col justify-between p-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <ShadowIllustration name={sh.name} />
                    <div>
                      <span className="font-pixel text-[10px] font-bold text-violet-400">
                        {sh.rank}-RANK · {sh.summonCount}x
                      </span>
                      <h3 className="font-display text-sm font-extrabold text-main">{sh.name}</h3>
                      <p className="text-[11px] text-dim">{sh.title}</p>
                    </div>
                  </div>

                  <p className="rounded-[2px] border-2 p-2.5 text-xs text-sub studio-subtle studio-divider">
                    <strong className="text-violet-300">Buff:</strong> {sh.passiveBuff}
                  </p>

                  <div className="text-xs">
                    <p className="font-bold text-main">{sh.routineTitle}</p>
                    <p className="mt-0.5 text-sub">{sh.routineDescription}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSummonShadow(sh.id)}
                  className="btn-arcane mt-4 flex w-full items-center justify-center gap-1.5 py-2 text-xs"
                >
                  <Zap className="h-4 w-4" />
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
