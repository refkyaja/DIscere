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

