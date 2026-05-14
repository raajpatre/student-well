const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getToken(): string | null {
  return localStorage.getItem('sw_token');
}

interface ApiOptions {
  method?: string;
  body?: unknown;
}

export async function apiCall<T = unknown>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined
      ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
      : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Something went wrong' }));
    throw new Error(error.error || `Request failed with status ${res.status}`);
  }

  return res.json();
}
