import React, { useEffect, useMemo, useState } from 'react';
import {
  Backpack,
  Check,
  Filter,
  Plus,
  Search,
  Shield,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type {
  EquipmentSlot,
  InventoryItem,
  ItemRarity,
  PlayerState,
  ShopItem,
  ShopItemCategory,
} from '../types/system';
import { PixelHeroSprite } from './DungeonSprites';
import {
  CUSTOM_REWARD_ICON_OPTIONS,
  EQUIPMENT_SLOT_META,
  ITEM_RARITY_META,
  PixelCurrencyIcon,
  PixelItemSprite,
  PixelSlotSilhouette,
  resolveItemIconKey,
} from './PixelItemSprites';

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
    iconKey?: string;
    rarity?: ItemRarity;
  }) => Promise<void>;
  onDeleteCustomReward?: (itemId: string) => Promise<void>;
}

const RARITY_RANK: Record<ItemRarity, number> = {
  COMMON: 1,
  RARE: 2,
  EPIC: 3,
  LEGENDARY: 4,
  MYTHIC: 5,
};

const LEFT_PAPERDOLL_SLOTS: EquipmentSlot[] = ['helm', 'weapon', 'tome'];
const RIGHT_PAPERDOLL_SLOTS: EquipmentSlot[] = ['armor', 'accessory', 'boots'];

const CAT_LABELS: Record<ShopItemCategory, string> = {
  artifact: 'Trang Bị',
  consumable: 'Tiêu Hao',
  real_reward: 'Thưởng Đời Thực',
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
  const [catFilter, setCatFilter] = useState<'all' | ShopItemCategory>('all');
  const [minRarity, setMinRarity] = useState<'all' | 'RARE' | 'EPIC' | 'LEGENDARY'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedShopId, setSelectedShopId] = useState<string>(
    () => shopItems[0]?.id || ''
  );
  const [selectedInvId, setSelectedInvId] = useState<string | null>(
    () => inventory[0]?.id || null
  );
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  // Custom Reward Creator
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customCurrency, setCustomCurrency] = useState<'gold' | 'runestones'>('gold');
  const [customPrice, setCustomPrice] = useState(200);
  const [customIconKey, setCustomIconKey] = useState('gift_box');
  const [customRarity, setCustomRarity] = useState<ItemRarity>('RARE');

  const equippedBySlot = useMemo(() => {
    const map = new Map<EquipmentSlot, InventoryItem>();
    for (const inv of inventory) {
      if (inv.equipped && inv.slot) {
        map.set(inv.slot, inv);
      }
    }
    return map;
  }, [inventory]);

  const equippedArtifacts = useMemo(
    () => inventory.filter((inv) => inv.equipped),
    [inventory]
  );

  const ownedArtifactIds = useMemo(
    () =>
      new Set(
        inventory.filter((i) => i.category === 'artifact').map((i) => i.itemId)
      ),
    [inventory]
  );

  const filteredShopItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const minRank = minRarity === 'all' ? 0 : RARITY_RANK[minRarity];
    return shopItems.filter((item) => {
      if (catFilter !== 'all' && item.category !== catFilter) return false;
      const r: ItemRarity = item.rarity || 'COMMON';
      if (RARITY_RANK[r] < minRank) return false;
      if (q) {
        const hay = `${item.name} ${item.effectLabel} ${item.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [shopItems, catFilter, minRarity, searchQuery]);

  useEffect(() => {
    if (
      filteredShopItems.length > 0 &&
      !filteredShopItems.some((i) => i.id === selectedShopId)
    ) {
      setSelectedShopId(filteredShopItems[0].id);
    }
  }, [filteredShopItems, selectedShopId]);

  useEffect(() => {
    if (inventory.length === 0) {
      setSelectedInvId(null);
      return;
    }
    if (!selectedInvId || !inventory.some((i) => i.id === selectedInvId)) {
      setSelectedInvId(inventory[0].id);
    }
  }, [inventory, selectedInvId]);

  const selectedShopItem =
    shopItems.find((i) => i.id === selectedShopId) || filteredShopItems[0] || null;
  const selectedInvItem =
    inventory.find((i) => i.id === selectedInvId) || inventory[0] || null;

  const backpackCapacity = Math.max(18, Math.ceil(inventory.length / 6) * 6);
  const backpackSlots: Array<InventoryItem | null> = Array.from(
    { length: backpackCapacity },
    (_, idx) => inventory[idx] ?? null
  );

  const handleBuy = async (item: ShopItem) => {
    if (busyActionId) return;
    setBusyActionId(item.id);
    try {
      await onBuyItem(item.id);
    } finally {
      setBusyActionId(null);
    }
  };

  const handleUse = async (inv: InventoryItem) => {
    if (busyActionId) return;
    setBusyActionId(inv.id);
    try {
      await onUseItem(inv.id);
    } finally {
      setBusyActionId(null);
    }
  };

  const renderPaperDollSlot = (slot: EquipmentSlot) => {
    const equipped = equippedBySlot.get(slot) || null;
    const meta = EQUIPMENT_SLOT_META[slot];
    const rarity: ItemRarity = equipped?.rarity || 'COMMON';
    const rMeta = ITEM_RARITY_META[rarity];
    const isSelected = Boolean(equipped && selectedInvItem?.id === equipped.id);

    return (
      <button
        key={slot}
        type="button"
        onClick={() => {
          if (equipped) setSelectedInvId(equipped.id);
        }}
        title={equipped ? `${equipped.name} (${equipped.effectLabel})` : `Ô trống: ${meta.label}`}
        className={`relative flex h-16 w-16 flex-col items-center justify-center rounded-[2px] border-2 transition ${
          equipped
            ? `${rMeta.borderCls} ${rMeta.bgCls} ${
                isSelected ? 'ring-2 ring-amber-400' : 'hover:brightness-110'
              }`
            : 'border-dashed studio-subtle rpg-divider opacity-75'
        }`}
        style={
          equipped
            ? { boxShadow: `inset 0 0 10px ${rMeta.glowHex}` }
            : undefined
        }
      >
        {equipped ? (
          <>
            <PixelItemSprite
              iconKey={resolveItemIconKey(equipped)}
              size={38}
              rarity={rarity}
            />
            <span className="font-pixel absolute -bottom-1.5 left-1/2 -translate-x-1/2 border border-emerald-400/70 bg-emerald-600 px-1 py-0.5 text-[7px] font-bold leading-none text-white rounded-[1px]">
              {meta.shortLabel}
            </span>
          </>
        ) : (
          <>
            <PixelSlotSilhouette slot={slot} size={26} />
            <span className="font-pixel mt-0.5 text-[7px] font-bold text-dim">
              {meta.shortLabel}
            </span>
          </>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* 1) Top RPG Economy Bar */}
      <section className="studio-surface px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-[2px] border-2 border-amber-500/50 bg-amber-500/10 px-3 py-1.5">
              <PixelCurrencyIcon type="gold" size={18} />
              <span className="font-mono text-sm font-extrabold text-amber-400">
                {player.gold.toLocaleString()} G
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-[2px] border-2 border-sky-500/50 bg-sky-500/10 px-3 py-1.5">
              <PixelCurrencyIcon type="runestones" size={18} />
              <span className="font-mono text-sm font-extrabold text-cyan-400">
                {player.runestones.toLocaleString()} 💎
              </span>
            </div>

            <div className="flex items-center gap-1.5 rounded-[2px] border-2 px-2.5 py-1.5 font-mono text-xs text-sub studio-subtle rpg-divider">
              <Shield className="h-3.5 w-3.5 text-emerald-400" />
              <span>
                Trang bị: <strong className="text-main">{equippedBySlot.size}/6</strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {player.activeBuffs.length > 0 ? (
              player.activeBuffs.map((buff) => (
                <span
                  key={buff}
                  className="inline-flex items-center gap-1 rounded-[2px] border border-violet-500/60 bg-violet-500/15 px-2 py-1 font-mono text-[11px] font-bold text-violet-300"
                >
                  <Sparkles className="h-3 w-3 text-amber-400" />
                  {buff === 'OVERDRIVE_1.5X'
                    ? 'Overdrive x1.5 XP/Gold'
                    : buff === 'DOUBLE_XP_2X'
                      ? 'Tinh Thể x2.0 XP'
                      : buff === 'ESPRESSO_FOCUS'
                        ? 'Espresso +15% XP'
                        : buff}
                </span>
              ))
            ) : (
              <span className="font-mono text-[11px] text-dim">
                Chưa bật buff tiêu hao
              </span>
            )}
          </div>
        </div>
      </section>

      {/* 2) Paper-Doll Equipment Loadout + Recessed Grid Backpack */}
      <section className="studio-surface overflow-hidden">
        <div className="flex items-center justify-between border-b-2 px-4 py-3 sm:px-5 rpg-divider">
          <div className="flex items-center gap-2">
            <Backpack className="h-4 w-4 text-amber-400" />
            <h3 className="font-display text-sm font-extrabold text-main">
              Trang Bị &amp; Túi Đồ ({inventory.length}/{backpackCapacity} Ô)
            </h3>
          </div>
          <span className="font-mono text-[11px] text-dim">
            Bấm ô bất kỳ để xem chi tiết &amp; trang bị / sử dụng
          </span>
        </div>

        <div className="grid grid-cols-1 divide-y-2 lg:grid-cols-12 lg:divide-x-2 lg:divide-y-0 rpg-divider">
          {/* Left 5 cols: 6-Slot Hero Paper-Doll Loadout */}
          <div className="p-4 sm:p-5 lg:col-span-5">
            <div className="flex items-center justify-between gap-2 rounded-[2px] border-2 bg-[#0b0e16] p-3.5 rpg-divider">
              <div className="flex flex-col gap-2.5">
                {LEFT_PAPERDOLL_SLOTS.map(renderPaperDollSlot)}
              </div>

              <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-2 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-[2px] border-2 border-amber-500/45 bg-[#141927]">
                  <PixelHeroSprite
                    rank={player.rank}
                    avatarStyle={player.profile.avatarStyle}
                    size={64}
                  />
                </div>
                <div className="mt-2 truncate font-display text-xs font-extrabold text-slate-100">
                  {player.profile.name}
                </div>
                <div className="font-pixel text-[9px] text-amber-400">{player.rank}</div>
              </div>

              <div className="flex flex-col gap-2.5">
                {RIGHT_PAPERDOLL_SLOTS.map(renderPaperDollSlot)}
              </div>
            </div>

            {/* Active Equipped Passive Bonuses Strip */}
            <div className="mt-3 rounded-[2px] border-2 p-2.5 studio-subtle rpg-divider">
              <div className="font-pixel text-[8px] font-bold uppercase text-amber-400">
                HIỆU ỨNG TRANG BỊ ĐANG KÍCH HOẠT ({equippedArtifacts.length})
              </div>
              {equippedArtifacts.length === 0 ? (
                <p className="mt-1 text-[11px] text-dim">
                  Chưa mang trang bị nào. Mua ở Cửa Hàng bên dưới để tự động gắn vào ô trống!
                </p>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {equippedArtifacts.map((eq) => (
                    <span
                      key={eq.id}
                      className="inline-flex items-center gap-1 rounded-[2px] border border-emerald-500/45 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-400"
                    >
                      {eq.effectLabel}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right 7 cols: Recessed Square RPG Grid Backpack + Selected Item Action */}
          <div className="flex flex-col justify-between p-4 sm:p-5 lg:col-span-7">
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-6">
              {backpackSlots.map((slotItem, idx) => {
                if (!slotItem) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="flex aspect-square items-center justify-center rounded-[2px] border-2 border-dashed studio-subtle rpg-divider opacity-45"
                    >
                      <span className="h-1.5 w-1.5 rounded-[1px] bg-slate-600/60" />
                    </div>
                  );
                }

                const rarity: ItemRarity = slotItem.rarity || 'COMMON';
                const rMeta = ITEM_RARITY_META[rarity];
                const isSelected = selectedInvItem?.id === slotItem.id;

                return (
                  <button
                    key={slotItem.id}
                    type="button"
                    onClick={() => setSelectedInvId(slotItem.id)}
                    onDoubleClick={() => void handleUse(slotItem)}
                    title={`${slotItem.name} — ${slotItem.effectLabel}`}
                    className={`relative flex aspect-square items-center justify-center rounded-[2px] border-2 transition ${rMeta.borderCls} ${rMeta.bgCls} ${
                      isSelected ? 'ring-2 ring-amber-400 brightness-110' : 'hover:brightness-110'
                    }`}
                    style={{ boxShadow: `inset 0 0 8px ${rMeta.glowHex}` }}
                  >
                    <PixelItemSprite
                      iconKey={resolveItemIconKey(slotItem)}
                      size={36}
                      rarity={rarity}
                    />
                    {slotItem.equipped && (
                      <span className="font-pixel absolute left-0.5 top-0.5 rounded-[1px] bg-emerald-600 px-1 py-0.5 text-[7px] font-bold leading-none text-white">
                        E
                      </span>
                    )}
                    {slotItem.category !== 'artifact' && (
                      <span className="font-mono absolute bottom-0.5 right-0.5 rounded-[1px] bg-[#0b0e16]/90 px-1 text-[9px] font-bold leading-tight text-amber-300">
                        x{slotItem.quantity}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected Backpack Item Inspector Strip */}
            {selectedInvItem ? (() => {
              const r: ItemRarity = selectedInvItem.rarity || 'COMMON';
              const rMeta = ITEM_RARITY_META[r];
              const isBusy = busyActionId === selectedInvItem.id;
              return (
                <div className="mt-3 flex flex-col gap-3 rounded-[2px] border-2 p-3 sm:flex-row sm:items-center sm:justify-between studio-subtle rpg-divider">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[2px] border-2 ${rMeta.borderCls} ${rMeta.bgCls}`}
                    >
                      <PixelItemSprite
                        iconKey={resolveItemIconKey(selectedInvItem)}
                        size={42}
                        rarity={r}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate font-display text-xs font-extrabold text-main">
                          {selectedInvItem.name}
                        </span>
                        <span
                          className={`font-pixel rounded-[2px] border px-1.5 py-0.5 text-[8px] font-bold ${rMeta.badgeCls}`}
                        >
                          {rMeta.label}
                        </span>
                        {selectedInvItem.slot && (
                          <span className="rounded-[2px] border px-1.5 py-0.5 font-mono text-[10px] text-sub rpg-divider">
                            {EQUIPMENT_SLOT_META[selectedInvItem.slot].label}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] font-semibold text-amber-400">
                        {selectedInvItem.effectLabel}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-sub">
                        {selectedInvItem.description}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleUse(selectedInvItem)}
                    className={`shrink-0 px-4 py-2 text-xs ${
                      selectedInvItem.equipped ? 'btn-secondary' : 'btn-emerald'
                    }`}
                  >
                    {selectedInvItem.category === 'artifact'
                      ? selectedInvItem.equipped
                        ? 'Tháo ra'
                        : 'Trang bị'
                      : selectedInvItem.category === 'real_reward'
                        ? 'Quy đổi thưởng'
                        : 'Sử dụng ngay'}
                  </button>
                </div>
              );
            })() : (
              <div className="mt-3 rounded-[2px] border-2 p-3 text-center text-xs text-dim studio-subtle rpg-divider">
                Kho đồ đang trống — mua trang bị hoặc thuốc hồi phục ở Cửa Hàng bên dưới.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3) Game-Style Merchant Shop (Slot Grid + Sticky Inspector) */}
      <section className="studio-surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b-2 px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between sm:px-5 rpg-divider">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-amber-400" />
            <h3 className="font-display text-sm font-extrabold text-main">
              Cửa Hàng Vật Phẩm ({filteredShopItems.length}/{shopItems.length})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { k: 'all', label: 'Tất cả' },
                { k: 'artifact', label: 'Trang Bị' },
                { k: 'consumable', label: 'Tiêu Hao' },
                { k: 'real_reward', label: 'Thưởng Thực Tế' },
              ] as const
            ).map((t) => (
              <button
                key={t.k}
                type="button"
                onClick={() => setCatFilter(t.k)}
                className={
                  catFilter === t.k
                    ? 'btn-primary px-2.5 py-1 text-xs'
                    : 'btn-secondary px-2.5 py-1 text-xs'
                }
              >
                {t.label}
              </button>
            ))}

            <div className="flex items-center gap-1 border-2 px-2 py-1 text-[11px] studio-subtle rpg-divider rounded-[2px]">
              <Filter className="h-3 w-3 text-dim" />
              <select
                value={minRarity}
                onChange={(e) =>
                  setMinRarity(e.target.value as 'all' | 'RARE' | 'EPIC' | 'LEGENDARY')
                }
                className="border-0 bg-transparent p-0 text-[11px] font-semibold text-main focus:ring-0"
                aria-label="Lọc theo độ hiếm"
              >
                <option value="all">Mọi độ hiếm</option>
                <option value="RARE">Rare trở lên</option>
                <option value="EPIC">Epic trở lên</option>
                <option value="LEGENDARY">Legendary+</option>
              </select>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-dim" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm món..."
                className="w-28 py-1 pl-6 pr-2 text-xs sm:w-36"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowCustomForm((v) => !v)}
              className="btn-secondary flex items-center gap-1 px-2.5 py-1 text-xs"
            >
              {showCustomForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5 text-amber-400" />}
              <span>Tạo thưởng riêng</span>
            </button>
          </div>
        </div>

        {/* Custom Reward Form with 12-Sprite Pixel Icon Picker */}
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
                iconKey: customIconKey,
                rarity: customRarity,
              });
              setCustomName('');
              setCustomDesc('');
              setShowCustomForm(false);
            }}
            className="space-y-3 border-b-2 p-4 studio-subtle rpg-divider"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="VD: Ly matcha đá / 1 tập Anime..."
                className="px-3 py-1.5 text-xs sm:col-span-2"
              />
              <select
                value={customCurrency}
                onChange={(e) => setCustomCurrency(e.target.value as 'gold' | 'runestones')}
                className="px-2.5 py-1.5 text-xs"
              >
                <option value="gold">Mua bằng Gold</option>
                <option value="runestones">Mua bằng Runestones</option>
              </select>
              <input
                type="number"
                min={1}
                value={customPrice}
                onChange={(e) => setCustomPrice(Number(e.target.value))}
                className="px-2.5 py-1.5 text-xs"
              />
              <select
                value={customRarity}
                onChange={(e) => setCustomRarity(e.target.value as ItemRarity)}
                className="px-2.5 py-1.5 text-xs"
              >
                <option value="COMMON">Phổ Thông</option>
                <option value="RARE">Hiếm (Rare)</option>
                <option value="EPIC">Sử Thi (Epic)</option>
                <option value="LEGENDARY">Huyền Thoại</option>
              </select>
            </div>

            <div>
              <div className="mb-1.5 text-[11px] font-semibold text-sub">
                Chọn hình Pixel cho phần thưởng:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CUSTOM_REWARD_ICON_OPTIONS.map((opt) => {
                  const picked = customIconKey === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setCustomIconKey(opt.key)}
                      title={opt.label}
                      className={`flex flex-col items-center gap-0.5 rounded-[2px] border-2 px-2 py-1.5 text-[9px] transition ${
                        picked
                          ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                          : 'studio-divider bg-[var(--bg-surface)] text-dim hover:border-amber-400/50'
                      }`}
                    >
                      <PixelItemSprite iconKey={opt.key} size={24} />
                      <span className="whitespace-nowrap">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                placeholder="Mô tả phần thưởng (tùy chọn)..."
                className="flex-1 px-3 py-1.5 text-xs"
              />
              <button type="submit" className="btn-primary shrink-0 px-4 py-1.5 text-xs">
                Lưu vào Cửa Hàng
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 divide-y-2 lg:grid-cols-12 lg:divide-x-2 lg:divide-y-0 rpg-divider">
          {/* Left 8 cols: RPG Item Slot Grid */}
          <div className="p-4 lg:col-span-8">
            {filteredShopItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-dim">
                Không có vật phẩm nào khớp bộ lọc.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                {filteredShopItems.map((item) => {
                  const rarity: ItemRarity = item.rarity || 'COMMON';
                  const rMeta = ITEM_RARITY_META[rarity];
                  const ownedArtifact =
                    item.category === 'artifact' && ownedArtifactIds.has(item.id);
                  const canAfford =
                    item.currency === 'gold'
                      ? player.gold >= item.price
                      : player.runestones >= item.price;
                  const isSelected = selectedShopItem?.id === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedShopId(item.id)}
                      onDoubleClick={() => {
                        if (!ownedArtifact && canAfford) {
                          void handleBuy(item);
                        }
                      }}
                      title={`${item.name} — ${item.effectLabel}`}
                      className={`group relative flex flex-col items-center justify-between overflow-hidden rounded-[2px] border-2 p-2 text-center transition ${rMeta.borderCls} ${rMeta.bgCls} ${
                        isSelected
                          ? 'ring-2 ring-amber-400 brightness-110'
                          : 'hover:brightness-110'
                      }`}
                      style={{ boxShadow: `inset 0 0 10px ${rMeta.glowHex}` }}
                    >
                      {/* Top Rarity Color Line */}
                      <span
                        className="absolute left-0 right-0 top-0 h-1"
                        style={{ backgroundColor: rMeta.barHex }}
                      />

                      {ownedArtifact && (
                        <span
                          className="absolute right-1 top-1.5 flex h-4 w-4 items-center justify-center rounded-[1px] bg-emerald-600 text-white"
                          title="Đã sở hữu"
                        >
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}

                      {item.isCustom && !ownedArtifact && (
                        <span className="font-pixel absolute left-1 top-1.5 text-[8px] text-amber-300">
                          ★
                        </span>
                      )}

                      <div className="mt-2 flex h-12 w-12 items-center justify-center">
                        <PixelItemSprite
                          iconKey={resolveItemIconKey(item)}
                          size={44}
                          rarity={rarity}
                        />
                      </div>

                      <div className="mt-1.5 w-full truncate text-[11px] font-bold text-main">
                        {item.name}
                      </div>

                      <div className="mt-1 flex items-center justify-center gap-1 font-mono text-[10px] font-extrabold">
                        <PixelCurrencyIcon type={item.currency} size={12} />
                        <span
                          className={
                            ownedArtifact
                              ? 'text-emerald-400'
                              : canAfford
                                ? item.currency === 'gold'
                                  ? 'text-amber-400'
                                  : 'text-cyan-400'
                                : 'text-dim'
                          }
                        >
                          {ownedArtifact
                            ? 'Đã có'
                            : `${item.price}${item.currency === 'gold' ? 'G' : ''}`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right 4 cols: Sticky RPG Merchant Item Inspector */}
          <aside className="p-4 sm:p-5 lg:col-span-4">
            {selectedShopItem ? (() => {
              const rarity: ItemRarity = selectedShopItem.rarity || 'COMMON';
              const rMeta = ITEM_RARITY_META[rarity];
              const ownedArtifact =
                selectedShopItem.category === 'artifact' &&
                ownedArtifactIds.has(selectedShopItem.id);
              const canAfford =
                selectedShopItem.currency === 'gold'
                  ? player.gold >= selectedShopItem.price
                  : player.runestones >= selectedShopItem.price;
              const isBusy = busyActionId === selectedShopItem.id;
              const missingAmount =
                selectedShopItem.currency === 'gold'
                  ? Math.max(0, selectedShopItem.price - player.gold)
                  : Math.max(0, selectedShopItem.price - player.runestones);

              return (
                <div className="sticky top-4 space-y-3.5">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[2px] border-2 bg-[#0b0e16] ${rMeta.borderCls}`}
                      style={{ boxShadow: `0 0 14px ${rMeta.glowHex}` }}
                    >
                      <PixelItemSprite
                        iconKey={resolveItemIconKey(selectedShopItem)}
                        size={52}
                        rarity={rarity}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`font-pixel rounded-[2px] border px-1.5 py-0.5 text-[8px] font-bold uppercase ${rMeta.badgeCls}`}
                        >
                          {rMeta.label}
                        </span>
                        <span className="rounded-[2px] border px-1.5 py-0.5 font-mono text-[10px] text-sub rpg-divider">
                          {selectedShopItem.slot
                            ? EQUIPMENT_SLOT_META[selectedShopItem.slot].label
                            : CAT_LABELS[selectedShopItem.category]}
                        </span>
                        {selectedShopItem.statFocus && (
                          <span className="font-pixel rounded-[2px] border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[8px] font-bold text-amber-300">
                            {selectedShopItem.statFocus}
                          </span>
                        )}
                      </div>
                      <h4 className="mt-1.5 font-display text-base font-extrabold text-main">
                        {selectedShopItem.name}
                      </h4>
                    </div>
                  </div>

                  <div className="rounded-[2px] border-2 border-amber-500/40 bg-amber-500/10 px-3 py-2">
                    <div className="font-pixel text-[8px] font-bold uppercase text-amber-400">
                      HIỆU ỨNG &amp; CHỈ SỐ
                    </div>
                    <div className="mt-0.5 font-mono text-xs font-extrabold text-main">
                      {selectedShopItem.effectLabel}
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed text-sub">
                    {selectedShopItem.description}
                  </p>

                  {selectedShopItem.lore && (
                    <p className="border-l-2 border-amber-500/50 pl-2.5 text-[11px] italic text-dim">
                      &ldquo;{selectedShopItem.lore}&rdquo;
                    </p>
                  )}

                  <div className="flex items-center justify-between rounded-[2px] border-2 px-3 py-2 text-xs studio-subtle rpg-divider">
                    <span className="text-sub">Giá vật phẩm:</span>
                    <span className="flex items-center gap-1.5 font-mono text-sm font-extrabold text-main">
                      <PixelCurrencyIcon type={selectedShopItem.currency} size={15} />
                      {selectedShopItem.price}{' '}
                      {selectedShopItem.currency === 'gold' ? 'Gold' : 'Runestones'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={ownedArtifact || !canAfford || isBusy}
                      onClick={() => void handleBuy(selectedShopItem)}
                      className="btn-primary flex-1 py-2.5 text-xs"
                    >
                      {ownedArtifact
                        ? 'Đã sở hữu trang bị này'
                        : canAfford
                          ? 'Mua ngay'
                          : `Thiếu ${missingAmount} ${
                              selectedShopItem.currency === 'gold' ? 'G' : '💎'
                            }`}
                    </button>

                    {selectedShopItem.isCustom && onDeleteCustomReward && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Xóa phần thưởng "${selectedShopItem.name}"?`)) {
                            void onDeleteCustomReward(selectedShopItem.id);
                          }
                        }}
                        className="btn-secondary p-2.5 text-dim hover:text-rose-500"
                        title="Xóa phần thưởng tự tạo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })() : (
              <div className="py-10 text-center text-xs text-dim">
                Chọn 1 vật phẩm ở lưới bên trái để xem thông số chi tiết.
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
};
