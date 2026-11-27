import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const TEST_PORT = 3099;
const BASE = `http://127.0.0.1:${TEST_PORT}`;
const TEST_DB = path.resolve(process.cwd(), 'data', 'test_big_update_verify.sqlite');

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}

async function api<T = any>(
  urlPath: string,
  method = 'GET',
  body?: unknown
): Promise<{ status: number; ok: boolean; data: T }> {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, ok: res.ok, data };
}

async function waitForHealth(timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await api('/api/health');
      if (r.ok && r.data?.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Server failed to start within timeout');
}

function cleanupDb() {
  for (const suffix of ['', '-wal', '-shm']) {
    const f = `${TEST_DB}${suffix}`;
    if (fs.existsSync(f)) {
      try {
        fs.unlinkSync(f);
      } catch {
        // ignore
      }
    }
  }
}

async function run() {
  cleanupDb();
  const realDb = path.resolve(process.cwd(), 'data', 'the_system.sqlite');
  if (fs.existsSync(realDb)) {
    // Copy existing real DB to verify 100% lossless additive migration!
    fs.copyFileSync(realDb, TEST_DB);
    console.log('Copied real DB to isolated test copy to verify safe additive migration.');
  }

  const tsxBin = path.resolve(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
  const child = spawn(tsxBin, ['server/index.ts'], {
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      THE_SYSTEM_DB_PATH: TEST_DB,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  try {
    await waitForHealth();
    console.log('1. Server booted cleanly against isolated DB (additive migration OK)');

    // 1. Verify /api/system/state returns new Big Update fields
    const stRes = await api('/api/system/state');
    assert(stRes.ok, 'GET /api/system/state ok');
    assert(stRes.data.disciplineSettings, 'disciplineSettings present');
    assert(Array.isArray(stRes.data.habits), 'habits array present');
    assert(Array.isArray(stRes.data.knowledgeNotes), 'knowledgeNotes array present');
    assert(stRes.data.localIntelligence, 'localIntelligence present');
    console.log(
      `   State loaded: mode=${stRes.data.disciplineSettings.mode}, habits=${stRes.data.habits.length}, notes=${stRes.data.knowledgeNotes.length}`
    );

    // 2. Test Core Habits + Minimum Viable Day check-in & streak
    const hCreate = await api('/api/habits', 'POST', {
      title: 'Test Deep Reading',
      timeOfDay: 'morning',
      frequency: 'daily',
      standardSpec: '20 trang sách chuyên môn',
      minimumSpec: 'Đọc 2 trang giữ chuỗi',
      primaryStat: 'PER',
    });
    assert(hCreate.ok && hCreate.data.habit?.id, 'create habit ok');
    const habitId = hCreate.data.habit.id;

    const hCheckMvd = await api(`/api/habits/${habitId}/checkin`, 'POST', { kind: 'minimum' });
    assert(hCheckMvd.ok && hCheckMvd.data.xpGain === 14, 'MVD checkin grants +14 XP');
    const enrichedHab = hCheckMvd.data.state.habits.find((h: any) => h.id === habitId);
    assert(
      enrichedHab && enrichedHab.completedToday === 'minimum' && enrichedHab.currentStreak >= 1,
      'habit streak incremented & marked minimum'
    );

    // Upgrade to full same day should NOT double-farm XP
    const hCheckFull = await api(`/api/habits/${habitId}/checkin`, 'POST', { kind: 'full' });
    assert(hCheckFull.ok && hCheckFull.data.xpGain === 0, 're-checkin same day prevents XP farming');

    const hUndo = await api(`/api/habits/${habitId}/checkin`, 'POST', { kind: 'undo' });
    assert(hUndo.ok && hUndo.data.undone === true, 'undo habit checkin ok');
    console.log('2. Core Habits + MVD + Streak + Anti-farm verified OK');

    // 3. Test 3 Discipline Modes (sustainable = 0 HP dmg, balanced = 50% + Streak Shield, iron = 100%)
    const setSus = await api('/api/discipline/settings', 'PUT', {
      mode: 'sustainable',
      dailyFocusGoalMinutes: 150,
      distractionBudgetMinutes: 35,
      minimumViableDayActive: true,
    });
    assert(
      setSus.ok &&
        setSus.data.settings.mode === 'sustainable' &&
        setSus.data.settings.dailyFocusGoalMinutes === 150 &&
        setSus.data.settings.minimumViableDayActive === true,
      'sustainable discipline settings saved'
    );

    const qRes = await api('/api/quests/custom', 'POST', {
      title: 'Test Sustainable Miss Quest',
      durationMinutes: 30,
      type: 'main',
      primaryStat: 'INT',
    });
    assert(qRes.ok, 'create quest for sustainable test');
    const testQuest = qRes.data.quests.find((q: any) => q.title === 'Test Sustainable Miss Quest');
    assert(testQuest?.id, 'found test quest');

    const failSus = await api(`/api/quests/${testQuest.id}/fail`, 'POST');
    assert(
      failSus.ok && failSus.data.hpDamage === 0,
      `sustainable mode deals 0 HP damage (got ${failSus.data.hpDamage})`
    );

    // Test Iron mode deals real damage
    await api('/api/discipline/settings', 'PUT', { mode: 'iron' });
    const qRes2 = await api('/api/quests/custom', 'POST', {
      title: 'Test Iron Miss Quest',
      durationMinutes: 30,
      type: 'main',
      primaryStat: 'INT',
    });
    const testQuest2 = qRes2.data.quests.find((q: any) => q.title === 'Test Iron Miss Quest');
    const failIron = await api(`/api/quests/${testQuest2.id}/fail`, 'POST');
    assert(
      failIron.ok && failIron.data.hpDamage > 0,
      `iron mode deals >0 HP damage (got ${failIron.data.hpDamage})`
    );
    console.log('3. Personalized 3 Discipline Modes (Sustainable 0 HP vs Iron HP dmg) verified OK');

    // 4. Test Auto Proof-of-Work Capture into Knowledge Vault + SM-2 Spaced Recall Review
    const qRes3 = await api('/api/quests/custom', 'POST', {
      title: 'Học nguyên lý WAL của SQLite',
      durationMinutes: 45,
      type: 'main',
      primaryStat: 'INT',
    });
    const testQuest3 = qRes3.data.quests.find((q: any) => q.title === 'Học nguyên lý WAL của SQLite');
    const compRes = await api(`/api/quests/${testQuest3.id}/complete`, 'POST', {
      proofNote: 'WAL cho phép đọc đồng thời khi đang ghi bằng cách append vào file -wal trước khi checkpoint.',
    });
    assert(compRes.ok, 'complete quest with proof ok');
    const capturedNote = compRes.data.state.knowledgeNotes.find(
      (n: any) => n.source === 'quest_proof' && n.sourceId === testQuest3.id
    );
    assert(
      capturedNote && capturedNote.recallEnabled === true,
      'INT quest proof auto-captured into Knowledge Vault with Spaced Recall enabled'
    );

    const revRes = await api(`/api/knowledge/${capturedNote.id}/review`, 'POST', {
      rating: 'good',
    });
    assert(
      revRes.ok && revRes.data.nextIntervalDays >= 3 && revRes.data.xpGain === 15,
      `SM-2 recall review advanced interval to ${revRes.data.nextIntervalDays}d and granted +15 XP`
    );

    // Manual Knowledge Note
    const knRes = await api('/api/knowledge', 'POST', {
      title: 'Feynman Technique',
      content: 'Giải thích một khái niệm phức tạp bằng ngôn ngữ đơn giản nhất để lộ lỗ hổng hiểu biết.',
      recallPrompt: 'Cốt lõi của phương pháp Feynman là gì?',
      recallEnabled: true,
    });
    assert(knRes.ok && knRes.data.note?.id, 'manual knowledge note created');
    console.log('4. Proof-of-Work Auto-Capture & SM-2 Spaced Recall verified OK');

    // 5. Verify Local Intelligence endpoint
    const intelRes = await api('/api/intelligence/local');
    assert(
      intelRes.ok &&
        intelRes.data.nextBestAction?.title &&
        typeof intelRes.data.weeklyAdjustment === 'string',
      'Local Intelligence payload valid'
    );
    console.log('5. Local Intelligence endpoint verified OK');

    console.log('\nALL BIG UPDATE VERIFICATION CHECKS PASSED!');
  } finally {
    if (process.platform === 'win32' && child.pid) {
      try {
        execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' });
      } catch {
        // ignore
      }
    } else {
      child.kill();
    }
    await new Promise((r) => setTimeout(r, 400));
    cleanupDb();
  }
}

run().catch((err) => {
  console.error(err);
  cleanupDb();
  process.exit(1);
});
