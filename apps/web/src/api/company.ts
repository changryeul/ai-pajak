import { apiFetch } from './client';

export type CompanySummary = {
  id: string;
  name: string;
  npwp: string;
  createdAt: string;
};

/**
 * 전체 회사 목록 조회
 */
export async function fetchAllCompanies(): Promise<CompanySummary[]> {
  const res = await fetch('/api/companies', {
    headers: { 'x-user-id': '1' },
  });
  if (!res.ok) throw new Error('Failed to fetch companies');
  return res.json();
}

export function createCompany(input: {
  name: string;
  npwp: string;
}) {
  return apiFetch('/companies', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getCompany(id: number) {
  return apiFetch(`/companies/${id}`);
}