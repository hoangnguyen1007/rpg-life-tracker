class SystemSoundEngine {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainVal = 0.08,
    delay = 0
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

    gain.gain.setValueAtTime(0.001, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(gainVal, ctx.currentTime + delay + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.02);
  }

  click() {
    this.tone(860, 0.05, 'square', 0.03);
  }

  systemPing() {
    this.tone(784, 0.1, 'triangle', 0.05, 0);
    this.tone(1174, 0.15, 'triangle', 0.05, 0.07);
  }

  swordSlash() {
    this.tone(420, 0.07, 'sawtooth', 0.06, 0);
    this.tone(240, 0.11, 'triangle', 0.07, 0.04);
  }

  critHit() {
    this.tone(660, 0.08, 'square', 0.06, 0);
    this.tone(990, 0.1, 'sawtooth', 0.07, 0.05);
    this.tone(1320, 0.18, 'triangle', 0.08, 0.1);
  }

  shieldBlock() {
    this.tone(290, 0.08, 'square', 0.06, 0);
    this.tone(440, 0.14, 'triangle', 0.06, 0.05);
  }

  magicCast() {
    this.tone(520, 0.1, 'sine', 0.06, 0);
    this.tone(780, 0.12, 'triangle', 0.06, 0.06);
    this.tone(1040, 0.2, 'sine', 0.07, 0.12);
  }

  monsterHit() {
    this.tone(180, 0.12, 'sawtooth', 0.07, 0);
    this.tone(125, 0.14, 'square', 0.06, 0.05);
  }

  skillUnlock() {
    this.tone(587.33, 0.12, 'triangle', 0.06, 0);
    this.tone(880, 0.14, 'triangle', 0.07, 0.08);
    this.tone(1174.66, 0.24, 'sine', 0.08, 0.16);
  }

  coinLoot() {
    this.tone(987.77, 0.08, 'square', 0.04, 0);
    this.tone(1318.51, 0.18, 'square', 0.05, 0.07);
  }

  campfireHeal() {
    this.tone(392, 0.16, 'sine', 0.05, 0);
    this.tone(493.88, 0.16, 'sine', 0.05, 0.1);
    this.tone(587.33, 0.24, 'sine', 0.06, 0.2);
  }

  questComplete() {
    this.tone(523.25, 0.14, 'triangle', 0.07, 0);
    this.tone(659.25, 0.14, 'triangle', 0.07, 0.09);
    this.tone(783.99, 0.16, 'triangle', 0.08, 0.18);
    this.tone(1046.5, 0.3, 'sine', 0.09, 0.27);
  }

  levelUp() {
    const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.51];
    notes.forEach((n, idx) => {
      this.tone(n, 0.22, 'sawtooth', 0.05, idx * 0.08);
      this.tone(n, 0.28, 'sine', 0.08, idx * 0.08);
    });
  }

  alert() {
    this.tone(240, 0.14, 'sawtooth', 0.06, 0);
    this.tone(190, 0.18, 'sawtooth', 0.06, 0.16);
  }

  arise() {
    this.tone(130.81, 0.5, 'sawtooth', 0.07, 0);
    this.tone(196.0, 0.55, 'triangle', 0.07, 0.12);
    this.tone(261.63, 0.7, 'sine', 0.08, 0.24);
  }
}

export const soundEngine = new SystemSoundEngine();
