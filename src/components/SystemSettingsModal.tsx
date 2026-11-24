import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Database,
  Download,
  HardDrive,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Upload,
  Wifi,
  X,
  XCircle,
} from 'lucide-react';
import type { AISettings, AuditLogEntry, StorageInfoPayload, SystemStatePayload } from '../types/system';
import { systemApi } from '../utils/api';

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
  const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs: number; reply?: string; error?: string } | null>(null);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="rpg-window relative max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6">
        <button onClick={onClose} className="absolute right-4 top-4 p-1.5 text-dim hover:text-main">
          <X className="h-5 w-5" />
        </button>

        <div className="mb-5 flex items-center gap-2.5 border-b-2 pb-3 rpg-divider">
          <Cpu className="h-5 w-5 text-amber-500" />
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
                setForm((f) => ({ ...f, providerName: p.providerName, baseUrl: p.baseUrl, model: p.model }))
              }
              className="btn-secondary px-2.5 py-1 text-xs"
            >
              {p.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-sm">
          <label className="flex cursor-pointer items-center justify-between border-2 p-3 studio-subtle rpg-divider rounded-[2px]">
            <div>
              <span className="font-semibold text-main">Kích hoạt Live OpenAI-Compatible LLM</span>
              <p className="text-xs text-sub">
                Tắt nếu muốn chạy miễn phí hoàn toàn bằng Smart Heuristic Offline.
              </p>
            </div>
            <input
              type="checkbox"
              checked={form.useLiveLlm}
              onChange={(e) => setForm({ ...form, useLiveLlm: e.target.checked })}
              className="h-4 w-4 accent-amber-500"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-sub">Provider Name</label>
              <input value={form.providerName} onChange={(e) => setForm({ ...form, providerName: e.target.value })} className="w-full px-3 py-2 text-sm" />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-sub">Model ID</label>
                <button
                  type="button"
                  onClick={handleFetchModels}
                  disabled={fetchingModels}
                  className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400"
                >
                  <RefreshCw className={`h-3 w-3 ${fetchingModels ? 'animate-spin' : ''}`} />
                  <span>Tải danh sách model</span>
                </button>
              </div>
              {availableModels.length > 0 ? (
                <select value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="w-full px-3 py-2 font-mono text-xs">
                  {availableModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="w-full px-3 py-2 text-sm" />
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-sub">Custom Base URL</label>
            <input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} className="w-full px-3 py-2 font-mono text-xs" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-sub">API Key (Lưu local trong SQLite)</label>
              <input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="sk-..." className="w-full px-3 py-2 font-mono text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-sub">Temperature</label>
              <input type="number" step="0.1" min="0" max="1.5" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })} className="w-full px-3 py-2 font-mono text-xs" />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-2 p-3 studio-subtle rpg-divider rounded-[2px]">
            <button type="button" onClick={handleTest} disabled={testing} className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs">
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
              <span>Kiểm tra kết nối</span>
            </button>

            {testResult && (
              <div className="font-mono text-xs">
                {testResult.ok ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    OK ({testResult.latencyMs}ms): {testResult.reply}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                    <XCircle className="h-4 w-4" />
                    {testResult.error}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Upgraded SQLite Vault & Disk Backup Block */}
          <div className="space-y-2.5 border-2 p-4 studio-subtle rpg-divider rounded-[2px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-main">
                <Database className="h-4 w-4 text-amber-500" />
                <span>SQLite Vault</span>
                <span className="border px-2 py-0.5 font-mono text-[10px] text-sub rpg-divider rounded-[2px]">
                  {journalMode} · FK: {fkStatus} · Integrity: {integrityOk ? 'OK' : 'WARN'}
                </span>
              </div>

              <button
                type="button"
                disabled={backingUp}
                onClick={handleDiskBackup}
                className="btn-secondary flex items-center gap-1.5 px-3 py-1 text-xs"
              >
                {backingUp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HardDrive className="h-3.5 w-3.5 text-amber-500" />}
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
              <div className="flex items-center gap-1.5 border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 font-mono text-[11px] text-emerald-700 dark:text-emerald-300 rounded-[2px]">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
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
                  <History className="h-3.5 w-3.5 text-amber-500" />
                  <span>Nhật ký Giao dịch (Audit Log) ({auditLogs.length})</span>
                </span>
                {showAuditPreview ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {showAuditPreview && (
                <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto pr-1 text-[11px]">
                  {auditLogs.length === 0 ? (
                    <p className="text-dim">Chưa có giao dịch nào được ghi.</p>
                  ) : (
                    auditLogs.slice(0, 8).map((entry) => (
                      <div key={entry.id} className="flex items-start justify-between gap-2 px-2 py-1 hover:bg-slate-500/10">
                        <div className="min-w-0">
                          <span className="font-mono text-[10px] font-semibold text-amber-600 dark:text-amber-400">
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
              <a href="/api/system/export" download="the-system-backup.json" className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs">
                <Download className="h-3.5 w-3.5" />
                <span>Export</span>
              </a>
              <input ref={importInputRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />
              <button type="button" onClick={() => importInputRef.current?.click()} className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs">
                <Upload className="h-3.5 w-3.5" />
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
                className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-500 dark:text-amber-300"
              >
                <RotateCcw className="h-3.5 w-3.5" />
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
                className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Toàn Bộ</span>
              </button>
            </div>

            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-1.5 px-5 py-2 text-xs">
              <Save className="h-4 w-4" />
              <span>Lưu cấu hình</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
