/**
 * Common types for accounting software integrations.
 * All providers (Accurate, Mekari Jurnal, etc.) implement AccountingProvider.
 */

export type AccountingProviderId = 'ACCURATE' | 'MEKARI';

export interface ConnectionCredentials {
  /** OAuth access token (all providers) */
  accessToken: string;
  /** Refresh token if provided */
  refreshToken?: string;
  /** Accurate-specific: session key from open-db.do */
  sessionKey?: string;
  /** Accurate-specific: dynamic host returned by open-db.do */
  host?: string;
  /** Optional database id (Accurate) or company id (Mekari) */
  databaseId?: string;
  databaseName?: string;
}

export interface NormalizedInvoice {
  externalId: string;            // id in source system
  invoiceType: 'SALES' | 'PURCHASE';
  invoiceNumber: string;
  invoiceDate: string;           // YYYY-MM-DD
  counterpartyName: string | null;
  counterpartyNpwp: string | null;
  subtotal: number;
  taxAmount: number;             // VAT / PPN amount
  totalAmount: number;
  currency: string;
  hasPpn: boolean;
  hasPph: boolean;
  raw: Record<string, unknown>;
}

export interface ListDatabasesResult {
  id: string | number;
  name: string;
}

export interface AccountingProvider {
  id: AccountingProviderId;
  displayName: string;

  /**
   * (Optional) list available databases for the given access token.
   * Mekari returns a single "company" per token so this may return [].
   */
  listDatabases?(accessToken: string): Promise<ListDatabasesResult[]>;

  /**
   * Establish a session from initial credentials.
   * - Accurate: calls open-db.do, returns sessionKey + host
   * - Mekari: returns credentials unchanged (no session step)
   */
  openSession(input: { accessToken: string; databaseId?: string | number }): Promise<ConnectionCredentials>;

  /**
   * Fetch sales invoices in a date range
   */
  listSalesInvoices(
    creds: ConnectionCredentials,
    opts: { fromDate?: string; toDate?: string; page?: number; pageSize?: number }
  ): Promise<{ invoices: NormalizedInvoice[]; hasMore: boolean }>;

  /**
   * Fetch purchase invoices in a date range
   */
  listPurchaseInvoices(
    creds: ConnectionCredentials,
    opts: { fromDate?: string; toDate?: string; page?: number; pageSize?: number }
  ): Promise<{ invoices: NormalizedInvoice[]; hasMore: boolean }>;
}
