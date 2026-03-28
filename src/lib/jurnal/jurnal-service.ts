/**
 * Jurnal.id (Mekari) API Service
 *
 * Cloud accounting integration for:
 * - Chart of accounts & financial reports
 * - Sales/purchase invoices for PPN reconciliation
 * - Contact (customer/vendor) management
 * - Payroll data for PPh 21
 *
 * API Docs: https://api-doc.jurnal.id
 */

import type {
  JurnalAuthToken,
  JurnalCompany,
  JurnalAccount,
  JurnalContact,
  JurnalTransaction,
  JurnalFinancialReport,
  JurnalSalesInvoice,
} from './types';

const JURNAL_API_BASE = 'https://api.jurnal.id/core/api/v1';
const JURNAL_AUTH_URL = 'https://api.jurnal.id/oauth';

function getConfig() {
  return {
    clientId: process.env.JURNAL_CLIENT_ID || '',
    clientSecret: process.env.JURNAL_CLIENT_SECRET || '',
    redirectUri: process.env.JURNAL_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/jurnal/callback`,
  };
}

export class JurnalService {
  // ============================
  // OAuth2
  // ============================

  static getAuthorizationUrl(state: string): string {
    const config = getConfig();
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      state,
    });
    return `${JURNAL_AUTH_URL}/authorize?${params}`;
  }

  static async exchangeCode(code: string): Promise<JurnalAuthToken> {
    const config = getConfig();
    const response = await fetch(`${JURNAL_AUTH_URL}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
      }),
    });

    if (!response.ok) throw new Error('Jurnal auth failed');
    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      companyId: data.company_id,
      companyName: data.company_name || '',
    };
  }

  static async refreshToken(refreshToken: string): Promise<JurnalAuthToken> {
    const config = getConfig();
    const response = await fetch(`${JURNAL_AUTH_URL}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) throw new Error('Token refresh failed');
    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      companyId: data.company_id,
      companyName: data.company_name || '',
    };
  }

  // ============================
  // Company
  // ============================

  static async getCompanyInfo(accessToken: string): Promise<JurnalCompany> {
    const data = await this.apiCall(accessToken, 'GET', '/company');
    const c = data.company;
    return {
      id: c.id,
      name: c.name,
      industry: c.industry_type || '',
      taxNumber: c.tax_no,
      address: c.address,
      currency: c.currency_code || 'IDR',
    };
  }

  // ============================
  // Chart of Accounts
  // ============================

  static async getAccounts(accessToken: string): Promise<JurnalAccount[]> {
    const data = await this.apiCall(accessToken, 'GET', '/accounts?page=1&page_size=500');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.accounts || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      number: a.number || a.account_code,
      category: a.category?.name || a.category_name || '',
      balance: a.balance || 0,
    }));
  }

  // ============================
  // Contacts
  // ============================

  static async getContacts(accessToken: string, type?: 'customer' | 'vendor'): Promise<JurnalContact[]> {
    const typeParam = type ? `&contact_type=${type}` : '';
    const data = await this.apiCall(accessToken, 'GET', `/contacts?page=1&page_size=200${typeParam}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.contacts || []).map((c: any) => ({
      id: c.id,
      name: c.display_name || c.name,
      email: c.email,
      phone: c.phone,
      taxNumber: c.tax_no,
      type: (c.contact_type || 'CUSTOMER').toString().toUpperCase(),
      balance: c.balance || 0,
    }));
  }

  // ============================
  // Sales Invoices (for PPN)
  // ============================

  static async getSalesInvoices(
    accessToken: string,
    startDate: string,
    endDate: string
  ): Promise<JurnalSalesInvoice[]> {
    const data = await this.apiCall(
      accessToken, 'GET',
      `/sales_invoices?start_date=${startDate}&end_date=${endDate}&page=1&page_size=200`
    );

    return (data.sales_invoices || []).map((inv: Record<string, unknown>) => {
      const items = (inv.line_items || inv.transaction_lines || []) as Array<Record<string, unknown>>;
      return {
        id: inv.id as number,
        invoiceNo: (inv.transaction_no || '') as string,
        customerName: (inv.person_name || '') as string,
        customerTaxNumber: inv.tax_no as string | undefined,
        invoiceDate: (inv.transaction_date || '') as string,
        dueDate: (inv.due_date || '') as string,
        subtotal: (inv.sub_total || 0) as number,
        taxAmount: (inv.tax_amount || 0) as number,
        total: (inv.total || 0) as number,
        status: mapStatus((inv.status || '') as string),
        items: items.map(item => ({
          productName: (item.product_name || item.description || '') as string,
          quantity: (item.quantity || 0) as number,
          rate: (item.rate || 0) as number,
          amount: (item.amount || 0) as number,
          taxRate: (item.tax_rate || 0) as number,
          taxAmount: (item.tax_amount || 0) as number,
        })),
      };
    });
  }

  // ============================
  // Financial Reports
  // ============================

  static async getProfitLoss(
    accessToken: string,
    startDate: string,
    endDate: string
  ): Promise<JurnalFinancialReport> {
    const data = await this.apiCall(
      accessToken, 'GET',
      `/reports/profit_and_loss?start_date=${startDate}&end_date=${endDate}`
    );
    return this.parseReport('PROFIT_LOSS', startDate, endDate, data);
  }

  static async getBalanceSheet(
    accessToken: string,
    asOfDate: string
  ): Promise<JurnalFinancialReport> {
    const data = await this.apiCall(
      accessToken, 'GET',
      `/reports/balance_sheet?date=${asOfDate}`
    );
    return this.parseReport('BALANCE_SHEET', asOfDate, asOfDate, data);
  }

  static async getTrialBalance(
    accessToken: string,
    startDate: string,
    endDate: string
  ): Promise<JurnalFinancialReport> {
    const data = await this.apiCall(
      accessToken, 'GET',
      `/reports/trial_balance?start_date=${startDate}&end_date=${endDate}`
    );
    return this.parseReport('TRIAL_BALANCE', startDate, endDate, data);
  }

  // ============================
  // Helpers
  // ============================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static async apiCall(accessToken: string, method: string, path: string): Promise<any> {
    const response = await fetch(`${JURNAL_API_BASE}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jurnal API error ${response.status}: ${error}`);
    }

    return response.json();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static parseReport(type: JurnalFinancialReport['reportType'], start: string, end: string, data: any): JurnalFinancialReport {
    const report = data.report || data;
    const sections = (report.sections || report.categories || []).map((s: Record<string, unknown>) => ({
      name: s.name || s.category_name || '',
      accounts: ((s.accounts || s.items || []) as Array<Record<string, unknown>>).map(a => ({
        accountNumber: (a.account_code || a.number || '') as string,
        accountName: (a.account_name || a.name || '') as string,
        amount: (a.total || a.amount || a.balance || 0) as number,
      })),
      subtotal: (s.total || s.subtotal || 0) as number,
    }));

    return {
      reportType: type,
      startDate: start,
      endDate: end,
      currency: 'IDR',
      sections,
      totals: report.totals || {},
    };
  }
}

function mapStatus(status: string): JurnalSalesInvoice['status'] {
  const s = status.toLowerCase();
  if (s === 'draft') return 'DRAFT';
  if (s === 'sent' || s === 'open') return 'SENT';
  if (s === 'paid' || s === 'closed') return 'PAID';
  if (s === 'overdue') return 'OVERDUE';
  if (s === 'void' || s === 'deleted') return 'VOID';
  return 'SENT';
}
