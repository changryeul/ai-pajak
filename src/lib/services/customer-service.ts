/**
 * Customer Service
 * Business logic for customer management operations
 */

import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type Customer = Database['public']['Tables']['customer']['Row'];
type CustomerInsert = Database['public']['Tables']['customer']['Insert'];
type CustomerUpdate = Database['public']['Tables']['customer']['Update'];

export interface CustomerWithRelations extends Customer {
  user?: {
    email: string;
  };
  tax_filings_count?: number;
  active_poa?: boolean;
}

export interface ListCustomersParams {
  page?: number;
  limit?: number;
  search?: string;
  customerType?: 'INDIVIDUAL' | 'COMPANY';
  consultantId?: string;
  sortBy?: 'created_at' | 'full_name' | 'company_name';
  sortOrder?: 'asc' | 'desc';
}

export interface ListCustomersResult {
  customers: CustomerWithRelations[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * List customers with pagination and filters
 */
export async function listCustomers(
  params: ListCustomersParams
): Promise<ListCustomersResult> {
  const {
    page = 1,
    limit = 20,
    search,
    customerType,
    consultantId,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = params;

  const supabase = await createClient();
  const offset = (page - 1) * limit;

  // Build query
  let query = supabase
    .from('customer')
    .select('*', { count: 'exact' });

  // Apply filters
  if (search) {
    query = query.or(
      `full_name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%,npwp.ilike.%${search}%`
    );
  }

  if (customerType) {
    query = query.eq('customer_type', customerType);
  }

  // If consultantId is provided, filter by assigned customers
  if (consultantId) {
    // Get assigned customer IDs
    const { data: assignments } = await supabase
      .from('customer_consultant')
      .select('customer_id')
      .eq('consultant_id', consultantId)
      .eq('is_active', true);

    const customerIds = assignments?.map(a => a.customer_id) || [];

    if (customerIds.length === 0) {
      return {
        customers: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    query = query.in('id', customerIds);
  }

  // Apply sorting
  query = query.order(sortBy, { ascending: sortOrder === 'asc' });

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to list customers: ${error.message}`);
  }

  const total = count || 0;

  return {
    customers: data || [],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get customer by ID
 */
export async function getCustomer(
  customerId: string
): Promise<CustomerWithRelations | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('customer')
    .select('*')
    .eq('id', customerId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get customer: ${error.message}`);
  }

  // Get tax filings count
  const { count: filingsCount } = await supabase
    .from('tax_filing')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId);

  // Check for active POA
  const { data: activePoa } = await supabase
    .from('power_of_attorney')
    .select('id')
    .eq('customer_id', customerId)
    .eq('status', 'ACTIVE')
    .limit(1)
    .single();

  return {
    ...data,
    tax_filings_count: filingsCount || 0,
    active_poa: !!activePoa,
  };
}

/**
 * Create a new customer
 */
export async function createCustomer(
  data: CustomerInsert
): Promise<Customer> {
  const supabase = await createClient();

  // Validate NPWP format if provided
  if (data.npwp && !isValidNpwp(data.npwp)) {
    throw new Error('Invalid NPWP format. Expected format: XX.XXX.XXX.X-XXX.XXX');
  }

  const { data: customer, error } = await supabase
    .from('customer')
    .insert(data)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create customer: ${error.message}`);
  }

  return customer;
}

/**
 * Update a customer
 */
export async function updateCustomer(
  customerId: string,
  data: CustomerUpdate
): Promise<Customer> {
  const supabase = await createClient();

  // Validate NPWP format if provided
  if (data.npwp && !isValidNpwp(data.npwp)) {
    throw new Error('Invalid NPWP format. Expected format: XX.XXX.XXX.X-XXX.XXX');
  }

  const { data: customer, error } = await supabase
    .from('customer')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', customerId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update customer: ${error.message}`);
  }

  return customer;
}

/**
 * Delete a customer (soft delete recommended)
 */
export async function deleteCustomer(
  customerId: string,
  softDelete: boolean = true
): Promise<void> {
  const supabase = await createClient();

  // Check if customer has tax filings
  const { count } = await supabase
    .from('tax_filing')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId);

  if (count && count > 0 && !softDelete) {
    throw new Error('Cannot delete customer with existing tax filings. Use soft delete instead.');
  }

  if (softDelete) {
    // For soft delete, we could add a deleted_at column
    // For now, we'll just mark user as inactive in user_roles
    const { data: customer } = await supabase
      .from('customer')
      .select('user_id')
      .eq('id', customerId)
      .single();

    if (customer) {
      await supabase
        .from('user_roles')
        .update({ is_active: false })
        .eq('user_id', customer.user_id)
        .eq('role', 'CUSTOMER');
    }
  } else {
    const { error } = await supabase
      .from('customer')
      .delete()
      .eq('id', customerId);

    if (error) {
      throw new Error(`Failed to delete customer: ${error.message}`);
    }
  }
}

/**
 * Assign a consultant to a customer
 */
export async function assignConsultant(
  customerId: string,
  consultantId: string,
  assignedBy: string
): Promise<void> {
  const supabase = await createClient();

  // Check if assignment already exists
  const { data: existing } = await supabase
    .from('customer_consultant')
    .select('id, is_active')
    .eq('customer_id', customerId)
    .eq('consultant_id', consultantId)
    .single();

  if (existing) {
    if (existing.is_active) {
      throw new Error('Consultant is already assigned to this customer');
    }

    // Reactivate existing assignment
    await supabase
      .from('customer_consultant')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    // Create new assignment
    const { error } = await supabase
      .from('customer_consultant')
      .insert({
        customer_id: customerId,
        consultant_id: consultantId,
        assigned_by_user_id: assignedBy,
        is_active: true,
      });

    if (error) {
      throw new Error(`Failed to assign consultant: ${error.message}`);
    }
  }
}

/**
 * Unassign a consultant from a customer
 */
export async function unassignConsultant(
  customerId: string,
  consultantId: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('customer_consultant')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('customer_id', customerId)
    .eq('consultant_id', consultantId);

  if (error) {
    throw new Error(`Failed to unassign consultant: ${error.message}`);
  }
}

/**
 * Get tax filings for a customer
 */
export async function getCustomerFilings(
  customerId: string,
  params?: { page?: number; limit?: number; status?: string; taxType?: string }
) {
  const supabase = await createClient();
  const { page = 1, limit = 20, status, taxType } = params || {};
  const offset = (page - 1) * limit;

  let query = supabase
    .from('tax_filing')
    .select(`
      id,
      tax_type,
      tax_period,
      status,
      created_at,
      updated_at,
      filed_at,
      bpe_number,
      consultant:consultant_id (
        id,
        full_name
      )
    `, { count: 'exact' })
    .eq('customer_id', customerId);

  if (status) {
    query = query.eq('status', status);
  }

  if (taxType) {
    query = query.eq('tax_type', taxType);
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to get customer filings: ${error.message}`);
  }

  return {
    filings: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

/**
 * Validate NPWP format
 * Format: XX.XXX.XXX.X-XXX.XXX
 */
function isValidNpwp(npwp: string): boolean {
  const npwpRegex = /^\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}$/;
  return npwpRegex.test(npwp);
}
