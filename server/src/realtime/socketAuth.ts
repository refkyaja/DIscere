import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { COOKIE_NAME } from '../middleware/auth.js';

/**
 * Mengekstrak dan memverifikasi JWT pengguna dari handshake Socket.IO
 * (cookie `discere_token`, `handshake.auth.token`, atau header Authorization Bearer).
 * Tidak pernah mempercayai userId mentah dari payload event klien.
 */
export function getVerifiedUserIdFromSocket(socket: Socket): string | null {
  try {
    const rawCookie = socket.handshake.headers.cookie || '';
    const cookieRegex = new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`);
    const cookieMatch = rawCookie.match(cookieRegex);

    const authToken =
      typeof socket.handshake.auth?.token === 'string'
        ? socket.handshake.auth.token
        : null;

    const authHeader =
      typeof socket.handshake.headers.authorization === 'string'
        ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '').trim()
        : null;

    const token = cookieMatch
      ? decodeURIComponent(cookieMatch[1])
      : authToken || authHeader || null;

    if (!token) return null;

    const decoded = jwt.verify(token, config.jwtSecret) as { userId?: string; id?: string };
    return decoded.userId || decoded.id || null;
  } catch {
    return null;
  }
}

