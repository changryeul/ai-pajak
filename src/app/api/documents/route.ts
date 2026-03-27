import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * List Documents
 *
 * Lists documents for the authenticated user.
 * Can filter by taxFilingId to get documents for a specific filing.
 *
 * @route GET /api/documents
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taxFilingId = searchParams.get('taxFilingId');
    const documentType = searchParams.get('documentType');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    // Validate pagination
    const validLimit = Math.min(Math.max(limit, 1), 100);
    const validOffset = Math.max(offset, 0);

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Build query
    // Query from tax_document table
    let query = supabase
      .from('tax_document')
      .select(`
        id,
        tax_filing_id,
        document_type,
        file_name,
        mime_type,
        file_size_bytes,
        ocr_data,
        uploaded_at,
        created_at,
        tax_filing:tax_filing_id (
          id,
          tax_type,
          tax_period,
          status,
          customer_id
        )
      `, { count: 'exact' });

    // Apply filters
    if (taxFilingId) {
      query = query.eq('tax_filing_id', taxFilingId);
    }

    if (documentType) {
      query = query.eq('document_type', documentType);
    }

    // Filter by user access
    // Get user's customer and consultant records
    const { data: customer } = await supabase
      .from('customer')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const { data: consultant } = await supabase
      .from('consultant')
      .select('id')
      .eq('user_id', user.id)
      .single();

    // If user is a customer, only show their documents
    let hasFilings = true;
    if (customer && !consultant) {
      // Get tax filing IDs for this customer
      const { data: filings } = await supabase
        .from('tax_filing')
        .select('id')
        .eq('customer_id', customer.id);

      const filingIds = filings?.map(f => f.id) || [];

      if (filingIds.length === 0) {
        hasFilings = false;
      } else {
        query = query.in('tax_filing_id', filingIds);
      }
    }

    // If user is a consultant, show documents for their assigned customers
    if (consultant) {
      const { data: filings } = await supabase
        .from('tax_filing')
        .select('id')
        .eq('consultant_id', consultant.id);

      const filingIds = filings?.map(f => f.id) || [];

      if (filingIds.length === 0 && !customer) {
        return NextResponse.json({
          success: true,
          data: [],
          pagination: {
            page,
            limit: validLimit,
            total: 0,
            totalPages: 0,
          },
        });
      }

      // If also a customer, include their own documents
      if (customer) {
        const { data: customerFilings } = await supabase
          .from('tax_filing')
          .select('id')
          .eq('customer_id', customer.id);

        const customerFilingIds = customerFilings?.map(f => f.id) || [];
        const allFilingIds = [...new Set([...filingIds, ...customerFilingIds])];
        query = query.in('tax_filing_id', allFilingIds);
      } else {
        query = query.in('tax_filing_id', filingIds);
      }
    }

    // Apply pagination and ordering
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let documents: any[] = [];
    let total = 0;

    if (hasFilings) {
      query = query
        .order('created_at', { ascending: false })
        .range(validOffset, validOffset + validLimit - 1);

      const { data, error: queryError, count } = await query;
      if (queryError) {
        console.error('List documents error:', queryError);
      }
      documents = data || [];
      total = count || 0;
    }

    const totalPages = Math.ceil(total / validLimit);

    interface TaxFilingInfo {
      id: string;
      tax_type: string;
      tax_period: string;
      status: string;
      customer_id: string;
    }

    // Also fetch standalone documents from document table
    let standaloneDocsData: Array<{
      id: string;
      document_type: string;
      file_name: string;
      mime_type: string;
      file_size_bytes: number;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }> = [];

    if (customer) {
      const { data: sDocs } = await supabase
        .from('document')
        .select('id, document_type, file_name, mime_type, file_size_bytes, metadata, created_at')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(validLimit);

      standaloneDocsData = sDocs || [];
    }

    // Map tax_document results
    const taxDocs = documents?.map(doc => {
      const taxFilingData = doc.tax_filing as TaxFilingInfo | TaxFilingInfo[] | null;
      const taxFiling = Array.isArray(taxFilingData) ? taxFilingData[0] : taxFilingData;
      return {
        id: doc.id,
        taxFilingId: doc.tax_filing_id,
        documentType: doc.document_type,
        fileName: doc.file_name,
        mimeType: doc.mime_type,
        size: doc.file_size_bytes,
        hasOcrData: !!doc.ocr_data,
        uploadedAt: doc.uploaded_at || doc.created_at,
        aiClassification: null as null | { category: string; confidence: number },
        taxFiling: taxFiling ? {
          id: taxFiling.id,
          taxType: taxFiling.tax_type,
          taxPeriod: taxFiling.tax_period,
          status: taxFiling.status,
        } : null,
      };
    }) || [];

    // Map standalone document results
    const standaloneMapped = standaloneDocsData.map(doc => {
      const meta = doc.metadata as { ai_classification?: { category: string; confidence: number }; original_document_type?: string } | null;
      return {
        id: doc.id,
        taxFilingId: null,
        documentType: meta?.original_document_type || doc.document_type,
        fileName: doc.file_name,
        mimeType: doc.mime_type,
        size: doc.file_size_bytes,
        hasOcrData: false,
        uploadedAt: doc.created_at,
        aiClassification: meta?.ai_classification || null,
        taxFiling: null,
      };
    });

    // Merge and sort by date
    const allDocs = [...taxDocs, ...standaloneMapped]
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .slice(0, validLimit);

    return NextResponse.json({
      success: true,
      data: allDocs,
      pagination: {
        page,
        limit: validLimit,
        total: total + standaloneDocsData.length,
        totalPages: Math.ceil((total + standaloneDocsData.length) / validLimit),
      },
    });
  } catch (error) {
    console.error('List documents error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list documents',
      },
      { status: 500 }
    );
  }
}
