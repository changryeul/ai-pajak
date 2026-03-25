import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { BulkFilingJob, BulkFilingItem, BulkFilingRequest } from './types';

export class BulkFilingService {
  /**
   * Create bulk filing drafts for multiple customers
   * Only TAX_ADVISOR_JTC can use this
   */
  static async createBulkDrafts(
    consultantId: string,
    advisorUserId: string,
    request: BulkFilingRequest
  ): Promise<BulkFilingJob> {
    const admin = getSupabaseAdmin();
    const items: BulkFilingItem[] = [];

    // Fetch customer names
    const { data: customers } = await admin
      .from('customer')
      .select('id, full_name, company_name')
      .in('id', request.customerIds);

    const customerMap = new Map(
      (customers || []).map((c) => [c.id, c.full_name || c.company_name || 'Unknown'])
    );

    // Verify consultant has assignment to all customers
    const { data: assignments } = await admin
      .from('customer_consultant')
      .select('customer_id')
      .eq('consultant_id', consultantId)
      .eq('is_active', true)
      .in('customer_id', request.customerIds);

    const assignedSet = new Set((assignments || []).map((a) => a.customer_id));

    // Process each customer
    for (const customerId of request.customerIds) {
      const item: BulkFilingItem = {
        customerId,
        customerName: customerMap.get(customerId) || 'Unknown',
        taxType: request.taxType,
        taxPeriod: request.taxPeriod,
        taxYear: request.taxYear,
        status: 'pending',
      };

      // Check assignment
      if (!assignedSet.has(customerId)) {
        item.status = 'error';
        item.error = 'Not assigned to this customer';
        items.push(item);
        continue;
      }

      // Check for existing filing (avoid duplicates)
      const { data: existing } = await admin
        .from('tax_filing')
        .select('id')
        .eq('customer_id', customerId)
        .eq('tax_type', request.taxType)
        .eq('tax_period', `${request.taxYear}-${request.taxPeriod}`)
        .maybeSingle();

      if (existing) {
        item.status = 'error';
        item.error = 'Filing already exists for this period';
        item.filingId = existing.id;
        items.push(item);
        continue;
      }

      // Create draft filing
      try {
        const { data: filing, error } = await admin
          .from('tax_filing')
          .insert({
            customer_id: customerId,
            consultant_id: consultantId,
            tax_type: request.taxType,
            tax_period: `${request.taxYear}-${request.taxPeriod}`,
            status: 'DRAFT',
            tax_data: {},
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (error) {
          item.status = 'error';
          item.error = error.message;
        } else {
          item.status = 'success';
          item.filingId = filing.id;
        }
      } catch (err) {
        item.status = 'error';
        item.error = err instanceof Error ? err.message : 'Unknown error';
      }

      items.push(item);

      // Audit log for each created filing
      if (item.status === 'success') {
        await admin.from('tax_activity_log').insert({
          customer_id: customerId,
          tax_filing_id: item.filingId,
          actor_user_id: advisorUserId,
          actor_role: 'TAX_ADVISOR_JTC',
          activity_type: 'CREATE',
          tax_type: request.taxType,
          tax_period: `${request.taxYear}-${request.taxPeriod}`,
          activity_details: { bulk: true, consultant_id: consultantId },
          created_at: new Date().toISOString(),
        });
      }
    }

    const completed = items.filter((i) => i.status === 'success').length;
    const failed = items.filter((i) => i.status === 'error').length;

    return {
      id: crypto.randomUUID(),
      consultantId,
      totalItems: items.length,
      completedItems: completed,
      failedItems: failed,
      status: failed === items.length ? 'FAILED' : failed > 0 ? 'PARTIAL' : 'COMPLETED',
      items,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Get summary of assigned customers for bulk filing selection
   */
  static async getAssignedCustomers(consultantId: string): Promise<{
    id: string;
    fullName: string;
    npwp: string;
    hasPendingFiling: boolean;
  }[]> {
    const admin = getSupabaseAdmin();

    const { data: assignments } = await admin
      .from('customer_consultant')
      .select('customer_id')
      .eq('consultant_id', consultantId)
      .eq('is_active', true);

    if (!assignments?.length) return [];

    const customerIds = assignments.map((a) => a.customer_id);

    const { data: customers } = await admin
      .from('customer')
      .select('id, full_name, company_name, npwp')
      .in('id', customerIds);

    // Check pending filings
    const { data: pendingFilings } = await admin
      .from('tax_filing')
      .select('customer_id')
      .in('customer_id', customerIds)
      .eq('status', 'DRAFT');

    const pendingSet = new Set((pendingFilings || []).map((f) => f.customer_id));

    return (customers || []).map((c) => ({
      id: c.id,
      fullName: c.full_name || c.company_name || '',
      npwp: c.npwp || '',
      hasPendingFiling: pendingSet.has(c.id),
    }));
  }
}
