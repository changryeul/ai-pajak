export async function fetchTaxCase(id: string) {
  const res = await fetch(`/api/tax-cases/${id}`);
  if (!res.ok) throw new Error('Failed to fetch tax case');
  return res.json();
}

export async function taxCaseAction(
  id: string,
  action: string
) {
  const res = await fetch(`/api/tax-cases/${id}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });

  if (!res.ok) throw new Error('Action failed');
  return res.json();
}