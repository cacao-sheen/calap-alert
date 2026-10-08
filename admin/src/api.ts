export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

type Options = { method?: string; body?: unknown };

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const token = localStorage.getItem('admin_token');
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new Error(`Cannot reach the server at ${API_URL}. Is the backend running?`);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    localStorage.removeItem('admin_token');
    window.location.href = '/login';
  }
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}
