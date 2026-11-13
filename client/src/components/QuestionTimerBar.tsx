import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';

/** Menghitung sisa waktu awal soal (ms) berdasar batas akhir server agar sinkron saat mount/reconnect dan terkoreksi dari clock skew. */
export function computeInitialRemainingMs(
  deadlineMs: number | null | undefined,
  durationSec: number,
  serverOffsetMs: number = 0
): number {
  const fullMs = Math.max(5, Number(durationSec) || 10) * 1000;
  if (typeof deadlineMs === 'number') {
    const correctedNow = Date.now() + (Number(serverOffsetMs) || 0);
    if (deadlineMs > correctedNow) {
      return Math.min(fullMs, Math.max(0, deadlineMs - correctedNow));
    }
  }
  return fullMs;
}

interface QuestionTimerBarProps {
  /** Kunci unik presentasi soal; setiap kali berubah, timer disetel ulang. */
  presentationKey: string | null | undefined;
  /** Durasi total per soal dalam detik. */
  durationSec: number;
  /** Sisa waktu awal dalam milidetik (opsional, misal sinkron dari endsAt server). */
  initialRemainingMs?: number;
  /** Apakah timer sedang berjalan aktif. */
  active: boolean;
  /** Callback saat waktu mencapai 0 (dipanggil maksimal sekali per presentationKey). */
  onTimeout?: () => void;
  /** Varian visual untuk Balap Karung ('bk') atau Tarik Tambang ('tt'). */
  variant?: 'bk' | 'tt';
  /** Teks unit detik (default 'dtk'). */
  unitLabel?: string;
  /** Teks ringkas tambahan di baris atas jika mode 'bk' (misal ` • 30 m`). */
  rightSuffix?: string;
  /** Label nomor soal untuk header jika ditampilkan di dalam bar. */
  questionLabel?: string;
  /** Konten kustom sisi kiri header (opsional, menggantikan questionLabel polos). */
  leftContent?: React.ReactNode;
  /** Konten opsional di antara baris header & progress bar (mis. badge status). */
  middleContent?: React.ReactNode;
}

/**
 * Timer hitung mundur soal terisolasi agar pembaruan tiap ~50ms tidak memicu
 * re-render ulang daftar tombol pilihan jawaban di komponen induk.
 */
export function QuestionTimerBar({
  presentationKey,
  durationSec,
  initialRemainingMs,
  active,
  onTimeout,
  variant = 'bk',
  unitLabel = 'dtk',
  rightSuffix = '',
  questionLabel,
  leftContent,
  middleContent,
}: QuestionTimerBarProps) {
  const safeDurationSec = Math.max(5, Number(durationSec) || 10);
  const fullMs = safeDurationSec * 1000;
  const startingMs =
    typeof initialRemainingMs === 'number'
      ? Math.min(fullMs, Math.max(0, initialRemainingMs))
      : fullMs;

  const [remainingMs, setRemainingMs] = useState<number>(startingMs);
  const remainingRef = useRef<number>(startingMs);
  const lastPresRef = useRef<string | null>(null);
  const timedOutPresRef = useRef<string | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    const key = presentationKey || null;
    if (!key) return;
    if (lastPresRef.current !== key) {
      lastPresRef.current = key;
      timedOutPresRef.current = null;
      remainingRef.current = startingMs;
      setRemainingMs(startingMs);
    }
  }, [presentationKey, startingMs]);

  useEffect(() => {
    if (!active || !presentationKey) return;
    let lastTick = performance.now();

    const interval = window.setInterval(() => {
      const now = performance.now();
      const delta = now - lastTick;
      lastTick = now;

      const nextMs = Math.max(0, remainingRef.current - delta);
      remainingRef.current = nextMs;
      setRemainingMs(nextMs);

      if (nextMs <= 0 && timedOutPresRef.current !== presentationKey) {
        timedOutPresRef.current = presentationKey;
        window.clearInterval(interval);
        onTimeoutRef.current?.();
      }
    }, 50);

    return () => window.clearInterval(interval);
  }, [active, presentationKey]);

  const ratio = Math.max(0, Math.min(1, fullMs > 0 ? remainingMs / fullMs : 0));
  const sisaDetik = Math.max(0, Math.ceil(remainingMs / 1000));

  if (variant === 'tt') {
    const pct = Math.max(0, Math.min(100, ratio * 100));
    return (
      <div>
        <div className="flex items-center justify-between text-[11px] font-extrabold text-[#6b6a85] mb-1">
          <span>{leftContent ?? (questionLabel || 'Waktu Soal')}</span>
          <span className={remainingMs <= 3000 ? 'text-[#dc2626]' : ''}>
            {sisaDetik} {unitLabel}
            {rightSuffix}
          </span>
        </div>
        {middleContent}
        <div className="tt-tb">
          <i
            style={{
              width: `${pct}%`,
              background: pct < 30 ? '#dc2626' : '#ffb81c',
              transition: 'none',
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between text-xs font-extrabold text-[#6b6a85] mb-2">
        <span>{leftContent ?? (questionLabel || 'Waktu Soal')}</span>
        <span className="inline-flex items-center gap-1 text-[#2b2a4a] font-mono">
          <Clock className="w-3.5 h-3.5 text-[#ffb81c]" />
          {sisaDetik} {unitLabel}
          {rightSuffix}
        </span>
      </div>
      {middleContent}
      <div className="bk-tbar !h-2.5 !mb-3">
        <div
          className="bk-tbar-fill"
          style={{ transform: `scaleX(${ratio})`, transition: 'none' }}
        />
      </div>
    </div>
  );
}
