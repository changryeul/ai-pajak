/**
 * Mekari Jurnal provider implementation
 *
 * Uses simple OAuth 2.0 Bearer token (no session step).
 * Base URL: https://api.mekari.com
 *
 * Docs: https://mekari.com/developers/
 */
import type {
  AccountingProvider,
  ConnectionCredentials,
  NormalizedInvoice,
} from '../types';

const MEKARI_BASE = 'https://api.mekari.com';

interface MekariInvoice {
  id: number | string;
  transaction_no?: string;
  transaction_date?: string;
  person?: { display_name?: string; tax_id?: string };
  original_amount?: number;
  tax_amount?: number;
  total_amount?: number;
  currency_code?: string;
}

interface MekariListResponse {
  sales_invoices?: MekariInvoice[];
  purchase_invoices?: MekariInvoice[];
  meta?: { total_count?: number; per_page?: number; current_page?: number };
}

async function callApi<T>(
  creds: ConnectionCredentials,
  path: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) query.set(k, String(v));

  const url = `${MEKARI_BASE}${path}${query.toString() ? '?' + query : ''}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Mekari ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export const mekariProvider: AccountingProvider = {
  id: 'MEKARI',
  displayName: 'Mekari Jurnal',

  // Mekari ties the token to a single company → no database selection
  async listDatabases() {
    return [];
  },

  async openSession(input) {
    // No session step — just return the token as-is
    return { accessToken: input.accessToken };
  },

  async listSalesInvoices(creds, opts) {
    const params: Record<string, string | number> = {
      'page[number]': opts.page ?? 1,
      'page[size]': opts.pageSize ?? 100,
    };
    if (opts.fromDate) params['filter[transaction_date_from]'] = opts.fromDate;
    if (opts.toDate) params['filter[transaction_date_to]'] = opts.toDate;

    const data = await callApi<MekariListResponse>(creds, '/jurnal/public/v1/sales_invoices', params);
    const list = data.sales_invoices || [];
    const invoices = list.map(mapMekariInvoice('SALES'));
    const total = data.meta?.total_count ?? list.length;
    const perPage = data.meta?.per_page ?? 100;
    const currentPage = data.meta?.current_page ?? 1;
    const hasMore = currentPage * perPage < total;
    return { invoices, hasMore };
  },

  async listPurchaseInvoices(creds, opts) {
    const params: Record<string, string | number> = {
      'page[number]': opts.page ?? 1,
      'page[size]': opts.pageSize ?? 100,
    };
    if (opts.fromDate) params['filter[transaction_date_from]'] = opts.fromDate;
    if (opts.toDate) params['filter[transaction_date_to]'] = opts.toDate;

    const data = await callApi<MekariListResponse>(creds, '/jurnal/public/v1/purchase_invoices', params);
    const list = data.purchase_invoices || [];
    const invoices = list.map(mapMekariInvoice('PURCHASE'));
    const total = data.meta?.total_count ?? list.length;
    const perPage = data.meta?.per_page ?? 100;
    const currentPage = data.meta?.current_page ?? 1;
    const hasMore = currentPage * perPage < total;
    return { invoices, hasMore };
  },
};

function mapMekariInvoice(type: 'SALES' | 'PURCHASE') {
  return (raw: MekariInvoice): NormalizedInvoice => {
    const subtotal = Number(raw.original_amount || 0);
    const taxAmount = Number(raw.tax_amount || 0);
    const total = Number(raw.total_amount || subtotal + taxAmount);
    return {
      externalId: String(raw.id),
      invoiceType: type,
      invoiceNumber: String(raw.transaction_no || ''),
      invoiceDate: String(raw.transaction_date || '').substring(0, 10),
      counterpartyName: raw.person?.display_name || null,
      counterpartyNpwp: raw.person?.tax_id || null,
      subtotal,
      taxAmount,
      totalAmount: total,
      currency: raw.currency_code || 'IDR',
      hasPpn: taxAmount > 0,
      hasPph: false, // Mekari doesn't expose this directly
      raw: raw as unknown as Record<string, unknown>,
    };
  };
}
