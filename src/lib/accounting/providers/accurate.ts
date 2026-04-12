/**
 * Accurate Online provider implementation
 * Uses OAuth access_token + Session Key + dynamic host pattern
 */
import type {
  AccountingProvider,
  ConnectionCredentials,
  NormalizedInvoice,
  ListDatabasesResult,
} from '../types';

// account.accurate.id = OAuth + DB management (db-list, open-db)
// Data APIs (invoices etc.) use the dynamic `host` returned by open-db.do
const ACCURATE_ACCOUNT_BASE = 'https://account.accurate.id';

async function callApi<T>(
  creds: ConnectionCredentials,
  path: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) query.set(k, String(v));

  // Data API calls use the host from open-db (e.g. zeus.accurate.id)
  const baseUrl = creds.host || ACCURATE_ACCOUNT_BASE;
  const url = `${baseUrl}/accurate/api/${path}${query.toString() ? '?' + query : ''}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      ...(creds.sessionKey ? { 'X-Session-ID': creds.sessionKey } : {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Accurate ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export const accurateProvider: AccountingProvider = {
  id: 'ACCURATE',
  displayName: 'Accurate Online',

  async listDatabases(accessToken: string): Promise<ListDatabasesResult[]> {
    const res = await fetch(`${ACCURATE_ACCOUNT_BASE}/api/db-list.do`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Accurate db-list failed: ${res.status}`);
    const data = await res.json();
    if (!data.s) throw new Error(`Accurate db-list error: ${data.e || 'unknown'}`);
    return (data.d || []).map((db: { id: number; alias?: string; dbName?: string }) => ({
      id: db.id,
      name: db.alias || db.dbName || `DB ${db.id}`,
    }));
  },

  async openSession(input) {
    if (!input.databaseId) throw new Error('databaseId required for Accurate');
    const res = await fetch(
      `${ACCURATE_ACCOUNT_BASE}/api/open-db.do?id=${input.databaseId}`,
      { headers: { Authorization: `Bearer ${input.accessToken}` } }
    );
    if (!res.ok) throw new Error(`Accurate open-db failed: ${res.status}`);
    const data = await res.json();
    if (!data.s || !data.session || !data.host) {
      throw new Error(`Accurate open-db error: ${data.e || 'missing session/host'}`);
    }
    return {
      accessToken: input.accessToken,
      sessionKey: data.session,
      host: data.host,
      databaseId: String(input.databaseId),
    };
  },

  async listSalesInvoices(creds, opts) {
    const params: Record<string, string | number> = {
      'sp.page': opts.page ?? 1,
      'sp.pageSize': opts.pageSize ?? 100,
      fields: 'id,number,transDate,customerName,customerNpwp,totalAmount,taxAmount1,taxAmount2,currency',
    };
    if (opts.fromDate && opts.toDate) {
      params['filter.transDate.op'] = 'BETWEEN';
      params['filter.transDate.val[0]'] = opts.fromDate;
      params['filter.transDate.val[1]'] = opts.toDate;
    }
    const data = await callApi<{ s: boolean; d?: Array<Record<string, unknown>>; sp?: { pageCount: number } }>(
      creds, 'sales-invoice/list.do', params
    );
    if (!data.s) throw new Error('Accurate sales-invoice/list failed');
    const invoices: NormalizedInvoice[] = (data.d || []).map(mapAccurateInvoice('SALES'));
    const hasMore = (data.sp?.pageCount ?? 1) > (opts.page ?? 1);
    return { invoices, hasMore };
  },

  async listPurchaseInvoices(creds, opts) {
    const params: Record<string, string | number> = {
      'sp.page': opts.page ?? 1,
      'sp.pageSize': opts.pageSize ?? 100,
      fields: 'id,number,transDate,vendorName,vendorNpwp,totalAmount,taxAmount1,taxAmount2,currency',
    };
    if (opts.fromDate && opts.toDate) {
      params['filter.transDate.op'] = 'BETWEEN';
      params['filter.transDate.val[0]'] = opts.fromDate;
      params['filter.transDate.val[1]'] = opts.toDate;
    }
    const data = await callApi<{ s: boolean; d?: Array<Record<string, unknown>>; sp?: { pageCount: number } }>(
      creds, 'purchase-invoice/list.do', params
    );
    if (!data.s) throw new Error('Accurate purchase-invoice/list failed');
    const invoices: NormalizedInvoice[] = (data.d || []).map(mapAccurateInvoice('PURCHASE'));
    const hasMore = (data.sp?.pageCount ?? 1) > (opts.page ?? 1);
    return { invoices, hasMore };
  },
};

function mapAccurateInvoice(type: 'SALES' | 'PURCHASE') {
  return (raw: Record<string, unknown>): NormalizedInvoice => {
    const taxAmount = Number(raw.taxAmount1 || 0);
    const totalAmount = Number(raw.totalAmount || 0);
    const transDate = String(raw.transDate || '').substring(0, 10);
    return {
      externalId: String(raw.id),
      invoiceType: type,
      invoiceNumber: String(raw.number || ''),
      invoiceDate: transDate,
      counterpartyName: (raw.customerName || raw.vendorName || null) as string | null,
      counterpartyNpwp: (raw.customerNpwp || raw.vendorNpwp || null) as string | null,
      subtotal: totalAmount - taxAmount,
      taxAmount,
      totalAmount,
      currency: String(raw.currency || 'IDR'),
      hasPpn: taxAmount > 0,
      hasPph: Number(raw.taxAmount2 || 0) > 0,
      raw,
    };
  };
}
