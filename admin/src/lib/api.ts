export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

function token(): string | null {
  return localStorage.getItem('pf.accessToken');
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? body.message ?? 'Request failed');
  return body as T;
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('pf.accessToken', accessToken);
  localStorage.setItem('pf.refreshToken', refreshToken);
}

export function clearTokens() {
  localStorage.removeItem('pf.accessToken');
  localStorage.removeItem('pf.refreshToken');
}
