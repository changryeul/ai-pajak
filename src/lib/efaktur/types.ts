export type FakturStatus = 'DRAFT' | 'APPROVED' | 'ISSUED' | 'VOID' | 'REPLACED';
export type FakturTransactionType = 'OUTPUT' | 'INPUT';

export interface FakturLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  dpp: number;
  ppnAmount: number;
  ppnbmAmount?: number;
  isLuxury?: boolean;
}

export interface FakturPajak {
  id: string;
  customerId: string;
  consultantId?: string;
  transactionType: FakturTransactionType;
  serialNumber?: string;
  buyerNpwp: string;
  buyerName: string;
  buyerAddress?: string;
  sellerNpwp: string;
  sellerName: string;
  dpp: number;
  ppnAmount: number;
  ppnbmAmount: number;
  totalAmount: number;
  items: FakturLineItem[];
  status: FakturStatus;
  issueDate?: string;
  voidDate?: string;
  voidReason?: string;
  djpApprovalCode?: string;
  taxFilingId?: string;
  taxPeriod?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFakturRequest {
  transactionType: FakturTransactionType;
  buyerNpwp: string;
  buyerName: string;
  buyerAddress?: string;
  sellerNpwp: string;
  sellerName: string;
  items: FakturLineItem[];
  taxPeriod: string;
}

export interface FakturSummary {
  totalOutput: number;
  totalInput: number;
  netPayable: number;
  outputCount: number;
  inputCount: number;
  period: string;
}
