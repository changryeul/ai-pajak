import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Employee Self-Service API
 *
 * Allows employees to update their own tax information:
 * - Upload NPWP
 * - Update NIK
 * - Update PTKP status (marriage/dependents)
 * - View their own PPh 21 calculation
 *
 * GET /api/employee/self-service - Get own employee data
 * PUT /api/employee/self-service - Update own data
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get customer record (employee is also a customer)
    const { data: customer } = await getSupabaseAdmin()
      .from('customer')
      .select('id, full_name, npwp, nik, address, phone, email, customer_type, created_at')
      .eq('user_id', user.id)
      .single();

    if (!customer) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
    }

    // Get latest tax calculation
    const { data: latestCalc } = await getSupabaseAdmin()
      .from('tax_calculation')
      .select('tax_year, calculation_result, created_at')
      .eq('customer_id', customer.id)
      .eq('tax_type', 'PPh21')
      .order('tax_year', { ascending: false })
      .limit(1)
      .single();

    // Get document count
    const { count: docCount } = await getSupabaseAdmin()
      .from('tax_document')
      .select('id', { count: 'exact', head: true })
      .eq('uploaded_by_user_id', user.id);

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          name: customer.full_name,
          npwp: customer.npwp,
          nik: customer.nik,
          address: customer.address,
          phone: customer.phone,
          email: customer.email,
          hasNpwp: !!customer.npwp,
          hasNik: !!customer.nik,
          completionPercent: calculateCompletion(customer),
        },
        latestTax: latestCalc ? {
          year: latestCalc.tax_year,
          result: latestCalc.calculation_result,
        } : null,
        documentCount: docCount || 0,
        requiredActions: getRequiredActions(customer),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get employee data' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { npwp, nik, phone, address } = body;

    // Validate NPWP format
    if (npwp && !/^\d{2}\.\d{3}\.\d{3}\.\d{1}-\d{3}\.\d{3}$/.test(npwp)) {
      return NextResponse.json({ error: 'Format NPWP tidak valid (XX.XXX.XXX.X-XXX.XXX)' }, { status: 400 });
    }

    // Validate NIK format
    if (nik && !/^\d{16}$/.test(nik)) {
      return NextResponse.json({ error: 'NIK harus 16 digit angka' }, { status: 400 });
    }

    const updateData: Record<string, string> = {};
    if (npwp !== undefined) updateData.npwp = npwp;
    if (nik !== undefined) updateData.nik = nik;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;

    const { error } = await getSupabaseAdmin()
      .from('customer')
      .update(updateData)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Data updated successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update data' }, { status: 500 });
  }
}

function calculateCompletion(customer: Record<string, unknown>): number {
  let score = 0;
  const total = 5;
  if (customer.full_name) score++;
  if (customer.npwp) score++;
  if (customer.nik) score++;
  if (customer.phone) score++;
  if (customer.address) score++;
  return Math.round((score / total) * 100);
}

function getRequiredActions(customer: Record<string, unknown>): string[] {
  const actions: string[] = [];
  if (!customer.npwp) actions.push('Upload atau input NPWP Anda');
  if (!customer.nik) actions.push('Lengkapi NIK (Nomor Induk Kependudukan)');
  if (!customer.phone) actions.push('Tambahkan nomor telepon');
  if (!customer.address) actions.push('Lengkapi alamat');
  return actions;
}
