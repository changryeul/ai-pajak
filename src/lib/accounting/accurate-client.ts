/**
 * Accurate Online API Client
 *
 * Uses Session Key + Host authentication pattern:
 * 1. User obtains OAuth access_token from Accurate (via account.accurate.id)
 * 2. Call /api/db-list.do to list available databases
 * 3. Call /api/open-db.do?id=<db_id> to get session_key + host
 * 4. All subsequent API calls use:
 *    - Base URL: the returned `host`
 *    - Headers:
 *        Authorization: Bearer <access_token>
 *        X-Session-ID: <session_key>
 *
 * Docs: https://api-doc.accurate.id/
 */

const ACCURATE_OAUTH_BASE = 'https://account.accurate.id';
const ACCURATE_PUBLIC_BASE = 'https://public.accurate.id';

export interface AccurateDatabase {
  id: number;
  alias: string;
  dbName: string;
  host?: string;
}

export interface AccurateSession {
  session: string;
  host: string;
}

export interface AccurateSalesInvoice {
  id: number;
  number: string;
  transDate: string;    // ISO date
  customerName?: string;
  customerNpwp?: string;
  totalAmount: number;
  taxAmount1?: number;  // PPN
  taxAmount2?: number;  // PPh
  currency?: string;
  detailItem?: Array<{ itemName: string; quantity: number; unitPrice: number; taxable?: boolean }>;
}

export interface AccuratePurchaseInvoice {
  id: number;
  number: string;
  transDate: string;
  vendorName?: string;
  vendorNpwp?: string;
  totalAmount: number;
  taxAmount1?: number;
  taxAmount2?: number;
  currency?: string;
  detailItem?: Array<{ itemName: string; quantity: number; unitPrice: number; taxable?: boolean }>;
}

interface AccurateListResponse<T> {
  s: boolean;                        // success flag
  d?: T[];                           // data
  sp?: { pageCount: number; page: number; rowCount: number };
  e?: string;                        // error
}

/**
 * List databases accessible by the provided access_token
 */
export async function listDatabases(accessToken: string): Promise<AccurateDatabase[]> {
  const res = await fetch(`${ACCURATE_PUBLIC_BASE}/accurate/api/db-list.do`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Accurate db-list failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  if (!data.s) {
    throw new Error(`Accurate db-list error: ${data.e || 'unknown'}`);
  }
  return data.d || [];
}

/**
 * Open a database session. Returns session_key + host to use for subsequent calls.
 */
export async function openDatabase(accessToken: string, databaseId: number | string): Promise<AccurateSession> {
  const url = `${ACCURATE_PUBLIC_BASE}/accurate/api/open-db.do?id=${databaseId}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Accurate open-db failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  if (!data.s || !data.session || !data.host) {
    throw new Error(`Accurate open-db error: ${data.e || 'missing session/host'}`);
  }

  return { session: data.session, host: data.host };
}

/**
 * Generic API call using stored session + host
 */
async function callApi<T>(
  session: AccurateSession,
  accessToken: string,
  path: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    query.set(k, String(v));
  }

  const url = `${session.host}/accurate/api/${path}${query.toString() ? '?' + query : ''}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Session-ID': session.session,
    },
  });

  if (!res.ok) {
    throw new Error(`Accurate ${path} failed: ${res.status} ${await res.text()}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Fetch sales invoices (paginated)
 */
export async function listSalesInvoices(
  session: AccurateSession,
  accessToken: string,
  opts: { page?: number; pageSize?: number; fromDate?: string; toDate?: string } = {}
): Promise<{ invoices: AccurateSalesInvoice[]; pageCount: number }> {
  const params: Record<string, string | number> = {
    'sp.page': opts.page ?? 1,
    'sp.pageSize': opts.pageSize ?? 100,
    'fields': 'id,number,transDate,customerName,customerNpwp,totalAmount,taxAmount1,taxAmount2,currency',
  };
  if (opts.fromDate) params['filter.transDate.op'] = 'BETWEEN';
  if (opts.fromDate && opts.toDate) {
    params['filter.transDate.val[0]'] = opts.fromDate;
    params['filter.transDate.val[1]'] = opts.toDate;
  }

  const data = await callApi<AccurateListResponse<AccurateSalesInvoice>>(
    session, accessToken, 'sales-invoice/list.do', params
  );

  if (!data.s) {
    throw new Error(`Accurate sales-invoice/list error: ${data.e || 'unknown'}`);
  }

  return {
    invoices: data.d || [],
    pageCount: data.sp?.pageCount || 1,
  };
}

/**
 * Fetch purchase invoices (paginated)
 */
export async function listPurchaseInvoices(
  session: AccurateSession,
  accessToken: string,
  opts: { page?: number; pageSize?: number; fromDate?: string; toDate?: string } = {}
): Promise<{ invoices: AccuratePurchaseInvoice[]; pageCount: number }> {
  const params: Record<string, string | number> = {
    'sp.page': opts.page ?? 1,
    'sp.pageSize': opts.pageSize ?? 100,
    'fields': 'id,number,transDate,vendorName,vendorNpwp,totalAmount,taxAmount1,taxAmount2,currency',
  };
  if (opts.fromDate && opts.toDate) {
    params['filter.transDate.op'] = 'BETWEEN';
    params['filter.transDate.val[0]'] = opts.fromDate;
    params['filter.transDate.val[1]'] = opts.toDate;
  }

  const data = await callApi<AccurateListResponse<AccuratePurchaseInvoice>>(
    session, accessToken, 'purchase-invoice/list.do', params
  );

  if (!data.s) {
    throw new Error(`Accurate purchase-invoice/list error: ${data.e || 'unknown'}`);
  }

  return {
    invoices: data.d || [],
    pageCount: data.sp?.pageCount || 1,
  };
}

/**
 * Test if a session is still valid by calling a lightweight endpoint
 */
export async function testSession(session: AccurateSession, accessToken: string): Promise<boolean> {
  try {
    await callApi(session, accessToken, 'user/me.do');
    return true;
  } catch {
    return false;
  }
}
