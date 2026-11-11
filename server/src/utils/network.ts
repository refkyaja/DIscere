import os from 'os';
import { Request } from 'express';
import { config } from '../config.js';

/**
 * Mendapatkan IP lokal IPv4 yang valid dan dapat diakses oleh perangkat lain di jaringan Wi-Fi/LAN.
 * Mengabaikan adapter virtual (VirtualBox, VMware, vEthernet, Hyper-V, Loopback, APIPA, WSL).
 */
export function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  const candidates: { address: string; priority: number }[] = [];

  for (const [name, ifaceList] of Object.entries(interfaces)) {
    if (!ifaceList) continue;
    const lowerName = name.toLowerCase();

    // Abaikan adapter virtual & pseudoinstances
    if (
      lowerName.includes('virtualbox') ||
      lowerName.includes('vbox') ||
      lowerName.includes('vmware') ||
      lowerName.includes('vethernet') ||
      lowerName.includes('pseudo') ||
      lowerName.includes('loopback') ||
      lowerName.includes('bluetooth') ||
      lowerName.includes('wsl')
    ) {
      continue;
    }

    for (const iface of ifaceList) {
      if (iface.family === 'IPv4' && !iface.internal) {
        // Abaikan rentang default VirtualBox (192.168.56.x) dan APIPA (169.254.x.x)
        if (iface.address.startsWith('192.168.56.') || iface.address.startsWith('169.254.')) {
          continue;
        }

        let priority = 1;
        // Prioritas tertinggi untuk Wi-Fi / WLAN fisik
        if (
          lowerName.includes('wi-fi') ||
          lowerName.includes('wifi') ||
          lowerName.includes('wlan') ||
          lowerName.includes('wireless')
        ) {
          priority = 10;
        } else if (lowerName.includes('ethernet') || lowerName.includes('lan')) {
          priority = 5;
        }

        candidates.push({ address: iface.address, priority });
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.priority - a.priority);
    return candidates[0].address;
  }

  return 'localhost';
}

/**
 * Mendapatkan basis URL jaringan yang tepat untuk request.
 * Memperhitungkan header reverse proxy (ngrok, Cloudflare tunnel, dsb.)
 * serta fallback ke IP Wi-Fi/LAN fisik yang valid.
 */
export function getNetworkBaseUrl(req: Request): string {
  // 1. Cek reverse proxy header jika ada (ngrok, tunnel publik, dsb.)
  const forwardedHost = (req.headers['x-forwarded-host'] as string) || (req.headers['host'] as string);
  const forwardedProto =
    (req.headers['x-forwarded-proto'] as string) || (req.secure ? 'https' : 'http');

  if (
    forwardedHost &&
    !forwardedHost.includes('localhost') &&
    !forwardedHost.includes('127.0.0.1') &&
    !forwardedHost.startsWith('192.168.56.')
  ) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  // 2. Akses lokal: gunakan IP Wi-Fi / LAN yang valid
  const localIp = getLocalIp();
  if (localIp !== 'localhost') {
    return `http://${localIp}:${config.port}`;
  }

  return `http://${req.hostname || 'localhost'}:${config.port}`;
}

