const API_BASE = '/api';

const HEADERS = {
  'x-user-id': '2',
};

export async function fetchTaxCase(id: string) {
  const res = await fetch(`${API_BASE}/tax-cases/${id}`, {
    headers: HEADERS,
  });
  if (!res.ok) throw new Error('fetchTaxCase failed');
  return res.json();
}

/**
 * 백엔드 실제 라우트 기준
 */
export async function taxCaseAction(id: string, action: string) {
  const map: Record<string, string> = {
    MOVE_TO_HUMAN_REVIEW: `${API_BASE}/tax-cases/${id}/request-review`,
    APPROVE: `${API_BASE}/tax-cases/${id}/approve`,
    FILE: `${API_BASE}/tax-cases/${id}/file`,
  };

  const url = map[action];
  if (!url) throw new Error(`Unknown action: ${action}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: HEADERS,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Action failed ${res.status}: ${text}`);
  }

  return res.json();
}