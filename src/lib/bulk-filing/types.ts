export type BulkFilingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PARTIAL';

export interface BulkFilingItem {
  customerId: string;
  customerName: string;
  taxType: string;
  taxPeriod: string;
  taxYear: number;
  status: 'pending' | 'success' | 'error';
  filingId?: string;
  error?: string;
}

export interface BulkFilingJob {
  id: string;
  consultantId: string;
  taxAdvisorId?: string;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  status: BulkFilingStatus;
  items: BulkFilingItem[];
  createdAt: string;
  completedAt?: string;
}

export interface BulkFilingRequest {
  customerIds: string[];
  taxType: string;
  taxPeriod: string;
  taxYear: number;
}
