import React, { useState } from 'react';
import {
  PixelRivets,
  PxClose,
  PxRefresh,
  PxReset,
  PxShield,
  PxTrash,
  PxWarn,
} from './PixelIcons';

interface ResetProgressModalProps {
  onReset: (mode: 'progress' | 'clean', clearChats: boolean) => Promise<void>;
  onClose: () => void;
}

export const ResetProgressModal: React.FC<ResetProgressModalProps> = ({
  onReset,
  onClose,
}) => {
  const [selectedMode, setSelectedMode] = useState<'progress' | 'clean'>('progress');
  const [clearChats, setClearChats] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onReset(selectedMode, selectedMode === 'clean' ? true : clearChats);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
    >
      <div
        className="rpg-window relative w-full max-w-lg rounded-none p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <PixelRivets />

        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="btn-secondary absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-none"
          aria-label="Đóng"
        >
          <PxClose size={13} />
        </button>

        <div className="mb-4 flex items-center gap-2.5 border-b-2 pb-3 pr-10 rpg-divider">
          <div className="px-inset flex h-9 w-9 shrink-0 items-center justify-center rounded-none text-[var(--px-gold-text)]">
            <PxReset size={17} />
          </div>
          <div>
            <h2 className="font-display text-base font-extrabold text-main">
              Reset Tiến Trình &amp; Kiểm Thử
            </h2>
            <p className="text-xs text-dim">
              Chọn mức độ khôi phục phù hợp trước khi bắt đầu lại.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Mode 1: Reset Progress (Recommended for testing) */}
          <button
            type="button"
            disabled={busy}
            onClick={() => setSelectedMode('progress')}
            className={`w-full rounded-none border-2 p-3.5 text-left ${
              selectedMode === 'progress'
                ? 'border-[var(--px-gold)] bg-[var(--px-gold)]/15'
                : 'px-inset hover:border-[var(--px-gold)]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-display text-sm font-extrabold text-main">
                1. Reset Tiến Trình (Khuyên dùng khi test)
              </span>
              <span className="font-pixel rounded-none border-2 border-[var(--border-ink)] bg-[var(--px-gold)] px-1.5 py-0.5 text-[9px] font-bold text-[#140e04]">
                GIỮ LỊCH &amp; HỒ SƠ
              </span>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-sub">
              <li>
                • <strong className="text-main">Đưa về Level 1</strong>: 0 XP, 0 SP, 0 Gold/Runestones, HP 100, reset Cây Kĩ Năng, Hành Trình Chương I, Quests &amp; Nhật ký ngày.
              </li>
              <li>
                • <strong className="text-[var(--px-green-text)]">Giữ nguyên</strong>: Hồ sơ cá nhân, Thời khóa biểu đã nhập, Mục tiêu (về 0%) &amp; Cài đặt AI.
              </li>
            </ul>
          </button>

          {selectedMode === 'progress' && (
            <label className="px-inset flex cursor-pointer items-center gap-2 rounded-none px-3 py-2 text-xs text-sub">
              <input
                type="checkbox"
                checked={clearChats}
                onChange={(e) => setClearChats(e.target.checked)}
                disabled={busy}
              />
              <span>Xóa luôn lịch sử chat AI</span>
            </label>
          )}

          {/* Mode 2: Full Clean Factory Reset */}
          <button
            type="button"
            disabled={busy}
            onClick={() => setSelectedMode('clean')}
            className={`w-full rounded-none border-2 p-3.5 text-left ${
              selectedMode === 'clean'
                ? 'border-[var(--px-red)] bg-[var(--px-red)]/15'
                : 'px-inset hover:border-[var(--px-red)]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-display text-sm font-extrabold text-[var(--px-red-text)]">
                2. Reset Toàn Bộ Về Ban Đầu
              </span>
              <span className="font-pixel rounded-none border-2 border-[var(--border-ink)] bg-[var(--px-red)] px-1.5 py-0.5 text-[9px] font-bold text-white">
                CLEAN RESET
              </span>
            </div>
            <p className="mt-1.5 text-xs text-sub">
              Xóa sạch hồ sơ, thời khóa biểu, mục tiêu, quests, lịch sử chat &amp; mở lại màn hình khởi tạo ban đầu (chỉ giữ cấu hình API AI).
            </p>
          </button>
        </div>

        <div className="px-inset mt-4 flex items-center gap-2 rounded-none px-3 py-2 text-[11px] text-sub">
          <PxShield size={15} color="var(--px-green-text)" />
          <span>SQLite tự động tạo bản sao lưu an toàn trên ổ cứng trước khi reset.</span>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 border-t-2 pt-3.5 rpg-divider">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="btn-secondary rounded-none px-4 py-2 text-xs"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleConfirm()}
            className={`${
              selectedMode === 'clean' ? 'btn-crimson' : 'btn-primary'
            } flex items-center gap-1.5 rounded-none px-4 py-2 text-xs`}
          >
            {busy ? (
              <PxRefresh size={13} className="animate-spin" />
            ) : selectedMode === 'clean' ? (
              <PxTrash size={13} />
            ) : (
              <PxWarn size={13} color="#140e04" />
            )}
            <span>
              {busy
                ? 'Đang reset...'
                : selectedMode === 'clean'
                  ? 'Xác nhận Reset Toàn Bộ'
                  : 'Xác nhận Reset Tiến Trình'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
