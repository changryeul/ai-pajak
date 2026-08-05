/**
 * Coretax 출력 xlsx → faktur 행 파싱 (클라이언트 전용, xlsx dynamic import).
 *
 * v19 §9 PPN Coretax 대조의 업로드 전처리 — 고객 PPN 페이지('Coretax 대조' 탭)와
 * 상담원 워크큐 부가세 패널(수정요청 21번)이 공유한다. 서버 매칭은
 * POST /api/tax/ppn-reconcile 가 수행.
 */
export interface CoretaxFakturRow {
  fakturType: 'KELUARAN' | 'MASUKAN';
  fakturNumber: string;
  dpp: number;
  ppn: number;
}

/** 휴리스틱 컬럼 매핑 — Coretax 출력 헤더 변형(언어/공백/기호) 흡수. */
export async function parseCoretaxFakturFile(file: File): Promise<CoretaxFakturRow[]> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const pick = (r: Record<string, unknown>, keys: string[]): string => {
    for (const k of Object.keys(r)) {
      const kl = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (keys.some(want => kl.includes(want))) return String(r[k] ?? '');
    }
    return '';
  };
  const num = (s: string) => Number(String(s).replace(/[^0-9.-]/g, '')) || 0;

  return rows.map(r => {
    const typeRaw = pick(r, ['jenis', 'type', 'faktur']).toUpperCase();
    const fakturType = typeRaw.includes('MASUK') || typeRaw.includes('INPUT') ? 'MASUKAN' : 'KELUARAN';
    return {
      fakturType: fakturType as 'KELUARAN' | 'MASUKAN',
      fakturNumber: pick(r, ['nomorfaktur', 'fakturnumber', 'nofaktur', 'nomor']),
      dpp: num(pick(r, ['dpp', 'taxbase', 'dasarpengenaan'])),
      ppn: num(pick(r, ['ppn', 'vat', 'pajakpertambahan'])),
    };
  }).filter(f => f.fakturNumber);
}
