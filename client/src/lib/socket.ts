import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const envUrl = (import.meta as any).env?.VITE_API_URL;
    const serverUrl = envUrl
      ? envUrl.replace(/\/+$/, '')
      : window.location.port === '5173'
        ? `${window.location.protocol}//${window.location.hostname}:3000`
        : window.location.origin;

    socket = io(serverUrl, {
      autoConnect: true,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });
  }

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function resetSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
