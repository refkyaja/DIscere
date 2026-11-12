import { Socket } from 'socket.io-client';

/**
 * Mengirim `sesi:host_join` saat socket terhubung maupun setiap kali Socket.IO reconnect otomatis.
 */
export function bindHostReconnect(socket: Socket, sessionId: string): () => void {
  const handleConnect = () => {
    socket.emit('sesi:host_join', { sessionId });
  };

  socket.on('connect', handleConnect);
  if (socket.connected) {
    handleConnect();
  }

  return () => {
    socket.off('connect', handleConnect);
  };
}

/**
 * Mengirim `sesi:gabung` ulang dengan kredensial peserta ketika Socket.IO putus lalu tersambung kembali.
 */
export function bindStudentReconnect<T = any>(
  socket: Socket,
  params: {
    token: string;
    nama: string;
    pesertaId: string;
    pesertaSecret?: string;
    onDisconnect?: () => void;
    onReconnectSuccess?: (res: T) => void;
  }
): () => void {
  let wasDisconnected = false;

  const handleDisconnect = () => {
    wasDisconnected = true;
    params.onDisconnect?.();
  };

  const handleConnect = () => {
    if (!wasDisconnected || !params.token || !params.nama || !params.pesertaId) return;
    wasDisconnected = false;

    socket.emit(
      'sesi:gabung',
      {
        token: params.token,
        nama: params.nama,
        pesertaId: params.pesertaId,
        ...(params.pesertaSecret ? { pesertaSecret: params.pesertaSecret } : {}),
      },
      (res: T) => {
        params.onReconnectSuccess?.(res);
      }
    );
  };

  socket.on('disconnect', handleDisconnect);
  socket.on('connect', handleConnect);

  return () => {
    socket.off('disconnect', handleDisconnect);
    socket.off('connect', handleConnect);
  };
}

/**
 * Menjaga pengiriman jawaban Socket.IO siswa agar tombol tidak terkunci selamanya saat ACK
 * hilang/terlambat dan memicu `soal:lanjut` jika soal berikutnya gagal tiba tepat waktu.
 */
export function createAnswerWatchdogs() {
  let ackTimer: ReturnType<typeof setTimeout> | null = null;
  let nextSoalTimer: ReturnType<typeof setTimeout> | null = null;

  const clearAck = () => {
    if (ackTimer) {
      clearTimeout(ackTimer);
      ackTimer = null;
    }
  };

  const clearNextSoal = () => {
    if (nextSoalTimer) {
      clearTimeout(nextSoalTimer);
      nextSoalTimer = null;
    }
  };

  const clearAll = () => {
    clearAck();
    clearNextSoal();
  };

  const armAckTimeout = (onTimeout: () => void, delayMs: number = 3000) => {
    clearAck();
    ackTimer = setTimeout(() => {
      ackTimer = null;
      onTimeout();
    }, delayMs);
  };

  const armNextSoalFallback = (
    socket: Socket,
    payload: { sessionId: string; pesertaId: string; pesertaSecret?: string },
    delayMs: number = 2000
  ) => {
    clearNextSoal();
    nextSoalTimer = setTimeout(() => {
      nextSoalTimer = null;
      if (socket.connected) {
        socket.emit('soal:lanjut', payload);
      }
    }, delayMs);
  };

  return {
    clearAck,
    clearNextSoal,
    clearAll,
    armAckTimeout,
    armNextSoalFallback,
  };
}

