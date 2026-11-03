export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

type Options = { method?: string; body?: unknown };

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const token = localStorage.getItem('token');
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      // Without a time limit a wrong address keeps the app spinning forever (photos get longer to upload)
      signal: AbortSignal.timeout(opts.body !== undefined ? 30_000 : 15_000),
    });
  } catch {
    throw new Error(`Cannot reach the server at ${API_URL}. Check that the backend is running and your phone is on the same Wi-Fi.`);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}
