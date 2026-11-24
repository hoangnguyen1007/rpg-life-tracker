import React, { useState } from 'react';
import {
  Backpack,
  CheckCircle2,
  Coins,
  Gem,
  Gift,
  Plus,
  Shield,
  ShoppingBag,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import type {
  InventoryItem,
  PlayerState,
  ShopItem,
  ShopItemCategory,
} from '../types/system';

interface ShopAndInventoryViewProps {
  player: PlayerState;
  shopItems: ShopItem[];
  inventory: InventoryItem[];
  onBuyItem: (itemId: string) => Promise<void>;
  onUseItem: (inventoryId: string) => Promise<void>;
  onCreateCustomReward: (payload: {
    name: string;
    description?: string;
    currency: 'gold' | 'runestones';
    price: number;
  }) => Promise<void>;
  onDeleteCustomReward?: (itemId: string) => Promise<void>;
}

const CAT_LABELS: Record<ShopItemCategory, { title: string; icon: React.ReactNode }> = {
  artifact: { title: 'Trang bị Tăng trưởng (Hiệu lực vĩnh viễn khi mang)', icon: <Shield className="h-4 w-4 shrink-0 text-amber-400" /> },
  consumable: { title: 'Vật phẩm Hỗ trợ Phiên học / Hồi phục', icon: <Zap className="h-4 w-4 shrink-0 text-emerald-400" /> },
  real_reward: { title: 'Phần thưởng Tự thưởng Thực tế (Guilt-Free)', icon: <Gift className="h-4 w-4 shrink-0 text-cyan-400" /> },
};

export const ShopAndInventoryView: React.FC<ShopAndInventoryViewProps> = ({
  player,
  shopItems,
  inventory,
  onBuyItem,
  onUseItem,
  onCreateCustomReward,
  onDeleteCustomReward,
}) => {
  const [filter, setFilter] = useState<'all' | ShopItemCategory>('all');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customCurrency, setCustomCurrency] = useState<'gold' | 'runestones'>('gold');
  const [customPrice, setCustomPrice] = useState(200);

  const categories: ShopItemCategory[] =
    filter === 'all' ? ['artifact', 'consumable', 'real_reward'] : [filter];

  return (
    <div className="space-y-4">
      {/* Economy Overview & Earning Guide */}
      <section className="studio-surface p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-lg font-extrabold text-main">
              Cửa Hàng Hệ Thống &amp; Kho Trang Bị Phát Triển Bản Thân
            </h2>
            <p className="mt-1 text-xs text-sub">
              Gold &amp; Runestones chỉ kiếm được từ nỗ lực thực tế — dùng để nâng Cây Kĩ Năng, mua trang bị hỗ trợ hoặc tự thưởng xứng đáng không áy náy.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-[2px] border-2 px-3.5 py-2 studio-subtle studio-divider">
              <Coins className="h-4 w-4 shrink-0 text-amber-400" />
              <div>
                <div className="font-mono text-sm font-bold text-amber-400 whitespace-nowrap">{player.gold} Gold</div>
                <div className="text-[10px] text-dim">Từ hoàn thành Quest</div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-[2px] border-2 px-3.5 py-2 studio-subtle studio-divider">
              <Gem className="h-4 w-4 shrink-0 text-cyan-400" />
              <div>
                <div className="font-mono text-sm font-bold text-cyan-400 whitespace-nowrap">{player.runestones} Runestones</div>
                <div className="text-[10px] text-dim">Từ Proof-of-Work &amp; Boss</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 border-t-2 pt-3.5 text-xs text-sub studio-divider sm:grid-cols-3">
          <div>
            <strong className="text-main">1. Gold:</strong> Nhận khi hoàn thành Daily/Main/Side Quest và Focus Mode (+25%).
          </div>
          <div>
            <strong className="text-main">2. Runestones (💎):</strong> Nhận khi có <em>Proof-of-Work</em>, nâng Tier Kỹ năng hoặc hạ Boss Chương.
          </div>
          <div>
            <strong className="text-main">3. Active Buffs:</strong>{' '}
            {player.activeBuffs.length > 0 ? player.activeBuffs.join(', ') : 'Chưa kích hoạt buff tiêu hao nào'}
          </div>
        </div>
      </section>

      {/* Inventory */}
      <section className="studio-surface overflow-hidden">
        <div className="flex items-center justify-between border-b-2 px-5 py-3.5 studio-divider">
          <div className="flex items-center gap-2">
            <Backpack className="h-4 w-4 shrink-0 text-amber-400" />
            <h3 className="font-display text-sm font-extrabold text-main">
              Kho Đồ &amp; Trang Bị Hiện Có ({inventory.length})
            </h3>
          </div>
        </div>

        {inventory.length === 0 ? (
          <div className="p-6 text-center text-xs text-dim">
            Kho đồ đang trống. Hãy hoàn thành nhiệm vụ để tích Gold &amp; Runestones mua trang bị đầu tiên!
          </div>
        ) : (
          <div className="divide-y-2 studio-divider">
            {inventory.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-col gap-2.5 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-main">{inv.name}</span>
                    {inv.category === 'artifact' ? (
                      inv.equipped && (
                        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[2px] border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Đang trang bị
                        </span>
                      )
                    ) : (
                      <span className="shrink-0 font-mono text-xs font-bold text-amber-400">x{inv.quantity}</span>
                    )}
                    <span className="inline-flex shrink-0 items-center rounded-[2px] border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-400">
                      {inv.effectLabel}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-sub">{inv.description}</p>
                </div>

                <button
                  type="button"
                  onClick={() => onUseItem(inv.id)}
                  className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 text-xs ${
                    inv.equipped ? 'btn-secondary' : 'btn-emerald'
                  }`}
                >
                  {inv.category === 'artifact'
                    ? inv.equipped
                      ? 'Tháo ra'
                      : 'Trang bị'
                    : inv.category === 'real_reward'
                      ? 'Quy đổi thưởng'
                      : 'Sử dụng'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Shop Catalog */}
      <section className="studio-surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b-2 px-5 py-3.5 lg:flex-row lg:items-center lg:justify-between studio-divider">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 shrink-0 text-amber-400" />
            <h3 className="font-display text-sm font-extrabold text-main">Cửa Hàng Hệ Thống</h3>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { k: 'all' as const, label: 'Tất cả' },
              { k: 'artifact' as const, label: 'Trang Bị Buff' },
              { k: 'consumable' as const, label: 'Hỗ Trợ & Hồi Phục' },
              { k: 'real_reward' as const, label: 'Thưởng Thực Tế' },
            ].map((t) => (
              <button
                key={t.k}
                type="button"
                onClick={() => setFilter(t.k)}
                className={filter === t.k ? 'btn-primary px-3 py-1.5 text-xs' : 'btn-secondary px-3 py-1.5 text-xs'}
              >
                {t.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setShowCustomForm((v) => !v)}
              className="btn-secondary flex items-center gap-1 px-3 py-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tạo thưởng riêng</span>
            </button>
          </div>
        </div>

        {showCustomForm && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!customName.trim()) return;
              await onCreateCustomReward({
                name: customName.trim(),
                description: customDesc.trim(),
                currency: customCurrency,
                price: customPrice,
              });
              setCustomName('');
              setCustomDesc('');
              setShowCustomForm(false);
            }}
            className="space-y-3 border-b-2 p-4 studio-subtle studio-divider"
          >
            <p className="text-xs font-semibold text-main">Thêm phần thưởng ngoài đời thực của riêng bạn:</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="VD: Mua sách mới / 1 buổi nghỉ giải trí..."
                className="px-3 py-2 text-xs sm:col-span-2"
              />
              <select
                value={customCurrency}
                onChange={(e) => setCustomCurrency(e.target.value as 'gold' | 'runestones')}
                className="px-2.5 py-2 text-xs"
              >
                <option value="gold">Mua bằng Gold</option>
                <option value="runestones">Mua bằng Runestones</option>
              </select>
              <input
                type="number"
                min={1}
                value={customPrice}
                onChange={(e) => setCustomPrice(Number(e.target.value))}
                className="px-2.5 py-2 text-xs"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                placeholder="Mô tả phần thưởng..."
                className="flex-1 px-3 py-1.5 text-xs"
              />
              <button type="submit" className="btn-primary shrink-0 px-4 py-1.5 text-xs">
                Lưu vào Shop
              </button>
            </div>
          </form>
        )}

        <div className="divide-y-2 studio-divider">
          {categories.map((cat) => {
            const items = shopItems.filter((i) => i.category === cat);
            if (items.length === 0) return null;
            const meta = CAT_LABELS[cat];
            return (
              <div key={cat} className="p-4 sm:p-5">
                <div className="mb-2.5 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-main">
                  {meta.icon}
                  <span>{meta.title}</span>
                </div>
                <div className="divide-y-2 studio-divider">
                  {items.map((item) => {
                    const ownedArtifact =
                      item.category === 'artifact' &&
                      inventory.some((inv) => inv.itemId === item.id);
                    const canAfford =
                      item.currency === 'gold'
                        ? player.gold >= item.price
                        : player.runestones >= item.price;

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-2.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-main">{item.name}</span>
                            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[2px] border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-400">
                              <Sparkles className="h-3 w-3 shrink-0" /> {item.effectLabel}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-sub">{item.description}</p>
                        </div>

                        <div className="flex shrink-0 items-center justify-between gap-2.5 sm:justify-end">
                          <span className="whitespace-nowrap font-mono text-xs font-bold text-amber-400">
                            {item.price} {item.currency === 'gold' ? 'G' : '💎'}
                          </span>
                          <button
                            type="button"
                            disabled={ownedArtifact || !canAfford}
                            onClick={() => onBuyItem(item.id)}
                            className="btn-primary shrink-0 whitespace-nowrap px-3.5 py-1.5 text-xs"
                          >
                            {ownedArtifact ? 'Đã sở hữu' : canAfford ? 'Mua' : 'Chưa đủ'}
                          </button>
                          {item.isCustom && onDeleteCustomReward && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Xóa phần thưởng "${item.name}"?`)) {
                                  void onDeleteCustomReward(item.id);
                                }
                              }}
                              className="btn-secondary p-1.5 text-dim hover:text-rose-500"
                              title="Xóa phần thưởng tự tạo"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
