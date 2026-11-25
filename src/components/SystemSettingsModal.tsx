import React, { useRef, useState } from 'react';
import type {
  AISettings,
  AuditLogEntry,
  StorageInfoPayload,
  SystemStatePayload,
} from '../types/system';
import { systemApi } from '../utils/api';
import {
  PixelRivets,
  PxBook,
  PxCheck,
  PxChevron,
  PxClock,
  PxClose,
  PxGear,
  PxRefresh,
  PxReset,
  PxSave,
  PxScroll,
  PxShield,
  PxSparkle,
  PxWarn,
} from './PixelIcons';

interface SystemSettingsModalProps {
  settings: AISettings;
  storageInfo: StorageInfoPayload;
  auditLogs?: AuditLogEntry[];
  onSaveSettings: (settings: Partial<AISettings>) => Promise<void>;
  onImportSnapshot: (snapshot: unknown) => Promise<void>;
  onResetSystem: (mode: 'progress' | 'clean', clearChats?: boolean) => Promise<void>;
  onStateUpdated?: (state: SystemStatePayload) => void;
  onClose: () => void;
}

const PROVIDER_PRESETS = [
  { label: 'OpenAI', providerName: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: 'Google Gemini', providerName: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
  { label: 'Ollama (Local)', providerName: 'Ollama Local', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:7b' },
  { label: 'LM Studio (Local)', providerName: 'LM Studio', baseUrl: 'http://localhost:1234/v1', model: 'local-model' },
  { label: 'OpenRouter', providerName: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { label: 'DeepSeek', providerName: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
];

export const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({
  settings,
  storageInfo,
  auditLogs = [],
  onSaveSettings,
  onImportSnapshot,
  onResetSystem,
  onStateUpdated,
  onClose,
}) => {
  const [form, setForm] = useState<AISettings>({ ...settings });
  const [testing, setTesting] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    latencyMs: number;
    reply?: string;
    error?: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [showAuditPreview, setShowAuditPreview] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await systemApi.testAIConnection(form);
      setTestResult(res);
    } finally {
      setTesting(false);
    }
  };

  const handleFetchModels = async () => {
    setFetchingModels(true);
    try {
      const res = await systemApi.fetchAIModels(form);
      if (res.ok && res.models.length > 0) {
        setAvailableModels(res.models);
      } else if (res.error) {
        setTestResult({ ok: false, latencyMs: 0, error: res.error });
      }
    } finally {
      setFetchingModels(false);
    }
  };

  const handleDiskBackup = async () => {
    setBackingUp(true);
    setBackupNotice(null);
    try {
      const res = await systemApi.createDiskBackup();
      onStateUpdated?.(res.state);
      setBackupNotice(`Đã lưu backup: ${res.filename} (${(res.sizeBytes / 1024).toFixed(1)} KB)`);
    } catch (err) {
      setBackupNotice(err instanceof Error ? `Lỗi backup: ${err.message}` : 'Không thể tạo backup.');
    } finally {
      setBackingUp(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await onImportSnapshot(JSON.parse(text));
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'File backup JSON không hợp lệ.');
    }
    e.target.value = '';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveSettings(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const sqliteKb = (storageInfo.fileSizeBytes / 1024).toFixed(1);
  const walKb = ((storageInfo.walSizeBytes ?? 0) / 1024).toFixed(1);
  const journalMode = (storageInfo.journalMode || 'WAL').toUpperCase();
  const fkStatus = storageInfo.foreignKeysEnabled === false ? 'OFF' : 'ON';
  const integrityOk = storageInfo.integrityOk !== false;
  const backupCount = storageInfo.backupCount ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="rpg-window relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-none p-6">
        <PixelRivets />

        <button
          type="button"
          onClick={onClose}
          className="btn-secondary absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-none"
          aria-label="Đóng"
        >
          <PxClose size={13} />
        </button>

        <div className="mb-5 flex items-center gap-2.5 border-b-2 pb-3 pr-10 rpg-divider">
          <div className="px-inset flex h-9 w-9 shrink-0 items-center justify-center rounded-none text-[var(--px-gold-text)]">
            <PxGear size={18} />
          </div>
          <div>
            <h2 className="font-display text-lg font-extrabold text-main">
              Cài đặt AI LLM &amp; SQLite
            </h2>
            <p className="text-xs text-dim">
              OpenAI-compatible API &amp; sao lưu dữ liệu cục bộ
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {PROVIDER_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  providerName: p.providerName,
                  baseUrl: p.baseUrl,
                  model: p.model,
                }))
              }
              className="btn-secondary rounded-none px-2.5 py-1 text-xs"
            >
              {p.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-sm">
          <label className="px-inset flex cursor-pointer items-center justify-between gap-3 rounded-none p-3">
            <div>
              <span className="font-semibold text-main">
                Kích hoạt Live OpenAI-Compatible LLM
              </span>
              <p className="text-xs text-sub">
                Tắt nếu muốn chạy miễn phí hoàn toàn bằng Smart Heuristic Offline.
              </p>
            </div>
            <input
              type="checkbox"
              checked={form.useLiveLlm}
              onChange={(e) => setForm({ ...form, useLiveLlm: e.target.checked })}
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-sub">Provider Name</label>
              <input
                value={form.providerName}
                onChange={(e) => setForm({ ...form, providerName: e.target.value })}
                className="w-full rounded-none px-3 py-2 text-sm"
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-sub">Model ID</label>
                <button
                  type="button"
                  onClick={() => void handleFetchModels()}
                  disabled={fetchingModels}
                  className="flex items-center gap-1 text-xs font-bold text-[var(--px-gold-text)]"
                >
                  <PxRefresh size={12} className={fetchingModels ? 'animate-spin' : ''} />
                  <span>Tải danh sách model</span>
                </button>
              </div>
              {availableModels.length > 0 ? (
                <select
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  className="w-full rounded-none px-3 py-2 font-mono text-xs"
                >
                  {availableModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  className="w-full rounded-none px-3 py-2 text-sm"
                />
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-sub">Custom Base URL</label>
            <input
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              className="w-full rounded-none px-3 py-2 font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-sub">
                API Key (Lưu local trong SQLite)
              </label>
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full rounded-none px-3 py-2 font-mono text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-sub">Temperature</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1.5"
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
                className="w-full rounded-none px-3 py-2 font-mono text-xs"
              />
            </div>
          </div>

          <div className="px-inset flex flex-wrap items-center justify-between gap-2 rounded-none p-3">
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={testing}
              className="btn-secondary flex items-center gap-1.5 rounded-none px-3 py-1.5 text-xs"
            >
              {testing ? (
                <PxRefresh size={13} className="animate-spin" />
              ) : (
                <PxSparkle size={13} />
              )}
              <span>Kiểm tra kết nối</span>
            </button>

            {testResult && (
              <div className="font-mono text-xs">
                {testResult.ok ? (
                  <span className="flex items-center gap-1 font-bold text-[var(--px-green-text)]">
                    <PxCheck size={14} />
                    OK ({testResult.latencyMs}ms): {testResult.reply}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-bold text-[var(--px-red-text)]">
                    <PxWarn size={14} danger />
                    {testResult.error}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Upgraded 16-Bit SQLite Vault & Disk Backup Block */}
          <div className="px-inset space-y-2.5 rounded-none p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-main">
                <PxBook size={15} color="var(--px-gold-text)" />
                <span>SQLite Vault</span>
                <span className="rounded-none border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 py-0.5 font-mono text-[10px] text-sub">
                  {journalMode} · FK: {fkStatus} · Integrity: {integrityOk ? 'OK' : 'WARN'}
                </span>
              </div>

              <button
                type="button"
                disabled={backingUp}
                onClick={() => void handleDiskBackup()}
                className="btn-secondary flex items-center gap-1.5 rounded-none px-3 py-1 text-xs"
              >
                {backingUp ? (
                  <PxRefresh size={13} className="animate-spin" />
                ) : (
                  <PxSave size={13} color="var(--px-gold-text)" />
                )}
                <span>Backup Ổ Cứng Ngay</span>
              </button>
            </div>

            <p className="break-all font-mono text-[11px] text-sub">{storageInfo.dbPath}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-dim">
              <span>DB: {sqliteKb} KB</span>
              <span>WAL: {walKb} KB</span>
              <span>Backups: {backupCount}</span>
              <span>Chapters: {storageInfo.tableCounts.chapters ?? 8}</span>
              <span>Bosses: {storageInfo.tableCounts.bosses}</span>
              <span>Audit: {storageInfo.tableCounts.auditLogs ?? auditLogs.length}</span>
            </div>

            {backupNotice && (
              <div className="flex items-center gap-1.5 rounded-none border-2 border-[var(--px-green)] bg-[var(--px-green)]/15 px-2.5 py-1.5 font-mono text-[11px] font-bold text-[var(--px-green-text)]">
                <PxShield size={13} />
                <span>{backupNotice}</span>
              </div>
            )}

            <div className="border-t-2 pt-2 rpg-divider">
              <button
                type="button"
                onClick={() => setShowAuditPreview((v) => !v)}
                className="flex w-full items-center justify-between text-xs font-medium text-sub hover:text-main"
              >
                <span className="flex items-center gap-1.5">
                  <PxClock size={13} color="var(--px-gold-text)" />
                  <span>Nhật ký Giao dịch (Audit Log) ({auditLogs.length})</span>
                </span>
                <PxChevron dir={showAuditPreview ? 'up' : 'down'} size={13} />
              </button>
              {showAuditPreview && (
                <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto pr-1 text-[11px]">
                  {auditLogs.length === 0 ? (
                    <p className="text-dim">Chưa có giao dịch nào được ghi.</p>
                  ) : (
                    auditLogs.slice(0, 8).map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start justify-between gap-2 border-b px-2 py-1 last:border-b-0 rpg-divider"
                      >
                        <div className="min-w-0">
                          <span className="font-mono text-[10px] font-bold text-[var(--px-gold-text)]">
                            [{entry.actionType}]
                          </span>{' '}
                          <span className="text-main">{entry.summary}</span>
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-dim">
                          {entry.timestamp.slice(11, 19)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 pt-4 rpg-divider">
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/api/system/export"
                download="the-system-backup.json"
                className="btn-secondary flex items-center gap-1.5 rounded-none px-3 py-1.5 text-xs"
              >
                <PxSave size={13} />
                <span>Export</span>
              </a>
              <input
                ref={importInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="btn-secondary flex items-center gap-1.5 rounded-none px-3 py-1.5 text-xs"
              >
                <PxScroll size={13} />
                <span>Import</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (
                    window.confirm(
                      'Reset tiến trình về Level 1 (0 XP, 0 SP) nhưng giữ nguyên Hồ sơ & Thời khóa biểu?'
                    )
                  ) {
                    await onResetSystem('progress', false);
                    onClose();
                  }
                }}
                className="btn-secondary flex items-center gap-1.5 rounded-none px-3 py-1.5 text-xs text-[var(--px-gold-text)]"
              >
                <PxReset size={13} />
                <span>Reset Tiến Trình</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (
                    window.confirm(
                      'Reset toàn bộ dữ liệu (hồ sơ, thời khóa biểu, mục tiêu, chat) về trạng thái ban đầu?'
                    )
                  ) {
                    await onResetSystem('clean', true);
                    onClose();
                  }
                }}
                className="btn-secondary flex items-center gap-1.5 rounded-none px-3 py-1.5 text-xs text-[var(--px-red-text)]"
              >
                <PxReset size={13} />
                <span>Reset Toàn Bộ</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex items-center gap-1.5 rounded-none px-5 py-2 text-xs"
            >
              <PxSave size={14} />
              <span>Lưu cấu hình</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
