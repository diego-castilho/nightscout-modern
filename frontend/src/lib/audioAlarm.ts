// ============================================================================
// audioAlarm.ts - Web Audio API tone generator for glucose alarms
// No external dependencies — works offline (PWA).
//
// IMPORTANT: AudioContext must be created from a user gesture handler.
// Call enable() inside the Bell button onClick, before any sound is played.
// ============================================================================

export type AlarmPattern = 'urgentLow' | 'low' | 'high';

interface BeepConfig {
  freq: number;       // Hz
  duration: number;   // seconds
  gap: number;        // seconds between beeps
  count: number;      // number of beeps
}

const PATTERNS: Record<AlarmPattern, BeepConfig> = {
  urgentLow: { freq: 820, duration: 0.10, gap: 0.08, count: 3 },
  low:       { freq: 620, duration: 0.18, gap: 0.15, count: 2 },
  high:      { freq: 360, duration: 0.30, gap: 0.25, count: 2 },
};

export class AudioAlarm {
  private ctx: AudioContext | null = null;

  /** Call this inside a user-gesture handler (e.g. button click). */
  enable(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    // Resume in case browser suspended it
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  disable(): void {
    if (!this.ctx) return;
    this.ctx.close().catch(() => {});
    this.ctx = null;
  }

  isEnabled(): boolean {
    return this.ctx !== null;
  }

  /** Plays a single beep with an ADSR envelope. */
  private playBeep(freq: number, duration: number, startTime: number): void {
    if (!this.ctx) return;

    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    // Simple ADSR envelope
    const attack  = 0.01;
    const decay   = 0.05;
    const sustain = 0.7;
    const release = Math.min(0.08, duration * 0.3);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.8,          startTime + attack);
    gain.gain.linearRampToValueAtTime(0.8 * sustain, startTime + attack + decay);
    gain.gain.setValueAtTime(0.8 * sustain,          startTime + duration - release);
    gain.gain.linearRampToValueAtTime(0,             startTime + duration);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  /** Plays the full alarm pattern (non-blocking). */
  playPattern(pattern: AlarmPattern): void {
    if (!this.ctx) return;

    const cfg = PATTERNS[pattern];
    let t = this.ctx.currentTime + 0.05; // small scheduling buffer

    for (let i = 0; i < cfg.count; i++) {
      this.playBeep(cfg.freq, cfg.duration, t);
      t += cfg.duration + cfg.gap;
    }
  }

  /** Plays a short confirmation beep (used when enabling the alarm). */
  playConfirmation(): void {
    if (!this.ctx) return;
    this.playBeep(520, 0.08, this.ctx.currentTime + 0.05);
  }
}

// Singleton shared between useAlarm (detector) and Header (toggle button).
// This ensures enable() is called on the same AudioContext that plays sounds.
export const globalAudioAlarm = new AudioAlarm();
