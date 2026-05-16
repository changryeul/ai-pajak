/**
 * Row-level validation rules for parsed consultant-ERP documents.
 *
 * Given a (slot, fieldName, fieldValue) tuple we return a severity and a
 * bilingual (ko/id) message. Severity drives the "고객 확인 필요" banner and
 * the supervisor approval snapshot.
 */

export type Severity = 'CRITICAL' | 'WARNING' | 'INFO' | 'OK';

export interface RowFinding {
  severity: Severity;
  issueCode: string;
  messageKo: string;
  messageId: string;
}

type FieldRule = (value: unknown, row: Record<string, unknown>) => RowFinding | null;

const isBlank = (v: unknown) =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

const VALID_PTKP = new Set([
  'TK/0', 'TK/1', 'TK/2', 'TK/3',
  'K/0', 'K/1', 'K/2', 'K/3',
  'HB/0', 'HB/1', 'HB/2', 'HB/3',
]);

// ── PAYROLL rules ──────────────────────────────────────────────────
const payrollRules: Record<string, FieldRule> = {
  npwpNik: (v) => {
    if (isBlank(v)) {
      return {
        severity: 'CRITICAL',
        issueCode: 'NPWP_NIK_MISSING',
        messageKo: 'NPWP/NIK가 누락되었습니다',
        messageId: 'NPWP/NIK kosong',
      };
    }
    const s = String(v).replace(/\D/g, '');
    if (s.length < 15) {
      return {
        severity: 'WARNING',
        issueCode: 'NPWP_NIK_LENGTH',
        messageKo: '임시 ID입니다. 실제 NIK/NPWP 확인 필요',
        messageId: 'ID sementara — periksa NIK/NPWP asli',
      };
    }
    return null;
  },
  ptkp: (v) => {
    if (isBlank(v)) {
      return {
        severity: 'CRITICAL',
        issueCode: 'PTKP_MISSING',
        messageKo: 'PTKP 코드가 비어 있습니다',
        messageId: 'Kode PTKP kosong',
      };
    }
    if (!VALID_PTKP.has(String(v))) {
      return {
        severity: 'CRITICAL',
        issueCode: 'PTKP_INVALID',
        messageKo: 'PTKP 코드가 유효하지 않습니다',
        messageId: 'Kode PTKP tidak valid',
      };
    }
    return null;
  },
  taxMethod: (v) =>
    isBlank(v)
      ? {
          severity: 'CRITICAL',
          issueCode: 'TAX_METHOD_MISSING',
          messageKo: '세금 부담 방식이 없습니다',
          messageId: 'Metode pajak (gross/gross-up/net) tidak ada',
        }
      : null,
  residency: (v) =>
    isBlank(v)
      ? {
          severity: 'WARNING',
          issueCode: 'RESIDENCY_MISSING',
          messageKo: '거주자 여부 확인 필요',
          messageId: 'Status residensi perlu dikonfirmasi',
        }
      : String(v).toUpperCase().includes('EXPAT')
        ? {
            severity: 'WARNING',
            issueCode: 'RESIDENCY_EXPAT',
            messageKo: '외국인 거주자 — 세금방식 확인 필요',
            messageId: 'Expat — periksa metode pajak',
          }
        : null,
  bpjsKesEmployee: (v) =>
    isBlank(v)
      ? {
          severity: 'WARNING',
          issueCode: 'BPJS_KES_MISSING',
          messageKo: 'BPJS Kesehatan 직원부담액 확인 필요',
          messageId: 'BPJS Kesehatan (karyawan) perlu dicek',
        }
      : null,
  bankAccount: (v) =>
    isBlank(v)
      ? {
          severity: 'INFO',
          issueCode: 'BANK_ACCOUNT_MISSING',
          messageKo: '급여 지급계좌가 비어 있습니다',
          messageId: 'Rekening pembayaran gaji kosong',
        }
      : null,
};

// ── WITHHOLDING_INVOICE rules ──────────────────────────────────────
const withholdingRules: Record<string, FieldRule> = {
  counterpartyNpwp: (v, row) => {
    if (isBlank(v)) {
      // 외국 거래처는 NPWP 없을 수 있음.
      if (String(row.country ?? '').toUpperCase() !== 'ID') {
        return {
          severity: 'INFO',
          issueCode: 'FOREIGN_VENDOR_NO_NPWP',
          messageKo: '해외 거래처 — NPWP 없음 (정상)',
          messageId: 'Vendor luar — NPWP tidak diperlukan',
        };
      }
      return {
        severity: 'CRITICAL',
        issueCode: 'COUNTERPARTY_NPWP_MISSING',
        messageKo: '거래처 NPWP 누락',
        messageId: 'NPWP lawan transaksi kosong',
      };
    }
    return null;
  },
  suggestedPph: (v) =>
    isBlank(v)
      ? {
          severity: 'WARNING',
          issueCode: 'PPH_TYPE_UNCLEAR',
          messageKo: 'PPh 유형 추정 불가 — 컨설턴트 확정 필요',
          messageId: 'Jenis PPh tidak jelas — perlu keputusan konsultan',
        }
      : null,
  dgtFormRequired: (v, row) =>
    v === true && isBlank(row.dgtFormDate)
      ? {
          severity: 'CRITICAL',
          issueCode: 'DGT_FORM_MISSING',
          messageKo: 'DGT Form 필요한 거래 — 미제출',
          messageId: 'Transaksi perlu DGT Form — belum tersedia',
        }
      : null,
  dpp: (v) =>
    isBlank(v) || Number(v) <= 0
      ? {
          severity: 'CRITICAL',
          issueCode: 'DPP_MISSING',
          messageKo: 'DPP(과세표준)가 없습니다',
          messageId: 'DPP kosong',
        }
      : null,
};

// ── VAT_IN_OUT rules ───────────────────────────────────────────────
const vatRules: Record<string, FieldRule> = {
  fakturNo: (v) =>
    isBlank(v)
      ? {
          severity: 'CRITICAL',
          issueCode: 'FAKTUR_NO_MISSING',
          messageKo: 'Faktur Pajak 번호 누락',
          messageId: 'Nomor Faktur Pajak kosong',
        }
      : null,
  dpp: (v) =>
    isBlank(v) || Number(v) <= 0
      ? {
          severity: 'CRITICAL',
          issueCode: 'VAT_DPP_MISSING',
          messageKo: 'DPP가 없습니다',
          messageId: 'DPP kosong',
        }
      : null,
};

const SLOT_RULES: Record<string, Record<string, FieldRule>> = {
  PAYROLL: payrollRules,
  WITHHOLDING_INVOICE: withholdingRules,
  VAT_IN_OUT: vatRules,
};

export function evaluateField(opts: {
  slot: string;
  fieldName: string;
  fieldValue: unknown;
  row: Record<string, unknown>;
}): RowFinding {
  const rules = SLOT_RULES[opts.slot];
  if (!rules) return { severity: 'OK', issueCode: 'NO_RULE', messageKo: '', messageId: '' };
  const rule = rules[opts.fieldName];
  if (!rule) return { severity: 'OK', issueCode: 'NO_RULE', messageKo: '', messageId: '' };
  return (
    rule(opts.fieldValue, opts.row) ?? {
      severity: 'OK',
      issueCode: 'PASS',
      messageKo: '',
      messageId: '',
    }
  );
}

export function evaluateRow(opts: {
  slot: string;
  row: Record<string, unknown>;
}): Array<{ fieldName: string; finding: RowFinding }> {
  const rules = SLOT_RULES[opts.slot];
  if (!rules) return [];
  const out: Array<{ fieldName: string; finding: RowFinding }> = [];
  for (const fieldName of Object.keys(rules)) {
    const finding = evaluateField({
      slot: opts.slot,
      fieldName,
      fieldValue: opts.row[fieldName],
      row: opts.row,
    });
    if (finding.severity !== 'OK') {
      out.push({ fieldName, finding });
    }
  }
  return out;
}
