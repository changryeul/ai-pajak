export async function createTaxCase() {
  const res = await fetch('/api/tax-cases', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 임시: 로그인 대체
      'x-user-id': '1',
    },
    body: JSON.stringify({
      companyId: 1,
      taxType: 'VAT',
      period: '2024-12',
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to create tax case');
  }

  return res.json(); // { id: number }
}