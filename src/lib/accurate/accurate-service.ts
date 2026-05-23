/**
 * Accurate Online API Service
 *
 * Integrates with Accurate Online accounting software for:
 * - Employee & payroll data sync
 * - Financial statement import
 * - Invoice/transaction sync for PPN reconciliation
 *
 * Accurate Online API Docs: https://accurate.id/api-accurate-online/
 *
 * OAuth2 Flow:
 * 1. Redirect user to Accurate authorization URL
 * 2. User grants access → redirect back with auth code
 * 3. Exchange code for access token
 * 4. Open database session
 * 5. Make API calls with session
 */

import type {
  AccurateAuthConfig,
  AccurateAuthToken,
  AccurateSession,
  AccurateDatabase,
  AccurateEmployee,
  AccuratePayrollItem,
  AccuratePayrollSummary,
  AccurateFinancialStatement,
  AccurateInvoice,
  AccurateSyncResult,
} from './types';

const ACCURATE_API_BASE = 'https://account.accurate.id';
const ACCURATE_API_VERSION = 'v2';

function getConfig(): AccurateAuthConfig {
  return {
    clientId: process.env.ACCURATE_CLIENT_ID || '',
    clientSecret: process.env.ACCURATE_CLIENT_SECRET || '',
    redirectUri: process.env.ACCURATE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/accurate/callback`,
  };
}

/**
 * Accurate Online API Service
 */
export class AccurateService {
  // ============================
  // OAuth2 Authentication
  // ============================

  /**
   * Get authorization URL for OAuth2 flow
   */
  static getAuthorizationUrl(state: string): string {
    const config = getConfig();
    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: config.redirectUri,
      scope: 'employee_read payroll_read sales_invoice_read general_ledger_read',
      state,
    });
    return `${ACCURATE_API_BASE}/oauth/authorize?${params}`;
  }

  /**
   * Exchange authorization code for access token
   */
  static async exchangeCode(code: string): Promise<AccurateAuthToken> {
    const config = getConfig();
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

    const response = await fetch(`${ACCURATE_API_BASE}/oauth/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: config.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Accurate auth failed: ${error}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
    };
  }

  /**
   * Refresh expired access token
   */
  static async refreshToken(refreshToken: string): Promise<AccurateAuthToken> {
    const config = getConfig();
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

    const response = await fetch(`${ACCURATE_API_BASE}/oauth/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
    };
  }

  // ============================
  // Database Management
  // ============================

  /**
   * List available databases for the authenticated user
   */
  static async listDatabases(accessToken: string): Promise<AccurateDatabase[]> {
    const response = await this.apiCall(accessToken, null, 'GET', '/api/db-list.do');
    return (response.d || []).map((db: Record<string, unknown>) => ({
      id: db.id,
      alias: db.alias,
      companyName: db.companyName || db.alias,
      description: db.description || '',
    }));
  }

  /**
   * Open a database session
   */
  static async openDatabase(accessToken: string, databaseId: number): Promise<AccurateSession> {
    const response = await this.apiCall(accessToken, null, 'GET', `/api/db-open.do?id=${databaseId}`);
    return {
      host: response.host,
      session: response.session,
    };
  }

  // ============================
  // Employee Data
  // ============================

  /**
   * Fetch all employees from Accurate
   */
  static async getEmployees(
    accessToken: string,
    session: AccurateSession,
    options?: { page?: number; pageSize?: number; isActive?: boolean }
  ): Promise<{ employees: AccurateEmployee[]; totalCount: number }> {
    const params = new URLSearchParams({
      fields: 'id,no,name,email,mobilePhone,npwp,idCardNo,address,department,position,startDate,ptkpStatus,bankAccountNo,bankName,suspended',
      sp: JSON.stringify({
        pageSize: (options?.pageSize || 100).toString(),
        page: (options?.page || 1).toString(),
        ...(options?.isActive !== undefined ? { filter: [{ property: 'suspended', value: !options.isActive }] } : {}),
      }),
    });

    const response = await this.apiCall(
      accessToken,
      session,
      'GET',
      `/accurate/api/employee/list.do?${params}`
    );

    const employees: AccurateEmployee[] = (response.d || []).map((emp: Record<string, unknown>) => ({
      id: emp.id as number,
      employeeNo: (emp.no || '') as string,
      name: (emp.name || '') as string,
      email: emp.email as string | undefined,
      phone: emp.mobilePhone as string | undefined,
      npwp: emp.npwp as string | undefined,
      nik: emp.idCardNo as string | undefined,
      address: emp.address as string | undefined,
      department: emp.department as string | undefined,
      position: emp.position as string | undefined,
      joinDate: emp.startDate as string | undefined,
      ptkpStatus: emp.ptkpStatus as string | undefined,
      bankAccount: emp.bankAccountNo as string | undefined,
      bankName: emp.bankName as string | undefined,
      isActive: !emp.suspended,
    }));

    return {
      employees,
      totalCount: response.sp?.totalCount || employees.length,
    };
  }

  // ============================
  // Payroll Data
  // ============================

  /**
   * Fetch payroll data for a specific period
   */
  static async getPayroll(
    accessToken: string,
    session: AccurateSession,
    period: string, // YYYY-MM
    options?: { page?: number; pageSize?: number }
  ): Promise<AccuratePayrollSummary> {
    const [year, month] = period.split('-');
    const params = new URLSearchParams({
      fields: 'id,employee.id,employee.name,employee.no,period,basicSalary,allowance,overtimePay,bonus,thr,grossIncome,bpjsKetenagakerjaan,bpjsKesehatan,pensionContribution,positionCost,pph21Amount,nettIncome,takeHomePay',
      sp: JSON.stringify({
        pageSize: (options?.pageSize || 200).toString(),
        page: (options?.page || 1).toString(),
        filter: [
          { property: 'periodYear', value: parseInt(year) },
          { property: 'periodMonth', value: parseInt(month) },
        ],
      }),
    });

    const response = await this.apiCall(
      accessToken,
      session,
      'GET',
      `/accurate/api/employee-salary/list.do?${params}`
    );

    const items: AccuratePayrollItem[] = (response.d || []).map((item: Record<string, unknown>) => {
      const employee = item.employee as Record<string, unknown> || {};
      return {
        id: item.id as number,
        employeeId: employee.id as number,
        employeeName: (employee.name || '') as string,
        employeeNo: (employee.no || '') as string,
        period,
        basicSalary: (item.basicSalary || 0) as number,
        allowances: (item.allowance || 0) as number,
        overtime: (item.overtimePay || 0) as number,
        bonus: (item.bonus || 0) as number,
        thr: (item.thr || 0) as number,
        grossIncome: (item.grossIncome || 0) as number,
        bpjsKetenagakerjaan: (item.bpjsKetenagakerjaan || 0) as number,
        bpjsKesehatan: (item.bpjsKesehatan || 0) as number,
        pensionContribution: (item.pensionContribution || 0) as number,
        positionCost: (item.positionCost || 0) as number,
        pph21: (item.pph21Amount || 0) as number,
        netIncome: (item.nettIncome || 0) as number,
        takeHomePay: (item.takeHomePay || 0) as number,
      };
    });

    return {
      period,
      totalEmployees: items.length,
      totalGrossIncome: items.reduce((s, i) => s + i.grossIncome, 0),
      totalPph21: items.reduce((s, i) => s + i.pph21, 0),
      totalBpjs: items.reduce((s, i) => s + i.bpjsKetenagakerjaan + i.bpjsKesehatan, 0),
      totalTakeHomePay: items.reduce((s, i) => s + i.takeHomePay, 0),
      items,
    };
  }

  /**
   * Fetch annual payroll summary (all months)
   */
  static async getAnnualPayroll(
    accessToken: string,
    session: AccurateSession,
    year: number
  ): Promise<AccuratePayrollSummary[]> {
    const results: AccuratePayrollSummary[] = [];
    for (let month = 1; month <= 12; month++) {
      const period = `${year}-${month.toString().padStart(2, '0')}`;
      try {
        const summary = await this.getPayroll(accessToken, session, period);
        if (summary.totalEmployees > 0) {
          results.push(summary);
        }
      } catch {
        // Month might not have data
      }
    }
    return results;
  }

  // ============================
  // Financial Statements
  // ============================

  /**
   * Fetch income statement (Laporan Laba Rugi)
   */
  static async getIncomeStatement(
    accessToken: string,
    session: AccurateSession,
    startDate: string,
    endDate: string
  ): Promise<AccurateFinancialStatement> {
    const params = new URLSearchParams({
      startDate,
      endDate,
      reportType: 'INCOME_STATEMENT',
    });

    const response = await this.apiCall(
      accessToken,
      session,
      'GET',
      `/accurate/api/financial-report/profit-loss.do?${params}`
    );

    return this.parseFinancialStatement('INCOME_STATEMENT', `${startDate} - ${endDate}`, response);
  }

  /**
   * Fetch balance sheet (Neraca)
   */
  static async getBalanceSheet(
    accessToken: string,
    session: AccurateSession,
    asOfDate: string
  ): Promise<AccurateFinancialStatement> {
    const params = new URLSearchParams({
      asOfDate,
      reportType: 'BALANCE_SHEET',
    });

    const response = await this.apiCall(
      accessToken,
      session,
      'GET',
      `/accurate/api/financial-report/balance-sheet.do?${params}`
    );

    return this.parseFinancialStatement('BALANCE_SHEET', asOfDate, response);
  }

  // ============================
  // Invoices (for PPN reconciliation)
  // ============================

  /**
   * Fetch sales invoices for PPN reconciliation
   */
  static async getSalesInvoices(
    accessToken: string,
    session: AccurateSession,
    startDate: string,
    endDate: string,
    options?: { page?: number; pageSize?: number }
  ): Promise<{ invoices: AccurateInvoice[]; totalCount: number }> {
    const params = new URLSearchParams({
      fields: 'id,number,customer.name,customer.npwp,transDate,dueDate,subTotal,taxAmount,totalAmount,statusName,detailItem',
      sp: JSON.stringify({
        pageSize: (options?.pageSize || 100).toString(),
        page: (options?.page || 1).toString(),
        filter: [
          { property: 'transDate', operator: 'GREATER_EQUAL', value: startDate },
          { property: 'transDate', operator: 'LESS_EQUAL', value: endDate },
        ],
      }),
    });

    const response = await this.apiCall(
      accessToken,
      session,
      'GET',
      `/accurate/api/sales-invoice/list.do?${params}`
    );

    const invoices: AccurateInvoice[] = (response.d || []).map((inv: Record<string, unknown>) => {
      const customer = inv.customer as Record<string, unknown> || {};
      const details = inv.detailItem as Array<Record<string, unknown>> || [];
      return {
        id: inv.id as number,
        invoiceNo: (inv.number || '') as string,
        customerName: (customer.name || '') as string,
        customerNpwp: customer.npwp as string | undefined,
        invoiceDate: (inv.transDate || '') as string,
        dueDate: (inv.dueDate || '') as string,
        subtotal: (inv.subTotal || 0) as number,
        taxAmount: (inv.taxAmount || 0) as number,
        total: (inv.totalAmount || 0) as number,
        status: mapInvoiceStatus(inv.statusName as string),
        items: details.map((d) => ({
          description: (d.itemName || d.detailName || '') as string,
          quantity: (d.quantity || 0) as number,
          unitPrice: (d.unitPrice || 0) as number,
          amount: (d.amount || 0) as number,
          taxRate: (d.taxRate || 0) as number,
          taxAmount: (d.taxAmount || 0) as number,
        })),
      };
    });

    return {
      invoices,
      totalCount: response.sp?.totalCount || invoices.length,
    };
  }

  // ============================
  // Data Sync Helper
  // ============================

  /**
   * Full sync: employees + annual payroll for a given year
   */
  static async syncPayrollData(
    accessToken: string,
    session: AccurateSession,
    year: number
  ): Promise<AccurateSyncResult> {
    const errors: string[] = [];
    let recordsCount = 0;

    try {
      // Sync employees
      const { employees } = await this.getEmployees(accessToken, session, { isActive: true });
      recordsCount += employees.length;

      // Sync annual payroll
      const payrolls = await this.getAnnualPayroll(accessToken, session, year);
      recordsCount += payrolls.reduce((s, p) => s + p.items.length, 0);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Sync failed');
    }

    return {
      status: errors.length === 0 ? 'SUCCESS' : 'FAILED',
      syncedAt: new Date().toISOString(),
      dataType: 'PAYROLL',
      recordsCount,
      errors,
    };
  }

  // ============================
  // Internal Helpers
  // ============================

   
  private static async apiCall(
    accessToken: string,
    session: AccurateSession | null,
    method: string,
    path: string
  ): Promise<any> {
    const baseUrl = session ? `https://${session.host}` : ACCURATE_API_BASE;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
    if (session) {
      headers['X-Session-ID'] = session.session;
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Accurate API error ${response.status}: ${errorText}`);
    }

    return response.json();
  }

   
  private static parseFinancialStatement(
    type: AccurateFinancialStatement['type'],
    period: string,
    response: any
  ): AccurateFinancialStatement {
    const data = response.d as Array<Record<string, unknown>> || [];
    const items = data.map((item) => ({
      accountNo: (item.accountNo || '') as string,
      accountName: (item.accountName || '') as string,
      category: (item.category || '') as string,
      amount: (item.amount || 0) as number,
      previousAmount: item.previousAmount as number | undefined,
    }));

    const totals: Record<string, number> = {};
    if (response.totals) {
      Object.entries(response.totals as Record<string, number>).forEach(([k, v]) => {
        totals[k] = v;
      });
    }

    return { type, period, currency: 'IDR', items, totals };
  }
}

function mapInvoiceStatus(status: string): AccurateInvoice['status'] {
  const map: Record<string, AccurateInvoice['status']> = {
    'Draft': 'DRAFT',
    'Open': 'OPEN',
    'Paid': 'PAID',
    'Overdue': 'OVERDUE',
    'Void': 'VOID',
  };
  return map[status] || 'OPEN';
}
