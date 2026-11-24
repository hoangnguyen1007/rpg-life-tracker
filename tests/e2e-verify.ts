const BASE = process.env.TEST_BASE_URL || 'http://localhost:3001';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}

async function api<T = any>(
  path: string,
  method = 'GET',
  body?: unknown
): Promise<{ status: number; ok: boolean; data: T }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log('1. Reset to clean Level 1');
  let r = await api('/api/system/reset', 'POST', { mode: 'clean' });
  assert(r.ok, 'reset ok');
  let st = r.data;
  assert(
    st.player.level === 1 && st.player.gold === 0 && st.player.skillPoints === 0,
    'clean level 1'
  );
  assert(st.player.hp === 100 && st.player.maxHp === 100, 'clean 100/100 HP');
  assert(
    st.skills.length === 12 &&
      st.skills.every((s: any) => !s.unlocked && s.masteryTier === 0),
    '12 locked skill nodes'
  );
  assert(
    st.activeEncounter &&
      st.activeEncounter.mode === 'monster' &&
      !st.activeEncounter.defeated,
    'initial small monster spawned'
  );

  console.log('2. Skill Tree Dual-Gate Guard Tests');
  r = await api('/api/skills/sk-blade-focus/upgrade', 'POST');
  assert(r.status === 400, 'cannot upgrade locked skill');
  r = await api('/api/skills/sk-blade-focus/unlock', 'POST');
  assert(r.status === 400, 'cannot unlock with 0 SP');
  r = await api('/api/skills/sk-crit-edge/unlock', 'POST');
  assert(r.status === 400, 'cannot unlock tier 2 before tier 1');
  r = await api('/api/skills/respec', 'POST');
  assert(r.status === 400, 'cannot respec empty tree');

  console.log('3. Small Monster Combat (3 monsters -> Elite on 3rd)');
  r = await api('/api/dungeon/action', 'POST', { action: 'whirlwind' });
  assert(r.status === 400, 'cannot use locked whirlwind skill');
  r = await api('/api/dungeon/action', 'POST', { action: 'shadow_nova' });
  assert(r.status === 400, 'cannot use locked shadow_nova skill');

  let eliteSeen = false;
  for (let m = 1; m <= 3; m++) {
    if (m > 1) {
      r = await api('/api/dungeon/spawn', 'POST', { mode: 'monster', chapterNumber: 1 });
      assert(r.ok, `spawn monster ${m}`);
      st = r.data;
      if (m === 3) {
        assert(st.activeEncounter.isElite === true, '3rd monster must be Elite');
        eliteSeen = true;
      }
    }
    let guardTested = false;
    let safety = 0;
    while (!st.activeEncounter.defeated && safety++ < 25) {
      const act = !guardTested ? 'guard' : 'strike';
      guardTested = true;
      r = await api('/api/dungeon/action', 'POST', {
        action: act,
        timingQuality: 'perfect',
      });
      assert(r.ok, `combat action ${act} failed: ${JSON.stringify(r.data)}`);
      st = r.data.state;
    }
    assert(st.activeEncounter.defeated, `monster ${m} defeated`);
    const postDef = await api('/api/dungeon/action', 'POST', { action: 'strike' });
    assert(postDef.status === 400, 'cannot attack defeated monster');
  }
  assert(eliteSeen, 'elite monster verified');
  assert(st.player.monstersSlain === 3, '3 monsters slain');
  assert(st.player.skillPoints >= 4, `earned >= 4 SP (actual ${st.player.skillPoints})`);
  assert(st.player.gold >= 150, `earned Gold (actual ${st.player.gold})`);
  assert(st.player.runestones >= 3, `earned Runestones from Elite (actual ${st.player.runestones})`);
  console.log(
    `   After 3 monsters: Lv.${st.player.level}, SP=${st.player.skillPoints}, G=${st.player.gold}, Rune=${st.player.runestones}, HP=${st.player.hp}/${st.player.maxHp}`
  );

  console.log('4. Skill Tree Unlock (SP) -> Upgrade (Currency) -> Prereq -> Respec Anti-Exploit');
  const preSp = st.player.skillPoints;
  const preGold = st.player.gold;
  const preAtk = st.combatStats.atk;
  const preStr = st.player.stats.STR;

  // Unlock blade focus (-1 SP)
  r = await api('/api/skills/sk-blade-focus/unlock', 'POST');
  assert(r.ok, 'unlock blade focus');
  st = r.data;
  assert(st.player.skillPoints === preSp - 1, 'SP deducted by 1');
  assert(st.skills.find((s: any) => s.id === 'sk-blade-focus').unlocked === true, 'blade focus unlocked');
  assert(
    st.skills.find((s: any) => s.id === 'sk-blade-focus').masteryTier === 0,
    'blade focus still Lv.0 before currency upgrade'
  );

  // Duplicate unlock rejected
  r = await api('/api/skills/sk-blade-focus/unlock', 'POST');
  assert(r.status === 400, 'duplicate unlock rejected');

  // Tier 2 still blocked while Tier 1 is Lv.0
  r = await api('/api/skills/sk-combo-frenzy/unlock', 'POST');
  assert(r.status === 400, 'tier 2 requires tier 1 Lv.1+');

  // Upgrade blade focus with Gold (-50G)
  r = await api('/api/skills/sk-blade-focus/upgrade', 'POST');
  assert(r.ok, 'upgrade blade focus');
  st = r.data;
  assert(st.player.gold === preGold - 50, '50G deducted');
  assert(st.skills.find((s: any) => s.id === 'sk-blade-focus').masteryTier === 1, 'blade focus Lv.1');
  assert(st.player.stats.STR === preStr + 2, 'STR +2');
  assert(st.combatStats.atk > preAtk, `ATK increased from ${preAtk} to ${st.combatStats.atk}`);

  // Unlock & Upgrade Vital Heart -> Max HP +20 (+1 Full Heart!)
  r = await api('/api/skills/sk-vital-heart/unlock', 'POST');
  assert(r.ok, 'unlock vital heart');
  r = await api('/api/skills/sk-vital-heart/upgrade', 'POST');
  assert(r.ok, 'upgrade vital heart');
  st = r.data;
  assert(st.player.maxHp >= 120, `maxHp increased to ${st.player.maxHp}`);

  // Earn extra gold & SP via Custom Quest
  r = await api('/api/quests/custom', 'POST', {
    title: 'Deep Work Sprint',
    durationMinutes: 60,
    type: 'main',
    primaryStat: 'INT',
  });
  assert(r.ok, 'create quest');
  const qId = r.data.quests[0].id;
  r = await api(`/api/quests/${qId}/complete`, 'POST', {
    proofNote: 'Completed full session with notes',
  });
  assert(r.ok, 'complete quest');
  st = r.data.state;
  assert((r.data.spGain || 0) === 2, 'main quest grants +2 SP');

  // Unlock & Upgrade Tier 2 Whirlwind (2 SP + 110G + 2 Runestones)
  r = await api('/api/skills/sk-combo-frenzy/unlock', 'POST');
  assert(r.ok, `unlock whirlwind: ${JSON.stringify(r.data)}`);
  r = await api('/api/skills/sk-combo-frenzy/upgrade', 'POST');
  assert(r.ok, `upgrade whirlwind: ${JSON.stringify(r.data)}`);
  st = r.data;
  assert(st.combatStats.hasWhirlwind === true, 'whirlwind unlocked & active');

  // Test Whirlwind in live combat!
  r = await api('/api/dungeon/spawn', 'POST', { mode: 'monster', chapterNumber: 1 });
  st = r.data;
  if (st.player.combatCombo < 2) {
    await api('/api/dungeon/action', 'POST', { action: 'strike', timingQuality: 'perfect' });
  }
  r = await api('/api/dungeon/action', 'POST', { action: 'whirlwind' });
  assert(r.ok && r.data.playerDamage > 0, `whirlwind dealt damage: ${JSON.stringify(r.data)}`);
  st = r.data.state;

  // Test Shadow Nova Stun (Tier 2 Arcane branch: sk-arcane-mind -> sk-shadow-bolt)
  // First verify insufficient Gold guard works cleanly when gold < 50!
  r = await api('/api/skills/sk-arcane-mind/unlock', 'POST');
  assert(r.ok, `unlock arcane mind: ${JSON.stringify(r.data)}`);
  st = r.data;
  if (st.player.gold < 50) {
    const failGold = await api('/api/skills/sk-arcane-mind/upgrade', 'POST');
    assert(failGold.status === 400, 'insufficient gold cleanly rejected');
  }
  // Earn Gold + SP + Runestones from quests to fund Arcane branch
  for (let i = 0; i < 3; i++) {
    const cq = await api('/api/quests/custom', 'POST', {
      title: `Arcane Study ${i}`,
      durationMinutes: 90,
      type: 'main',
      primaryStat: 'INT',
    });
    const q = cq.data.quests.find((x: any) => x.status === 'pending');
    const done = await api(`/api/quests/${q.id}/complete`, 'POST', {
      proofNote: 'Verified study synthesis output',
    });
    assert(done.ok, 'complete funding quest');
    st = done.data.state;
  }
  r = await api('/api/skills/sk-arcane-mind/upgrade', 'POST');
  assert(r.ok, `upgrade arcane mind Lv.1: ${JSON.stringify(r.data)}`);
  r = await api('/api/skills/sk-shadow-bolt/unlock', 'POST');
  assert(r.ok, `unlock shadow bolt: ${JSON.stringify(r.data)}`);
  r = await api('/api/skills/sk-shadow-bolt/upgrade', 'POST');
  assert(r.ok, `upgrade shadow bolt: ${JSON.stringify(r.data)}`);
  st = r.data;
  assert(st.combatStats.hasShadowNova === true, 'shadow nova unlocked');

  // Spawn fresh monster & verify Shadow Nova STUNS enemy (0 enemyDamage on stun turn!)
  r = await api('/api/dungeon/spawn', 'POST', { mode: 'monster', chapterNumber: 1 });
  st = r.data;
  while ((st.player.combatCombo ?? 0) < 2 && !st.activeEncounter.defeated) {
    const gr = await api('/api/dungeon/action', 'POST', { action: 'guard' });
    st = gr.data.state;
  }
  if (!st.activeEncounter.defeated) {
    const novaRes = await api('/api/dungeon/action', 'POST', { action: 'shadow_nova' });
    assert(novaRes.ok, `shadow nova ok: ${JSON.stringify(novaRes.data)}`);
    assert(novaRes.data.enemyStunned === true, 'shadow nova stunned enemy');
    assert(novaRes.data.enemyDamage === 0, 'stunned enemy dealt 0 damage');
    st = novaRes.data.state;
  }

  // Test Respec Anti-Exploit after investing across both branches!
  const beforeRespecSp = st.player.skillPoints;
  const beforeRespecGold = st.player.gold;
  const beforeRespecRune = st.player.runestones;
  r = await api('/api/skills/respec', 'POST');
  assert(r.ok, 'respec ok');
  st = r.data;
  assert(st.player.skillPoints === beforeRespecSp + 7, `refunded exact 7 SP (got ${st.player.skillPoints - beforeRespecSp})`);
  assert(st.player.gold === beforeRespecGold + 370, `refunded exact 370G (got ${st.player.gold - beforeRespecGold})`);
  assert(st.player.runestones === beforeRespecRune + 4, `refunded exact 4 Runestones (got ${st.player.runestones - beforeRespecRune})`);
  assert(st.combatStats.hasWhirlwind === false && st.combatStats.hasShadowNova === false, 'all active skills reset');
  assert(
    st.skills.every((s: any) => !s.unlocked && s.masteryTier === 0),
    'all nodes reset cleanly'
  );

  // Test Max Tier Cap (upgrade sk-blade-focus Lv.1..5, then verify Lv.6 rejected!)
  // Give enough gold by defeating a couple more quests if needed
  for (let i = 0; i < 6 && st.player.gold < 800; i++) {
    const cq = await api('/api/quests/custom', 'POST', { title: `Gold Farm ${i}`, durationMinutes: 120, type: 'main' });
    const q = cq.data.quests.find((x: any) => x.status === 'pending');
    const done = await api(`/api/quests/${q.id}/complete`, 'POST', { proofNote: 'Completed full session' });
    st = done.data.state;
  }
  r = await api('/api/skills/sk-blade-focus/unlock', 'POST');
  assert(r.ok, 're-unlock blade focus for max tier test');
  for (let lv = 1; lv <= 5; lv++) {
    r = await api('/api/skills/sk-blade-focus/upgrade', 'POST');
    assert(r.ok, `upgrade blade focus to Lv.${lv}`);
    st = r.data;
  }
  assert(st.skills.find((s: any) => s.id === 'sk-blade-focus').masteryTier === 5, 'reached maxTier 5');
  r = await api('/api/skills/sk-blade-focus/upgrade', 'POST');
  assert(r.status === 400, 'Lv.6 beyond maxTier rejected cleanly');

  console.log('5. Campfire & Health Potion Economy');
  r = await api('/api/shop/buy', 'POST', { itemId: 'item-con-potion' });
  assert(r.ok, 'buy health potion');
  assert(
    r.data.inventory.some((i: any) => i.effectCode === 'USE_HEALTH_POTION'),
    'potion added to inventory'
  );
  // Use potion in combat
  if (r.data.activeEncounter.defeated) {
    await api('/api/dungeon/spawn', 'POST', { mode: 'monster', chapterNumber: 1 });
  }
  r = await api('/api/dungeon/action', 'POST', { action: 'potion' });
  assert(r.ok && r.data.healedHp === 50, 'potion healed +50 HP in combat');
  r = await api('/api/dungeon/campfire', 'POST');
  assert(r.ok && r.data.player.hp === r.data.player.maxHp, 'campfire restores full HP');

  console.log('6. Boss Combat + Proof Stages + Chapter 2 Unlock');
  r = await api('/api/dungeon/spawn', 'POST', { mode: 'boss', bossId: 'boss-c1-boss' });
  assert(r.status === 400, 'cannot fight sealed chapter boss');

  r = await api('/api/dungeon/spawn', 'POST', { mode: 'boss', bossId: 'boss-c1-m1' });
  assert(r.ok && r.data.activeEncounter.mode === 'boss', 'spawn mini-boss 1');
  r = await api('/api/dungeon/action', 'POST', { action: 'strike', timingQuality: 'perfect' });
  assert(r.ok && r.data.playerDamage > 0, '2D combat hits mini-boss');
  const mb1AfterHit = r.data.state.bosses.find((b: any) => b.id === 'boss-c1-m1');
  assert(mb1AfterHit.currentHp < mb1AfterHit.maxHp, 'boss HP persisted in SQLite');

  for (const bossId of ['boss-c1-m1', 'boss-c1-m2']) {
    const boss = st.bosses.find((b: any) => b.id === bossId);
    for (const stage of boss.stages) {
      r = await api(`/api/bosses/${bossId}/stages/${stage.id}/verify`, 'POST', {
        proofText: 'Verified real milestone output',
      });
      assert(r.ok, `verify stage ${stage.id}`);
      st = r.data.state;
    }
  }
  const ch1Boss = st.bosses.find((b: any) => b.id === 'boss-c1-boss');
  assert(ch1Boss.unlocked === true, 'Chapter 1 Boss unsealed after 2 Mini-Bosses!');
  assert(st.shadows.length >= 2, '2 Shadows extracted from Mini-Bosses!');

  for (const stage of ch1Boss.stages) {
    r = await api(`/api/bosses/boss-c1-boss/stages/${stage.id}/verify`, 'POST', {
      proofText: 'Chapter 1 Boss proof verified',
    });
    assert(r.ok, 'verify ch1 boss stage');
    st = r.data.state;
  }
  assert(st.chapters.find((c: any) => c.id === 'ch-1').completed === true, 'Ch1 completed');
  assert(st.chapters.find((c: any) => c.id === 'ch-2').unlocked === true, 'Ch2 unlocked');

  console.log('7. Goal Analysis, Custom Boss & SQLite Integrity');
  r = await api('/api/goals/analyze', 'POST', {
    rawInput: 'Build strong daily discipline and finish 1 creative portfolio project in 60 days',
  });
  assert(r.ok && r.data.state.goals.length === 1, 'goal analyzed');
  assert(
    r.data.state.bosses.some((b: any) => b.bossRole === 'custom_boss'),
    'custom goal boss created'
  );
  r = await api('/api/system/health-full');
  assert(r.ok && r.data.integrityCheck === 'ok', 'SQLite integrity OK');

  console.log('8. Final Clean Reset back to Level 1');
  r = await api('/api/system/reset', 'POST', { mode: 'clean' });
  assert(
    r.ok &&
      r.data.player.level === 1 &&
      r.data.player.gold === 0 &&
      r.data.player.skillPoints === 0 &&
      r.data.player.hp === 100 &&
      r.data.player.maxHp === 100,
    'final clean reset verified'
  );

  console.log('\n✅ ALL 8 E2E VERIFICATION SUITES PASSED 100%!');
}

run().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
