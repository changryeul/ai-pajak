import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { BulkFilingJob, BulkFilingItem, BulkFilingRequest } from './types';

export class BulkFilingService {
  /**
   * Create bulk filing drafts for multiple customers.
   * Batched queries: ~4 queries total regardless of N (vs 3N before).
   */
  static async createBulkDrafts(
    consultantId: string,
    advisorUserId: string,
    request: BulkFilingRequest
  ): Promise<BulkFilingJob> {
    const admin = getSupabaseAdmin();
    const period = `${request.taxYear}-${request.taxPeriod}`;

    // Batch 1: fetch customer names + assignments + existing filings in parallel
    const [customersResult, assignmentsResult, existingResult] = await Promise.all([
      admin
        .from('customer')
        .select('id, full_name, company_name')
        .in('id', request.customerIds),
      admin
        .from('customer_consultant')
        .select('customer_id')
        .eq('consultant_id', consultantId)
        .eq('is_active', true)
        .in('customer_id', request.customerIds),
      admin
        .from('tax_filing')
        .select('id, customer_id')
        .in('customer_id', request.customerIds)
        .eq('tax_type', request.taxType)
        .eq('tax_period', period),
    ]);

    const customerMap = new Map(
      (customersResult.data || []).map((c) => [c.id, c.full_name || c.company_name || 'Unknown'])
    );
    const assignedSet = new Set((assignmentsResult.data || []).map((a) => a.customer_id));
    const existingMap = new Map(
      (existingResult.data || []).map((f) => [f.customer_id, f.id])
    );

    // Classify items
    const items: BulkFilingItem[] = [];
    const toInsert: { customer_id: string; consultant_id: string; tax_type: string; tax_period: string; status: string; tax_data: object; updated_at: string }[] = [];

    for (const customerId of request.customerIds) {
      const item: BulkFilingItem = {
        customerId,
        customerName: customerMap.get(customerId) || 'Unknown',
        taxType: request.taxType,
        taxPeriod: request.taxPeriod,
        taxYear: request.taxYear,
        status: 'pending',
      };

      if (!assignedSet.has(customerId)) {
        item.status = 'error';
        item.error = 'Not assigned to this customer';
      } else if (existingMap.has(customerId)) {
        item.status = 'error';
        item.error = 'Filing already exists for this period';
        item.filingId = existingMap.get(customerId);
      } else {
        toInsert.push({
          customer_id: customerId,
          consultant_id: consultantId,
          tax_type: request.taxType,
          tax_period: period,
          status: 'DRAFT',
          tax_data: {},
          updated_at: new Date().toISOString(),
        });
      }

      items.push(item);
    }

    // Batch 2: insert all valid filings at once
    if (toInsert.length > 0) {
      const { data: inserted, error } = await admin
        .from('tax_filing')
        .insert(toInsert)
        .select('id, customer_id');

      if (error) {
        // Mark all pending as failed
        for (const item of items) {
          if (item.status === 'pending') {
            item.status = 'error';
            item.error = error.message;
          }
        }
      } else if (inserted) {
        const insertedMap = new Map(inserted.map((f) => [f.customer_id, f.id]));
        for (const item of items) {
          if (item.status === 'pending') {
            const filingId = insertedMap.get(item.customerId);
            if (filingId) {
              item.status = 'success';
              item.filingId = filingId;
            } else {
              item.status = 'error';
              item.error = 'Insert succeeded but ID not returned';
            }
          }
        }

        // Batch 3: audit logs for all created filings
        const auditRows = inserted.map((f) => ({
          customer_id: f.customer_id,
          tax_filing_id: f.id,
          actor_user_id: advisorUserId,
          actor_role: 'TAX_ADVISOR',
          activity_type: 'CREATE',
          tax_type: request.taxType,
          tax_period: period,
          activity_details: { bulk: true, consultant_id: consultantId },
          created_at: new Date().toISOString(),
        }));
        await admin.from('tax_activity_log').insert(auditRows);
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
   * Get assigned customers for bulk filing selection
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

    const [customersResult, pendingResult] = await Promise.all([
      admin.from('customer').select('id, full_name, company_name, npwp').in('id', customerIds),
      admin.from('tax_filing').select('customer_id').in('customer_id', customerIds).eq('status', 'DRAFT'),
    ]);

    const pendingSet = new Set((pendingResult.data || []).map((f) => f.customer_id));

    return (customersResult.data || []).map((c) => ({
      id: c.id,
      fullName: c.full_name || c.company_name || '',
      npwp: c.npwp || '',
      hasPendingFiling: pendingSet.has(c.id),
    }));
  }
}
