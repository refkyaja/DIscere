export interface VersionedPlayerProgress {
  jumlahJawab?: number;
  totalDijawab?: number;
  soalAktif?: { presentationId?: string } | null;
}

export interface VersionedSoloSession<P = VersionedPlayerProgress> {
  stateVersion?: number;
  state?: string;
  isFinished?: boolean;
  pemain1: P;
  pemain2: P;
}

function getAnsweredCount(player: VersionedPlayerProgress | undefined): number {
  if (!player) return 0;
  return Number(player.totalDijawab ?? player.jumlahJawab ?? 0);
}

/**
 * Menggabungkan snapshot sesi Solo agar respons HTTP yang datang terlambat (misal /bot-langkah
 * atau jawaban lawan lokal yang saling tumpang-tindih) tidak pernah mengembalikan soal lama.
 */
export function mergeMonotonicSoloSession<T extends VersionedSoloSession<any>>(
  prev: T | null,
  next: T,
  options?: {
    preserveSlot1IfNewer?: boolean;
    preserveSlot2IfNewer?: boolean;
  }
): T {
  if (!prev) return next;

  const prevVer = typeof prev.stateVersion === 'number' ? prev.stateVersion : -1;
  const nextVer = typeof next.stateVersion === 'number' ? next.stateVersion : -1;

  if (prevVer >= 0 && nextVer >= 0 && nextVer < prevVer) {
    return prev;
  }

  const prevFinished = Boolean(prev.isFinished || prev.state === 'FINISHED' || prev.state === 'STOPPED');
  const nextFinished = Boolean(next.isFinished || next.state === 'FINISHED' || next.state === 'STOPPED');
  if (prevFinished && !nextFinished && next.state !== 'READY') {
    return prev;
  }

  let pemain1 = next.pemain1;
  let pemain2 = next.pemain2;

  if (
    options?.preserveSlot1IfNewer !== false &&
    prev.state === next.state &&
    getAnsweredCount(prev.pemain1) > getAnsweredCount(next.pemain1)
  ) {
    pemain1 = prev.pemain1;
  }

  if (
    options?.preserveSlot2IfNewer !== false &&
    prev.state === next.state &&
    getAnsweredCount(prev.pemain2) > getAnsweredCount(next.pemain2)
  ) {
    pemain2 = prev.pemain2;
  }

  return {
    ...next,
    pemain1,
    pemain2,
  };
}

/**
 * Mendeteksi pesan galat server yang menandakan soal di layar klien sudah kedaluwarsa/terproses
 * sehingga klien perlu melakukan sinkronisasi ulang otomatis dari /sesi/:id.
 */
export function isStaleQuestionErrorMessage(msg: string): boolean {
  const lower = (msg || '').toLowerCase();
  return (
    lower.includes('kedaluwarsa') ||
    lower.includes('sudah dijawab') ||
    lower.includes('sudah diproses') ||
    lower.includes('tidak ada pertanyaan aktif') ||
    lower.includes('belum tersedia') ||
    lower.includes('jawaban ganda')
  );
}

