import React, { useState } from 'react';
import { AlertTriangle, Loader2, RotateCcw, ShieldCheck, Trash2, X } from 'lucide-react';

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rpg-window relative w-full max-w-lg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="absolute right-4 top-4 p-1 text-dim hover:text-main"
          aria-label="Đóng"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 flex items-center gap-2.5 border-b-2 pb-3 rpg-divider">
          <RotateCcw className="h-5 w-5 text-amber-500" />
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
            className={`w-full rounded-[2px] border-2 p-3.5 text-left transition ${
              selectedMode === 'progress'
                ? 'border-amber-400 bg-amber-500/15'
                : 'studio-subtle rpg-divider hover:border-amber-500/50'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-sm font-extrabold text-main">
                1. Reset Tiến Trình (Khuyên dùng khi test)
              </span>
              <span className="font-pixel rounded-[2px] border border-amber-500/50 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-500 dark:text-amber-300">
                GIỮ LỊCH &amp; HỒ SƠ
              </span>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-sub">
              <li>
                • <strong className="text-main">Đưa về Level 1</strong>: 0 XP, 0 SP, 0 Gold/Runestones, HP 100, reset Cây Kĩ Năng, Hành Trình Chương I, Quests &amp; Nhật ký ngày.
              </li>
              <li>
                • <strong className="text-emerald-600 dark:text-emerald-400">Giữ nguyên</strong>: Hồ sơ cá nhân, Thời khóa biểu đã nhập, Mục tiêu (về 0%) &amp; Cài đặt AI.
              </li>
            </ul>
          </button>

          {selectedMode === 'progress' && (
            <label className="flex cursor-pointer items-center gap-2 rounded-[2px] border px-3 py-2 text-xs text-sub studio-subtle rpg-divider">
              <input
                type="checkbox"
                checked={clearChats}
                onChange={(e) => setClearChats(e.target.checked)}
                disabled={busy}
                className="h-3.5 w-3.5 accent-amber-500"
              />
              <span>Xóa luôn lịch sử chat AI</span>
            </label>
          )}

          {/* Mode 2: Full Clean Factory Reset */}
          <button
            type="button"
            disabled={busy}
            onClick={() => setSelectedMode('clean')}
            className={`w-full rounded-[2px] border-2 p-3.5 text-left transition ${
              selectedMode === 'clean'
                ? 'border-rose-500 bg-rose-500/15'
                : 'studio-subtle rpg-divider hover:border-rose-500/50'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-sm font-extrabold text-rose-500 dark:text-rose-400">
                2. Reset Toàn Bộ Về Ban Đầu
              </span>
              <span className="font-pixel rounded-[2px] border border-rose-500/40 bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-bold text-rose-400">
                CLEAN RESET
              </span>
            </div>
            <p className="mt-1.5 text-xs text-sub">
              Xóa sạch hồ sơ, thời khóa biểu, mục tiêu, quests, lịch sử chat &amp; mở lại màn hình khởi tạo ban đầu (chỉ giữ cấu hình API AI).
            </p>
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-[2px] border px-3 py-2 text-[11px] text-dim studio-subtle rpg-divider">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
          <span>SQLite tự động tạo bản sao lưu an toàn trên ổ cứng trước khi reset.</span>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 border-t-2 pt-3.5 rpg-divider">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="btn-secondary px-4 py-2 text-xs"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleConfirm()}
            className={`${
              selectedMode === 'clean' ? 'btn-crimson' : 'btn-primary'
            } flex items-center gap-1.5 px-4 py-2 text-xs`}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : selectedMode === 'clean' ? (
              <Trash2 className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
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
