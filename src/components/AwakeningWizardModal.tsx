import React, { useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Cpu,
  Loader2,
  Target,
  UserCheck,
  X,
} from 'lucide-react';
import type { AISettings, PlayerProfile } from '../types/system';
import { systemApi } from '../utils/api';

interface AwakeningWizardModalProps {
  aiSettings: AISettings;
  profile: PlayerProfile;
  onSaveAI: (s: Partial<AISettings>) => Promise<void>;
  onSaveProfile: (p: Partial<PlayerProfile>) => Promise<void>;
  onImportTimetable: (rawText: string, replaceAll: boolean) => Promise<void>;
  onAnalyzeGoal: (rawInput: string) => Promise<void>;
  onComplete: () => Promise<void>;
}

const WIZARD_LIFE_TEMPLATES = [
  {
    label: '+ Khối Công việc / Học tập Sáng 08:00-12:00 T2-T6',
    line: 'Thứ 2-6 Khối Công việc / Học tập Sáng 08:00-12:00',
  },
  {
    label: '+ Khối Chiều 13:30-17:30 T2-T6',
    line: 'Thứ 2-6 Khối Chiều 13:30-17:30',
  },
  {
    label: '+ Lớp Kỹ năng / Rèn luyện Tối 19:00-21:00 T3-T5-T7',
    line: 'Tối thứ 3, 5, 7 Lớp Kỹ năng / Rèn luyện Tối 19:00-21:00',
  },
  {
    label: '+ Rèn luyện Thể chất 17:30-18:30 T2-T4-T6',
    line: 'Thứ 2, 4, 6 Rèn luyện Thể chất 17:30-18:30',
  },
  {
    label: '+ Nhịp Ngủ & Hồi phục 23:00-06:30 Cả tuần',
    line: 'Cả tuần Nhịp Ngủ & Hồi phục 23:00-06:30',
  },
];

export const AwakeningWizardModal: React.FC<AwakeningWizardModalProps> = ({
  aiSettings,
  profile,
  onSaveAI,
  onSaveProfile,
  onImportTimetable,
  onAnalyzeGoal,
  onComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [busy, setBusy] = useState(false);

  const [useLiveLlm, setUseLiveLlm] = useState(aiSettings.useLiveLlm);
  const [baseUrl, setBaseUrl] = useState(aiSettings.baseUrl);
  const [apiKey, setApiKey] = useState(aiSettings.apiKey);
  const [model, setModel] = useState(aiSettings.model);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const [name, setName] = useState(profile.name === 'New Player' ? '' : profile.name);
  const [role, setRole] = useState(profile.currentRole);
  const [strengths, setStrengths] = useState(profile.strengths.join(', '));
  const [weaknesses, setWeaknesses] = useState(profile.weaknesses.join(', '));

  const [scheduleText, setScheduleText] = useState(
    'Thứ 2-6 Khối Công việc / Học tập Sáng 08:00-12:00\nThứ 2-6 Khối Chiều 13:30-17:30\nThứ 2, 4, 6 Rèn luyện Thể chất 17:30-18:30\nTối thứ 3, 5, 7 Lớp Kỹ năng / Rèn luyện Tối 19:00-21:00\nCả tuần Nhịp Ngủ & Hồi phục 23:00-06:30'
  );
  const [goalText, setGoalText] = useState('');

  const handleTestAI = async () => {
    setBusy(true);
    setTestMsg(null);
    try {
      const res = await systemApi.testAIConnection({ ...aiSettings, useLiveLlm: true, baseUrl, apiKey, model });
      setTestMsg(res.ok ? `OK (${res.latencyMs}ms): ${res.reply}` : `Lỗi: ${res.error}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="rpg-window relative max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6 md:p-8">
        <button onClick={onComplete} className="absolute right-4 top-4 flex items-center gap-1 text-xs text-dim hover:text-main">
          <span>Bỏ qua</span>
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5">
          <p className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
            BƯỚC {step} / 4 • THIẾT LẬP NHANH • HÀNH TRÌNH 8 CHƯƠNG · 30 KĨ NĂNG
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-main">
            Khởi tạo Hồ sơ Phát triển Cá nhân (Level 1)
          </h2>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className={`h-2 border rpg-divider ${step >= n ? 'bg-amber-500' : 'studio-subtle'}`} />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 font-semibold text-main">
              <Cpu className="h-4 w-4 text-indigo-600" />
              <span>1. Kết nối AI LLM (hoặc dùng Offline Heuristic)</span>
            </div>
            <label className="flex items-center justify-between rounded-lg p-3 text-xs studio-subtle">
              <span className="font-semibold text-main">Bật Live LLM API</span>
              <input type="checkbox" checked={useLiveLlm} onChange={(e) => setUseLiveLlm(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-sub">Base URL</label>
                <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="w-full px-3 py-2 font-mono text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-sub">Model</label>
                <input value={model} onChange={(e) => setModel(e.target.value)} className="w-full px-3 py-2 font-mono text-xs" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-sub">API Key</label>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-... (có thể bỏ trống nếu dùng Offline)" className="w-full px-3 py-2 font-mono text-xs" />
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleTestAI} disabled={busy} className="btn-secondary px-3 py-1.5 text-xs">
                Kiểm tra kết nối
              </button>
              {testMsg && <span className="font-mono text-xs text-emerald-600">{testMsg}</span>}
            </div>
            <div className="flex justify-end pt-2">
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onSaveAI({ useLiveLlm, baseUrl, apiKey, model });
                    setStep(2);
                  } finally {
                    setBusy(false);
                  }
                }}
                className="btn-primary flex items-center gap-1.5 px-5 py-2 text-xs"
              >
                <span>Tiếp tục</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 font-semibold text-main">
              <UserCheck className="h-4 w-4 text-indigo-600" />
              <span>2. Thông tin cá nhân của bạn</span>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-medium text-sub">Tên của bạn</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Minh Anh..." className="w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block font-medium text-sub">Vai trò / Lĩnh vực hiện tại</label>
                <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="VD: Kỹ sư, Sinh viên, Nhà nghiên cứu, Creator..." className="w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block font-medium text-sub">Điểm mạnh</label>
                <input value={strengths} onChange={(e) => setStrengths(e.target.value)} className="w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block font-medium text-sub">Điểm yếu cần cải thiện</label>
                <input value={weaknesses} onChange={(e) => setWeaknesses(e.target.value)} className="w-full px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(1)} className="btn-secondary px-4 py-2 text-xs">Quay lại</button>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
                    await onSaveProfile({ name: name.trim() || 'Player', currentRole: role.trim(), strengths: split(strengths), weaknesses: split(weaknesses) });
                    setStep(3);
                  } finally {
                    setBusy(false);
                  }
                }}
                className="btn-primary flex items-center gap-1.5 px-5 py-2 text-xs"
              >
                <span>Lưu & Tiếp tục</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 font-semibold text-main">
              <CalendarClock className="h-4 w-4 text-indigo-600" />
              <span>3. Import Lịch cố định (Công việc / Học tập, Rèn luyện & Giờ ngủ)</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {WIZARD_LIFE_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() =>
                    setScheduleText((prev) =>
                      prev.includes(tpl.line)
                        ? prev
                        : prev.trim()
                          ? `${prev.trim()}\n${tpl.line}`
                          : tpl.line
                    )
                  }
                  className="btn-secondary px-2 py-1 text-[11px]"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
            <textarea rows={5} value={scheduleText} onChange={(e) => setScheduleText(e.target.value)} className="w-full p-3 font-mono text-xs" />
            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(2)} className="btn-secondary px-4 py-2 text-xs">Quay lại</button>
              <div className="flex gap-2">
                <button onClick={() => setStep(4)} className="btn-secondary px-4 py-2 text-xs">Để sau</button>
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      if (scheduleText.trim()) await onImportTimetable(scheduleText, true);
                      setStep(4);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="btn-primary flex items-center gap-1.5 px-5 py-2 text-xs"
                >
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Import & Tiếp tục</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 font-semibold text-main">
              <Target className="h-4 w-4 text-indigo-600" />
              <span>4. Mục tiêu đầu tiên của bạn</span>
            </div>
            <textarea rows={3} value={goalText} onChange={(e) => setGoalText(e.target.value)} placeholder="VD: Nâng cấp năng lực chuyên môn & hoàn thành dự án trọng điểm, hoặc duy trì rèn luyện thể chất & học ngoại ngữ..." className="w-full p-3 text-sm" />
            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(3)} className="btn-secondary px-4 py-2 text-xs">Quay lại</button>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    if (goalText.trim()) await onAnalyzeGoal(goalText.trim());
                    await onComplete();
                  } finally {
                    setBusy(false);
                  }
                }}
                className="btn-primary flex items-center gap-1.5 px-5 py-2 text-xs"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                <span>Bắt đầu ngay (Level 1)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
