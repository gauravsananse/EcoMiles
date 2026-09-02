/**
 * Audio Notification Service
 * Web Audio API synthesizer for clean, non-intrusive sound cues.
 * Never crashes or blocks journey tracking if audio is unavailable or blocked by browser policies.
 */

class NotificationService {
  constructor() {
    this.audioCtx = null;
    this.isMuted = false;
    this.lastBeepTime = 0;
    this.MIN_BEEP_INTERVAL_MS = 2500; // Quiet Verification: Prevent rapid repetitive beeping
  }

  /**
   * Lazy-initialize AudioContext on user interaction
   */
  getAudioContext() {
    if (typeof window === 'undefined') return null;

    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }

      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      return this.audioCtx;
    } catch (e) {
      console.warn('[NotificationService] Audio context init warning:', e.message);
      return null;
    }
  }

  /**
   * Synthesize a clean frequency tone
   */
  playTone(freq, durationMs = 200, type = 'sine', gainVal = 0.15) {
    if (this.isMuted) return;

    const now = Date.now();
    if (now - this.lastBeepTime < 400) return; // Prevent overlapping screech
    this.lastBeepTime = now;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch (err) {
      console.warn('[NotificationService] Tone playback skipped:', err.message);
    }
  }

  /**
   * Distinct alert when vehicle motion is confirmed (880Hz single tone)
   */
  playVehicleDetectedBeep() {
    this.playTone(880, 260, 'sine', 0.22);
  }

  /**
   * Attention chime when EV or transit verification is required (660Hz -> 880Hz)
   */
  playVerificationRequiredBeep() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx || this.isMuted) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      this.playTone(880, 250);
    }
  }

  /**
   * Double warning beep when BLE or route verification is temporarily lost (440Hz double tap)
   */
  playVerificationWarning() {
    this.playTone(440, 150, 'sawtooth', 0.15);
    setTimeout(() => {
      this.playTone(440, 180, 'sawtooth', 0.15);
    }, 200);
  }

  /**
   * Pleasant success chord on verification (C5 -> E5 -> G5)
   */
  playVerificationSuccess() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx || this.isMuted) return;

      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

        gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.08 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.35);
      });
    } catch (e) {
      this.playTone(660, 300);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }
}

export const notificationService = new NotificationService();
export default notificationService;
