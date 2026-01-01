import { apiFetch } from './client';

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