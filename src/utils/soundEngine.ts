export type AmbienceMode = 'off' | 'rain' | 'campfire' | 'brown_noise' | 'tavern_8bit';

export interface SoundEngineSnapshot {
  enabled: boolean;
  sfxVolume: number; // 0..1
  ambienceMode: AmbienceMode;
  ambienceVolume: number; // 0..1
  ambiencePaused: boolean;
}

const STORAGE_SFX_ENABLED = 'sys_sfx_enabled';
const STORAGE_SFX_VOL = 'sys_sfx_vol';
const STORAGE_AMBIENCE_MODE = 'sys_ambience_mode';
const STORAGE_AMBIENCE_VOL = 'sys_ambience_vol';

const VALID_AMBIENCE_MODES: ReadonlySet<AmbienceMode> = new Set([
  'off',
  'rain',
  'campfire',
  'brown_noise',
  'tavern_8bit',
]);

function clamp01(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function readStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota/privacy mode failures
  }
}

function parseAmbienceMode(raw: string | null): AmbienceMode {
  if (raw && VALID_AMBIENCE_MODES.has(raw as AmbienceMode)) {
    return raw as AmbienceMode;
  }
  return 'off';
}

// Cozy 4-bar (32 eighth-note steps) D Dorian / pentatonic 16-bit guild tavern loop (~92 BPM)
const TAVERN_BASS_HZ: Array<number | null> = [
  146.83, null, null, null, 146.83, null, 220.0, null, // Dm7 (D3 -> A3)
  130.81, null, null, null, 130.81, null, 196.0, null, // Cadd9 (C3 -> G3)
  123.47, null, null, null, 110.0, null, 164.81, null, // G/B -> Am7
  146.83, null, null, null, 110.0, null, 164.81, null, // Dm9 -> A7sus4
];

const TAVERN_ARP_HZ: Array<number | null> = [
  293.66, 349.23, 440.0, 523.25, 440.0, 349.23, 440.0, 392.0,
  261.63, 329.63, 392.0, 587.33, 523.25, 392.0, 329.63, 392.0,
  293.66, 392.0, 493.88, 440.0, 329.63, 392.0, 523.25, 493.88,
  349.23, 440.0, 329.63, 293.66, 261.63, 329.63, 392.0, 440.0,
];

class SystemSoundEngine {
  private ctx: AudioContext | null = null;
  private _enabled = true;
  private _sfxVolume = 0.7;
  private _ambienceMode: AmbienceMode = 'off';
  private _ambienceVolume = 0.45;
  private _ambiencePaused = false;

  private ambienceMasterGain: GainNode | null = null;
  private ambienceActiveMode: AmbienceMode = 'off';
  private ambienceCleanups: Array<() => void> = [];
  private listeners: Set<(s: SoundEngineSnapshot) => void> = new Set();

  constructor() {
    const savedEnabled = readStorage(STORAGE_SFX_ENABLED);
    if (savedEnabled === 'false') {
      this._enabled = false;
    }

    const savedSfxVol = readStorage(STORAGE_SFX_VOL);
    if (savedSfxVol !== null) {
      this._sfxVolume = clamp01(Number(savedSfxVol), 0.7);
    }

    const savedAmbience = readStorage(STORAGE_AMBIENCE_MODE);
    this._ambienceMode = parseAmbienceMode(savedAmbience);

    const savedAmbienceVol = readStorage(STORAGE_AMBIENCE_VOL);
    if (savedAmbienceVol !== null) {
      this._ambienceVolume = clamp01(Number(savedAmbienceVol), 0.45);
    }
  }

  // Backward-compatible property accessor (`soundEngine.enabled = ...`)
  public get enabled(): boolean {
    return this._enabled;
  }

  public set enabled(v: boolean) {
    this.setEnabled(Boolean(v));
  }

  public getSnapshot(): SoundEngineSnapshot {
    return {
      enabled: this._enabled,
      sfxVolume: this._sfxVolume,
      ambienceMode: this._ambienceMode,
      ambienceVolume: this._ambienceVolume,
      ambiencePaused: this._ambiencePaused,
    };
  }

  public subscribe(fn: (s: SoundEngineSnapshot) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(): void {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => {
      try {
        fn(snap);
      } catch {
        // Isolate subscriber errors
      }
    });
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getSfxContext(): AudioContext | null {
    if (!this._enabled || this._sfxVolume <= 0.001) return null;
    return this.getAudioContext();
  }

  // ==================== CHANNEL CONTROLS ====================

  public setEnabled(v: boolean): void {
    const next = Boolean(v);
    if (this._enabled === next) return;
    this._enabled = next;
    writeStorage(STORAGE_SFX_ENABLED, String(next));
    this.emit();
  }

  public setSfxVolume(v: number): void {
    const next = clamp01(v, 0.7);
    if (Math.abs(this._sfxVolume - next) < 0.0005) return;
    this._sfxVolume = next;
    writeStorage(STORAGE_SFX_VOL, String(Number(next.toFixed(3))));
    this.emit();
  }

  public getSfxVolume(): number {
    return this._sfxVolume;
  }

  public setAmbience(mode: AmbienceMode): void {
    const safeMode: AmbienceMode = VALID_AMBIENCE_MODES.has(mode) ? mode : 'off';
    this._ambienceMode = safeMode;
    writeStorage(STORAGE_AMBIENCE_MODE, safeMode);

    if (safeMode === 'off') {
      this._ambiencePaused = false;
      this.teardownAmbience();
      this.emit();
      return;
    }

    this._ambiencePaused = false;
    this.startAmbienceGraph(safeMode);
    this.emit();
  }

  public getAmbience(): AmbienceMode {
    return this._ambienceMode;
  }

  public setAmbienceVolume(v: number): void {
    const next = clamp01(v, 0.45);
    this._ambienceVolume = next;
    writeStorage(STORAGE_AMBIENCE_VOL, String(Number(next.toFixed(3))));

    if (this._ambienceMode !== 'off' && !this._ambiencePaused) {
      if (this.ambienceActiveMode !== this._ambienceMode || !this.ambienceMasterGain) {
        this.startAmbienceGraph(this._ambienceMode);
      } else {
        this.rampAmbienceGain(next, 0.08);
      }
    }
    this.emit();
  }

  public getAmbienceVolume(): number {
    return this._ambienceVolume;
  }

  public setAmbiencePaused(paused: boolean): void {
    const next = Boolean(paused);
    this._ambiencePaused = next;

    if (this._ambienceMode === 'off') {
      this.emit();
      return;
    }

    if (next) {
      if (this.ambienceMasterGain) {
        this.rampAmbienceGain(0.0001, 0.18);
      }
    } else {
      if (this.ambienceActiveMode !== this._ambienceMode || !this.ambienceMasterGain) {
        this.startAmbienceGraph(this._ambienceMode);
      } else {
        const ctx = this.getAudioContext();
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        this.rampAmbienceGain(this._ambienceVolume, 0.2);
      }
    }
    this.emit();
  }

  public stopAmbience(): void {
    this._ambienceMode = 'off';
    this._ambiencePaused = false;
    writeStorage(STORAGE_AMBIENCE_MODE, 'off');
    this.teardownAmbience();
    this.emit();
  }

  // ==================== AMBIENCE GRAPH ENGINE ====================

  private rampAmbienceGain(target: number, durationSec: number): void {
    const ctx = this.ctx;
    const gainNode = this.ambienceMasterGain;
    if (!ctx || !gainNode) return;
    const now = ctx.currentTime;
    const clampedTarget = Math.max(0.0001, target);
    try {
      gainNode.gain.cancelScheduledValues(now);
      const current = Math.max(0.0001, gainNode.gain.value || 0.0001);
      gainNode.gain.setValueAtTime(current, now);
      gainNode.gain.exponentialRampToValueAtTime(clampedTarget, now + Math.max(0.02, durationSec));
    } catch {
      gainNode.gain.setValueAtTime(clampedTarget, now);
    }
  }

  private teardownAmbience(): void {
    const cleanups = this.ambienceCleanups;
    this.ambienceCleanups = [];
    for (const fn of cleanups) {
      try {
        fn();
      } catch {
        // Ignore already-stopped nodes
      }
    }
    if (this.ambienceMasterGain) {
      try {
        this.ambienceMasterGain.disconnect();
      } catch {
        // Ignore
      }
      this.ambienceMasterGain = null;
    }
    this.ambienceActiveMode = 'off';
  }

  private createSeamlessNoiseBuffer(
    ctx: AudioContext,
    durationSec: number,
    brown: boolean
  ): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.max(sampleRate, Math.floor(sampleRate * durationSec));
    const buffer = ctx.createBuffer(2, length, sampleRate);
    const fadeSamples = Math.min(Math.floor(sampleRate * 0.08), Math.floor(length / 8));

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let lastOut = 0;
      let peak = 0.001;

      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        if (brown) {
          lastOut = (lastOut + 0.02 * white) / 1.02;
          data[i] = lastOut;
          const abs = Math.abs(lastOut);
          if (abs > peak) peak = abs;
        } else {
          data[i] = white;
          peak = 1;
        }
      }

      if (brown && peak > 0) {
        const scale = 0.85 / peak;
        for (let i = 0; i < length; i++) {
          data[i] *= scale;
        }
      }

      // Crossfade tail into head for click-free looping
      for (let i = 0; i < fadeSamples; i++) {
        const t = i / fadeSamples;
        const tailIdx = length - fadeSamples + i;
        data[i] = data[i] * t + data[tailIdx] * (1 - t);
      }
    }
    return buffer;
  }

  private startAmbienceGraph(mode: Exclude<AmbienceMode, 'off'>): void {
    this.teardownAmbience();

    const ctx = this.getAudioContext();
    if (!ctx) return;

    const master = ctx.createGain();
    const now = ctx.currentTime;
    const targetVol = this._ambiencePaused ? 0.0001 : Math.max(0.0001, this._ambienceVolume);
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(targetVol, now + 0.25);
    master.connect(ctx.destination);

    this.ambienceMasterGain = master;
    this.ambienceActiveMode = mode;

    if (mode === 'rain') {
      this.buildRainGraph(ctx, master);
    } else if (mode === 'campfire') {
      this.buildCampfireGraph(ctx, master);
    } else if (mode === 'brown_noise') {
      this.buildBrownNoiseGraph(ctx, master);
    } else if (mode === 'tavern_8bit') {
      this.buildTavern8BitGraph(ctx, master);
    }
  }

  private buildRainGraph(ctx: AudioContext, master: GainNode): void {
    const buffer = this.createSeamlessNoiseBuffer(ctx, 3, false);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 950;
    band.Q.value = 0.65;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    lp.Q.value = 0.7;

    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.36;

    // Gentle LFO wind/shower sway
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;

    lfo.connect(lfoGain);
    lfoGain.connect(band.frequency);

    // Subtle soft low rain bed
    const bedLp = ctx.createBiquadFilter();
    bedLp.type = 'lowpass';
    bedLp.frequency.value = 420;
    const bedGain = ctx.createGain();
    bedGain.gain.value = 0.12;

    src.connect(band);
    band.connect(lp);
    lp.connect(rainGain);
    rainGain.connect(master);

    src.connect(bedLp);
    bedLp.connect(bedGain);
    bedGain.connect(master);

    src.start();
    lfo.start();

    this.ambienceCleanups.push(() => {
      src.stop();
      lfo.stop();
      src.disconnect();
      band.disconnect();
      lp.disconnect();
      rainGain.disconnect();
      lfo.disconnect();
      lfoGain.disconnect();
      bedLp.disconnect();
      bedGain.disconnect();
    });
  }

  private buildCampfireGraph(ctx: AudioContext, master: GainNode): void {
    const brownBuf = this.createSeamlessNoiseBuffer(ctx, 3, true);
    const crackleBuf = this.createSeamlessNoiseBuffer(ctx, 0.08, false);

    const hearthSrc = ctx.createBufferSource();
    hearthSrc.buffer = brownBuf;
    hearthSrc.loop = true;

    const hearthLp = ctx.createBiquadFilter();
    hearthLp.type = 'lowpass';
    hearthLp.frequency.value = 140;
    hearthLp.Q.value = 0.85;

    const hearthGain = ctx.createGain();
    hearthGain.gain.value = 0.52;

    const swayLfo = ctx.createOscillator();
    swayLfo.type = 'sine';
    swayLfo.frequency.value = 0.24;
    const swayGain = ctx.createGain();
    swayGain.gain.value = 0.07;

    swayLfo.connect(swayGain);
    swayGain.connect(hearthGain.gain);

    hearthSrc.connect(hearthLp);
    hearthLp.connect(hearthGain);
    hearthGain.connect(master);

    hearthSrc.start();
    swayLfo.start();

    // Sparse gentle wood crackle pops
    const triggerPop = (delaySec: number) => {
      if (this._ambiencePaused || this.ambienceMasterGain !== master) return;
      const now = ctx.currentTime + delaySec;
      const popSrc = ctx.createBufferSource();
      popSrc.buffer = crackleBuf;

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2100 + Math.random() * 1400;

      const popGain = ctx.createGain();
      const peak = 0.035 + Math.random() * 0.075;
      const dur = 0.018 + Math.random() * 0.025;
      popGain.gain.setValueAtTime(0.0001, now);
      popGain.gain.exponentialRampToValueAtTime(peak, now + 0.003);
      popGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      popSrc.connect(hp);
      hp.connect(popGain);
      popGain.connect(master);
      popSrc.start(now);
      popSrc.stop(now + dur + 0.01);
    };

    const timerId = window.setInterval(() => {
      if (this._ambiencePaused || ctx.state !== 'running') return;
      const r = Math.random();
      if (r < 0.36) {
        triggerPop(0);
        if (Math.random() < 0.28) {
          triggerPop(0.045 + Math.random() * 0.06);
        }
      }
    }, 260);

    this.ambienceCleanups.push(() => {
      window.clearInterval(timerId);
      hearthSrc.stop();
      swayLfo.stop();
      hearthSrc.disconnect();
      hearthLp.disconnect();
      hearthGain.disconnect();
      swayLfo.disconnect();
      swayGain.disconnect();
    });
  }

  private buildBrownNoiseGraph(ctx: AudioContext, master: GainNode): void {
    const buffer = this.createSeamlessNoiseBuffer(ctx, 4, true);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    lp.Q.value = 0.6;

    const gain = ctx.createGain();
    gain.gain.value = 0.52;

    src.connect(lp);
    lp.connect(gain);
    gain.connect(master);
    src.start();

    this.ambienceCleanups.push(() => {
      src.stop();
      src.disconnect();
      lp.disconnect();
      gain.disconnect();
    });
  }

  private buildTavern8BitGraph(ctx: AudioContext, master: GainNode): void {
    // Cozy mellow lowpass bus so 8-bit square waves feel warm like a SNES/GBA hearth
    const warmthLp = ctx.createBiquadFilter();
    warmthLp.type = 'lowpass';
    warmthLp.frequency.value = 1350;
    warmthLp.Q.value = 0.65;
    warmthLp.connect(master);

    let step = 0;
    const stepDurationSec = 60 / 92 / 2; // ~92 BPM eighth-notes (~0.326s)

    const playNote = (
      freq: number,
      type: OscillatorType,
      peakGain: number,
      durSec: number
    ) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(peakGain, now + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, now + durSec);

      osc.connect(env);
      env.connect(warmthLp);
      osc.start(now);
      osc.stop(now + durSec + 0.03);
    };

    const tick = () => {
      if (this._ambiencePaused || this.ambienceMasterGain !== master || ctx.state !== 'running') {
        return;
      }
      const idx = step % TAVERN_ARP_HZ.length;
      const bassHz = TAVERN_BASS_HZ[idx];
      const arpHz = TAVERN_ARP_HZ[idx];

      if (bassHz) {
        playNote(bassHz, 'triangle', 0.14, stepDurationSec * 2.4);
      }
      if (arpHz) {
        playNote(arpHz, 'square', 0.042, stepDurationSec * 0.92);
      }
      step = (step + 1) % TAVERN_ARP_HZ.length;
    };

    // Play first beat gently after a brief fade-in tick
    const initialTimeout = window.setTimeout(tick, 60);
    const intervalId = window.setInterval(tick, Math.round(stepDurationSec * 1000));

    this.ambienceCleanups.push(() => {
      window.clearTimeout(initialTimeout);
      window.clearInterval(intervalId);
      warmthLp.disconnect();
    });
  }

  // ==================== 16-BIT SFX SYNTHESIZER ====================

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'square',
    gainVal = 0.08,
    delay = 0,
    endFreq?: number
  ): void {
    const ctx = this.getSfxContext();
    if (!ctx) return;

    const scaledGain = Math.max(0.0002, gainVal * this._sfxVolume);
    const startAt = ctx.currentTime + delay;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startAt);
    if (typeof endFreq === 'number' && endFreq > 0) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, startAt + duration);
    }

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(scaledGain, startAt + Math.min(0.01, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.02);
  }

  // Existing SFX (100% preserved & scaled cleanly by sfxVolume)
  click(): void {
    this.tone(880, 0.045, 'square', 0.032, 0, 740);
  }

  systemPing(): void {
    this.tone(784, 0.09, 'triangle', 0.055, 0);
    this.tone(1174.66, 0.14, 'triangle', 0.055, 0.065);
  }

  swordSlash(): void {
    this.tone(480, 0.07, 'sawtooth', 0.06, 0, 210);
    this.tone(260, 0.11, 'triangle', 0.07, 0.035, 130);
  }

  critHit(): void {
    this.tone(660, 0.075, 'square', 0.06, 0);
    this.tone(990, 0.095, 'sawtooth', 0.068, 0.045);
    this.tone(1320, 0.17, 'triangle', 0.08, 0.09);
  }

  shieldBlock(): void {
    this.tone(290, 0.075, 'square', 0.06, 0, 240);
    this.tone(440, 0.13, 'triangle', 0.06, 0.045);
  }

  magicCast(): void {
    this.tone(520, 0.1, 'triangle', 0.06, 0, 620);
    this.tone(780, 0.12, 'triangle', 0.06, 0.06, 880);
    this.tone(1040, 0.2, 'sine', 0.07, 0.12);
  }

  monsterHit(): void {
    this.tone(185, 0.11, 'sawtooth', 0.07, 0, 110);
    this.tone(125, 0.14, 'square', 0.055, 0.045, 88);
  }

  skillUnlock(): void {
    this.tone(587.33, 0.11, 'square', 0.045, 0);
    this.tone(880, 0.13, 'triangle', 0.07, 0.075);
    this.tone(1174.66, 0.23, 'triangle', 0.08, 0.15);
  }

  coinLoot(): void {
    this.tone(987.77, 0.07, 'square', 0.045, 0);
    this.tone(1318.51, 0.17, 'square', 0.05, 0.065);
  }

  campfireHeal(): void {
    this.tone(392, 0.16, 'triangle', 0.055, 0);
    this.tone(493.88, 0.16, 'triangle', 0.055, 0.095);
    this.tone(587.33, 0.24, 'sine', 0.065, 0.19);
  }

  questComplete(): void {
    this.tone(523.25, 0.13, 'square', 0.05, 0);
    this.tone(659.25, 0.13, 'square', 0.05, 0.085);
    this.tone(783.99, 0.15, 'triangle', 0.075, 0.17);
    this.tone(1046.5, 0.28, 'triangle', 0.085, 0.255);
  }

  levelUp(): void {
    const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.51];
    notes.forEach((n, idx) => {
      this.tone(n, 0.2, 'square', 0.042, idx * 0.075);
      this.tone(n, 0.26, 'triangle', 0.075, idx * 0.075);
    });
  }

  alert(): void {
    this.tone(240, 0.13, 'sawtooth', 0.055, 0);
    this.tone(190, 0.17, 'sawtooth', 0.055, 0.15);
  }

  arise(): void {
    this.tone(130.81, 0.48, 'sawtooth', 0.065, 0);
    this.tone(196.0, 0.52, 'triangle', 0.07, 0.12);
    this.tone(261.63, 0.68, 'sine', 0.08, 0.24);
  }

  // ==================== NEW FOCUS ARENA 16-BIT SFX ====================

  /** Crisp short 16-bit focus slash */
  focusHit(): void {
    this.tone(640, 0.055, 'square', 0.05, 0, 260);
    this.tone(320, 0.075, 'triangle', 0.06, 0.025, 190);
  }

  /** Bright 3-note 16-bit critical hit arpeggio */
  focusCrit(): void {
    this.tone(880, 0.065, 'square', 0.052, 0);
    this.tone(1108.73, 0.075, 'square', 0.055, 0.05);
    this.tone(1318.51, 0.16, 'triangle', 0.078, 0.1);
    this.tone(1760, 0.14, 'square', 0.036, 0.11);
  }

  /** Calm low retro thud + soft descending triangle — gentle discipline alert */
  monsterCounter(): void {
    this.tone(130, 0.13, 'triangle', 0.065, 0, 78);
    this.tone(246.94, 0.16, 'triangle', 0.048, 0.07, 196.0);
  }

  /** Warm soft bell chord for 10s neural replay micro-gap */
  microGapChime(): void {
    this.tone(587.33, 0.34, 'sine', 0.055, 0);
    this.tone(880.0, 0.38, 'triangle', 0.042, 0.06);
    this.tone(739.99, 0.44, 'sine', 0.045, 0.12);
  }

  /** Uplifting 4-note retro fanfare when entering Overtime Flow */
  overtimeFanfare(): void {
    const notes = [587.33, 739.99, 880.0, 1174.66];
    notes.forEach((hz, idx) => {
      this.tone(hz, idx === 3 ? 0.28 : 0.11, 'square', 0.046, idx * 0.08);
      this.tone(hz / 2, idx === 3 ? 0.32 : 0.12, 'triangle', 0.05, idx * 0.08);
    });
  }

  /** Triumphant 16-bit focus victory jingle */
  focusVictory(): void {
    const melody: Array<{ hz: number; delay: number; dur: number; bass?: number }> = [
      { hz: 523.25, delay: 0.0, dur: 0.11, bass: 261.63 },
      { hz: 659.25, delay: 0.09, dur: 0.11 },
      { hz: 783.99, delay: 0.18, dur: 0.13, bass: 196.0 },
      { hz: 1046.5, delay: 0.29, dur: 0.2, bass: 261.63 },
      { hz: 880.0, delay: 0.46, dur: 0.12, bass: 220.0 },
      { hz: 1046.5, delay: 0.58, dur: 0.38, bass: 261.63 },
    ];
    for (const note of melody) {
      this.tone(note.hz, note.dur, 'square', 0.048, note.delay);
      this.tone(note.hz, note.dur + 0.04, 'triangle', 0.055, note.delay);
      if (note.bass) {
        this.tone(note.bass, note.dur + 0.08, 'triangle', 0.055, note.delay);
      }
    }
  }
}

export const soundEngine = new SystemSoundEngine();
