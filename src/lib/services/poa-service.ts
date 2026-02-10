import { createClient } from '@/lib/supabase/server';

export type POAStatus =
  | 'DRAFT'
  | 'PENDING_SIGNATURE'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'REVOKED'
  | 'REJECTED';

export type POAScope =
  | 'ALL_TAX_TYPES'
  | 'PPh21_ONLY'
  | 'PPh23_ONLY'
  | 'PPN_ONLY'
  | 'SPT_TAHUNAN_ONLY'
  | 'CUSTOM';

export interface POA {
  id: string;
  poa_number: string;
  customer_id: string;
  tax_partner_id: string;
  scope: POAScope;
  scope_details: Record<string, unknown> | null;
  valid_from: string;
  valid_to: string;
  document_url: string;
  document_hash: string | null;
  status: POAStatus;
  customer_signed_at: string | null;
  customer_signature_url: string | null;
  customer_ip_address: string | null;
  tax_partner_signed_at: string | null;
  tax_partner_signed_by_user_id: string | null;
  tax_partner_signature_url: string | null;
  revoked_at: string | null;
  revoked_by_user_id: string | null;
  revocation_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface POAWithRelations extends POA {
  customer?: {
    id: string;
    full_name: string;
    company_name: string | null;
    email: string;
    npwp: string | null;
    customer_type: string;
  };
  tax_partner?: {
    id: string;
    name: string;
    tax_license_number: string;
  };
}

export interface ListPOAsParams {
  page?: number;
  limit?: number;
  customerId?: string;
  taxPartnerId?: string;
  status?: POAStatus;
  sortBy?: 'created_at' | 'valid_from' | 'valid_to';
  sortOrder?: 'asc' | 'desc';
}

export interface ListPOAsResult {
  poas: POAWithRelations[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export async function listPOAs(params: ListPOAsParams): Promise<ListPOAsResult> {
  const supabase = await createClient();

  const {
    page = 1,
    limit = 20,
    customerId,
    taxPartnerId,
    status,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = params;

  const offset = (page - 1) * limit;

  let query = supabase
    .from('power_of_attorney')
    .select(
      `
      *,
      customer:customer_id (
        id, full_name, company_name, email, npwp, customer_type
      ),
      tax_partner:tax_partner_id (
        id, name, tax_license_number
      )
    `,
      { count: 'exact' }
    );

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  if (taxPartnerId) {
    query = query.eq('tax_partner_id', taxPartnerId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to list POAs: ${error.message}`);
  }

  return {
    poas: (data || []) as POAWithRelations[],
    page,
    limit,
    total: count || 0,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

export async function getPOA(poaId: string): Promise<POAWithRelations | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('power_of_attorney')
    .select(
      `
      *,
      customer:customer_id (
        id, full_name, company_name, email, npwp, customer_type
      ),
      tax_partner:tax_partner_id (
        id, name, tax_license_number
      )
    `
    )
    .eq('id', poaId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get POA: ${error.message}`);
  }

  return data as POAWithRelations;
}

export interface CreatePOAData {
  customer_id: string;
  tax_partner_id: string;
  scope: POAScope;
  scope_details?: Record<string, unknown>;
  valid_from: string;
  valid_to: string;
  document_url: string;
  document_hash?: string;
  notes?: string;
}

export async function createPOA(data: CreatePOAData): Promise<POA> {
  const supabase = await createClient();

  const { data: poa, error } = await supabase
    .from('power_of_attorney')
    .insert({
      ...data,
      status: 'DRAFT',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create POA: ${error.message}`);
  }

  return poa;
}

export interface CustomerSignData {
  signature_url: string;
  ip_address?: string;
}

export async function customerSignPOA(
  poaId: string,
  data: CustomerSignData
): Promise<POA> {
  const supabase = await createClient();

  // First verify POA is in correct state
  const { data: currentPOA, error: fetchError } = await supabase
    .from('power_of_attorney')
    .select('status, customer_signed_at')
    .eq('id', poaId)
    .single();

  if (fetchError) {
    throw new Error(`POA not found: ${fetchError.message}`);
  }

  if (currentPOA.status !== 'DRAFT') {
    throw new Error(`POA must be in DRAFT status for customer to sign. Current: ${currentPOA.status}`);
  }

  if (currentPOA.customer_signed_at) {
    throw new Error('Customer has already signed this POA');
  }

  const { data: poa, error } = await supabase
    .from('power_of_attorney')
    .update({
      customer_signed_at: new Date().toISOString(),
      customer_signature_url: data.signature_url,
      customer_ip_address: data.ip_address || null,
      status: 'PENDING_SIGNATURE',
    })
    .eq('id', poaId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to sign POA: ${error.message}`);
  }

  return poa;
}

export interface AdvisorSignData {
  signature_url: string;
  signed_by_user_id: string;
}

export async function advisorSignPOA(
  poaId: string,
  data: AdvisorSignData
): Promise<POA> {
  const supabase = await createClient();

  // First verify POA is in correct state
  const { data: currentPOA, error: fetchError } = await supabase
    .from('power_of_attorney')
    .select('status, customer_signed_at, tax_partner_signed_at')
    .eq('id', poaId)
    .single();

  if (fetchError) {
    throw new Error(`POA not found: ${fetchError.message}`);
  }

  if (currentPOA.status !== 'PENDING_SIGNATURE') {
    throw new Error(`POA must be in PENDING_SIGNATURE status. Current: ${currentPOA.status}`);
  }

  if (!currentPOA.customer_signed_at) {
    throw new Error('Customer must sign POA first');
  }

  if (currentPOA.tax_partner_signed_at) {
    throw new Error('Tax partner has already signed this POA');
  }

  const { data: poa, error } = await supabase
    .from('power_of_attorney')
    .update({
      tax_partner_signed_at: new Date().toISOString(),
      tax_partner_signature_url: data.signature_url,
      tax_partner_signed_by_user_id: data.signed_by_user_id,
      status: 'ACTIVE',
    })
    .eq('id', poaId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to sign POA: ${error.message}`);
  }

  return poa;
}

export interface RevokePOAData {
  revoked_by_user_id: string;
  revocation_reason: string;
}

export async function revokePOA(
  poaId: string,
  data: RevokePOAData
): Promise<POA> {
  const supabase = await createClient();

  // First verify POA is in correct state
  const { data: currentPOA, error: fetchError } = await supabase
    .from('power_of_attorney')
    .select('status')
    .eq('id', poaId)
    .single();

  if (fetchError) {
    throw new Error(`POA not found: ${fetchError.message}`);
  }

  if (currentPOA.status !== 'ACTIVE') {
    throw new Error(`Only active POAs can be revoked. Current: ${currentPOA.status}`);
  }

  if (!data.revocation_reason || data.revocation_reason.trim().length < 10) {
    throw new Error('Revocation reason must be at least 10 characters');
  }

  const { data: poa, error } = await supabase
    .from('power_of_attorney')
    .update({
      status: 'REVOKED',
      revoked_at: new Date().toISOString(),
      revoked_by_user_id: data.revoked_by_user_id,
      revocation_reason: data.revocation_reason,
    })
    .eq('id', poaId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to revoke POA: ${error.message}`);
  }

  return poa;
}

export async function rejectPOA(
  poaId: string,
  userId: string,
  reason: string
): Promise<POA> {
  const supabase = await createClient();

  // First verify POA is in correct state
  const { data: currentPOA, error: fetchError } = await supabase
    .from('power_of_attorney')
    .select('status')
    .eq('id', poaId)
    .single();

  if (fetchError) {
    throw new Error(`POA not found: ${fetchError.message}`);
  }

  if (currentPOA.status !== 'PENDING_SIGNATURE') {
    throw new Error(`Only pending POAs can be rejected. Current: ${currentPOA.status}`);
  }

  const { data: poa, error } = await supabase
    .from('power_of_attorney')
    .update({
      status: 'REJECTED',
      revoked_at: new Date().toISOString(),
      revoked_by_user_id: userId,
      revocation_reason: reason,
    })
    .eq('id', poaId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to reject POA: ${error.message}`);
  }

  return poa;
}

export async function getActivePOA(
  customerId: string,
  taxPartnerId: string
): Promise<POA | null> {
  const supabase = await createClient();

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('power_of_attorney')
    .select('*')
    .eq('customer_id', customerId)
    .eq('tax_partner_id', taxPartnerId)
    .eq('status', 'ACTIVE')
    .lte('valid_from', today)
    .gte('valid_to', today)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get active POA: ${error.message}`);
  }

  return data;
}

export async function hasActivePOA(
  customerId: string,
  taxPartnerId: string
): Promise<boolean> {
  const poa = await getActivePOA(customerId, taxPartnerId);
  return poa !== null;
}
