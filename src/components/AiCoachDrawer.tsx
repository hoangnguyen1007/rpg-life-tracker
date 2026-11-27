import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type {
  AIChatMessage,
  AIChatThread,
  AISettings,
  AttributeKey,
  ChatContextScope,
  DayScheduleAnalysis,
  PlayerState,
  QuestRank,
  QuestType,
} from '../types/system';
import { MarkdownContent } from './MarkdownContent';
import {
  PxAutomaton,
  PxClose,
  PxCoffee,
  PxPlus,
  PxSparkle,
  PxTrash,
} from './PixelIcons';
import { DayAllocationDonut } from './VisualIllustrations';

const CHAT_SCOPES: Array<{ key: ChatContextScope; label: string; placeholder: string }> = [
  { key: 'general', label: 'Tổng hợp', placeholder: 'Hỏi AI về kế hoạch & ưu tiên hôm nay...' },
  { key: 'timetable', label: 'Lịch', placeholder: 'Hỏi AI cách sắp xếp giờ trống hôm nay...' },
  { key: 'goals', label: 'Mục tiêu', placeholder: 'Hỏi AI về lộ trình & bước tiếp theo...' },
  { key: 'skills', label: 'Kĩ năng', placeholder: 'Hỏi AI về kỹ năng cần tập trung...' },
  { key: 'review', label: 'Phản tư', placeholder: 'Phân tích lý do trì hoãn hoặc mệt mỏi...' },
];

const QUICK_CHIPS = [
  'Gợi ý 2 việc trọng tâm hợp giờ vàng của tôi',
  'Hôm nay mệt, nên giữ những gì ở mức tối thiểu?',
  'Phân tích điểm nghẽn gần đây của tôi',
];

export interface AiCoachDrawerProps {
  open: boolean;
  onClose: () => void;
  player: PlayerState;
  aiSettings: AISettings;
  todayAnalysis: DayScheduleAnalysis;
  chatThreads: AIChatThread[];
  activeChatThreadId: string | null;
  chatDraftsByKey: Record<string, string>;
  pendingChatKeys: Record<string, boolean>;
  optimisticMessagesByKey: Record<string, AIChatMessage | undefined>;
  chatErrorByKey: Record<string, string | null>;
  initialReflectionNote: string;
  onSelectChatThread: (threadId: string) => void;
  onCreateChatThread: (contextScope: ChatContextScope, title?: string) => Promise<void>;
  onDeleteChatThread: (threadId: string) => Promise<void>;
  onChangeChatDraft: (key: string, value: string) => void;
  onSendChatPrompt: (
    prompt: string,
    contextScope?: ChatContextScope,
    explicitThreadId?: string | null
  ) => Promise<void>;
  onCreateCustomQuest: (payload: {
    title: string;
    description?: string;
    type?: QuestType;
    rank?: QuestRank;
    durationMinutes?: number;
    scheduledSlot?: string;
    learningMethod?: string;
    primaryStat?: AttributeKey;
  }) => Promise<void>;
  onReflect: (payload: { reflectionNote?: string; plannedRestMode?: boolean }) => Promise<unknown>;
}

export const AiCoachDrawer: React.FC<AiCoachDrawerProps> = ({
  open,
  onClose,
  player,
  aiSettings,
  todayAnalysis,
  chatThreads,
  activeChatThreadId,
  chatDraftsByKey,
  pendingChatKeys,
  optimisticMessagesByKey,
  chatErrorByKey,
  initialReflectionNote,
  onSelectChatThread,
  onCreateChatThread,
  onDeleteChatThread,
  onChangeChatDraft,
  onSendChatPrompt,
  onCreateCustomQuest,
  onReflect,
}) => {
  const [drawerTab, setDrawerTab] = useState<'chat' | 'rhythm'>('chat');
  const [scope, setScope] = useState<ChatContextScope>('general');
  const [reflectionDraft, setReflectionDraft] = useState(initialReflectionNote);
  const [savingReflect, setSavingReflect] = useState(false);
  const [addingSugIdx, setAddingSugIdx] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setReflectionDraft(initialReflectionNote);
  }, [initialReflectionNote]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const activeThread =
    chatThreads.find((t) => t.id === activeChatThreadId) || chatThreads[0] || null;
  const draftKey = activeThread?.id || '__new__';
  const draftVal = chatDraftsByKey[draftKey] ?? '';
  const isSending = Boolean(pendingChatKeys[draftKey]);
  const optimisticMsg = optimisticMessagesByKey[draftKey];
  const chatErr = chatErrorByKey[draftKey];

  const messages: AIChatMessage[] = [
    ...(activeThread?.messages || []),
    ...(optimisticMsg ? [optimisticMsg] : []),
  ];

  useEffect(() => {
    if (open && drawerTab === 'chat') {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, open, drawerTab]);

  if (!open) return null;

  const currentScopeMeta = CHAT_SCOPES.find((s) => s.key === scope) || CHAT_SCOPES[0];
  const isLiveAi = Boolean(aiSettings.useLiveLlm && aiSettings.baseUrl);

  const handleSend = async (text?: string) => {
    const prompt = (text ?? draftVal).trim();
    if (!prompt || isSending) return;
    await onSendChatPrompt(prompt, activeThread?.contextScope || scope, activeThread?.id ?? null);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/55"
      onClick={onClose}
      role="dialog"
      aria-label="Cố vấn AI"
    >
      <aside
        className="flex h-full w-full max-w-[440px] flex-col border-l-2 border-[var(--border-ink)] bg-[var(--bg-surface)] shadow-[-6px_0_0_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] px-4 py-3">
          <div className="flex items-center gap-2">
            <PxAutomaton size={16} color="var(--px-gold-text)" />
            <h2 className="font-display text-sm font-extrabold text-main">Cố vấn AI</h2>
            <span className="px-pill font-mono text-[10px]">
              {isLiveAi ? aiSettings.model : 'Offline'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-dim hover:bg-[var(--bg-surface-2)] hover:text-main"
            aria-label="Đóng Cố vấn AI"
          >
            <PxClose size={14} />
          </button>
        </div>

        {/* 2 Clean Drawer Tabs */}
        <div className="grid grid-cols-2 border-b border-[var(--border-hairline)] bg-[var(--bg-subtle)]">
          <button
            type="button"
            onClick={() => setDrawerTab('chat')}
            className={`py-2 text-xs font-bold ${
              drawerTab === 'chat'
                ? 'border-b-2 border-[var(--px-gold)] bg-[var(--bg-surface)] text-[var(--px-gold-text)]'
                : 'text-sub hover:text-main'
            }`}
          >
            Hỏi đáp & Gợi ý
          </button>
          <button
            type="button"
            onClick={() => setDrawerTab('rhythm')}
            className={`py-2 text-xs font-bold ${
              drawerTab === 'rhythm'
                ? 'border-b-2 border-[var(--px-gold)] bg-[var(--bg-surface)] text-[var(--px-gold-text)]'
                : 'text-sub hover:text-main'
            }`}
          >
            Nhịp 24h & Phản tư
          </button>
        </div>

        {drawerTab === 'chat' ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Compact Thread & Scope Strip */}
            <div className="flex items-center gap-1.5 border-b border-[var(--border-hairline)] px-3 py-2">
              <select
                value={activeThread?.id || ''}
                onChange={(e) => {
                  if (e.target.value) onSelectChatThread(e.target.value);
                }}
                className="min-w-0 flex-1 px-2 py-1 text-xs"
              >
                {chatThreads.length === 0 && <option value="">Cuộc trò chuyện mới</option>}
                {chatThreads.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void onCreateChatThread(scope)}
                className="btn-secondary p-1.5"
                title="Tạo luồng mới"
              >
                <PxPlus size={12} />
              </button>
              {activeThread && (
                <button
                  type="button"
                  onClick={() => void onDeleteChatThread(activeThread.id)}
                  className="btn-secondary p-1.5 text-dim hover:text-[var(--px-red-text)]"
                  title="Xóa luồng hiện tại"
                >
                  <PxTrash size={12} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1 border-b border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 py-1.5">
              {CHAT_SCOPES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setScope(s.key)}
                  className={`px-2 py-0.5 text-[11px] font-semibold ${
                    scope === s.key
                      ? 'bg-[var(--px-gold)] text-[#140e04]'
                      : 'text-sub hover:bg-[var(--bg-surface-2)] hover:text-main'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3.5">
              {messages.length === 0 ? (
                <div className="space-y-3 py-4 text-center">
                  <PxSparkle size={22} className="mx-auto text-[var(--px-gold-text)]" />
                  <p className="text-xs text-sub">
                    AI đã tự đồng bộ Thói quen cốt lõi, Giờ vàng thực tế và Mục tiêu của bạn.
                  </p>
                  <div className="space-y-1.5 text-left">
                    {QUICK_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => void handleSend(chip)}
                        className="w-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 py-2 text-left text-xs text-sub hover:border-[var(--px-gold)] hover:text-main"
                      >
                        → {chip}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3 text-xs ${
                      m.role === 'user'
                        ? 'ml-6 border border-[var(--px-gold)] bg-[var(--bg-surface-2)] text-main'
                        : 'mr-2 border border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-main'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between text-[10px] font-mono text-dim">
                      <span>{m.role === 'user' ? player.profile.name : 'THE SYSTEM'}</span>
                      {m.modelUsed && <span>{m.modelUsed}</span>}
                    </div>
                    <MarkdownContent content={m.content} />
                    {m.suggestedQuests && m.suggestedQuests.length > 0 && (
                      <div className="mt-2.5 space-y-1.5 border-t border-[var(--border-hairline)] pt-2">
                        {m.suggestedQuests.map((sq, idx) => {
                          const key = `${m.id}-${idx}`;
                          return (
                            <div
                              key={key}
                              className="flex items-center justify-between gap-2 bg-[var(--bg-surface)] px-2.5 py-1.5"
                            >
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-main">{sq.title}</div>
                                <div className="font-mono text-[10px] text-dim">
                                  {sq.durationMinutes}p · {sq.primaryStat}
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={addingSugIdx === key}
                                onClick={async () => {
                                  setAddingSugIdx(key);
                                  try {
                                    await onCreateCustomQuest({
                                      title: sq.title,
                                      description: sq.description,
                                      type: sq.type,
                                      rank: sq.rank,
                                      durationMinutes: sq.durationMinutes,
                                      scheduledSlot: 'Flexible',
                                      learningMethod: sq.learningMethod,
                                      primaryStat: sq.primaryStat,
                                    });
                                  } finally {
                                    setAddingSugIdx(null);
                                  }
                                }}
                                className="btn-primary shrink-0 px-2 py-1 text-[10px]"
                              >
                                {addingSugIdx === key ? '...' : '+ Thêm'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}

              {isSending && (
                <div className="flex items-center gap-2 text-xs text-dim">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang phân tích dữ liệu cá nhân...</span>
                </div>
              )}
              {chatErr && (
                <div className="border border-[var(--px-red)] bg-[var(--px-red)]/10 p-2 text-xs text-[var(--px-red-text)]">
                  {chatErr}
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
              className="flex items-center gap-2 border-t border-[var(--border-hairline)] p-3"
            >
              <input
                value={draftVal}
                onChange={(e) => onChangeChatDraft(draftKey, e.target.value)}
                placeholder={currentScopeMeta.placeholder}
                className="min-w-0 flex-1 px-3 py-2 text-xs"
              />
              <button
                type="submit"
                disabled={isSending || !draftVal.trim()}
                className="btn-primary shrink-0 px-3.5 py-2 text-xs"
              >
                Gửi
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {/* 24h Schedule Balance */}
            <div className="px-card p-3.5">
              <h3 className="mb-2 text-xs font-bold text-main">
                Phân bổ 24h hôm nay ({todayAnalysis.dayLabel})
              </h3>
              <DayAllocationDonut analysis={todayAnalysis} />
              <div className="mt-3 space-y-1 text-xs text-sub">
                <div className="flex justify-between">
                  <span>Khung rảnh khả dụng</span>
                  <strong className="font-mono text-main">
                    {(todayAnalysis.totalFreeMinutes / 60).toFixed(1)}h
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Đề xuất tải nhiệm vụ</span>
                  <strong className="font-mono text-[var(--px-green-text)]">
                    {todayAnalysis.recommendedQuestMinutes}p
                  </strong>
                </div>
              </div>
            </div>

            {/* Planned Rest / Grace Day */}
            <div className="px-card flex items-center justify-between gap-3 p-3.5">
              <div>
                <div className="text-xs font-bold text-main">Chế độ Nghỉ Chủ Động (Grace Day)</div>
                <p className="mt-0.5 text-[11px] text-sub">
                  Bảo toàn chuỗi ngày, hồi HP và tắt áp lực nhiệm vụ nặng hôm nay.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onReflect({ plannedRestMode: !player.plannedRestMode })}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs ${
                  player.plannedRestMode ? 'btn-emerald' : 'btn-secondary'
                }`}
              >
                <PxCoffee size={13} />
                <span>{player.plannedRestMode ? 'Đang bật' : 'Bật'}</span>
              </button>
            </div>

            {/* Quick Reflection Note */}
            <div className="px-card space-y-2.5 p-3.5">
              <h3 className="text-xs font-bold text-main">Ghi nhanh Phản tư hôm nay</h3>
              <textarea
                rows={4}
                value={reflectionDraft}
                onChange={(e) => setReflectionDraft(e.target.value)}
                placeholder="Hôm nay điều gì đang trôi chảy? Điều gì làm bạn mất nhịp?"
                className="w-full p-2.5 text-xs"
              />
              <button
                type="button"
                disabled={savingReflect || !reflectionDraft.trim()}
                onClick={async () => {
                  setSavingReflect(true);
                  try {
                    await onReflect({ reflectionNote: reflectionDraft.trim() });
                  } finally {
                    setSavingReflect(false);
                  }
                }}
                className="btn-primary w-full py-2 text-xs"
              >
                {savingReflect ? 'Đang lưu...' : 'Lưu Phản tư'}
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};
