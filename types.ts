
export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  CONSULTANT = 'CONSULTANT',
  JTC_ADVISOR = 'JTC_ADVISOR',
  JTC_OPERATOR = 'JTC_OPERATOR'
}

export enum CustomerType {
  CORPORATE = 'CORPORATE',
  INDIVIDUAL = 'INDIVIDUAL', // Standard 1770 (Business/Professional)
  INDIVIDUAL_S = 'INDIVIDUAL_S', // 1770S (Employee > 60M)
  INDIVIDUAL_SS = 'INDIVIDUAL_SS', // 1770SS (Employee < 60M)
  NON_PROFIT = 'NON_PROFIT'
}

export enum BusinessSector {
  TRADING = 'TRADING', 
  RESTAURANT = 'RESTAURANT', 
  HOTEL = 'HOTEL', 
  SERVICE = 'SERVICE', 
  ENTERTAINMENT = 'ENTERTAINMENT', 
  OTHERS = 'OTHERS'
}

export enum TaxRegime {
  UMKM_05 = 'UMKM_05', 
  GENERAL_BOOKKEEPING = 'GENERAL_BOOKKEEPING' 
}

export enum TaxStatus {
  PENDING_DATA = 'PENDING_DATA',
  AI_PROPOSED = 'AI_PROPOSED',
  AWAITING_ADVISOR_APPROVAL = 'AWAITING_ADVISOR_APPROVAL',
  AWAITING_ID_BILLING_ISSUANCE = 'AWAITING_ID_BILLING_ISSUANCE',
  WAITING_FEE_PAYMENT = 'WAITING_FEE_PAYMENT',
  WAITING_TAX_PAYMENT = 'WAITING_TAX_PAYMENT',
  WAITING_NTPN_UPLOAD = 'WAITING_NTPN_UPLOAD',
  WAITING_FILING = 'WAITING_FILING',
  FILED = 'FILED'
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isActionRequest?: boolean;
}

export interface AssignmentHistory {
  timestamp: string;
  fromStaffId?: string;
  toStaffId: string;
  action: string;
}

export interface TaxDataRow {
  id: string;
  label: string;
  partnerName?: string;
  partnerNpwp?: string;
  baseAmount: number;
  taxType: string;
  rate: number;
  taxAmount: number;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  sourceFile?: string;
  aiSuggested?: {
    taxType: string;
    rate: number;
    reason: string;
  };
}

export interface TaxFiling {
  id: string;
  type: string;
  period: string;
  amount: number;
  status: TaxStatus;
  dueDate: string;
  idBilling?: string;
  ntpn?: string;
  bpn?: string;
  clientName?: string;
  clientId?: string;
  assignedStaffId?: string;
  history?: AssignmentHistory[];
  chatHistory?: ChatMessage[];
  aiReasoning?: string;
  missingDocs?: string[];
  serviceFeePaid?: boolean;
  submittedData?: TaxDataRow[];
  uploadedFiles?: { name: string; type: string; url: string }[];
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  npwp?: string;
  customerType?: CustomerType;
  taxRegime?: TaxRegime;
  businessSector?: BusinessSector;
  businessStartDate?: string;
  annualRevenue?: number;
}

export interface StaffMember {
  id: string;
  name: string;
  role: UserRole;
  activeTasks: number;
  completedTasks: number;
  status: 'ONLINE' | 'BUSY' | 'OFFLINE';
  performance: number;
}

export enum PartnerType {
  VENDOR = 'VENDOR',
  CLIENT = 'CLIENT'
}

export interface Partner {
  id: string;
  name: string;
  npwp: string;
  type: PartnerType;
  email: string;
  address: string;
}

export type TaxType = 'WHT' | 'PPN' | 'PPh OP' | 'PPh Badan' | 'Pajak Daerah';

export interface TaxCatalogItem {
  id: TaxType;
  icon: string;
  labelKey: 'whtLabel' | 'ppnLabel' | 'opLabel' | 'corporateLabel' | 'localTaxLabel';
  descriptionKey: 'whtDesc' | 'ppnDesc' | 'opDesc' | 'corporateDesc' | 'localTaxDesc';
}

export const TAX_CATALOG: TaxCatalogItem[] = [
  { id: 'WHT', icon: '🧾', labelKey: 'whtLabel', descriptionKey: 'whtDesc' },
  { id: 'PPN', icon: '🛍️', labelKey: 'ppnLabel', descriptionKey: 'ppnDesc' },
  { id: 'PPh OP', icon: '👤', labelKey: 'opLabel', descriptionKey: 'opDesc' },
  { id: 'PPh Badan', icon: '🏢', labelKey: 'corporateLabel', descriptionKey: 'corporateDesc' },
  { id: 'Pajak Daerah', icon: '🏨', labelKey: 'localTaxLabel', descriptionKey: 'localTaxDesc' },
];
