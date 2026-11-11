/**
 * Audio Synthesizer Web Audio API murni untuk alarm timer papan tulis
 * Menghasilkan 3 nada beep harmonik 880Hz yang jernih tanpa memerlukan aset berkas audio eksternal.
 */
export function playTimerAlarm(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    [0, 0.22, 0.44].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime + t);

      gain.gain.setValueAtTime(0.2, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.2);
    });
  } catch (err) {
    console.warn('Tidak dapat memutar suara alarm:', err);
  }
}

