import React from 'react';
import type { EquipmentSlot, ItemRarity } from '../types/system';

export const ITEM_RARITY_META: Record<
  ItemRarity,
  {
    label: string;
    borderCls: string;
    bgCls: string;
    textCls: string;
    badgeCls: string;
    barHex: string;
    glowHex: string;
  }
> = {
  COMMON: {
    label: 'Phổ Thông',
    borderCls: 'border-slate-500/60',
    bgCls: 'bg-slate-500/10',
    textCls: 'text-slate-300',
    badgeCls: 'border-slate-500/50 bg-slate-500/15 text-slate-300',
    barHex: '#94a3b8',
    glowHex: 'rgba(148,163,184,0.18)',
  },
  RARE: {
    label: 'Hiếm',
    borderCls: 'border-sky-500/75',
    bgCls: 'bg-sky-500/10',
    textCls: 'text-sky-300',
    badgeCls: 'border-sky-500/55 bg-sky-500/15 text-sky-300',
    barHex: '#38bdf8',
    glowHex: 'rgba(56,189,248,0.26)',
  },
  EPIC: {
    label: 'Sử Thi',
    borderCls: 'border-violet-500/80',
    bgCls: 'bg-violet-500/12',
    textCls: 'text-violet-300',
    badgeCls: 'border-violet-500/60 bg-violet-500/15 text-violet-300',
    barHex: '#a78bfa',
    glowHex: 'rgba(167,139,250,0.32)',
  },
  LEGENDARY: {
    label: 'Huyền Thoại',
    borderCls: 'border-amber-400/90',
    bgCls: 'bg-amber-500/12',
    textCls: 'text-amber-300',
    badgeCls: 'border-amber-400/70 bg-amber-500/20 text-amber-300',
    barHex: '#fbbf24',
    glowHex: 'rgba(251,191,36,0.34)',
  },
  MYTHIC: {
    label: 'Thần Thoại',
    borderCls: 'border-rose-400/90',
    bgCls: 'bg-rose-500/15',
    textCls: 'text-rose-300',
    badgeCls: 'border-rose-400/75 bg-rose-500/20 text-rose-300',
    barHex: '#fb7185',
    glowHex: 'rgba(251,113,133,0.38)',
  },
};

export const EQUIPMENT_SLOT_META: Record<
  EquipmentSlot,
  { label: string; shortLabel: string }
> = {
  helm: { label: 'Mũ / Kính', shortLabel: 'MŨ' },
  weapon: { label: 'Vũ Khí', shortLabel: 'VŨ KHÍ' },
  tome: { label: 'Cổ Thư / Dụng Cụ', shortLabel: 'CỔ THƯ' },
  armor: { label: 'Giáp / Trang Phục', shortLabel: 'GIÁP' },
  accessory: { label: 'Trang Sức / Nhẫn', shortLabel: 'NHẪN' },
  boots: { label: 'Giày / Bộ Pháp', shortLabel: 'GIÀY' },
};

export const CUSTOM_REWARD_ICON_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'gift_box', label: 'Hộp Quà' },
  { key: 'coffee_cup', label: 'Cà Phê' },
  { key: 'ramen_bowl', label: 'Đồ Ăn Ngon' },
  { key: 'cake_slice', label: 'Bánh Ngọt' },
  { key: 'gamepad_retro', label: 'Chơi Game' },
  { key: 'movie_ticket', label: 'Xem Phim' },
  { key: 'music_disc', label: 'Nghe Nhạc' },
  { key: 'book_stack', label: 'Mua Sách' },
  { key: 'headphones_pixel', label: 'Nâng Gear' },
  { key: 'pillow_rest', label: 'Nghỉ Ngơi' },
  { key: 'travel_bag', label: 'Du Lịch' },
  { key: 'star_trophy', label: 'Cúp Tự Hào' },
];

const LEGACY_ICON_MAP: Record<string, string> = {
  'item-art-kasaka-dagger': 'dagger_venom',
  'item-art-igris': 'sword_crimson',
  'item-art-demon-katana': 'katana_shadow',
  'item-art-clarity-glasses': 'glasses_clarity',
  'item-art-circlet-recall': 'circlet_arcane',
  'item-art-crown-sovereign': 'crown_monarch',
  'item-art-tunic-runner': 'tunic_emerald',
  'item-art-vitality': 'armor_vitality',
  'item-art-aegis-sleep': 'armor_aegis',
  'item-art-coin-amulet': 'amulet_gold',
  'item-art-scholar': 'ring_synthesis',
  'item-art-heart-pendant': 'pendant_phoenix',
  'item-art-pomodoro-orb': 'hourglass_crystal',
  'item-art-archmage': 'tome_architect',
  'item-art-grimoire-feynman': 'grimoire_void',
  'item-art-sandals-2min': 'boots_leather',
  'item-art-greaves-flow': 'boots_swift',
  'item-art-boots-shadowstep': 'boots_shadow',
  'item-con-water': 'potion_water',
  'item-con-coffee-potion': 'potion_espresso',
  'item-con-elixir': 'potion_elixir',
  'item-con-phoenix-brew': 'potion_phoenix',
  'item-con-overdrive': 'key_overdrive',
  'item-con-focus-crystal': 'crystal_focus',
  'item-con-scroll': 'scroll_hidden',
  'item-con-boss-scroll': 'scroll_raid',
  'item-con-shield-grace': 'shield_grace',
  'item-con-sp-tome': 'gem_sp',
  'item-rew-break': 'gamepad_retro',
  'item-rew-nap': 'pillow_rest',
  'item-rew-snack': 'ramen_bowl',
  'item-rew-coffee': 'coffee_cup',
  'item-rew-movie': 'movie_ticket',
  'item-rew-book': 'book_stack',
  'item-rew-gear': 'headphones_pixel',
  'item-rew-dayoff': 'chest_treasure',
};

export function resolveItemIconKey(item: {
  id?: string;
  itemId?: string;
  iconKey?: string;
  category?: string;
  effectCode?: string;
}): string {
  if (item.iconKey) return item.iconKey;
  if (item.itemId && LEGACY_ICON_MAP[item.itemId]) return LEGACY_ICON_MAP[item.itemId];
  if (item.id && LEGACY_ICON_MAP[item.id]) return LEGACY_ICON_MAP[item.id];
  if (item.category === 'artifact') return 'sword_crimson';
  if (item.category === 'consumable') return 'potion_elixir';
  return 'gift_box';
}

export const PixelCurrencyIcon: React.FC<{
  type: 'gold' | 'runestones';
  size?: number;
  className?: string;
}> = ({ type, size = 16, className = '' }) => {
  if (type === 'gold') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        className={`pixel-art shrink-0 ${className}`}
        aria-hidden="true"
      >
        <path d="M5 2h6v1h2v2h1v6h-1v2h-2v1H5v-1H3v-2H2V5h1V3h2V2z" fill="#451a03" />
        <path d="M5 3h6v1h1v1h1v6h-1v1h-1v1H5v-1H4v-1H3V5h1V4h1V3z" fill="#f59e0b" />
        <rect x="5" y="4" width="6" height="8" fill="#fbbf24" />
        <rect x="4" y="5" width="8" height="6" fill="#fbbf24" />
        <rect x="7" y="5" width="2" height="6" fill="#b45309" />
        <rect x="5" y="4" width="2" height="2" fill="#fef3c7" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`pixel-art shrink-0 ${className}`}
      aria-hidden="true"
    >
      <path d="M7 1h2v1h2v2h2v3h1v2h-1v3h-2v2H9v1H7v-1H5v-2H3V9H2V7h1V4h2V2h2V1z" fill="#082f49" />
      <path d="M7 2h2v2h2v2h1v4h-1v2H9v2H7v-2H5v-2H4V6h1V4h2V2z" fill="#0284c7" />
      <rect x="6" y="4" width="4" height="8" fill="#38bdf8" />
      <rect x="5" y="6" width="6" height="4" fill="#38bdf8" />
      <rect x="7" y="3" width="2" height="4" fill="#bae6fd" />
      <rect x="6" y="5" width="1" height="2" fill="#ffffff" />
    </svg>
  );
};

export const PixelSlotSilhouette: React.FC<{
  slot: EquipmentSlot;
  size?: number;
}> = ({ slot, size = 28 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className="pixel-art opacity-35"
      aria-hidden="true"
    >
      {slot === 'weapon' && (
        <path d="M12 2h2v2h-1v1h-1v1h-1v1h-1v1H9v1H8v1h1v1H8v1H7v-1H5v1H4v1H2v-2h1v-1h1v-2h1v1h1V9h1V8h1V7h1V6h1V5h1V4h1V2z" fill="#94a3b8" />
      )}
      {slot === 'helm' && (
        <path d="M4 3h8v2h1v5h-2v3H5v-3H3V5h1V3zm2 3v2h4V6H6z" fill="#94a3b8" />
      )}
      {slot === 'armor' && (
        <path d="M4 2h3v1h2V2h3v2h2v3h-2v6H4V7H2V4h2V2z" fill="#94a3b8" />
      )}
      {slot === 'accessory' && (
        <path d="M5 3h6v2h2v6h-2v2H5v-2H3V5h2V3zm1 3v4h4V6H6z" fill="#94a3b8" />
      )}
      {slot === 'tome' && (
        <path d="M3 2h10v12H3V2zm2 2v8h6V4H5z" fill="#94a3b8" />
      )}
      {slot === 'boots' && (
        <path d="M4 3h4v6h5v4H3V3h1z" fill="#94a3b8" />
      )}
    </svg>
  );
};

export const PixelItemSprite: React.FC<{
  iconKey: string;
  size?: number;
  rarity?: ItemRarity;
  className?: string;
}> = ({ iconKey, size = 40, rarity, className = '' }) => {
  const showSparkle = rarity === 'LEGENDARY' || rarity === 'MYTHIC';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`pixel-art shrink-0 ${className}`}
      aria-hidden="true"
    >
      {/* 1. dagger_venom */}
      {iconKey === 'dagger_venom' && (
        <>
          <rect x="11" y="2" width="3" height="3" fill="#0f172a" />
          <rect x="10" y="3" width="3" height="3" fill="#475569" />
          <rect x="9" y="4" width="3" height="3" fill="#94a3b8" />
          <rect x="8" y="5" width="3" height="3" fill="#10b981" />
          <rect x="7" y="6" width="2" height="2" fill="#34d399" />
          <rect x="11" y="2" width="2" height="2" fill="#e2e8f0" />
          <rect x="5" y="8" width="4" height="2" fill="#f59e0b" />
          <rect x="6" y="7" width="2" height="4" fill="#b45309" />
          <rect x="4" y="10" width="2" height="2" fill="#78350f" />
          <rect x="2" y="12" width="3" height="2" fill="#fbbf24" />
        </>
      )}

      {/* 2. sword_crimson */}
      {iconKey === 'sword_crimson' && (
        <>
          <rect x="12" y="1" width="3" height="3" fill="#e2e8f0" />
          <rect x="10" y="3" width="3" height="3" fill="#cbd5e1" />
          <rect x="8" y="5" width="3" height="3" fill="#94a3b8" />
          <rect x="7" y="6" width="2" height="3" fill="#ef4444" />
          <rect x="11" y="2" width="2" height="2" fill="#ffffff" />
          <rect x="4" y="8" width="5" height="2" fill="#f59e0b" />
          <rect x="6" y="7" width="2" height="5" fill="#d97706" />
          <rect x="3" y="11" width="3" height="2" fill="#991b1b" />
          <rect x="2" y="12" width="2" height="2" fill="#fbbf24" />
        </>
      )}

      {/* 3. katana_shadow */}
      {iconKey === 'katana_shadow' && (
        <>
          <rect x="12" y="1" width="2" height="2" fill="#c4b5fd" />
          <rect x="11" y="2" width="2" height="3" fill="#8b5cf6" />
          <rect x="9" y="4" width="2" height="3" fill="#6d28d9" />
          <rect x="7" y="6" width="2" height="3" fill="#4c1d95" />
          <rect x="10" y="3" width="1" height="2" fill="#ffffff" />
          <rect x="8" y="5" width="1" height="2" fill="#ddd6fe" />
          <rect x="5" y="8" width="4" height="1" fill="#fbbf24" />
          <rect x="6" y="7" width="1" height="3" fill="#fbbf24" />
          <rect x="4" y="10" width="2" height="2" fill="#1e1b4b" />
          <rect x="2" y="12" width="2" height="2" fill="#a78bfa" />
        </>
      )}

      {/* 4. glasses_clarity */}
      {iconKey === 'glasses_clarity' && (
        <>
          <rect x="2" y="4" width="2" height="3" fill="#94a3b8" />
          <rect x="12" y="4" width="2" height="3" fill="#94a3b8" />
          <rect x="1" y="6" width="6" height="5" fill="#1e293b" />
          <rect x="9" y="6" width="6" height="5" fill="#1e293b" />
          <rect x="2" y="7" width="4" height="3" fill="#38bdf8" />
          <rect x="10" y="7" width="4" height="3" fill="#38bdf8" />
          <rect x="2" y="7" width="2" height="1" fill="#e0f2fe" />
          <rect x="10" y="7" width="2" height="1" fill="#e0f2fe" />
          <rect x="7" y="7" width="2" height="1" fill="#cbd5e1" />
        </>
      )}

      {/* 5. circlet_arcane */}
      {iconKey === 'circlet_arcane' && (
        <>
          <rect x="2" y="6" width="12" height="5" fill="#4c1d95" />
          <rect x="3" y="5" width="10" height="4" fill="#8b5cf6" />
          <rect x="4" y="4" width="8" height="2" fill="#a78bfa" />
          <rect x="2" y="9" width="12" height="2" fill="#fbbf24" />
          <rect x="7" y="5" width="2" height="4" fill="#38bdf8" />
          <rect x="7" y="6" width="1" height="1" fill="#ffffff" />
          <rect x="4" y="7" width="1" height="1" fill="#fde68a" />
          <rect x="11" y="7" width="1" height="1" fill="#fde68a" />
        </>
      )}

      {/* 6. crown_monarch */}
      {iconKey === 'crown_monarch' && (
        <>
          <rect x="2" y="4" width="2" height="7" fill="#d97706" />
          <rect x="7" y="2" width="2" height="9" fill="#fbbf24" />
          <rect x="12" y="4" width="2" height="7" fill="#d97706" />
          <rect x="4" y="6" width="3" height="5" fill="#f59e0b" />
          <rect x="9" y="6" width="3" height="5" fill="#f59e0b" />
          <rect x="2" y="10" width="12" height="3" fill="#b45309" />
          <rect x="3" y="11" width="10" height="1" fill="#fde68a" />
          <rect x="7" y="5" width="2" height="2" fill="#f43f5e" />
          <rect x="3" y="7" width="1" height="2" fill="#38bdf8" />
          <rect x="12" y="7" width="1" height="2" fill="#38bdf8" />
        </>
      )}

      {/* 7. tunic_emerald */}
      {iconKey === 'tunic_emerald' && (
        <>
          <rect x="5" y="2" width="6" height="2" fill="#065f46" />
          <rect x="3" y="4" width="10" height="4" fill="#10b981" />
          <rect x="1" y="5" width="2" height="4" fill="#059669" />
          <rect x="13" y="5" width="2" height="4" fill="#059669" />
          <rect x="4" y="8" width="8" height="6" fill="#047857" />
          <rect x="7" y="4" width="2" height="10" fill="#34d399" />
          <rect x="4" y="10" width="8" height="1" fill="#fbbf24" />
        </>
      )}

      {/* 8. armor_vitality */}
      {iconKey === 'armor_vitality' && (
        <>
          <rect x="4" y="2" width="8" height="3" fill="#334155" />
          <rect x="2" y="4" width="12" height="4" fill="#475569" />
          <rect x="4" y="7" width="8" height="7" fill="#1e293b" />
          <rect x="5" y="4" width="6" height="6" fill="#64748b" />
          <rect x="6" y="5" width="4" height="3" fill="#ef4444" />
          <rect x="7" y="6" width="2" height="3" fill="#fca5a5" />
          <rect x="2" y="4" width="3" height="2" fill="#fbbf24" />
          <rect x="11" y="4" width="3" height="2" fill="#fbbf24" />
        </>
      )}

      {/* 9. armor_aegis */}
      {iconKey === 'armor_aegis' && (
        <>
          <rect x="4" y="2" width="8" height="2" fill="#fde68a" />
          <rect x="2" y="4" width="12" height="4" fill="#f59e0b" />
          <rect x="3" y="8" width="10" height="6" fill="#b45309" />
          <rect x="5" y="4" width="6" height="8" fill="#fbbf24" />
          <rect x="7" y="5" width="2" height="5" fill="#38bdf8" />
          <rect x="6" y="6" width="4" height="2" fill="#bae6fd" />
          <rect x="2" y="5" width="2" height="2" fill="#e0f2fe" />
          <rect x="12" y="5" width="2" height="2" fill="#e0f2fe" />
        </>
      )}

      {/* 10. amulet_gold */}
      {iconKey === 'amulet_gold' && (
        <>
          <rect x="5" y="2" width="6" height="1" fill="#fbbf24" />
          <rect x="4" y="3" width="1" height="3" fill="#d97706" />
          <rect x="11" y="3" width="1" height="3" fill="#d97706" />
          <rect x="5" y="6" width="6" height="7" fill="#b45309" />
          <rect x="6" y="7" width="4" height="5" fill="#fbbf24" />
          <rect x="7" y="8" width="2" height="3" fill="#fef3c7" />
        </>
      )}

      {/* 11. ring_synthesis */}
      {iconKey === 'ring_synthesis' && (
        <>
          <rect x="6" y="3" width="4" height="3" fill="#06b6d4" />
          <rect x="7" y="4" width="2" height="2" fill="#e0f2fe" />
          <rect x="4" y="6" width="8" height="7" fill="#d97706" />
          <rect x="3" y="7" width="10" height="5" fill="#fbbf24" />
          <rect x="5" y="8" width="6" height="3" fill="#0b0e16" />
        </>
      )}

      {/* 12. pendant_phoenix */}
      {iconKey === 'pendant_phoenix' && (
        <>
          <rect x="6" y="2" width="4" height="1" fill="#fbbf24" />
          <rect x="5" y="3" width="1" height="3" fill="#f59e0b" />
          <rect x="10" y="3" width="1" height="3" fill="#f59e0b" />
          <rect x="4" y="6" width="8" height="6" fill="#ea580c" />
          <rect x="5" y="7" width="6" height="5" fill="#fb923c" />
          <rect x="6" y="8" width="4" height="4" fill="#ef4444" />
          <rect x="7" y="9" width="2" height="2" fill="#fde68a" />
          <rect x="6" y="12" width="4" height="2" fill="#fbbf24" />
        </>
      )}

      {/* 13. hourglass_crystal */}
      {iconKey === 'hourglass_crystal' && (
        <>
          <rect x="4" y="2" width="8" height="2" fill="#b45309" />
          <rect x="4" y="12" width="8" height="2" fill="#b45309" />
          <rect x="5" y="4" width="6" height="3" fill="#38bdf8" />
          <rect x="6" y="7" width="4" height="2" fill="#bae6fd" />
          <rect x="5" y="9" width="6" height="3" fill="#0284c7" />
          <rect x="6" y="10" width="4" height="2" fill="#fbbf24" />
          <rect x="7" y="6" width="2" height="3" fill="#fde68a" />
        </>
      )}

      {/* 14. tome_architect */}
      {iconKey === 'tome_architect' && (
        <>
          <rect x="3" y="2" width="10" height="12" fill="#1e3a8a" />
          <rect x="4" y="3" width="8" height="10" fill="#2563eb" />
          <rect x="3" y="2" width="2" height="12" fill="#fbbf24" />
          <rect x="6" y="5" width="4" height="2" fill="#fde68a" />
          <rect x="7" y="4" width="2" height="5" fill="#fde68a" />
          <rect x="5" y="11" width="7" height="2" fill="#e2e8f0" />
        </>
      )}

      {/* 15. grimoire_void */}
      {iconKey === 'grimoire_void' && (
        <>
          <rect x="3" y="2" width="10" height="12" fill="#3b0764" />
          <rect x="4" y="3" width="8" height="10" fill="#6d28d9" />
          <rect x="3" y="2" width="2" height="12" fill="#f43f5e" />
          <rect x="6" y="5" width="4" height="4" fill="#c4b5fd" />
          <rect x="7" y="6" width="2" height="2" fill="#38bdf8" />
          <rect x="5" y="11" width="7" height="2" fill="#cbd5e1" />
        </>
      )}

      {/* 16. boots_leather */}
      {iconKey === 'boots_leather' && (
        <>
          <rect x="4" y="4" width="4" height="6" fill="#92400e" />
          <rect x="4" y="10" width="8" height="3" fill="#78350f" />
          <rect x="3" y="12" width="10" height="2" fill="#451a03" />
          <rect x="4" y="4" width="4" height="2" fill="#d97706" />
          <rect x="6" y="10" width="4" height="1" fill="#fbbf24" />
        </>
      )}

      {/* 17. boots_swift */}
      {iconKey === 'boots_swift' && (
        <>
          <rect x="4" y="4" width="4" height="6" fill="#0284c7" />
          <rect x="4" y="10" width="8" height="3" fill="#0369a1" />
          <rect x="3" y="12" width="10" height="2" fill="#0f172a" />
          <rect x="4" y="4" width="4" height="2" fill="#38bdf8" />
          <rect x="8" y="5" width="3" height="2" fill="#fde68a" />
          <rect x="9" y="4" width="3" height="1" fill="#ffffff" />
        </>
      )}

      {/* 18. boots_shadow */}
      {iconKey === 'boots_shadow' && (
        <>
          <rect x="4" y="3" width="4" height="7" fill="#312e81" />
          <rect x="4" y="10" width="8" height="3" fill="#1e1b4b" />
          <rect x="3" y="12" width="10" height="2" fill="#0f172a" />
          <rect x="4" y="3" width="4" height="2" fill="#8b5cf6" />
          <rect x="8" y="6" width="4" height="2" fill="#38bdf8" />
          <rect x="9" y="8" width="2" height="1" fill="#c4b5fd" />
        </>
      )}

      {/* 19. potion_water */}
      {iconKey === 'potion_water' && (
        <>
          <rect x="6" y="2" width="4" height="2" fill="#d97706" />
          <rect x="6" y="4" width="4" height="2" fill="#bae6fd" />
          <rect x="4" y="6" width="8" height="7" fill="#0284c7" />
          <rect x="5" y="7" width="6" height="5" fill="#38bdf8" />
          <rect x="5" y="12" width="6" height="2" fill="#0369a1" />
          <rect x="6" y="8" width="1" height="3" fill="#e0f2fe" />
        </>
      )}

      {/* 20. potion_espresso */}
      {iconKey === 'potion_espresso' && (
        <>
          <rect x="6" y="2" width="4" height="2" fill="#fbbf24" />
          <rect x="6" y="4" width="4" height="2" fill="#d6d3d1" />
          <rect x="4" y="6" width="8" height="7" fill="#78350f" />
          <rect x="5" y="7" width="6" height="5" fill="#b45309" />
          <rect x="5" y="7" width="6" height="2" fill="#f59e0b" />
          <rect x="6" y="9" width="1" height="2" fill="#fde68a" />
        </>
      )}

      {/* 21. potion_elixir */}
      {iconKey === 'potion_elixir' && (
        <>
          <rect x="6" y="2" width="4" height="2" fill="#fbbf24" />
          <rect x="6" y="4" width="4" height="2" fill="#cbd5e1" />
          <rect x="4" y="6" width="8" height="7" fill="#be123c" />
          <rect x="5" y="7" width="6" height="5" fill="#ef4444" />
          <rect x="5" y="7" width="6" height="2" fill="#fb7185" />
          <rect x="6" y="8" width="1" height="3" fill="#ffe4e6" />
        </>
      )}

      {/* 22. potion_phoenix */}
      {iconKey === 'potion_phoenix' && (
        <>
          <rect x="6" y="2" width="4" height="2" fill="#fde68a" />
          <rect x="6" y="4" width="4" height="2" fill="#fed7aa" />
          <rect x="3" y="6" width="10" height="7" fill="#ea580c" />
          <rect x="4" y="7" width="8" height="5" fill="#f59e0b" />
          <rect x="5" y="8" width="6" height="3" fill="#fde047" />
          <rect x="6" y="8" width="2" height="2" fill="#ffffff" />
          <rect x="5" y="13" width="6" height="1" fill="#9a3412" />
        </>
      )}

      {/* 23. key_overdrive */}
      {iconKey === 'key_overdrive' && (
        <>
          <rect x="3" y="4" width="5" height="5" fill="#f59e0b" />
          <rect x="4" y="5" width="3" height="3" fill="#0b0e16" />
          <rect x="8" y="6" width="6" height="2" fill="#fbbf24" />
          <rect x="11" y="8" width="1" height="2" fill="#d97706" />
          <rect x="13" y="8" width="1" height="3" fill="#d97706" />
          <rect x="4" y="4" width="2" height="1" fill="#fef3c7" />
        </>
      )}

      {/* 24. crystal_focus */}
      {iconKey === 'crystal_focus' && (
        <>
          <rect x="7" y="1" width="2" height="14" fill="#6d28d9" />
          <rect x="5" y="3" width="6" height="10" fill="#8b5cf6" />
          <rect x="4" y="5" width="8" height="6" fill="#a78bfa" />
          <rect x="6" y="4" width="2" height="5" fill="#ddd6fe" />
          <rect x="6" y="5" width="1" height="2" fill="#ffffff" />
        </>
      )}

      {/* 25. scroll_hidden */}
      {iconKey === 'scroll_hidden' && (
        <>
          <rect x="3" y="3" width="10" height="2" fill="#d97706" />
          <rect x="4" y="5" width="8" height="6" fill="#fef3c7" />
          <rect x="3" y="11" width="10" height="2" fill="#d97706" />
          <rect x="6" y="6" width="4" height="1" fill="#8b5cf6" />
          <rect x="5" y="8" width="6" height="1" fill="#8b5cf6" />
          <rect x="7" y="9" width="2" height="1" fill="#f59e0b" />
        </>
      )}

      {/* 26. scroll_raid */}
      {iconKey === 'scroll_raid' && (
        <>
          <rect x="3" y="3" width="10" height="2" fill="#991b1b" />
          <rect x="4" y="5" width="8" height="6" fill="#fde68a" />
          <rect x="3" y="11" width="10" height="2" fill="#991b1b" />
          <rect x="6" y="6" width="4" height="4" fill="#ef4444" />
          <rect x="7" y="7" width="2" height="2" fill="#ffffff" />
        </>
      )}

      {/* 27. shield_grace */}
      {iconKey === 'shield_grace' && (
        <>
          <rect x="3" y="2" width="10" height="7" fill="#0f766e" />
          <rect x="4" y="9" width="8" height="3" fill="#0d9488" />
          <rect x="6" y="12" width="4" height="2" fill="#14b8a6" />
          <rect x="4" y="3" width="8" height="6" fill="#2dd4bf" />
          <rect x="7" y="4" width="2" height="6" fill="#f0fdfa" />
          <rect x="5" y="6" width="6" height="2" fill="#f0fdfa" />
        </>
      )}

      {/* 28. gem_sp */}
      {iconKey === 'gem_sp' && (
        <>
          <rect x="5" y="2" width="6" height="2" fill="#fbbf24" />
          <rect x="3" y="4" width="10" height="4" fill="#f59e0b" />
          <rect x="4" y="8" width="8" height="3" fill="#d97706" />
          <rect x="6" y="11" width="4" height="3" fill="#b45309" />
          <rect x="5" y="4" width="4" height="3" fill="#fef08a" />
          <rect x="6" y="5" width="2" height="1" fill="#ffffff" />
        </>
      )}

      {/* 29. gamepad_retro */}
      {iconKey === 'gamepad_retro' && (
        <>
          <rect x="2" y="5" width="12" height="6" fill="#334155" />
          <rect x="1" y="7" width="3" height="5" fill="#1e293b" />
          <rect x="12" y="7" width="3" height="5" fill="#1e293b" />
          <rect x="4" y="7" width="1" height="3" fill="#cbd5e1" />
          <rect x="3" y="8" width="3" height="1" fill="#cbd5e1" />
          <rect x="10" y="7" width="1" height="1" fill="#ef4444" />
          <rect x="12" y="8" width="1" height="1" fill="#38bdf8" />
          <rect x="7" y="8" width="2" height="1" fill="#94a3b8" />
        </>
      )}

      {/* 30. coffee_cup */}
      {iconKey === 'coffee_cup' && (
        <>
          <rect x="5" y="2" width="1" height="2" fill="#cbd5e1" />
          <rect x="8" y="1" width="1" height="3" fill="#cbd5e1" />
          <rect x="3" y="5" width="8" height="8" fill="#f8fafc" />
          <rect x="11" y="6" width="2" height="4" fill="#cbd5e1" />
          <rect x="4" y="6" width="6" height="2" fill="#78350f" />
          <rect x="3" y="13" width="9" height="1" fill="#94a3b8" />
        </>
      )}

      {/* 31. ramen_bowl */}
      {iconKey === 'ramen_bowl' && (
        <>
          <rect x="5" y="2" width="8" height="1" fill="#b45309" />
          <rect x="4" y="4" width="8" height="1" fill="#d97706" />
          <rect x="3" y="6" width="10" height="2" fill="#fde047" />
          <rect x="4" y="6" width="3" height="2" fill="#fb7185" />
          <rect x="2" y="8" width="12" height="4" fill="#ef4444" />
          <rect x="4" y="12" width="8" height="2" fill="#991b1b" />
        </>
      )}

      {/* 32. pillow_rest */}
      {iconKey === 'pillow_rest' && (
        <>
          <rect x="11" y="2" width="3" height="1" fill="#fde68a" />
          <rect x="12" y="3" width="1" height="1" fill="#fde68a" />
          <rect x="11" y="4" width="3" height="1" fill="#fde68a" />
          <rect x="2" y="6" width="11" height="7" fill="#38bdf8" />
          <rect x="3" y="7" width="9" height="5" fill="#bae6fd" />
          <rect x="4" y="8" width="3" height="2" fill="#ffffff" />
        </>
      )}

      {/* 33. movie_ticket */}
      {iconKey === 'movie_ticket' && (
        <>
          <rect x="2" y="4" width="12" height="8" fill="#f43f5e" />
          <rect x="2" y="7" width="1" height="2" fill="#0b0e16" />
          <rect x="13" y="7" width="1" height="2" fill="#0b0e16" />
          <rect x="4" y="5" width="8" height="6" fill="#fda4af" />
          <rect x="6" y="6" width="4" height="4" fill="#881337" />
          <rect x="7" y="7" width="2" height="2" fill="#fde68a" />
        </>
      )}

      {/* 34. book_stack */}
      {iconKey === 'book_stack' && (
        <>
          <rect x="3" y="3" width="10" height="3" fill="#ef4444" />
          <rect x="4" y="4" width="8" height="1" fill="#fef2f2" />
          <rect x="2" y="6" width="11" height="4" fill="#10b981" />
          <rect x="3" y="7" width="9" height="2" fill="#ecfdf5" />
          <rect x="3" y="10" width="11" height="4" fill="#3b82f6" />
          <rect x="4" y="11" width="9" height="2" fill="#eff6ff" />
        </>
      )}

      {/* 35. headphones_pixel */}
      {iconKey === 'headphones_pixel' && (
        <>
          <rect x="4" y="2" width="8" height="2" fill="#94a3b8" />
          <rect x="3" y="4" width="2" height="4" fill="#64748b" />
          <rect x="11" y="4" width="2" height="4" fill="#64748b" />
          <rect x="2" y="8" width="3" height="5" fill="#38bdf8" />
          <rect x="11" y="8" width="3" height="5" fill="#38bdf8" />
          <rect x="4" y="9" width="1" height="3" fill="#0f172a" />
          <rect x="11" y="9" width="1" height="3" fill="#0f172a" />
        </>
      )}

      {/* 36. chest_treasure */}
      {iconKey === 'chest_treasure' && (
        <>
          <rect x="2" y="4" width="12" height="4" fill="#b45309" />
          <rect x="2" y="8" width="12" height="6" fill="#92400e" />
          <rect x="2" y="7" width="12" height="2" fill="#fbbf24" />
          <rect x="7" y="6" width="2" height="4" fill="#fde68a" />
          <rect x="4" y="4" width="2" height="10" fill="#d97706" />
          <rect x="10" y="4" width="2" height="10" fill="#d97706" />
        </>
      )}

      {/* 37. gift_box */}
      {iconKey === 'gift_box' && (
        <>
          <rect x="4" y="2" width="3" height="2" fill="#fbbf24" />
          <rect x="9" y="2" width="3" height="2" fill="#fbbf24" />
          <rect x="2" y="4" width="12" height="3" fill="#ec4899" />
          <rect x="3" y="7" width="10" height="7" fill="#db2777" />
          <rect x="7" y="4" width="2" height="10" fill="#fde68a" />
        </>
      )}

      {/* 38. cake_slice */}
      {iconKey === 'cake_slice' && (
        <>
          <rect x="7" y="3" width="2" height="2" fill="#ef4444" />
          <rect x="4" y="5" width="9" height="3" fill="#fdf2f8" />
          <rect x="3" y="8" width="10" height="2" fill="#fbcfe8" />
          <rect x="3" y="10" width="10" height="3" fill="#f59e0b" />
        </>
      )}

      {/* 39. music_disc */}
      {iconKey === 'music_disc' && (
        <>
          <rect x="4" y="2" width="8" height="12" fill="#1e293b" />
          <rect x="2" y="4" width="12" height="8" fill="#1e293b" />
          <rect x="5" y="5" width="6" height="6" fill="#8b5cf6" />
          <rect x="7" y="7" width="2" height="2" fill="#e2e8f0" />
        </>
      )}

      {/* 40. travel_bag */}
      {iconKey === 'travel_bag' && (
        <>
          <rect x="6" y="2" width="4" height="2" fill="#94a3b8" />
          <rect x="3" y="4" width="10" height="9" fill="#0ea5e9" />
          <rect x="4" y="5" width="8" height="7" fill="#0284c7" />
          <rect x="5" y="7" width="6" height="2" fill="#fde68a" />
          <rect x="4" y="13" width="2" height="1" fill="#0f172a" />
          <rect x="10" y="13" width="2" height="1" fill="#0f172a" />
        </>
      )}

      {/* 41. star_trophy */}
      {iconKey === 'star_trophy' && (
        <>
          <rect x="4" y="2" width="8" height="6" fill="#fbbf24" />
          <rect x="2" y="3" width="2" height="3" fill="#d97706" />
          <rect x="12" y="3" width="2" height="3" fill="#d97706" />
          <rect x="6" y="8" width="4" height="3" fill="#f59e0b" />
          <rect x="4" y="11" width="8" height="3" fill="#92400e" />
          <rect x="5" y="3" width="2" height="3" fill="#fef3c7" />
        </>
      )}

      {/* Sparkle Accent for Legendary & Mythic */}
      {showSparkle && (
        <>
          <rect x="1" y="2" width="1" height="1" fill="#fef08a" />
          <rect x="14" y="13" width="1" height="1" fill="#fef08a" />
          <rect x="2" y="14" width="1" height="1" fill="#ffffff" />
        </>
      )}
    </svg>
  );
};
