import { apiFetch } from './api';

export function getTaxCase(id: string) {
  return apiFetch(`/tax-cases/${id}`);
}

export function applyAIResult(id: string, body: {
  suggestedTax: string;
  confidence: number;
  rawResponse?: any;
}) {
  return apiFetch(`/tax-cases/${id}/ai-result`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function moveToReview(id: string) {
  return apiFetch(`/tax-cases/${id}/review`, {
    method: 'POST',
  });
}

export function approveTaxCase(id: string) {
  return apiFetch(`/tax-cases/${id}/approve`, {
    method: 'POST',
  });
}