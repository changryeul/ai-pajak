const API_BASE = 'http://localhost:3000/api';

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': '1', // ✅ 지금은 고정 (나중에 auth로 교체)
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'API Error');
  }

  return res.json();
}