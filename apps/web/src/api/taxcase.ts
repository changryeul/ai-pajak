import { TaxCaseDetail } from '../types/taxcase';

export type TaxCaseSummary = {
  id: string;
  workflowStage: string;
};

export async function fetchCompanyTaxCases(
  companyId: string,
): Promise<TaxCaseSummary[]> {
  const res = await fetch(`/api/companies/${companyId}/tax-cases`, {
    headers: { 'x-user-id': '1' },
  });
  if (!res.ok) throw new Error('Failed to fetch tax cases');
  return res.json();
}

// (이미 제공된) fetchTaxCase(id)
export async function fetchTaxCase(id: string): Promise<TaxCaseDetail> {
  const res = await fetch(`/api/tax-cases/${id}`, {
    headers: { 'x-user-id': '1' },
  });
  if (!res.ok) throw new Error('Failed to fetch tax case');
  return res.json();
}