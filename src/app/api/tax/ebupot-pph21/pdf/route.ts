import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loggers } from '@/lib/logger';
import { generateBPNumber1721A1 } from '@/lib/tax/ebupot/pph21-bupot-service';

/**
 * GET /api/tax/ebupot-pph21/pdf?payslipId=xxx&seq=1
 * Returns printable HTML Bukti Potong 1721-A1
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new NextResponse('Unauthorized', { status: 401 });

    const p = new URL(request.url).searchParams;
    const payslipId = p.get('payslipId');
    const seq = Number(p.get('seq')) || 1;
    if (!payslipId) return new NextResponse('payslipId required', { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: ps } = await admin.from('monthly_payslip')
      .select('*, employee:employee_id(employee_name, employee_npwp, employee_nik, ptkp_category)')
      .eq('id', payslipId).single();
    if (!ps) return new NextResponse('Payslip not found', { status: 404 });

    const { data: customer } = await admin.from('customer').select('company_name, full_name, npwp').eq('id', ps.customer_id).single();
    const pemotong = customer?.company_name || customer?.full_name || '-';
    const pemotongNpwp = customer?.npwp || '-';
    const emp = ps.employee as { employee_name: string; employee_npwp?: string; employee_nik?: string; ptkp_category?: string } | null;
    const bpNumber = generateBPNumber1721A1(ps.period, seq);
    const fmtRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Bukti Potong 1721-A1 - ${bpNumber}</title>
<style>
body{font-family:'Courier New',monospace;max-width:700px;margin:30px auto;padding:20px;font-size:12px}
.border-box{border:2px solid #000;padding:12px;margin-bottom:8px}
h1{text-align:center;font-size:14px;text-decoration:underline;margin:5px 0}
h2{text-align:center;font-size:11px;font-weight:normal;margin:3px 0}
.row{display:flex;margin:2px 0}.label{width:170px;font-weight:bold}.value{flex:1}
table{width:100%;border-collapse:collapse;margin:8px 0}
th,td{border:1px solid #000;padding:4px;font-size:10px}
th{background:#f0f0f0}.right{text-align:right}
</style></head><body>
<div class="border-box" style="text-align:center">
<h2>BUKTI PEMOTONGAN PAJAK PENGHASILAN PASAL 21</h2>
<h2>BAGI PEGAWAI TETAP ATAU PENERIMA PENSIUN BERKALA</h2>
<h1>FORMULIR 1721-A1</h1>
<div style="margin-top:8px;font-size:14px;letter-spacing:2px"><b>${bpNumber}</b></div>
</div>

<div class="border-box">
<div style="font-weight:bold;text-decoration:underline;margin-bottom:6px">PEMOTONG PAJAK</div>
<div class="row"><span class="label">Nama</span><span class="value">: ${pemotong}</span></div>
<div class="row"><span class="label">NPWP</span><span class="value">: ${pemotongNpwp}</span></div>
</div>

<div class="border-box">
<div style="font-weight:bold;text-decoration:underline;margin-bottom:6px">PENERIMA PENGHASILAN</div>
<div class="row"><span class="label">Nama</span><span class="value">: ${emp?.employee_name || '-'}</span></div>
<div class="row"><span class="label">NPWP</span><span class="value">: ${emp?.employee_npwp || 'TIDAK ADA'}</span></div>
<div class="row"><span class="label">NIK</span><span class="value">: ${emp?.employee_nik || '-'}</span></div>
<div class="row"><span class="label">Status PTKP</span><span class="value">: ${emp?.ptkp_category || 'TK0'}</span></div>
</div>

<div class="border-box">
<div style="font-weight:bold;margin-bottom:6px">RINCIAN PENGHASILAN DAN PENGHITUNGAN PPh PASAL 21</div>
<table>
<tr><td>Gaji Pokok</td><td class="right">${fmtRp(Number(ps.base_salary))}</td></tr>
<tr><td>Tunjangan</td><td class="right">${fmtRp(Number(ps.total_gross) - Number(ps.base_salary))}</td></tr>
<tr><th>Penghasilan Bruto</th><th class="right">${fmtRp(Number(ps.total_gross))}</th></tr>
<tr><td>Biaya Jabatan</td><td class="right">(${fmtRp(Number(ps.personal_expense || 0))})</td></tr>
<tr><td>Iuran JHT</td><td class="right">(${fmtRp(Number(ps.jht_employee))})</td></tr>
<tr><td>Iuran JP</td><td class="right">(${fmtRp(Number(ps.jp_employee))})</td></tr>
<tr><td>Potongan Lainnya</td><td class="right">(${fmtRp(Number(ps.other_deductions || 0))})</td></tr>
<tr><th>Total Potongan</th><th class="right">(${fmtRp(Number(ps.total_deduction))})</th></tr>
<tr><th>Penghasilan Neto</th><th class="right">${fmtRp(Number(ps.total_gross) - Number(ps.total_deduction))}</th></tr>
<tr><td>PPh 21 Terutang (TER ${((Number(ps.ter_rate) || 0) * 100).toFixed(2)}%)</td><td class="right"><b>${fmtRp(Number(ps.pph21_tax))}</b></td></tr>
</table>
</div>

<div class="border-box">
<div class="row"><span class="label">Masa Pajak</span><span class="value">: ${ps.period}</span></div>
<div class="row"><span class="label">Take Home Pay</span><span class="value">: ${fmtRp(Number(ps.net_salary))}</span></div>
</div>

<div style="text-align:right;margin-top:20px">
<div>Tempat, ${new Date().toLocaleDateString('id-ID')}</div>
<div style="margin-top:40px"><b>${pemotong}</b></div>
</div>
<div style="font-size:9px;color:#999;text-align:center;margin-top:20px">Generated by AI Pajak × Jakarta Tax Consulting</div>
</body></html>`;

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (error) {
    loggers.api.error({ err: error }, 'e-Bupot 1721-A1 PDF error');
    return new NextResponse('Failed', { status: 500 });
  }
}
