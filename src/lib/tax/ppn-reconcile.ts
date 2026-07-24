/**
 * PPN Coretax 대조 로직 (v19 §9, 트랙 6).
 *
 * 고객 제출 faktur 와 Coretax 출력 faktur 를 faktur_number(+type) 로 매칭해
 * 대조 상태를 산출한다. 순수 함수 — DB I/O 는 endpoint 에서.
 */

export type ReconStatus = 'MATCH' | 'DIFF' | 'MISSING_CORETAX' | 'MISSING_CUSTOMER';

export interface CustomerFaktur {
  id: string;
  fakturType: string;      // KELUARAN | MASUKAN
  fakturNumber: string | null;
  dpp: number;
  ppn: number;
}

export interface CoretaxFaktur {
  fakturType: string;
  fakturNumber: string;
  dpp: number;
  ppn: number;
}

export interface ReconRowUpdate {
  id: string;
  coretaxDpp: number;
  coretaxPpn: number;
  reconStatus: ReconStatus;
}

export interface ReconNewRow {
  fakturType: string;
  fakturNumber: string;
  coretaxDpp: number;
  coretaxPpn: number;
}

export interface ReconResult {
  updates: ReconRowUpdate[];        // 고객 행 갱신 (coretax 값 + 상태)
  coretaxOnly: ReconNewRow[];       // Coretax 에만 있는 faktur (신규 MISSING_CUSTOMER 행)
  summary: { match: number; diff: number; missingCoretax: number; missingCustomer: number };
}

/** 금액 비교 — 반올림 오차 흡수 (Rp 1 단위). */
function eq(a: number, b: number): boolean {
  return Math.round(a) === Math.round(b);
}

function key(type: string, number: string): string {
  return `${type}::${number.trim().toUpperCase()}`;
}

export function reconcile(customer: CustomerFaktur[], coretax: CoretaxFaktur[]): ReconResult {
  const coretaxByKey = new Map<string, CoretaxFaktur>();
  for (const c of coretax) {
    if (c.fakturNumber) coretaxByKey.set(key(c.fakturType, c.fakturNumber), c);
  }
  const matchedCoretaxKeys = new Set<string>();

  const updates: ReconRowUpdate[] = [];
  const summary = { match: 0, diff: 0, missingCoretax: 0, missingCustomer: 0 };

  for (const f of customer) {
    if (!f.fakturNumber) {
      // 번호 없는 고객 행은 매칭 불가 → Coretax 누락으로 본다.
      updates.push({ id: f.id, coretaxDpp: 0, coretaxPpn: 0, reconStatus: 'MISSING_CORETAX' });
      summary.missingCoretax++;
      continue;
    }
    const k = key(f.fakturType, f.fakturNumber);
    const c = coretaxByKey.get(k);
    if (!c) {
      updates.push({ id: f.id, coretaxDpp: 0, coretaxPpn: 0, reconStatus: 'MISSING_CORETAX' });
      summary.missingCoretax++;
      continue;
    }
    matchedCoretaxKeys.add(k);
    const status: ReconStatus = eq(f.dpp, c.dpp) && eq(f.ppn, c.ppn) ? 'MATCH' : 'DIFF';
    updates.push({ id: f.id, coretaxDpp: c.dpp, coretaxPpn: c.ppn, reconStatus: status });
    if (status === 'MATCH') summary.match++; else summary.diff++;
  }

  const coretaxOnly: ReconNewRow[] = [];
  for (const [k, c] of coretaxByKey) {
    if (matchedCoretaxKeys.has(k)) continue;
    coretaxOnly.push({ fakturType: c.fakturType, fakturNumber: c.fakturNumber, coretaxDpp: c.dpp, coretaxPpn: c.ppn });
    summary.missingCustomer++;
  }

  return { updates, coretaxOnly, summary };
}
