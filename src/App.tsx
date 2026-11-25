import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Loader2 } from 'lucide-react';
import type {
  ActivityCategory,
  AIChatMessage,
  AssistantOverviewPayload,
  ChatContextScope,
  Quest,
  RaidChestId,
  RaidDifficultyTier,
  RejectionReason,
  SystemResetMode,
  SystemStatePayload,
  WeeklyBlueprintBlockDraft,
  WeeklyRaidPayload,
} from './types/system';
import {
  claimWeeklyRaidChest,
  fetchWeeklyRaid,
  isLanAuthError,
  isTauriDesktop,
  regenerateWeeklyRaidAi,
  setLanToken,
  setWeeklyRaidDifficulty,
  systemApi,
} from './utils/api';
import { soundEngine } from './utils/soundEngine';
import { getVnTodayKey } from './utils/timeVn';
import { TopSystemHud } from './components/TopSystemHud';
import {
  PixelRivets,
  PxAutomaton,
  PxCalendar,
  PxChest,
  PxClose,
  PxCmd,
  PxCoffee,
  PxEye,
  PxEyeOff,
  PxGear,
  PxGhost,
  PxMoon,
  PxRefresh,
  PxReset,
  PxScroll,
  PxSearch,
  PxShield,
  PxSkillTree,
  PxSkull,
  PxSparkle,
  PxSun,
  PxTarget,
} from './components/PixelIcons';
import { SkillTreeView } from './components/SkillTreeView';
import { BossAndSkillsView } from './components/BossAndSkillsView';
import { QuestCouncilBoard } from './components/QuestCouncilBoard';
import { StatusWindow } from './components/StatusWindow';
import { TimetablePlanner } from './components/TimetablePlanner';
import { ProfileGoalsConsole } from './components/ProfileGoalsConsole';
import { ShopAndInventoryView } from './components/ShopAndInventoryView';
import { ShadowArmyModal } from './components/ShadowArmyModal';
import { DungeonFocusModal } from './components/DungeonFocusModal';
import { SystemSettingsModal } from './components/SystemSettingsModal';
import { AwakeningWizardModal } from './components/AwakeningWizardModal';
import { DeathCheckpointModal } from './components/DeathCheckpointModal';
import { ResetProgressModal } from './components/ResetProgressModal';
import { AssistantCenterView } from './components/AssistantCenterView';
import { FloatingHudPage } from './components/FloatingHudPage';
import { MobileQuickView } from './components/MobileQuickView';

type TabKey = 'quests' | 'skills' | 'campaign' | 'timetable' | 'hero' | 'assistant';
type HeroSubTab = 'status' | 'profile' | 'shop' | 'shadows';
type AppViewMode = 'main' | 'hud' | 'mobile';

function getViewModeFromLocation(): AppViewMode {
  if (typeof window === 'undefined') return 'main';
  const rawHash = window.location.hash.replace(/^#/, '').split('?')[0].toLowerCase();
  const rawPath = window.location.pathname.toLowerCase();
  if (rawHash === '/hud' || rawHash === 'hud' || rawPath === '/hud') return 'hud';
  if (rawHash === '/mobile' || rawHash === 'mobile' || rawPath === '/mobile') return 'mobile';
  return 'main';
}

interface SystemAlert {
  id: string;
  title: string;
  message: string;
}

const NAV_TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'quests', label: 'Hôm Nay', icon: <PxScroll size={15} /> },
  { key: 'timetable', label: 'Thời Khóa Biểu', icon: <PxCalendar size={15} /> },
  { key: 'skills', label: 'Cây Kĩ Năng', icon: <PxSkillTree size={15} /> },
  { key: 'hero', label: 'Tiến Độ & Mục Tiêu', icon: <PxShield size={15} /> },
  { key: 'campaign', label: 'Hành Trình', icon: <PxSkull size={15} /> },
  { key: 'assistant', label: 'Trợ Lý PC', icon: <PxAutomaton size={15} /> },
];

export default function App() {
  const [viewMode, setViewMode] = useState<AppViewMode>(() => getViewModeFromLocation());
  const [lanAuthRequired, setLanAuthRequired] = useState(false);
  const [state, setState] = useState<SystemStatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('quests');
  const [heroSubTab, setHeroSubTab] = useState<HeroSubTab>('status');

  // Default to Dark Obsidian Pixel Dungeon Theme
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('sys_theme') : null;
    return saved === 'light' ? 'light' : 'dark';
  });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [dungeonQuest, setDungeonQuest] = useState<Quest | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [questUtilityTab, setQuestUtilityTab] = useState<'advisor' | 'rhythm' | 'reflect'>('advisor');
  const [assistantOverview, setAssistantOverview] = useState<AssistantOverviewPayload | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [weeklyRaid, setWeeklyRaid] = useState<WeeklyRaidPayload | null>(null);
  const [weeklyRaidLoading, setWeeklyRaidLoading] = useState(false);
  const lastSettledPenaltyWeekRef = useRef<string | null>(null);

  const [activeChatThreadId, setActiveChatThreadId] = useState<string | null>(() => {
    return typeof window !== 'undefined'
      ? window.localStorage.getItem('sys_active_chat_thread')
      : null;
  });
  const [chatDraftsByKey, setChatDraftsByKey] = useState<Record<string, string>>({});
  const [pendingChatKeys, setPendingChatKeys] = useState<Record<string, boolean>>({});
  const [optimisticMessagesByKey, setOptimisticMessagesByKey] = useState<
    Record<string, AIChatMessage | undefined>
  >({});
  const [chatErrorByKey, setChatErrorByKey] = useState<Record<string, string | null>>({});

  const activeTabRef = useRef<TabKey>(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const activeThreadIdRef = useRef<string | null>(activeChatThreadId);
  useEffect(() => {
    activeThreadIdRef.current = activeChatThreadId;
    if (typeof window !== 'undefined') {
      if (activeChatThreadId) {
        window.localStorage.setItem('sys_active_chat_thread', activeChatThreadId);
      } else {
        window.localStorage.removeItem('sys_active_chat_thread');
      }
    }
  }, [activeChatThreadId]);

  useEffect(() => {
    if (!state) return;
    const threads = state.chatThreads || [];
    if (threads.length === 0) {
      if (activeChatThreadId !== null) setActiveChatThreadId(null);
      return;
    }
    if (!activeChatThreadId || !threads.some((t) => t.id === activeChatThreadId)) {
      setActiveChatThreadId(threads[0].id);
    }
  }, [state, activeChatThreadId]);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [selectedCommandIdx, setSelectedCommandIdx] = useState(0);
  const [paletteBusy, setPaletteBusy] = useState(false);
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const [alert, setAlert] = useState<SystemAlert | null>(null);
  const [hudVisible, setHudVisible] = useState<boolean>(() => isTauriDesktop());
  const hudPopupRef = useRef<Window | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    window.localStorage.setItem('sys_theme', theme);
  }, [theme]);

  const pushAlert = useCallback((title: string, message: string) => {
    setAlert({ id: String(Date.now()), title, message });
  }, []);

  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), 4200);
    return () => clearTimeout(t);
  }, [alert]);

  useEffect(() => {
    const syncRoute = () => setViewMode(getViewModeFromLocation());
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('popstate', syncRoute);
    return () => {
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('popstate', syncRoute);
    };
  }, []);

  useEffect(() => {
    if (viewMode === 'hud') {
      document.documentElement.classList.add('hud-mode');
      document.body.classList.add('hud-mode');
    } else {
      document.documentElement.classList.remove('hud-mode');
      document.body.classList.remove('hud-mode');
    }
    return () => {
      document.documentElement.classList.remove('hud-mode');
      document.body.classList.remove('hud-mode');
    };
  }, [viewMode]);

  const loadState = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await systemApi.getState();
      setState(data);
      setError(null);
      setLanAuthRequired(false);
    } catch (err) {
      if (isLanAuthError(err)) {
        setLanAuthRequired(true);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Không thể kết nối tới máy chủ.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState(false);
  }, [loadState]);

  const loadAssistantOverview = useCallback(async () => {
    setAssistantLoading(true);
    try {
      const ov = await systemApi.getAssistantOverview();
      setAssistantOverview(ov);
    } catch (err) {
      if (isLanAuthError(err)) {
        setLanAuthRequired(true);
      }
      // Non-fatal if assistant endpoint is temporarily unavailable
    } finally {
      setAssistantLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssistantOverview();
  }, [loadAssistantOverview]);

  const loadWeeklyRaid = useCallback(
    async (silent = false) => {
      if (!silent) setWeeklyRaidLoading(true);
      try {
        const payload = await fetchWeeklyRaid();
        setWeeklyRaid(payload);
        if (
          payload.justSettledPenalty &&
          lastSettledPenaltyWeekRef.current !== payload.justSettledPenalty.weekKey
        ) {
          lastSettledPenaltyWeekRef.current = payload.justSettledPenalty.weekKey;
          const p = payload.justSettledPenalty;
          soundEngine.monsterHit();
          pushAlert(
            'Boss Tuần Trước Tung Đòn Cuối!',
            `Boss ${p.bossName} (${p.weekKey}): -${p.hpLost} HP, -${p.goldLost} G${
              p.died ? ' — Bạn gục ngã & hồi sinh tại Checkpoint!' : '!'
            }`
          );
          void loadState(true);
        }
      } catch (err) {
        if (isLanAuthError(err)) {
          setLanAuthRequired(true);
        }
      } finally {
        if (!silent) setWeeklyRaidLoading(false);
      }
    },
    [loadState, pushAlert]
  );

  useEffect(() => {
    void loadWeeklyRaid(false);
  }, [loadWeeklyRaid]);

  useEffect(() => {
    if (activeTab === 'campaign') {
      void loadWeeklyRaid(true);
    }
  }, [activeTab, loadWeeklyRaid]);

  useEffect(() => {
    if (activeTab !== 'assistant') return;
    void loadAssistantOverview();
    const timer = setInterval(() => {
      void loadAssistantOverview();
    }, 20000);
    return () => clearInterval(timer);
  }, [activeTab, loadAssistantOverview]);

  useEffect(() => {
    const isStartupBootRetry = !state && (viewMode === 'hud' || isTauriDesktop());
    if (viewMode !== 'hud' && viewMode !== 'mobile' && !isStartupBootRetry) return;
    if (lanAuthRequired) return;
    const intervalMs = !state ? 1200 : viewMode === 'hud' ? 4000 : 10000;
    const timer = setInterval(() => {
      void loadState(true);
      void loadAssistantOverview();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [viewMode, lanAuthRequired, state, loadState, loadAssistantOverview]);

  const openCommandPalette = useCallback(() => {
    soundEngine.click();
    setCommandQuery('');
    setSelectedCommandIdx(0);
    setCommandPaletteOpen(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => {
          const next = !prev;
          if (next) {
            setCommandQuery('');
            setSelectedCommandIdx(0);
          }
          return next;
        });
      } else if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (commandPaletteOpen) {
      setTimeout(() => commandInputRef.current?.focus(), 20);
    }
  }, [commandPaletteOpen]);

  const handleTogglePlannedRest = useCallback(
    async (nextMode: boolean) => {
      soundEngine.systemPing();
      const updated = await systemApi.reflect({ plannedRestMode: nextMode });
      setState(updated);
      pushAlert(
        nextMode ? 'Bật Nghỉ Chủ Động' : 'Tắt Nghỉ Chủ Động',
        nextMode
          ? 'Grace Day đang bật: bảo toàn chuỗi, hồi phục HP và ưu tiên nhiệm vụ nhẹ nhàng.'
          : 'Đã quay lại nhịp rèn luyện bình thường.'
      );
      return updated;
    },
    [pushAlert]
  );

  const handleToggleSound = useCallback(() => {
    const next = !soundEnabled;
    soundEngine.enabled = next;
    setSoundEnabled(next);
    if (next) soundEngine.click();
  }, [soundEnabled]);

  const handleReclassifyApp = useCallback(
    async (payload: { keyword: string; category: Exclude<ActivityCategory, 'idle'> }) => {
      const res = await systemApi.reclassifyActivityApp({ ...payload, retroactive: true });
      setAssistantOverview(res.overview);
      soundEngine.systemPing();
      pushAlert('Đã cập nhật phân loại', res.message);
    },
    [pushAlert]
  );

  const handleConvertFocusToQuest = useCallback(
    async (payload: {
      mode: 'complete_new' | 'credit_pending';
      title?: string;
      questId?: string;
      primaryStat?: import('./types/system').AttributeKey;
    }) => {
      const res = await systemApi.convertActivityToQuest(payload);
      setAssistantOverview(res.overview);
      setState(res.state);
      void loadWeeklyRaid(true);
      soundEngine.questComplete();
      pushAlert('Đồng bộ Focus PC!', res.message);
    },
    [loadWeeklyRaid, pushAlert]
  );

  const triggerLevelUpFx = useCallback(() => {
    soundEngine.levelUp();
    confetti({
      particleCount: 85,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#f59e0b', '#ef4444', '#8b5cf6', '#10b981'],
    });
  }, []);

  const handlePairWithPin = useCallback(
    async (pin: string) => {
      const res = await systemApi.pairWithLanPin(pin);
      if (res.ok) {
        if (res.token) setLanToken(res.token);
        setLanAuthRequired(false);
        await Promise.all([loadState(false), loadAssistantOverview(), loadWeeklyRaid(true)]);
      }
      return { ok: res.ok, error: res.error };
    },
    [loadAssistantOverview, loadState, loadWeeklyRaid]
  );

  const handleStartQuest = useCallback(
    async (questId: string) => {
      soundEngine.systemPing();
      const updated = await systemApi.startQuest(questId);
      setState(updated);
      pushAlert('Đã bắt đầu', 'Đang ghi nhận tiến độ phiên làm việc.');
    },
    [pushAlert]
  );

  const handlePauseQuest = useCallback(
    async (questId: string) => {
      soundEngine.click();
      const updated = await systemApi.pauseQuest(questId);
      setState(updated);
      pushAlert('Đã tạm dừng phiên', 'Thời gian tích lũy đã được lưu tự động.');
    },
    [pushAlert]
  );

  const handleCompleteQuest = useCallback(
    async (questId: string, proofNote?: string) => {
      const res = await systemApi.completeQuest(questId, { proofNote });
      setState(res.state);
      void loadWeeklyRaid(true);
      const extraDetail = `${res.actualDurationMinutes ? ` · ${res.actualDurationMinutes}p thực` : ''}${
        res.contributedSkillName
          ? ` · +${res.skillPracticeXpGain ?? 0} Skill XP (${res.contributedSkillName})`
          : ''
      }`;
      if (res.leveledUp || res.rankPromoted) {
        triggerLevelUpFx();
        pushAlert(
          'THĂNG CẤP!',
          `Level ${res.state.player.level} (${res.state.player.rank}) · +${res.spGain ?? 2} SP${extraDetail}!`
        );
      } else {
        soundEngine.questComplete();
        pushAlert(
          'Hoàn thành nhiệm vụ',
          `+${res.xpGain} XP · +${res.goldGain}G · +${res.spGain ?? 1} SP${
            res.runestoneGain > 0 ? ` · +${res.runestoneGain} 💎` : ''
          }${extraDetail}`
        );
      }
    },
    [loadWeeklyRaid, pushAlert, triggerLevelUpFx]
  );

  const handleCheckinEnergy = useCallback(
    async (energy: number) => {
      soundEngine.systemPing();
      const updated = await systemApi.checkin({ energyLevel: energy });
      setState(updated);
      pushAlert(
        'Đã cập nhật thể trạng',
        `Năng lượng hôm nay: ${energy}% — AI sẽ cân chỉnh độ nặng bài phù hợp (HP giữ nguyên).`
      );
    },
    [pushAlert]
  );

  const handleQuickAddQuest = useCallback(
    async (title: string, durationMinutes: number) => {
      soundEngine.systemPing();
      const updated = await systemApi.createCustomQuest({
        title,
        durationMinutes,
        primaryStat: 'PER',
        type: 'daily',
      });
      setState(updated);
      pushAlert('Đã thêm nhiệm vụ nhanh', `"${title}" (${durationMinutes}p) đã vào bảng hôm nay.`);
    },
    [pushAlert]
  );

  const handleSetDnd = useCallback(
    async (minutes: number) => {
      soundEngine.systemPing();
      const res = await systemApi.setAssistantDnd(minutes);
      setAssistantOverview(res.overview);
      pushAlert(
        minutes > 0 ? 'Đã bật Do Not Disturb' : 'Đã tắt DND',
        minutes > 0
          ? `Tạm tắt nhắc xao nhãng trong ${minutes} phút.`
          : 'Trợ lý PC tiếp tục giám sát bình thường.'
      );
    },
    [pushAlert]
  );

  const handleApplyWeeklyBlueprint = useCallback(
    async (blocks: WeeklyBlueprintBlockDraft[], syncTodayQuests = true) => {
      soundEngine.arise();
      const res = await systemApi.applyWeeklyBlueprint(blocks, syncTodayQuests);
      setState(res.state);
      pushAlert('Đã áp dụng Blueprint tuần', res.message);
    },
    [pushAlert]
  );

  const handleOpenMainApp = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (isTauriDesktop()) {
      const tauri = (
        window as unknown as {
          __TAURI__?: { core?: { invoke?: (cmd: string) => Promise<unknown> } };
        }
      ).__TAURI__;
      if (tauri?.core?.invoke) {
        void tauri.core.invoke('open_main_dashboard');
        return;
      }
    }
    if (window.location.hash) {
      window.location.hash = '';
    }
    if (
      window.location.pathname.toLowerCase() === '/hud' ||
      window.location.pathname.toLowerCase() === '/mobile'
    ) {
      window.history.pushState({}, '', '/');
    }
    setViewMode('main');
  }, []);

  const handleChangeRaidDifficulty = useCallback(
    async (tier: RaidDifficultyTier) => {
      soundEngine.click();
      const updated = await setWeeklyRaidDifficulty(tier);
      setWeeklyRaid(updated);
      pushAlert(
        'Đã đổi độ khó Raid Boss',
        `${updated.raid.name} đã chuyển sang ${tier}-Rank (${updated.raid.maxHp.toLocaleString('vi-VN')} HP).`
      );
    },
    [pushAlert]
  );

  const handleClaimRaidChest = useCallback(
    async (chestId: RaidChestId) => {
      const res = await claimWeeklyRaidChest(chestId);
      setWeeklyRaid(res.payload);
      await loadState(true);
      const s = res.rewardSummary;
      const parts = [
        s.gold > 0 ? `+${s.gold} G` : '',
        s.runestones > 0 ? `+${s.runestones} 💎` : '',
        s.sp > 0 ? `+${s.sp} SP` : '',
        s.lootItemName ? `Vật phẩm: ${s.lootItemName}` : '',
        s.unlockedTitle ? `Danh hiệu: ${s.unlockedTitle}` : '',
      ].filter(Boolean);
      if (chestId === 'victory' || chestId === 'overkill') {
        triggerLevelUpFx();
      } else {
        soundEngine.coinLoot();
      }
      pushAlert('Đã mở Rương Raid Boss!', parts.join(' · ') || 'Phần thưởng đã được chuyển vào Kho Đồ.');
    },
    [loadState, pushAlert, triggerLevelUpFx]
  );

  const handleRegenerateRaidAi = useCallback(async () => {
    const res = await regenerateWeeklyRaidAi();
    setWeeklyRaid(res.payload);
    soundEngine.systemPing();
    pushAlert(
      res.usedAi ? 'Đã triệu hồi Boss AI mới!' : 'Boss Đột Kích Tuần',
      res.usedAi
        ? `${res.payload.raid.name} (${res.payload.raid.weaknessLabel}) đã xuất trận!`
        : res.note || 'Đang dùng bộ Boss nội bộ.'
    );
  }, [pushAlert]);

  const handleRefreshRaid = useCallback(async () => {
    soundEngine.click();
    await loadWeeklyRaid(false);
  }, [loadWeeklyRaid]);

  useEffect(() => {
    if (typeof window === 'undefined' || viewMode !== 'main') return;
    type TauriBridge = {
      core?: { invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> };
      event?: {
        listen?: (
          event: string,
          handler: (ev: { payload: unknown }) => void
        ) => Promise<() => void>;
      };
    };
    const tauri = (window as unknown as { __TAURI__?: TauriBridge }).__TAURI__;

    if (isTauriDesktop() && tauri?.core?.invoke) {
      let disposed = false;
      const unlisteners: Array<() => void> = [];
      const syncTauriHud = () => {
        tauri.core
          ?.invoke?.('get_hud_visible')
          .then((val) => {
            if (typeof val === 'boolean') setHudVisible(val);
          })
          .catch(() => {});
      };
      syncTauriHud();
      window.addEventListener('focus', syncTauriHud);
      if (tauri.event?.listen) {
        const registerListener = (
          eventName: string,
          handler: (ev: { payload: unknown }) => void
        ) => {
          tauri.event
            ?.listen?.(eventName, handler)
            .then((fn) => {
              if (disposed) {
                fn();
              } else {
                unlisteners.push(fn);
              }
            })
            .catch(() => {});
        };

        registerListener('tauri-hud-visibility', (ev) => {
          if (typeof ev.payload === 'boolean') setHudVisible(ev.payload);
        });

        registerListener('tauri-open-mobile-qr', () => {
          soundEngine.systemPing();
          setActiveTab('assistant');
          setTimeout(() => {
            document
              .getElementById('lan-qr-card')
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 120);
        });

        registerListener('tauri-dnd-updated', (ev) => {
          const mins = typeof ev.payload === 'number' ? ev.payload : 0;
          void loadAssistantOverview();
          pushAlert(
            'Đã cập nhật DND từ System Tray',
            mins > 0
              ? `Đã bật Do Not Disturb trong ${mins} phút.`
              : 'Đã tắt Do Not Disturb — Trợ lý PC tiếp tục theo dõi.'
          );
        });
      }
      return () => {
        disposed = true;
        window.removeEventListener('focus', syncTauriHud);
        unlisteners.forEach((fn) => fn());
      };
    }

    const syncViaBackendBridge = () => {
      systemApi
        .getHudStatus()
        .then((st) => {
          if (st.nativeRunning) {
            setHudVisible(Boolean(st.visible));
          } else {
            const open = Boolean(hudPopupRef.current && !hudPopupRef.current.closed);
            setHudVisible(open);
          }
        })
        .catch(() => {
          const open = Boolean(hudPopupRef.current && !hudPopupRef.current.closed);
          setHudVisible(open);
        });
    };
    syncViaBackendBridge();
    window.addEventListener('focus', syncViaBackendBridge);
    const interval = window.setInterval(syncViaBackendBridge, 3000);
    return () => {
      window.removeEventListener('focus', syncViaBackendBridge);
      window.clearInterval(interval);
    };
  }, [viewMode, loadAssistantOverview, pushAlert]);

  const handleToggleHudVisible = useCallback(async () => {
    soundEngine.click();
    if (typeof window === 'undefined') return;
    const tauri = (
      window as unknown as {
        __TAURI__?: {
          core?: { invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> };
        };
      }
    ).__TAURI__;

    if (isTauriDesktop() && tauri?.core?.invoke) {
      try {
        const nextVisible = await tauri.core.invoke('set_hud_visible', {
          visible: !hudVisible,
        });
        const resolved = typeof nextVisible === 'boolean' ? nextVisible : !hudVisible;
        setHudVisible(resolved);
        pushAlert(
          resolved ? 'Đã hiện Mini HUD' : 'Đã ẩn Mini HUD',
          resolved
            ? 'Mini HUD 2D Pixel đang nổi trên góc màn hình (Ctrl+Shift+Space để ẩn/hiện nhanh).'
            : 'Mini HUD đã ẩn gọn về khay chạy ẩn — bấm icon khay hệ thống hoặc nút Mini HUD để hiện lại.'
        );
      } catch {
        // Ignore IPC error
      }
      return;
    }

    // Web Browser -> directly control the REAL native transparent Mini HUD (.exe) via backend bridge!
    try {
      const action = hudVisible ? 'hide' : 'show';
      const res = await systemApi.controlNativeHud(action);
      if (res.ok) {
        setHudVisible(Boolean(res.visible));
        pushAlert(
          res.visible ? 'Đã hiện Mini HUD trên màn hình' : 'Đã ẩn Mini HUD',
          res.launched
            ? 'Đang khởi chạy Mini HUD 2D Pixel trong suốt ở góc phải thanh Taskbar!'
            : res.visible
              ? 'Mini HUD 2D Pixel đã hiện lên ngay phía trên thanh Taskbar.'
              : 'Mini HUD đã ẩn gọn về khay hệ thống (bấm icon khay hoặc nút này để hiện lại).'
        );
        return;
      }
    } catch {
      // Fall through to browser popup only if backend bridge / .exe unavailable
    }

    if (hudPopupRef.current && !hudPopupRef.current.closed) {
      hudPopupRef.current.close();
      hudPopupRef.current = null;
      setHudVisible(false);
      pushAlert('Đã ẩn cửa sổ Mini HUD', 'Bạn có thể bấm "Mini HUD: Ẩn" để mở lại bất cứ lúc nào.');
    } else {
      const popup = window.open('/#/hud', 'rpg_hud', 'width=440,height=280');
      hudPopupRef.current = popup;
      setHudVisible(Boolean(popup));
      if (popup) {
        pushAlert('Đã mở Mini HUD (Trình duyệt)', 'Chạy bản rpg-life-tracker.exe để dùng HUD trong suốt Always-on-Top.');
      }
    }
  }, [hudVisible, pushAlert]);

  const handleDockHudCorner = useCallback(() => {
    soundEngine.click();
    if (typeof window === 'undefined') return;
    const tauri = (
      window as unknown as {
        __TAURI__?: { core?: { invoke?: (cmd: string) => Promise<unknown> } };
      }
    ).__TAURI__;
    if (isTauriDesktop() && tauri?.core?.invoke) {
      void tauri.core.invoke('dock_hud_corner').then(() => {
        setHudVisible(true);
        pushAlert('Đã đưa Mini HUD về góc Taskbar', 'Mini HUD đã đậu gọn ở góc phải phía trên thanh tác vụ.');
      });
      return;
    }
    void systemApi
      .controlNativeHud('dock')
      .then((res) => {
        if (res.ok) {
          setHudVisible(true);
          pushAlert('Đã đưa Mini HUD về góc Taskbar', 'Mini HUD đã hiện lại ở góc phải phía trên thanh tác vụ.');
        }
      })
      .catch(() => {});
  }, [pushAlert]);

  const handleHideHudFromSelf = useCallback(() => {
    if (typeof window === 'undefined') return;
    const tauri = (
      window as unknown as {
        __TAURI__?: {
          core?: { invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> };
        };
      }
    ).__TAURI__;
    if (isTauriDesktop() && tauri?.core?.invoke) {
      void tauri.core.invoke('set_hud_visible', { visible: false });
    }
  }, []);

  const handleCreateChatThread = useCallback(
    async (contextScope: ChatContextScope = 'general', title?: string) => {
      soundEngine.click();
      const res = await systemApi.createChatThread({ contextScope, title });
      setState((prev) => (prev ? { ...prev, chatThreads: res.threads } : prev));
      setActiveChatThreadId(res.thread.id);
    },
    []
  );

  const handleDeleteChatThread = useCallback(async (threadId: string) => {
    soundEngine.click();
    const res = await systemApi.deleteChatThread(threadId);
    setState((prev) => (prev ? { ...prev, chatThreads: res.threads } : prev));
    if (activeThreadIdRef.current === threadId) {
      setActiveChatThreadId(res.threads[0]?.id ?? null);
    }
  }, []);

  const handleSendChatPrompt = useCallback(
    async (
      prompt: string,
      contextScope: ChatContextScope = 'general',
      explicitThreadId?: string | null
    ) => {
      const cleanPrompt = prompt.trim();
      const targetThreadId =
        explicitThreadId !== undefined ? explicitThreadId : activeThreadIdRef.current;
      const targetKey = targetThreadId || '__new__';
      if (!cleanPrompt || pendingChatKeys[targetKey]) return;

      setChatDraftsByKey((prev) => ({ ...prev, [targetKey]: '' }));
      setChatErrorByKey((prev) => ({ ...prev, [targetKey]: null }));
      setPendingChatKeys((prev) => ({ ...prev, [targetKey]: true }));
      setOptimisticMessagesByKey((prev) => ({
        ...prev,
        [targetKey]: {
          id: `opt-${Date.now()}`,
          threadId: targetThreadId || '__new__',
          role: 'user',
          content: cleanPrompt,
          createdAt: new Date().toISOString(),
        },
      }));

      try {
        const res = await systemApi.consultAI({
          prompt: cleanPrompt,
          threadId: targetThreadId || undefined,
          contextScope,
        });
        setState((prev) =>
          prev
            ? {
                ...prev,
                chatThreads: res.threads ?? prev.chatThreads,
              }
            : prev
        );
        if (targetKey === '__new__' && res.threadId && !activeThreadIdRef.current) {
          setActiveChatThreadId(res.threadId);
        }
        if (activeTabRef.current !== 'quests') {
          soundEngine.systemPing();
          pushAlert('Cố vấn AI đã trả lời', 'Quay lại tab Hôm Nay để xem câu trả lời.');
        }
      } catch (err) {
        setChatErrorByKey((prev) => ({
          ...prev,
          [targetKey]: err instanceof Error ? err.message : 'Không thể kết nối Cố vấn AI.',
        }));
      } finally {
        setPendingChatKeys((prev) => ({ ...prev, [targetKey]: false }));
        setOptimisticMessagesByKey((prev) => ({ ...prev, [targetKey]: undefined }));
      }
    },
    [pendingChatKeys, pushAlert]
  );

  const handleResetSystem = useCallback(
    async (mode: SystemResetMode, clearChats = false) => {
      soundEngine.alert();
      const updated = await systemApi.resetSystem(mode, { clearChats });
      setState(updated);
      setPendingChatKeys({});
      setOptimisticMessagesByKey({});
      setChatErrorByKey({});
      setChatDraftsByKey({});
      setActiveChatThreadId(updated.chatThreads?.[0]?.id ?? null);
      setResetModalOpen(false);
      pushAlert(
        mode === 'progress' ? 'Đã reset tiến trình' : 'Đã reset toàn bộ',
        mode === 'progress'
          ? 'Level 1 sạch — giữ nguyên Hồ sơ & Thời khóa biểu.'
          : 'Hệ thống đã quay về trạng thái ban đầu.'
      );
    },
    [pushAlert]
  );

  const commandActions = useMemo(() => {
    const tabItems = NAV_TABS.map((tab) => ({
      id: `tab-${tab.key}`,
      group: 'Điều hướng',
      label: `Đi tới: ${tab.label}`,
      hint: tab.key.toUpperCase(),
      keywords: `${tab.label} ${tab.key}`,
      icon: tab.icon,
      run: async () => {
        soundEngine.click();
        setActiveTab(tab.key);
        setCommandPaletteOpen(false);
      },
    }));

    const quickActions = [
      {
        id: 'action-orchestrate',
        group: 'Hệ thống AI',
        label: 'AI Lập Kế Hoạch hôm nay',
        hint: 'Tạo Quest theo lịch trống',
        keywords: 'ai orchestrate quests lap ke hoach',
        icon: <PxRefresh size={14} color="var(--px-gold-text)" />,
        run: async () => {
          setPaletteBusy(true);
          try {
            soundEngine.systemPing();
            setActiveTab('quests');
            const updated = await systemApi.orchestrate({});
            setState(updated);
            pushAlert('Kế hoạch đã sẵn sàng', 'AI đã sắp xếp các nhiệm vụ phù hợp thời khóa biểu hôm nay.');
            setCommandPaletteOpen(false);
          } finally {
            setPaletteBusy(false);
          }
        },
      },
      {
        id: 'action-theme',
        group: 'Giao diện',
        label: theme === 'dark' ? 'Đổi sang Quán Trọ Sáng (Light)' : 'Đổi sang Hầm Ngục Tối (Dark)',
        hint: 'Theme',
        keywords: 'theme dark light',
        icon: theme === 'dark' ? (
          <PxSun size={14} color="var(--px-gold-text)" />
        ) : (
          <PxMoon size={14} color="var(--px-blue-text)" />
        ),
        run: async () => {
          soundEngine.click();
          setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'action-planned-rest',
        group: 'Hệ thống AI',
        label: `${state?.player.plannedRestMode ? 'Tắt' : 'Bật'} Nghỉ Chủ Động (Grace Day)`,
        hint: 'Hồi phục & chống kiệt sức',
        keywords: 'rest grace day nghi',
        icon: <PxCoffee size={14} color="var(--px-green-text)" />,
        run: async () => {
          setPaletteBusy(true);
          try {
            await handleTogglePlannedRest(!state?.player.plannedRestMode);
            setCommandPaletteOpen(false);
          } finally {
            setPaletteBusy(false);
          }
        },
      },
      {
        id: 'action-reset-progress',
        group: 'Hệ thống',
        label: 'Reset tiến trình về Level 1',
        hint: 'Reset / Test',
        keywords: 'reset progress level 1 test clean',
        icon: <PxReset size={14} color="var(--px-red-text)" />,
        run: async () => {
          soundEngine.click();
          setCommandPaletteOpen(false);
          setResetModalOpen(true);
        },
      },
      {
        id: 'action-toggle-hud',
        group: 'Giao diện',
        label: hudVisible
          ? 'Ẩn 2D Pixel HUD nổi (Ctrl+Shift+Space)'
          : 'Hiện 2D Pixel HUD nổi (Ctrl+Shift+Space)',
        hint: hudVisible ? 'Đang hiện' : 'Đang ẩn',
        keywords: 'hud an hien floating widget pixel taskbar',
        icon: hudVisible ? (
          <PxEyeOff size={14} color="var(--px-gold-text)" />
        ) : (
          <PxEye size={14} color="var(--px-blue-text)" />
        ),
        run: async () => {
          await handleToggleHudVisible();
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'action-assistant',
        group: 'Hệ thống',
        label: 'Mở Trợ Lý PC & Khởi động cùng Windows',
        hint: 'Assistant',
        keywords: 'assistant tro ly pc startup windows tray activity tracker',
        icon: <PxAutomaton size={14} color="var(--px-green-text)" />,
        run: async () => {
          soundEngine.click();
          setActiveTab('assistant');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'action-settings',
        group: 'Hệ thống',
        label: 'Mở Cài đặt (LLM API & Backup)',
        hint: 'Settings',
        keywords: 'settings api llm backup reset sqlite',
        icon: <PxGear size={14} color="var(--text-secondary)" />,
        run: async () => {
          soundEngine.click();
          setCommandPaletteOpen(false);
          setSettingsOpen(true);
        },
      },
    ];

    return [...quickActions, ...tabItems];
  }, [handleToggleHudVisible, handleTogglePlannedRest, hudVisible, pushAlert, state?.player.plannedRestMode, theme]);

  const filteredCommands = useMemo(() => {
    const q = commandQuery.trim().toLowerCase();
    if (!q) return commandActions;
    return commandActions.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.hint.toLowerCase().includes(q) ||
        cmd.keywords.toLowerCase().includes(q)
    );
  }, [commandActions, commandQuery]);

  useEffect(() => {
    setSelectedCommandIdx(0);
  }, [commandQuery]);

  if (viewMode === 'mobile') {
    if (loading && !state && !lanAuthRequired) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center">
          <Loader2 className="h-9 w-9 animate-spin text-amber-500" />
          <p className="font-pixel mt-3 text-xs text-sub">LOADING MOBILE SYSTEM...</p>
        </div>
      );
    }
    return (
      <MobileQuickView
        state={state}
        overview={assistantOverview}
        authRequired={lanAuthRequired}
        onPairWithPin={handlePairWithPin}
        onCheckinEnergy={handleCheckinEnergy}
        onStartQuest={handleStartQuest}
        onPauseQuest={handlePauseQuest}
        onCompleteQuest={(id) => handleCompleteQuest(id)}
        onQuickAddQuest={handleQuickAddQuest}
        onToggleDnd={handleSetDnd}
        onRefresh={async () => {
          await Promise.all([loadState(true), loadAssistantOverview()]);
        }}
      />
    );
  }

  if (viewMode === 'hud') {
    if (loading && !state) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-transparent">
          <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
        </div>
      );
    }
    return (
      <FloatingHudPage
        state={state}
        overview={assistantOverview}
        onStartQuest={handleStartQuest}
        onPauseQuest={handlePauseQuest}
        onCompleteQuest={(id) => handleCompleteQuest(id)}
        onQuickAddQuest={handleQuickAddQuest}
        onToggleDnd={handleSetDnd}
        onConvertFocusToQuest={handleConvertFocusToQuest}
        onHideHud={isTauriDesktop() ? handleHideHudFromSelf : undefined}
        onOpenMainApp={handleOpenMainApp}
      />
    );
  }

  if (loading && !state) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <Loader2 className="h-9 w-9 animate-spin text-amber-500" />
        <p className="font-pixel mt-3 text-xs text-sub">LOADING SYSTEM...</p>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="rpg-window max-w-md p-6 text-center">
          <h2 className="font-display text-lg font-bold text-rose-500">Lỗi kết nối máy chủ</h2>
          <p className="mt-2 text-sm text-sub">{error}</p>
          <button onClick={() => void loadState(false)} className="btn-primary mt-4 px-4 py-2 text-xs">
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  const liveDungeonQuest = dungeonQuest
    ? state.quests.find((q) => q.id === dungeonQuest.id) || dungeonQuest
    : null;
  const todayKey = getVnTodayKey();
  const todayReflectionNote =
    state.dailySnapshots.find((s) => s.dateKey === todayKey)?.reflectionNote || '';

  const spAvailable = state.player.skillPoints ?? 0;
  const anyChatPending = Object.values(pendingChatKeys).some(Boolean);
  const trackerRunning = Boolean(
    assistantOverview?.trackerRunning ?? state.assistantSummary?.trackerRunning
  );
  const unreadNudges =
    assistantOverview?.nudges.filter((n) => !n.dismissed).length ??
    state.assistantSummary?.unreadNudges ??
    0;
  const unclaimedRaidChests =
    weeklyRaid?.raid.chests.filter((c) => c.unlocked && !c.claimed).length ?? 0;

  return (
    <div className="min-h-screen pb-10">
      {/* RPG Toast Alert */}
      {alert && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm">
          <div className="rpg-window relative rounded-none border-l-4 border-l-[var(--px-gold)] p-3.5">
            <PixelRivets />
            <div className="flex items-center gap-2 text-xs font-extrabold text-[var(--px-gold-text)]">
              <PxSparkle size={14} color="var(--px-gold-text)" />
              <span>{alert.title}</span>
            </div>
            <p className="mt-1 text-xs text-main">{alert.message}</p>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1380px] space-y-4 px-3 pt-3 sm:px-5">
        {/* TOP-LEFT CORNER HEARTS/HP/EXP HUD + TOP-RIGHT COUNTERS */}
        <TopSystemHud
          player={state.player}
          aiSettings={state.aiSettings}
          theme={theme}
          soundEnabled={soundEnabled}
          lastSavedAt={state.storageInfo?.lastSavedAt}
          assistantSummary={state.assistantSummary}
          hudVisible={hudVisible}
          onToggleHudVisible={() => void handleToggleHudVisible()}
          onOpenAssistant={() => {
            soundEngine.click();
            setActiveTab('assistant');
          }}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          onToggleSound={handleToggleSound}
          onOpenSettings={() => {
            soundEngine.click();
            setSettingsOpen(true);
          }}
          onOpenReset={() => {
            soundEngine.click();
            setResetModalOpen(true);
          }}
          onOpenCommandPalette={openCommandPalette}
          onOpenSkillTree={() => {
            soundEngine.click();
            setActiveTab('skills');
          }}
          onQuickRename={async (name, hunterClass) => {
            soundEngine.systemPing();
            const updated = await systemApi.updateProfile({ name, hunterClass });
            setState(updated);
            pushAlert('Đã cập nhật Hồ sơ', `Xin chào ${name} (${hunterClass}).`);
          }}
        />

        {/* UNIFIED 5-TAB RPG MENU BOOK SHELL (Zero-Gap Flush Tabs + .rpg-window) */}
        <div>
          <nav
            className="relative z-10 -mb-[2px] flex flex-row items-end gap-1 overflow-x-auto overflow-y-hidden px-0.5"
            aria-label="Điều hướng chính"
          >
            {NAV_TABS.map((tab) => {
              const active = activeTab === tab.key;
              const showSpDot = tab.key === 'skills' && spAvailable > 0;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    soundEngine.click();
                    setActiveTab(tab.key);
                  }}
                  className={`flex shrink-0 items-center gap-2 px-4 py-2.5 text-xs ${
                    active ? 'rpg-tab-active !mb-0' : 'rpg-tab mb-[2px]'
                  }`}
                >
                  {tab.icon}
                  <span className="whitespace-nowrap">{tab.label}</span>
                  {tab.key === 'quests' && !active && anyChatPending && (
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin text-amber-400"
                      aria-label="AI đang xử lý"
                    />
                  )}
                  {tab.key === 'assistant' && trackerRunning && (
                    <span
                      className="h-2 w-2 bg-[var(--px-green-text)]"
                      title="PC Activity Tracker đang chạy"
                    />
                  )}
                  {tab.key === 'assistant' && unreadNudges > 0 && (
                    <span className="font-pixel rounded-none border border-[var(--border-ink)] bg-[var(--px-gold)] px-1 py-0.5 text-[9px] font-bold leading-none text-[#140e04]">
                      {unreadNudges}
                    </span>
                  )}
                  {tab.key === 'campaign' && unclaimedRaidChests > 0 && (
                    <span
                      className="font-pixel rounded-none border border-[var(--border-ink)] bg-[var(--px-gold)] px-1 py-0.5 text-[9px] font-bold leading-none text-[#140e04]"
                      title="Rương Raid Boss tuần chưa mở"
                    >
                      {unclaimedRaidChests} Rương
                    </span>
                  )}
                  {showSpDot && (
                    <span
                      className="font-pixel rounded-none border border-[var(--border-ink)] bg-[var(--px-gold)] px-1.5 py-0.5 text-[9px] font-bold leading-none text-[#140e04]"
                    >
                      +{spAvailable} SP
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* MAIN UNIFIED RPG WINDOW FRAME */}
          <main className="rpg-window relative min-w-0 rounded-none">
            <PixelRivets />
            {activeTab === 'quests' && (
              <QuestCouncilBoard
                player={state.player}
                aiSettings={state.aiSettings}
                todayAnalysis={state.todayAnalysis}
                quests={state.quests}
                skills={state.skills}
                chapters={state.chapters}
                bosses={state.bosses}
                shadowsCount={state.shadows.length}
                deliberation={state.lastDeliberation}
                memoryLogs={state.memoryLogs}
                initialReflectionNote={todayReflectionNote}
                chatThreads={state.chatThreads || []}
                activeChatThreadId={activeChatThreadId}
                chatDraftsByKey={chatDraftsByKey}
                pendingChatKeys={pendingChatKeys}
                optimisticMessagesByKey={optimisticMessagesByKey}
                chatErrorByKey={chatErrorByKey}
                utilityTab={questUtilityTab}
                onChangeUtilityTab={setQuestUtilityTab}
                onSelectChatThread={(threadId) => setActiveChatThreadId(threadId)}
                onCreateChatThread={handleCreateChatThread}
                onDeleteChatThread={handleDeleteChatThread}
                onChangeChatDraft={(key, value) =>
                  setChatDraftsByKey((prev) => ({ ...prev, [key]: value }))
                }
                onSendChatPrompt={handleSendChatPrompt}
                onOpenSettings={() => setSettingsOpen(true)}
                onNavigateBosses={() => {
                  soundEngine.click();
                  setActiveTab('campaign');
                }}
                onCheckinEnergy={async (energy) => {
                  soundEngine.systemPing();
                  const updated = await systemApi.checkin({ energyLevel: energy });
                  setState(updated);
                  pushAlert(
                    'Đã cập nhật thể trạng',
                    `Năng lượng hôm nay: ${energy}% — AI sẽ cân chỉnh độ nặng bài phù hợp (HP giữ nguyên).`
                  );
                }}
                onOrchestrate={async (focusNote) => {
                  soundEngine.systemPing();
                  const updated = await systemApi.orchestrate({ focusNote });
                  setState(updated);
                  pushAlert('Kế hoạch mới đã sẵn sàng', 'AI đã sắp xếp nhiệm vụ vừa khung giờ rảnh hôm nay.');
                }}
                onCreateCustomQuest={async (payload) => {
                  soundEngine.systemPing();
                  const updated = await systemApi.createCustomQuest(payload);
                  setState(updated);
                  pushAlert('Đã thêm nhiệm vụ', `"${payload.title}" đã vào bảng hôm nay.`);
                }}
                onDeleteQuest={async (questId) => {
                  soundEngine.click();
                  const updated = await systemApi.deleteQuest(questId);
                  setState(updated);
                  pushAlert('Đã xóa nhiệm vụ', 'Nhiệm vụ và khung lịch liên kết (nếu có) đã được gỡ.');
                }}
                onToggleSubtask={async (questId, subtaskId) => {
                  soundEngine.click();
                  const updated = await systemApi.toggleSubtask(questId, subtaskId);
                  setState(updated);
                }}
                onCompleteQuest={handleCompleteQuest}
                onStartQuest={async (questId) => {
                  soundEngine.systemPing();
                  const updated = await systemApi.startQuest(questId);
                  setState(updated);
                  pushAlert('Đã bắt đầu', 'Đang ghi nhận tiến độ phiên làm việc.');
                }}
                onPauseQuest={async (questId) => {
                  soundEngine.click();
                  const updated = await systemApi.pauseQuest(questId);
                  setState(updated);
                  pushAlert('Đã tạm dừng phiên', 'Thời gian tích lũy đã được lưu tự động.');
                }}
                onRejectQuest={async (questId, reason: RejectionReason) => {
                  soundEngine.alert();
                  const updated = await systemApi.rejectQuest(questId, reason);
                  setState(updated);
                  pushAlert('Đã đổi nhiệm vụ', 'AI đã tạo nhiệm vụ thay thế phù hợp hơn.');
                }}
                onFailQuest={async (questId) => {
                  const res = await systemApi.failQuest(questId);
                  setState(res.state);
                  if (res.died) {
                    soundEngine.alert();
                    pushAlert('Kiệt sức!', 'HP đã cạn — quay về Checkpoint gần nhất!');
                  } else if (res.hpDamage === 0) {
                    soundEngine.systemPing();
                    pushAlert('Được bảo vệ', 'Nhiệm vụ này không trừ HP (Nghỉ Chủ Động / Hidden / Recovery).');
                  } else {
                    soundEngine.monsterHit();
                    pushAlert('Bỏ lỡ nhiệm vụ', `Bị trừ -${res.hpDamage} HP! Giữ vững nhịp độ nhé.`);
                  }
                }}
                onSettleDay={async () => {
                  const res = await systemApi.settleDay();
                  setState(res.state);
                  const s = res.settlement;
                  if (s.died) {
                    soundEngine.alert();
                    pushAlert('Chốt ngày: Kiệt sức!', 'Tổng sát thương khiến HP về 0 — hồi sinh tại Checkpoint.');
                  } else if (s.protectedByGraceDay) {
                    soundEngine.campfireHeal();
                    pushAlert('Chốt ngày (Grace Day)', 'Chế độ Nghỉ Chủ Động đã bảo toàn 100% HP & chuỗi ngày!');
                  } else if (s.totalHpDamage > 0) {
                    soundEngine.monsterHit();
                    pushAlert(
                      'Đã chốt ngày',
                      `Bỏ lỡ ${s.missedQuests.length} nhiệm vụ (-${s.totalHpDamage} HP).`
                    );
                  } else {
                    soundEngine.questComplete();
                    pushAlert('Chốt ngày hoàn hảo!', 'Không có nhiệm vụ nào bị bỏ lỡ — 0 sát thương!');
                  }
                }}
                onUpdateQuest={async (questId, updates) => {
                  soundEngine.click();
                  const updated = await systemApi.updateQuest(questId, updates);
                  setState(updated);
                }}
                onMicroStartQuest={async (id) => {
                  soundEngine.questComplete();
                  const updated = await systemApi.microStartQuest(id);
                  setState(updated);
                  pushAlert('Khởi động 2 phút!', '+10 XP & +10G.');
                  return updated;
                }}
                onReflect={async (payload) => {
                  if (typeof payload.plannedRestMode === 'boolean' && payload.reflectionNote === undefined) {
                    return handleTogglePlannedRest(payload.plannedRestMode);
                  }
                  soundEngine.systemPing();
                  const updated = await systemApi.reflect(payload);
                  setState(updated);
                  pushAlert('Đã lưu Nhật ký', 'Phản hồi hôm nay đã đồng bộ với AI.');
                  return updated;
                }}
                onEnterDungeon={(quest) => {
                  soundEngine.arise();
                  setDungeonQuest(quest);
                }}
                assistantOverview={assistantOverview}
                weeklyRaid={weeklyRaid}
                onOpenRaidArena={() => {
                  soundEngine.click();
                  setActiveTab('campaign');
                }}
                onConvertFocusToQuest={handleConvertFocusToQuest}
                onOpenAssistant={() => {
                  soundEngine.click();
                  setActiveTab('assistant');
                }}
              />
            )}

            {activeTab === 'skills' && (
              <div className="p-4 sm:p-5">
                <SkillTreeView
                  player={state.player}
                  skills={state.skills}
                  growthBonuses={state.growthBonuses}
                  onUnlockSkill={async (skillId) => {
                    const prev = state.skills.find((s) => s.id === skillId);
                    const updated = await systemApi.unlockSkill(skillId);
                    setState(updated);
                    soundEngine.skillUnlock();
                    if (prev?.unlocked) {
                      triggerLevelUpFx();
                      pushAlert(
                        'Phá Giới Hạn +5 Cấp!',
                        `${prev.name} đã đột phá Ascension mới — tiếp tục nâng cấp vô hạn bằng Gold & Runestones!`
                      );
                    } else {
                      pushAlert(
                        'Đã Mở Khóa Kĩ Năng!',
                        'Bạn có thể dùng Gold / Runestones để nâng cấp kỹ năng này ngay bây giờ!'
                      );
                    }
                  }}
                  onUpgradeSkill={async (skillId) => {
                    const updated = await systemApi.upgradeSkill(skillId);
                    setState(updated);
                    soundEngine.questComplete();
                    pushAlert(
                      'Nâng Cấp Kĩ Năng Thành Công!',
                      'Chỉ số & hiệu ứng bị động phát triển bản thân đã tăng ngay lập tức!'
                    );
                  }}
                  onRespecSkills={async () => {
                    const updated = await systemApi.respecSkills();
                    setState(updated);
                    soundEngine.systemPing();
                    pushAlert('Đã Tẩy Cây Kĩ Năng', 'Hoàn trả 100% Điểm Kĩ Năng (SP), Gold & Runestones!');
                  }}
                  onVerifyCustomSkill={async (skillId, proofNote) => {
                    const updated = await systemApi.verifySkill(skillId, proofNote);
                    setState(updated);
                    soundEngine.questComplete();
                    pushAlert('Đã nâng Tier kỹ năng', 'Nhận +8 💎, +100G và +3 Stat.');
                  }}
                />
              </div>
            )}

            {activeTab === 'campaign' && (
              <div className="p-4 sm:p-5">
                <BossAndSkillsView
                  chapters={state.chapters}
                  bosses={state.bosses}
                  skills={state.skills}
                  streakDays={state.player.streakDays}
                  weeklyRaid={weeklyRaid}
                  weeklyRaidLoading={weeklyRaidLoading}
                  onChangeRaidDifficulty={handleChangeRaidDifficulty}
                  onClaimRaidChest={handleClaimRaidChest}
                  onRegenerateRaidAi={handleRegenerateRaidAi}
                  onRefreshRaid={handleRefreshRaid}
                  onVerifyBossStage={async (bossId, stageId, proofText) => {
                    const res = await systemApi.verifyBossStage(bossId, stageId, proofText);
                    setState(res.state);
                    if (res.unlockedChapterTitle) {
                      triggerLevelUpFx();
                      soundEngine.arise();
                      pushAlert(
                        'Mở khóa Chương mới!',
                        `Đã mở: ${res.unlockedChapterTitle} (+4 SP, +40 💎, +400G)!`
                      );
                    } else if (res.unlockedChapterBossTitle) {
                      triggerLevelUpFx();
                      soundEngine.arise();
                      pushAlert(
                        'Phong ấn Boss Chương đã mở!',
                        `${res.unlockedChapterBossTitle} sẵn sàng nhận Proof-of-Work!`
                      );
                    } else if (res.bossDefeated) {
                      triggerLevelUpFx();
                      soundEngine.arise();
                      pushAlert(
                        'Hạ gục Boss!',
                        'Chiết xuất Shadow Soldier mới + nhận +4 SP bonus & Runestones!'
                      );
                    } else {
                      soundEngine.questComplete();
                      pushAlert(
                        'Xác thực cột mốc thành công!',
                        'Boss HP đã giảm · +2 SP · +10 💎 · +120 G!'
                      );
                    }
                  }}
                  onVerifySkill={async (skillId, proofNote) => {
                    soundEngine.questComplete();
                    const updated = await systemApi.verifySkill(skillId, proofNote);
                    setState(updated);
                    pushAlert('Đã nâng Tier kỹ năng', 'Nhận +8 💎, +100G.');
                  }}
                  onVerifyMinionStage={async (chapterId, stageId, proofText) => {
                    const res = await systemApi.verifyMinionStage(chapterId, stageId, proofText);
                    setState(res.state);
                    if (res.stageCleared) {
                      triggerLevelUpFx();
                      soundEngine.arise();
                      pushAlert('Đã dọn sạch đợt quái!', 'Nhận thưởng Gold, XP & SP cho màn chiến dịch!');
                    } else {
                      soundEngine.questComplete();
                      pushAlert('Đã ghi nhận tiến độ!', 'Hoàn thành thêm Quest hoặc xác thực để dọn xong đợt quái.');
                    }
                  }}
                />
              </div>
            )}

            {activeTab === 'timetable' && (
              <div className="p-4 sm:p-5">
                <TimetablePlanner
                  weeklyAnalysis={state.weeklyAnalysis}
                  quests={state.quests}
                  onApplyWeeklyBlueprint={handleApplyWeeklyBlueprint}
                  onAiPlanDaySchedule={async (p) => {
                    soundEngine.arise();
                    const res = await systemApi.aiPlanDaySchedule(p);
                    setState(res.state);
                    pushAlert('AI Đã Xếp Lịch', res.summary);
                    return res;
                  }}
                  onSaveBatch={async (blocks, replaceExisting) => {
                    soundEngine.systemPing();
                    const updated = await systemApi.saveTimetableBatch(blocks, replaceExisting);
                    setState(updated);
                    pushAlert('Đã cập nhật lịch', `Đã thêm ${blocks.length} khung giờ.`);
                  }}
                  onUpdateBlock={async (id, updates) => {
                    soundEngine.click();
                    const updated = await systemApi.updateTimetableBlock(id, updates);
                    setState(updated);
                  }}
                  onDeleteBlock={async (id) => {
                    soundEngine.click();
                    const updated = await systemApi.deleteTimetableBlock(id);
                    setState(updated);
                    pushAlert('Đã xóa khung lịch', 'Khối thời gian và nhiệm vụ chờ liên kết đã được xóa.');
                  }}
                  onDeleteQuest={async (questId) => {
                    soundEngine.click();
                    const updated = await systemApi.deleteQuest(questId);
                    setState(updated);
                    pushAlert('Đã xóa nhiệm vụ', 'Nhiệm vụ và khung lịch liên kết (nếu có) đã được gỡ.');
                  }}
                  onClearTimetable={async (dayOfWeek) => {
                    soundEngine.alert();
                    const updated = await systemApi.clearTimetable(dayOfWeek);
                    setState(updated);
                    pushAlert('Đã dọn lịch', 'Các khung giờ đã chọn được xóa.');
                  }}
                  onImportText={async (rawText, replaceAll) => {
                    soundEngine.arise();
                    const res = await systemApi.importTimetableText(rawText, replaceAll);
                    setState(res.state);
                    pushAlert('Import thành công', `Đã nhập ${res.importedCount} khung giờ cố định.`);
                  }}
                />
              </div>
            )}

            {activeTab === 'hero' && (
              <div>
                {/* Flush Sub-Tabs Ledger Bar */}
                <div className="flex flex-wrap items-center gap-1 border-b-2 px-4 pt-3 rpg-divider studio-subtle">
                  {[
                    { key: 'status' as const, label: 'Biểu Đồ & Cấp Độ', icon: <PxShield size={14} /> },
                    { key: 'profile' as const, label: 'Mục Tiêu & Hồ Sơ', icon: <PxTarget size={14} /> },
                    {
                      key: 'shop' as const,
                      label: `Cửa Hàng & Kho (${state.inventory.length})`,
                      icon: <PxChest size={14} />,
                    },
                    {
                      key: 'shadows' as const,
                      label: `Shadow Army (${state.shadows.length})`,
                      icon: <PxGhost size={14} />,
                    },
                  ].map((st) => {
                    const active = heroSubTab === st.key;
                    return (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => {
                          soundEngine.click();
                          setHeroSubTab(st.key);
                        }}
                        className={`flex items-center gap-1.5 px-3.5 py-2 text-xs ${
                          active ? 'rpg-tab-active' : 'rpg-tab'
                        }`}
                      >
                        {st.icon}
                        <span>{st.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="p-4 sm:p-5">
                  {heroSubTab === 'status' && (
                    <StatusWindow
                      player={state.player}
                      dailySnapshots={state.dailySnapshots}
                      storageInfo={state.storageInfo}
                      auditLogs={state.auditLogs}
                      growthBonuses={state.growthBonuses}
                      quests={state.quests}
                      onSelectTitle={async (title) => {
                        soundEngine.systemPing();
                        const updated = await systemApi.checkin({ activeTitle: title });
                        setState(updated);
                        pushAlert('Đã đổi danh hiệu', `Đang mang danh hiệu "${title}".`);
                      }}
                    />
                  )}

                  {heroSubTab === 'profile' && (
                    <ProfileGoalsConsole
                      player={state.player}
                      goals={state.goals}
                      onSaveProfile={async (profile) => {
                        soundEngine.systemPing();
                        const updated = await systemApi.updateProfile(profile);
                        setState(updated);
                        pushAlert('Đã lưu hồ sơ', 'Thông tin & System Prompt đã đồng bộ với AI.');
                      }}
                      onAnalyzeGoal={async (rawInput) => {
                        soundEngine.arise();
                        const res = await systemApi.analyzeGoal(rawInput);
                        setState(res.state);
                        pushAlert(
                          'Đã phân tích & lên lịch mục tiêu',
                          `"${res.analysis.goal.title}" đã chia cột mốc, tự động gắn lên Thời Khóa Biểu và tạo Quest hôm nay!`
                        );
                      }}
                      onDeleteGoal={async (id) => {
                        soundEngine.click();
                        const updated = await systemApi.deleteGoal(id);
                        setState(updated);
                      }}
                    />
                  )}

                  {heroSubTab === 'shop' && (
                    <ShopAndInventoryView
                      player={state.player}
                      shopItems={state.shopItems}
                      inventory={state.inventory}
                      onBuyItem={async (itemId) => {
                        soundEngine.coinLoot();
                        const updated = await systemApi.buyShopItem(itemId);
                        setState(updated);
                        pushAlert('Mua thành công!', 'Vật phẩm đã vào Túi Đồ.');
                      }}
                      onUseItem={async (inventoryId) => {
                        soundEngine.campfireHeal();
                        const res = await systemApi.useInventoryItem(inventoryId);
                        setState(res.state);
                        pushAlert('Đã sử dụng vật phẩm', res.message);
                      }}
                      onCreateCustomReward={async (payload) => {
                        soundEngine.systemPing();
                        const updated = await systemApi.createCustomReward(payload);
                        setState(updated);
                        pushAlert('Đã tạo phần thưởng', `"${payload.name}" đã thêm vào Cửa Hàng.`);
                      }}
                      onDeleteCustomReward={async (itemId) => {
                        soundEngine.click();
                        const updated = await systemApi.deleteCustomReward(itemId);
                        setState(updated);
                        pushAlert('Đã xóa phần thưởng', 'Phần thưởng tự tạo đã được gỡ khỏi Cửa Hàng.');
                      }}
                    />
                  )}

                  {heroSubTab === 'shadows' && (
                    <ShadowArmyModal
                      shadows={state.shadows}
                      onSummonShadow={async (shadowId) => {
                        soundEngine.arise();
                        const updated = await systemApi.summonShadow(shadowId);
                        setState(updated);
                        setActiveTab('quests');
                        pushAlert('Triệu hồi Shadow!', 'Nhiệm vụ tự động từ Shadow đã thêm vào hôm nay.');
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            {activeTab === 'assistant' && (
              <div className="p-4 sm:p-5">
                <AssistantCenterView
                  overview={assistantOverview}
                  pendingQuests={state.quests.filter(
                    (q) => q.dateKey === todayKey && q.status === 'pending'
                  )}
                  loading={assistantLoading}
                  onRefresh={async () => {
                    await Promise.all([loadAssistantOverview(), loadWeeklyRaid(true)]);
                  }}
                  onSetDnd={handleSetDnd}
                  onStateChanged={(nextState) => setState(nextState)}
                  hudVisible={hudVisible}
                  onToggleHudVisible={() => void handleToggleHudVisible()}
                  onDockHudCorner={handleDockHudCorner}
                  onToggleTracker={async (enabled) => {
                    soundEngine.systemPing();
                    const ov = await systemApi.toggleDesktopTracker(enabled);
                    setAssistantOverview(ov);
                    pushAlert(
                      enabled ? 'Đã bật Tracker PC' : 'Đã tắt Tracker PC',
                      enabled
                        ? 'Hệ thống bắt đầu ghi nhận thời gian tập trung trên Windows.'
                        : 'Đã tạm dừng theo dõi cửa sổ.'
                    );
                  }}
                  onUpdateSettings={async (patch) => {
                    soundEngine.click();
                    const ov = await systemApi.updateAssistantSettings(patch);
                    setAssistantOverview(ov);
                    pushAlert('Đã lưu quy tắc Trợ Lý PC', 'Cấu hình thông báo & phân loại đã được cập nhật.');
                  }}
                  onInstallStartup={async (opts) => {
                    const res = await systemApi.installWindowsStartup(opts);
                    setAssistantOverview(res.overview);
                    soundEngine.skillUnlock();
                    pushAlert('Đã cài Khởi động cùng Windows', res.message);
                  }}
                  onUninstallStartup={async (opts) => {
                    const res = await systemApi.uninstallWindowsStartup(opts);
                    setAssistantOverview(res.overview);
                    soundEngine.alert();
                    pushAlert('Đã gỡ Khởi động cùng Windows', res.message);
                  }}
                  onLaunchTray={async () => {
                    soundEngine.systemPing();
                    const res = await systemApi.launchSystemTray();
                    pushAlert('System Tray', res.message);
                  }}
                  onTestNotification={async () => {
                    soundEngine.systemPing();
                    const res = await systemApi.testAssistantNotification();
                    setAssistantOverview(res.overview);
                    pushAlert('Thử thông báo Windows', res.message);
                  }}
                  onDismissNudge={async (id) => {
                    soundEngine.click();
                    const ov = await systemApi.dismissAssistantNudge(id);
                    setAssistantOverview(ov);
                  }}
                  onSyncFocusToSkill={async () => {
                    const res = await systemApi.syncActivityToSkill();
                    setAssistantOverview(res.overview);
                    setState(res.state);
                    void loadWeeklyRaid(true);
                    if (res.bonusSp > 0) {
                      triggerLevelUpFx();
                    } else {
                      soundEngine.questComplete();
                    }
                    pushAlert('Quy đổi Focus -> Skill XP!', res.message);
                  }}
                  onReclassifyApp={handleReclassifyApp}
                  onConvertFocusToQuest={handleConvertFocusToQuest}
                  onRunOrchestrate={async () => {
                    soundEngine.systemPing();
                    const updated = await systemApi.orchestrate({});
                    setState(updated);
                    setActiveTab('quests');
                    pushAlert('Kế hoạch mới đã sẵn sàng', 'AI đã sắp xếp nhiệm vụ vừa khung giờ rảnh hôm nay.');
                  }}
                />
              </div>
            )}
          </main>
        </div>
      </div>

      {state.player.lastDeathReport && (
        <DeathCheckpointModal
          deathReport={state.player.lastDeathReport}
          onAcknowledge={async () => {
            soundEngine.campfireHeal();
            const updated = await systemApi.acknowledgeDeath();
            setState(updated);
            pushAlert('Đã hồi sinh tại Checkpoint!', 'Tiếp tục hành trình với 75% HP!');
          }}
        />
      )}

      {!state.player.isOnboarded && (
        <AwakeningWizardModal
          aiSettings={state.aiSettings}
          profile={state.player.profile}
          onSaveAI={async (s) => {
            const updated = await systemApi.saveAISettings(s);
            setState(updated);
          }}
          onSaveProfile={async (p) => {
            const updated = await systemApi.updateProfile(p);
            setState(updated);
          }}
          onImportTimetable={async (rawText, replaceAll) => {
            const res = await systemApi.importTimetableText(rawText, replaceAll);
            setState(res.state);
          }}
          onAnalyzeGoal={async (rawInput) => {
            const res = await systemApi.analyzeGoal(rawInput);
            setState(res.state);
          }}
          onComplete={async () => {
            soundEngine.arise();
            const updated = await systemApi.completeOnboarding();
            setState(updated);
            pushAlert('Chào mừng vào Hệ Thống!', 'Hoàn thành Quest hàng ngày để tích Điểm Kĩ Năng (SP) & nâng Cây Kĩ Năng!');
          }}
        />
      )}

      {liveDungeonQuest && (
        <DungeonFocusModal
          quest={liveDungeonQuest}
          onToggleSubtask={async (questId, subtaskId) => {
            soundEngine.click();
            const updated = await systemApi.toggleSubtask(questId, subtaskId);
            setState(updated);
          }}
          onClearDungeon={async (questId, proofNote) => {
            const res = await systemApi.completeQuest(questId, { proofNote, dungeonCleared: true });
            setState(res.state);
            void loadWeeklyRaid(true);
            setDungeonQuest(null);
            if (res.leveledUp || res.rankPromoted) triggerLevelUpFx();
            else soundEngine.questComplete();
            pushAlert(
              'Hoàn thành Focus!',
              `+${res.xpGain} XP (+25% Bonus) · +${res.goldGain}G · +${res.spGain ?? 2} SP${
                res.actualDurationMinutes ? ` · ${res.actualDurationMinutes}p thực` : ''
              }${res.contributedSkillName ? ` · +${res.skillPracticeXpGain ?? 0} Skill XP (${res.contributedSkillName})` : ''}`
            );
          }}
          onClose={() => setDungeonQuest(null)}
        />
      )}

      {settingsOpen && (
        <SystemSettingsModal
          settings={state.aiSettings}
          storageInfo={state.storageInfo}
          auditLogs={state.auditLogs}
          onSaveSettings={async (newSettings) => {
            soundEngine.systemPing();
            const updated = await systemApi.saveAISettings(newSettings);
            setState(updated);
            pushAlert('Đã lưu cài đặt', 'Cấu hình AI đã được cập nhật.');
          }}
          onImportSnapshot={async (snapshot) => {
            soundEngine.arise();
            const updated = await systemApi.importSnapshot(snapshot);
            setState(updated);
            pushAlert('Đã khôi phục dữ liệu', 'File backup đã được nạp vào SQLite.');
          }}
          onResetSystem={async (mode, clearChats = false) => {
            await handleResetSystem(mode, clearChats);
          }}
          onStateUpdated={(updated) => setState(updated)}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {resetModalOpen && (
        <ResetProgressModal
          onReset={async (mode, clearChats) => {
            await handleResetSystem(mode, clearChats);
          }}
          onClose={() => setResetModalOpen(false)}
        />
      )}

      {/* Command Palette (Ctrl+K / Cmd+K) */}
      {commandPaletteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 px-4 pt-16"
          onClick={() => setCommandPaletteOpen(false)}
        >
          <div
            className="rpg-window relative w-full max-w-lg overflow-hidden rounded-none"
            onClick={(e) => e.stopPropagation()}
          >
            <PixelRivets />
            <div className="flex items-center gap-2.5 border-b-2 px-4 py-3 rpg-divider">
              <PxSearch size={15} color="var(--px-gold-text)" />
              <input
                ref={commandInputRef}
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedCommandIdx((prev) =>
                      filteredCommands.length === 0 ? 0 : (prev + 1) % filteredCommands.length
                    );
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedCommandIdx((prev) =>
                      filteredCommands.length === 0
                        ? 0
                        : (prev - 1 + filteredCommands.length) % filteredCommands.length
                    );
                  } else if (e.key === 'Enter' && filteredCommands[selectedCommandIdx]) {
                    e.preventDefault();
                    void filteredCommands[selectedCommandIdx].run();
                  }
                }}
                placeholder="Tìm lệnh nhanh: Hôm Nay, Thời Khóa Biểu, Cây Kĩ Năng, Tiến Độ & Mục Tiêu, Hành Trình..."
                className="flex-1 !border-0 !bg-transparent text-sm text-main !shadow-none focus:!shadow-none"
              />
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(false)}
                className="p-1 text-dim hover:text-main"
              >
                <PxClose size={14} />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {filteredCommands.length === 0 ? (
                <div className="py-8 text-center text-xs text-dim">Không tìm thấy lệnh phù hợp.</div>
              ) : (
                filteredCommands.map((cmd, idx) => {
                  const selected = idx === selectedCommandIdx;
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      disabled={paletteBusy}
                      onMouseEnter={() => setSelectedCommandIdx(idx)}
                      onClick={() => void cmd.run()}
                      className={`flex w-full items-center justify-between gap-3 rounded-none px-3 py-2.5 text-left text-xs ${
                        selected
                          ? 'border-2 border-[var(--border-ink)] bg-[var(--px-gold)] text-[#140e04]'
                          : 'border-2 border-transparent text-main hover:bg-[var(--bg-muted)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {cmd.icon}
                        <span className="font-semibold">{cmd.label}</span>
                      </div>
                      <span
                        className={`font-mono text-[10px] ${
                          selected ? 'font-bold text-[#140e04]' : 'text-dim'
                        }`}
                      >
                        {cmd.hint}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between border-t-2 px-4 py-2 text-[11px] text-dim rpg-divider studio-subtle">
              <span className="flex items-center gap-1.5">
                <PxCmd size={12} /> ↑↓ chọn · Enter chạy · Esc đóng
              </span>
              <span className="font-mono">Ctrl+K / ⌘K</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
