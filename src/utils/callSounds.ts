class CallSoundManager {
  private audioCtx: AudioContext | null = null;
  private ringInterval: any = null;
  private isPlaying: boolean = false;

  private initCtx(): AudioContext | null {
    try {
      if (!this.audioCtx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.audioCtx = new AudioCtx();
        }
      }
      if (this.audioCtx && this.audioCtx.state === "suspended") {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  /**
   * Realistic Outgoing Ringback Sound
   * Plays the standard authentic dual-tone telephone ringing cadence:
   * [Ring 0.4s] -> [Pause 0.2s] -> [Ring 0.4s] -> [Silent 2.0s]
   */
  playRingback() {
    this.stopRingtone();
    const ctx = this.initCtx();
    if (!ctx) return;

    this.isPlaying = true;

    const playBurst = (startTime: number, duration: number) => {
      try {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        // Standard telephony ringback frequencies (440Hz + 480Hz)
        osc1.type = "sine";
        osc2.type = "sine";
        osc1.frequency.setValueAtTime(440, startTime);
        osc2.frequency.setValueAtTime(480, startTime);

        // Smooth acoustic envelope
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.14, startTime + 0.05);
        gain.gain.setValueAtTime(0.14, startTime + duration - 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(startTime);
        osc2.start(startTime);
        osc1.stop(startTime + duration);
        osc2.stop(startTime + duration);
      } catch {}
    };

    const triggerCadence = () => {
      if (!this.isPlaying || !this.audioCtx) return;
      const now = this.audioCtx.currentTime;
      // First burst (0.4s)
      playBurst(now, 0.4);
      // Second burst (0.4s) after 0.2s pause
      playBurst(now + 0.6, 0.4);
    };

    triggerCadence();
    this.ringInterval = setInterval(triggerCadence, 3000);
  }

  /**
   * Realistic Modern Polyphonic Incoming Ringtone
   * Plays a rich, pleasant marimba / bell chime melody with warm harmonics
   */
  playIncomingRingtone() {
    this.stopRingtone();
    const ctx = this.initCtx();
    if (!ctx) return;

    this.isPlaying = true;

    // Harmonized bell chime note helper
    const playChimeNote = (freq: number, startTime: number, duration: number = 0.35, vol: number = 0.18) => {
      try {
        const now = startTime;
        // Fundamental tone
        const oscFundamental = ctx.createOscillator();
        // Warm 2nd harmonic
        const oscHarmonic = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscFundamental.type = "sine";
        oscHarmonic.type = "triangle";

        oscFundamental.frequency.setValueAtTime(freq, now);
        oscHarmonic.frequency.setValueAtTime(freq * 2.005, now);

        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.linearRampToValueAtTime(vol, now + 0.015);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        oscFundamental.connect(gainNode);
        oscHarmonic.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscFundamental.start(now);
        oscHarmonic.start(now);
        oscFundamental.stop(now + duration);
        oscHarmonic.stop(now + duration);
      } catch {}
    };

    const triggerRingtoneChime = () => {
      if (!this.isPlaying || !this.audioCtx) return;
      const now = this.audioCtx.currentTime;

      // Beautiful ascending & descending melodic chord cadence
      // E5 (659.25), G#5 (830.61), B5 (987.77), E6 (1318.51)
      playChimeNote(659.25, now + 0.00, 0.32, 0.16);
      playChimeNote(830.61, now + 0.14, 0.32, 0.16);
      playChimeNote(987.77, now + 0.28, 0.35, 0.18);
      playChimeNote(1318.51, now + 0.42, 0.55, 0.20);

      // Answering motif
      playChimeNote(1174.66, now + 0.95, 0.32, 0.16); // D6
      playChimeNote(987.77, now + 1.10, 0.32, 0.16);  // B5
      playChimeNote(830.61, now + 1.25, 0.35, 0.17);  // G#5
      playChimeNote(659.25, now + 1.40, 0.60, 0.19);  // E5
    };

    triggerRingtoneChime();
    this.ringInterval = setInterval(triggerRingtoneChime, 2500);
  }

  stopRingtone() {
    this.isPlaying = false;
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
  }

  /**
   * Gentle End / Disconnect Chime
   */
  playCutSound() {
    this.stopRingtone();
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const tones = [523.25, 440.0, 349.23]; // C5 -> A4 -> F4 soft descending disconnect
      tones.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.12;

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.14, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + 0.18);
      });
    } catch {}
  }

  /**
   * Gentle Message Notification Sound (WhatsApp style message chime)
   */
  playMessageNotificationSound() {
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const tones = [1318.51, 1760.0];
      tones.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + idx * 0.08;

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.1, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + 0.14);
      });
    } catch {}
  }
}

export const callSounds = new CallSoundManager();
