import { describe, it, expect } from 'vitest';

/**
 * e-SPT XML Generation Tests
 *
 * Tests XML serialization for DJP e-Filing format.
 */

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateSPT1770SSXML(data: {
  npwp: string;
  nik: string;
  name: string;
  taxYear: number;
  grossIncome: number;
  totalDeductions: number;
  ptkpAmount: number;
  taxDue: number;
  taxWithheld: number;
}): string {
  const taxableIncome = Math.max(data.grossIncome - data.totalDeductions - data.ptkpAmount, 0);
  const remainingTax = data.taxDue - data.taxWithheld;

  return `<?xml version="1.0" encoding="UTF-8"?>
<SPT xmlns="urn:schemas-djp-go-id:spt:1770ss">
  <Header>
    <KodePembetulan>0</KodePembetulan>
    <TahunPajak>${data.taxYear}</TahunPajak>
    <NPWP>${data.npwp}</NPWP>
    <NIK>${data.nik}</NIK>
    <NamaWP>${escapeXml(data.name)}</NamaWP>
    <StatusSPT>Normal</StatusSPT>
  </Header>
  <FormulirUtama>
    <A_PenghasilanBruto>${data.grossIncome}</A_PenghasilanBruto>
    <B_PengurangPenghasilan>${data.totalDeductions}</B_PengurangPenghasilan>
    <D_PTKP>${data.ptkpAmount}</D_PTKP>
    <E_PKP>${taxableIncome}</E_PKP>
    <F_PPhTerutang>${data.taxDue}</F_PPhTerutang>
    <G_PPhDipotong>${data.taxWithheld}</G_PPhDipotong>
    <H_PPhKurangLebihBayar>${remainingTax}</H_PPhKurangLebihBayar>
  </FormulirUtama>
</SPT>`;
}

describe('e-SPT XML Generation', () => {
  describe('XML structure', () => {
    it('should generate valid XML with correct header', () => {
      const xml = generateSPT1770SSXML({
        npwp: '012345678901234',
        nik: '3201234567890001',
        name: 'Test User',
        taxYear: 2025,
        grossIncome: 120_000_000,
        totalDeductions: 6_000_000,
        ptkpAmount: 54_000_000,
        taxDue: 3_000_000,
        taxWithheld: 2_800_000,
      });

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<SPT xmlns="urn:schemas-djp-go-id:spt:1770ss">');
      expect(xml).toContain('<TahunPajak>2025</TahunPajak>');
      expect(xml).toContain('<NPWP>012345678901234</NPWP>');
      expect(xml).toContain('</SPT>');
    });

    it('should include all required fields', () => {
      const xml = generateSPT1770SSXML({
        npwp: '012345678901234',
        nik: '3201234567890001',
        name: 'Ahmad Suryadi',
        taxYear: 2025,
        grossIncome: 200_000_000,
        totalDeductions: 10_000_000,
        ptkpAmount: 58_500_000,
        taxDue: 13_575_000,
        taxWithheld: 13_000_000,
      });

      expect(xml).toContain('<A_PenghasilanBruto>200000000</A_PenghasilanBruto>');
      expect(xml).toContain('<B_PengurangPenghasilan>10000000</B_PengurangPenghasilan>');
      expect(xml).toContain('<D_PTKP>58500000</D_PTKP>');
      expect(xml).toContain('<F_PPhTerutang>13575000</F_PPhTerutang>');
      expect(xml).toContain('<G_PPhDipotong>13000000</G_PPhDipotong>');
      expect(xml).toContain('<H_PPhKurangLebihBayar>575000</H_PPhKurangLebihBayar>');
    });

    it('should calculate correct taxable income (PKP)', () => {
      const xml = generateSPT1770SSXML({
        npwp: '012345678901234',
        nik: '3201234567890001',
        name: 'Test',
        taxYear: 2025,
        grossIncome: 120_000_000,
        totalDeductions: 6_000_000,
        ptkpAmount: 54_000_000,
        taxDue: 3_000_000,
        taxWithheld: 3_000_000,
      });

      // PKP = 120M - 6M - 54M = 60M
      expect(xml).toContain('<E_PKP>60000000</E_PKP>');
    });

    it('should handle zero taxable income', () => {
      const xml = generateSPT1770SSXML({
        npwp: '012345678901234',
        nik: '3201234567890001',
        name: 'Test',
        taxYear: 2025,
        grossIncome: 50_000_000,
        totalDeductions: 2_500_000,
        ptkpAmount: 54_000_000,
        taxDue: 0,
        taxWithheld: 0,
      });

      // PKP = max(50M - 2.5M - 54M, 0) = 0
      expect(xml).toContain('<E_PKP>0</E_PKP>');
      expect(xml).toContain('<H_PPhKurangLebihBayar>0</H_PPhKurangLebihBayar>');
    });
  });

  describe('XML escaping', () => {
    it('should escape special characters in name', () => {
      expect(escapeXml('PT A & B <Test>')).toBe('PT A &amp; B &lt;Test&gt;');
    });

    it('should escape quotes', () => {
      expect(escapeXml('PT "Example"')).toBe('PT &quot;Example&quot;');
    });

    it('should handle normal text without modification', () => {
      expect(escapeXml('Ahmad Suryadi')).toBe('Ahmad Suryadi');
    });
  });

  describe('overpayment (Lebih Bayar)', () => {
    it('should calculate negative remaining tax as overpayment', () => {
      const xml = generateSPT1770SSXML({
        npwp: '012345678901234',
        nik: '3201234567890001',
        name: 'Test',
        taxYear: 2025,
        grossIncome: 120_000_000,
        totalDeductions: 6_000_000,
        ptkpAmount: 54_000_000,
        taxDue: 2_000_000,
        taxWithheld: 3_000_000, // Overpaid by 1M
      });

      // Remaining = 2M - 3M = -1M (lebih bayar)
      expect(xml).toContain('<H_PPhKurangLebihBayar>-1000000</H_PPhKurangLebihBayar>');
    });
  });
});
