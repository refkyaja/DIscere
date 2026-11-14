export class ApiError extends Error {
  status: number;
  pesan: string;

  constructor(status: number, pesan: string) {
    super(pesan);
    this.name = 'ApiError';
    this.status = status;
    this.pesan = pesan;
  }
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  const cleanBaseUrl = envUrl ? envUrl.replace(/\/+$/, '') : '';
  const normalizedPath = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;
  const url = cleanBaseUrl ? `${cleanBaseUrl}${normalizedPath}` : normalizedPath;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Kirim cookie otentikasi otomatis
  });

  let data: any;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const pesan =
      (typeof data === 'object' && data?.pesan) ||
      'Terjadi kesalahan saat menghubungi server.';
    throw new ApiError(response.status, pesan);
  }

  return data as T;
}

