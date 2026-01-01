const API_BASE = 'http://localhost:3000/api';

export async function apiFetch(
  url: string,
  options: RequestInit = {},
) {
  const res = await fetch(API_BASE + url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': '1', // 🔥 임시 고정
      ...(options.headers || {}),
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw data;
  }

  return data;
}