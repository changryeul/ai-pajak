const API_BASE = '/api';

export async function createCompany() {
  const res = await fetch(`${API_BASE}/companies`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': '1', // 임시 사용자
    },
    body: JSON.stringify({
      name: 'PT Nusantara Digital',
      npwp: '01.234.567.8-999.000',
    }),
  });

  if (!res.ok) throw new Error('Failed to create company');
  return res.json();
}

export async function createTaxCase(companyId: number) {
  const res = await fetch(`${API_BASE}/tax-cases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': '1',
    },
    body: JSON.stringify({
      companyId,
      taxType: 'VAT',
      period: '2024-12',
    }),
  });

  if (!res.ok) throw new Error('Failed to create tax case');
  return res.json();
}