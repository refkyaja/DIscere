/**
 * Sound Effects Generator menggunakan Web Audio API murni.
 * Tidak memerlukan berkas audio eksternal sehingga 100% offline,
 * ringan, dan bebas masalah dependensi jaringan / CORS.
 */

interface ToneOptions {
  type?: OscillatorType;
  freqStart: number;
  freqEnd?: number;
  startAt: number;
  duration: number;
  peakGain: number;
  attack?: number;
}

interface NoiseOptions {
  filterType: BiquadFilterType;
  freqStart: number;
  freqMid?: number;
  freqEnd?: number;
  q?: number;
  startAt: number;
  duration: number;
  peakGain: number;
  attack?: number;
}

class SoundEffectsManager {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private isMuted: boolean = false;
  private lastCheerAt: number = 0;

  constructor() {
    try {
      const saved = localStorage.getItem('discere_sound_muted');
      if (saved !== null) {
        this.isMuted = saved === 'true';
      }
    } catch {
      // Abaikan jika localStorage tidak tersedia
    }
  }

  private getContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Buffer noise hangat yang di-cache agar efek sorakan, tepuk tangan,
   * gesekan tali, dan lompatan karung terdengar natural tanpa overhead memori.
   */
  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const length = Math.floor(ctx.sampleRate * 2.5);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      // Filter ringan agar noise lebih hangat dan tidak menusuk telinga
      lastOut = (lastOut + 0.35 * white) / 1.35;
      data[i] = Math.max(-1, Math.min(1, lastOut * 1.4));
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private scheduleTone(ctx: AudioContext, opts: ToneOptions) {
    const {
      type = 'sine',
      freqStart,
      freqEnd,
      startAt,
      duration,
      peakGain,
      attack = 0.012,
    } = opts;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freqStart), startAt);
    if (typeof freqEnd === 'number') {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), startAt + duration);
    }

    const attackTime = Math.min(attack, duration * 0.4);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(peakGain, startAt + attackTime);
    gain.gain.exponentialRampToValueAtTime(0.0008, startAt + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.02);
  }

  private scheduleFilteredNoise(ctx: AudioContext, opts: NoiseOptions) {
    const {
      filterType,
      freqStart,
      freqMid,
      freqEnd,
      q = 1.2,
      startAt,
      duration,
      peakGain,
      attack = 0.03,
    } = opts;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.setValueAtTime(q, startAt);
    filter.frequency.setValueAtTime(freqStart, startAt);
    if (typeof freqMid === 'number') {
      filter.frequency.linearRampToValueAtTime(freqMid, startAt + duration * 0.45);
    }
    if (typeof freqEnd === 'number') {
      filter.frequency.linearRampToValueAtTime(freqEnd, startAt + duration);
    }

    const gain = ctx.createGain();
    const attackTime = Math.min(attack, duration * 0.4);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(peakGain, startAt + attackTime);
    gain.gain.exponentialRampToValueAtTime(0.0008, startAt + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    // Offset acak agar setiap sorakan & tepukan terasa organik
    const randomOffset = Math.random() * 1.2;
    src.start(startAt, randomOffset, duration + 0.03);
    src.stop(startAt + duration + 0.04);
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('discere_sound_muted', String(this.isMuted));
    } catch {
      // ignore
    }
    return this.isMuted;
  }

  /**
   * Suara Peluit Wasit Lomba 17-an (dengan desis udara khas peluit)
   */
  public playWhistle() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2600, now);
    osc.frequency.linearRampToValueAtTime(2880, now + 0.08);
    osc.frequency.linearRampToValueAtTime(2660, now + 0.16);
    osc.frequency.linearRampToValueAtTime(2920, now + 0.28);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.03);
    gain.gain.setValueAtTime(0.18, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.46);

    // Lapisan udara peluit wasit
    this.scheduleFilteredNoise(ctx, {
      filterType: 'highpass',
      freqStart: 3200,
      q: 1.5,
      startAt: now,
      duration: 0.38,
      peakGain: 0.04,
      attack: 0.02,
    });
  }

  /**
   * Peluit mulai lomba disambut sorakan pembuka penonton
   */
  public playRaceStart() {
    this.playWhistle();
    setTimeout(() => {
      this.playCrowdCheer('small');
    }, 220);
  }

  /**
   * Sorakan Penonton & Tepuk Tangan Lomba 17 Agustus.
   * Memiliki jeda minimum agar aksi cepat di mode multiplayer tidak bertumpuk.
   */
  public playCrowdCheer(intensity: 'small' | 'big' | 'victory' = 'small') {
    const ctx = this.getContext();
    if (!ctx) return;

    const nowMs = Date.now();
    if (intensity !== 'victory' && nowMs - this.lastCheerAt < 650) {
      return;
    }
    this.lastCheerAt = nowMs;

    const now = ctx.currentTime;
    const cfg = {
      small: { dur: 0.78, roarGain: 0.085, upperGain: 0.055, claps: 6 },
      big: { dur: 1.32, roarGain: 0.125, upperGain: 0.08, claps: 12 },
      victory: { dur: 2.15, roarGain: 0.15, upperGain: 0.1, claps: 20 },
    }[intensity];

    // Formant sorakan kerumunan ("Wooo!")
    this.scheduleFilteredNoise(ctx, {
      filterType: 'bandpass',
      freqStart: 520,
      freqMid: 820,
      freqEnd: 560,
      q: 1.35,
      startAt: now,
      duration: cfg.dur,
      peakGain: cfg.roarGain,
      attack: 0.14,
    });

    // Formant teriakan tinggi ("Horee!")
    this.scheduleFilteredNoise(ctx, {
      filterType: 'bandpass',
      freqStart: 1200,
      freqMid: 1700,
      freqEnd: 1120,
      q: 1.7,
      startAt: now + 0.04,
      duration: cfg.dur * 0.9,
      peakGain: cfg.upperGain,
      attack: 0.16,
    });

    // Tepuk tangan penonton bersahutan
    for (let i = 0; i < cfg.claps; i++) {
      const clapAt = now + 0.06 + (i / cfg.claps) * (cfg.dur * 0.78) + Math.random() * 0.04;
      this.scheduleFilteredNoise(ctx, {
        filterType: 'bandpass',
        freqStart: 1850 + Math.random() * 750,
        q: 2.2,
        startAt: clapAt,
        duration: 0.045,
        peakGain: intensity === 'small' ? 0.055 : 0.08,
        attack: 0.004,
      });
    }

    // Sentuhan nada riang penonton pada sorakan besar / kemenangan
    if (intensity === 'big' || intensity === 'victory') {
      this.scheduleTone(ctx, {
        type: 'triangle',
        freqStart: 523.25,
        freqEnd: 587.33,
        startAt: now + 0.12,
        duration: 0.45,
        peakGain: 0.035,
        attack: 0.08,
      });
    }
  }

  /**
   * Suara Tarikan Tali Tambang ("Kreet-Dug!": gesekan tali + hentakan kaki)
   */
  public playRopeTug(isStrong: boolean = false) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Gesekan & regangan serat tali tambang
    this.scheduleFilteredNoise(ctx, {
      filterType: 'bandpass',
      freqStart: isStrong ? 620 : 480,
      freqEnd: 290,
      q: 4.2,
      startAt: now,
      duration: 0.19,
      peakGain: isStrong ? 0.16 : 0.12,
      attack: 0.015,
    });

    // Hentakan kaki menahan di rumput
    this.scheduleTone(ctx, {
      type: 'triangle',
      freqStart: isStrong ? 160 : 138,
      freqEnd: 48,
      startAt: now,
      duration: 0.22,
      peakGain: isStrong ? 0.28 : 0.22,
      attack: 0.008,
    });
  }

  /**
   * Suara Jawaban Benar (Chime ceria)
   */
  public playCorrect() {
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    const now = ctx.currentTime;
    notes.forEach((freq, i) => {
      this.scheduleTone(ctx, {
        type: 'sine',
        freqStart: freq,
        startAt: now + i * 0.055,
        duration: 0.24,
        peakGain: 0.15,
        attack: 0.01,
      });
    });
  }

  /**
   * Suara Jawaban Salah (Buzzer bersahabat)
   */
  public playIncorrect() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(175, now + 0.2);

    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Suara Terpeleset / Tersandung Ringan (untuk Tarik Tambang & Balap Karung)
   */
  public playStumble() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Slide komikal kaki tergelincir
    this.scheduleTone(ctx, {
      type: 'sine',
      freqStart: 420,
      freqEnd: 160,
      startAt: now,
      duration: 0.2,
      peakGain: 0.14,
      attack: 0.01,
    });
    // Gesekan rumput/tanah
    this.scheduleFilteredNoise(ctx, {
      filterType: 'bandpass',
      freqStart: 1200,
      freqEnd: 520,
      q: 1.8,
      startAt: now,
      duration: 0.14,
      peakGain: 0.085,
      attack: 0.01,
    });
  }

  /**
   * Suara Kemenangan / Juara 17-an (Fanfare meriah + sorakan penonton)
   */
  public playVictoryFanfare() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const melody = [
      { freq: 523.25, duration: 0.13, time: 0 },
      { freq: 659.25, duration: 0.13, time: 0.13 },
      { freq: 783.99, duration: 0.19, time: 0.26 },
      { freq: 1046.5, duration: 0.52, time: 0.46 },
    ];

    melody.forEach((note) => {
      this.scheduleTone(ctx, {
        type: 'triangle',
        freqStart: note.freq,
        startAt: now + note.time,
        duration: note.duration,
        peakGain: 0.2,
        attack: 0.015,
      });
    });

    // Harmoni akor penutup C mayor
    this.scheduleTone(ctx, {
      type: 'sine',
      freqStart: 523.25,
      startAt: now + 0.46,
      duration: 0.52,
      peakGain: 0.1,
      attack: 0.02,
    });

    this.playCrowdCheer('victory');
  }

  /**
   * Suara Gigitan Kerupuk Renyah (Kriuk Crunch)
   */
  public playCrunch() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.scheduleTone(ctx, {
      type: 'triangle',
      freqStart: 800,
      freqEnd: 250,
      startAt: now,
      duration: 0.14,
      peakGain: 0.26,
    });
    this.scheduleTone(ctx, {
      type: 'sawtooth',
      freqStart: 1400,
      freqEnd: 450,
      startAt: now + 0.05,
      duration: 0.14,
      peakGain: 0.18,
    });
  }

  /**
   * Suara Zonk / Kerupuk Menghindar
   */
  public playZonk() {
    const ctx = this.getContext();
    if (!ctx) return;

    this.scheduleTone(ctx, {
      type: 'sine',
      freqStart: 400,
      freqEnd: 150,
      startAt: ctx.currentTime,
      duration: 0.26,
      peakGain: 0.18,
    });
  }

  /**
   * Suara Memanjat Naik (Panjat Pinang)
   */
  public playClimb() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [440, 587.33].forEach((freq, idx) => {
      this.scheduleTone(ctx, {
        type: 'triangle',
        freqStart: freq,
        startAt: now + idx * 0.06,
        duration: 0.14,
        peakGain: 0.18,
      });
    });
  }

  /**
   * Suara Terpeleset Turun (Tiang Licin / Panjat Pinang)
   */
  public playSlip() {
    const ctx = this.getContext();
    if (!ctx) return;

    this.scheduleTone(ctx, {
      type: 'sine',
      freqStart: 520,
      freqEnd: 170,
      startAt: ctx.currentTime,
      duration: 0.29,
      peakGain: 0.18,
    });
  }

  /**
   * Suara Efek Positif / Perisai / Boost
   */
  public playBoost() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [587.33, 739.99, 880].forEach((freq, idx) => {
      this.scheduleTone(ctx, {
        type: 'sine',
        freqStart: freq,
        startAt: now + idx * 0.05,
        duration: 0.18,
        peakGain: 0.15,
      });
    });
  }

  /**
   * Suara Lompatan Karung Goni (Balap Karung: gesekan karung + pantulan + mendarat)
   */
  public playJump(isBoosted: boolean = false) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Gesekan kain karung saat melompat
    this.scheduleFilteredNoise(ctx, {
      filterType: 'bandpass',
      freqStart: 680,
      freqEnd: 1380,
      q: 1.5,
      startAt: now,
      duration: 0.09,
      peakGain: 0.09,
      attack: 0.01,
    });
    // Pantulan lompatan
    this.scheduleTone(ctx, {
      type: 'triangle',
      freqStart: 230,
      freqEnd: isBoosted ? 760 : 540,
      startAt: now,
      duration: 0.14,
      peakGain: 0.19,
      attack: 0.008,
    });
    // Pendaratan ringan karung di lintasan
    this.scheduleTone(ctx, {
      type: 'sine',
      freqStart: 135,
      freqEnd: 65,
      startAt: now + 0.13,
      duration: 0.09,
      peakGain: 0.12,
      attack: 0.006,
    });
  }

  /**
   * Suara Terjatuh Keseimbangan 0% (Balap Karung: meluncur + gedebug rumput)
   */
  public playFall() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.scheduleTone(ctx, {
      type: 'triangle',
      freqStart: 360,
      freqEnd: 92,
      startAt: now,
      duration: 0.28,
      peakGain: 0.18,
      attack: 0.01,
    });
    // Suara jatuh empuk di tanah/rumput
    this.scheduleFilteredNoise(ctx, {
      filterType: 'lowpass',
      freqStart: 280,
      freqEnd: 110,
      q: 1.0,
      startAt: now + 0.11,
      duration: 0.2,
      peakGain: 0.22,
      attack: 0.01,
    });
  }

  /**
   * Suara Perisai Keseimbangan Aktif / Melindungi
   */
  public playShield() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [659.25, 880, 1046.5].forEach((freq, idx) => {
      this.scheduleTone(ctx, {
        type: 'sine',
        freqStart: freq,
        startAt: now + idx * 0.045,
        duration: 0.16,
        peakGain: 0.15,
      });
    });
  }

  /**
   * Suara Rintangan Lumpur / Kulit Pisang (Cipratan basah + wobble)
   */
  public playMud() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Cipratan lumpur
    this.scheduleFilteredNoise(ctx, {
      filterType: 'bandpass',
      freqStart: 540,
      freqEnd: 170,
      q: 2.8,
      startAt: now,
      duration: 0.19,
      peakGain: 0.14,
      attack: 0.01,
    });

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(115, now + 0.14);
    osc.frequency.linearRampToValueAtTime(160, now + 0.24);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  /**
   * Memainkan rangkaian efek suara yang sesuai untuk aksi Balap Karung
   * (lompatan karung, sorakan penonton, boost/perisai, jatuh, lumpur, atau tersandung).
   */
  public playBalapKarungAction(opts: {
    benar: boolean;
    streakSaatIni?: number;
    isBoosted?: boolean;
    terjatuh?: boolean;
    perisaiDigunakan?: boolean;
    isMud?: boolean;
    playAnswerChime?: boolean;
    playStumbleOnWrong?: boolean;
  }) {
    if (opts.benar) {
      const strong = Boolean(opts.isBoosted || (opts.streakSaatIni ?? 0) >= 3);
      if (opts.playAnswerChime) {
        this.playCorrect();
        if (strong) {
          setTimeout(() => this.playBoost(), 90);
        }
      } else if (strong) {
        this.playBoost();
      }
      this.playJump(strong);
      this.playCrowdCheer(strong ? 'big' : 'small');
      return;
    }

    if (opts.terjatuh && opts.perisaiDigunakan) {
      this.playShield();
    } else if (opts.terjatuh) {
      this.playFall();
    } else if (opts.isMud) {
      this.playMud();
    } else if (opts.playStumbleOnWrong !== false) {
      this.playStumble();
    }
  }

  /**
   * Memainkan efek suara terpadu untuk aksi Tarik Tambang
   * (gesekan & hentakan tali, sorakan penonton, atau terpeleset).
   */
  public playTarikTambangAction(opts: {
    benar: boolean;
    isStrong?: boolean;
    playAnswerChime?: boolean;
  }) {
    if (opts.benar) {
      if (opts.playAnswerChime) {
        this.playCorrect();
      }
      this.playRopeTug(Boolean(opts.isStrong));
      this.playCrowdCheer(opts.isStrong ? 'big' : 'small');
      return;
    }

    this.playStumble();
  }
}

export const soundEffects = new SoundEffectsManager();
