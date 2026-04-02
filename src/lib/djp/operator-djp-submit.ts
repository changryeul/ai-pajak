/**
 * Operator DJP Submission
 *
 * Bridges the operator queue (djp_submission_queue) with the DJP job system (djp_job).
 * When operator clicks "Submit to DJP", this creates the necessary tax_filing
 * record and queues an E_FILING job.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { queueDJPJob } from './queue';
import type { EFilingRequest, SPTType } from './types';

interface QueueItemForDJP {
  id: string;
  customer_id: string;
  tax_type: string;
  tax_period_month: number;
  tax_period_year: number;
  amount: number;
  operator_id: string | null;
}

interface DJPSubmitResult {
  success: boolean;
  jobId?: string;
  taxFilingId?: string;
  error?: string;
}

/**
 * Map operator queue tax_type to DJP SPT type.
 */
function mapToSPTType(taxType: string): SPTType {
  const mapping: Record<string, SPTType> = {
    'PPh21': 'SPT_MASA_PPH21',
    'PPh23': 'SPT_MASA_PPH23',
    'PPh25': 'SPT_MASA_PPH21',  // fallback to PPh21
    'PPh29': 'SPT_TAHUNAN_1770',
    'PPN': 'SPT_MASA_PPN',
    'SPT1770SS': 'SPT_TAHUNAN_1770SS',
    'SPT1770S': 'SPT_TAHUNAN_1770S',
    'SPT1770': 'SPT_TAHUNAN_1770',
    'SPT1771': 'SPT_TAHUNAN_1771',
  };
  return mapping[taxType] || 'SPT_MASA_PPH21';
}

/**
 * Submit a queue item to DJP via the job queue system.
 */
export async function submitQueueItemToDJP(
  admin: SupabaseClient,
  queueItem: QueueItemForDJP,
  submittedByUserId: string
): Promise<DJPSubmitResult> {
  try {
    // 1. Get customer details
    const { data: customer } = await admin
      .from('customer')
      .select('id, user_id, full_name, customer_name, npwp, nik, address, phone, email, customer_type')
      .eq('id', queueItem.customer_id)
      .single();

    if (!customer || !customer.npwp) {
      return { success: false, error: 'Customer not found or NPWP missing' };
    }

    // 2. Check for existing tax_filing or create one
    const taxPeriod = queueItem.tax_type.startsWith('SPT17')
      ? `${queueItem.tax_period_year}`
      : `${queueItem.tax_period_year}-${String(queueItem.tax_period_month).padStart(2, '0')}`;

    let taxFilingId: string;

    const { data: existingFiling } = await admin
      .from('tax_filing')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('tax_type', queueItem.tax_type)
      .eq('tax_period', taxPeriod)
      .eq('tax_year', queueItem.tax_period_year)
      .maybeSingle();

    if (existingFiling) {
      taxFilingId = existingFiling.id;
      // Update status to indicate DJP submission
      await admin
        .from('tax_filing')
        .update({
          status: 'PENDING_SUBMISSION',
          djp_submission_status: 'PENDING',
          updated_at: new Date().toISOString(),
        })
        .eq('id', taxFilingId);
    } else {
      // Create tax_filing from queue data
      const { data: newFiling, error: createError } = await admin
        .from('tax_filing')
        .insert({
          customer_id: customer.id,
          tax_type: queueItem.tax_type,
          tax_period: taxPeriod,
          tax_year: queueItem.tax_period_year,
          total_income: queueItem.amount,
          tax_due: queueItem.amount,
          status: 'PENDING_SUBMISSION',
          djp_submission_status: 'PENDING',
          tax_data: {
            source: 'operator_queue',
            queueItemId: queueItem.id,
            amount: queueItem.amount,
          },
        })
        .select('id')
        .single();

      if (createError || !newFiling) {
        return { success: false, error: `Failed to create tax_filing: ${createError?.message}` };
      }
      taxFilingId = newFiling.id;
    }

    // 3. Get tax partner info (consultant's org)
    let consultantNpwp = '';
    let consultantName = '';
    let licenseNumber = '';

    if (queueItem.operator_id) {
      const { data: operator } = await admin
        .from('tax_operators')
        .select('user_id')
        .eq('id', queueItem.operator_id)
        .single();

      if (operator) {
        const { data: consultant } = await admin
          .from('consultant')
          .select('full_name, tax_partner:tax_partner_id(name, npwp, tax_license_number)')
          .eq('user_id', operator.user_id)
          .maybeSingle();

        if (consultant) {
          consultantName = consultant.full_name || '';
          const tp = consultant.tax_partner as { name?: string; npwp?: string; tax_license_number?: string } | null;
          if (tp) {
            consultantNpwp = tp.npwp || '';
            licenseNumber = tp.tax_license_number || '';
          }
        }
      }
    }

    // 4. Build EFilingRequest
    const sptType = mapToSPTType(queueItem.tax_type);
    const eFilingRequest: EFilingRequest = {
      npwp: customer.npwp,
      taxYear: queueItem.tax_period_year,
      taxPeriod: taxPeriod,
      sptType,
      correctionNumber: 0,
      sptData: {
        identitasWP: {
          npwp: customer.npwp,
          nama: customer.full_name || customer.customer_name || '',
          alamat: customer.address || '',
          kota: '',
          statusWP: customer.customer_type === 'INDIVIDUAL' ? 'OP' : 'BADAN',
        },
        periodeData: {
          tahunPajak: queueItem.tax_period_year,
          masaPajak: `${String(queueItem.tax_period_month).padStart(2, '0')}`,
          pembetulanKe: 0,
        },
        detailData: {
          jumlahPegawaiTetap: 0,
          jumlahPenerimaUpah: 0,
          penghasilanBruto: queueItem.amount,
          pphTerutang: queueItem.amount,
          pphDipotong: 0,
          pphDisetor: queueItem.amount,
        },
      },
      submittedBy: {
        npwp: consultantNpwp,
        name: consultantName,
        licenseNumber,
      },
    };

    // 5. Queue DJP job
    const jobId = await queueDJPJob({
      type: 'E_FILING',
      taxFilingId,
      customerId: customer.id,
      payload: eFilingRequest,
      priority: 'NORMAL',
    });

    // 6. Link job to queue item
    await admin
      .from('djp_submission_queue')
      .update({
        djp_job_id: jobId,
        tax_filing_id: taxFilingId,
        submitted_to_djp_at: new Date().toISOString(),
        submitted_to_djp_by: submittedByUserId,
      })
      .eq('id', queueItem.id);

    return { success: true, jobId, taxFilingId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[OperatorDJPSubmit] Failed:', message);
    return { success: false, error: message };
  }
}
