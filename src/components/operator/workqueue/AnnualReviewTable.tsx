'use client';
import styles from './workqueue.module.css';
import type { AnnualDocRow } from './types';

// closing_document.doc_type 슬롯 라벨 (미지 슬롯은 raw 표기)
const DOC_TYPE_LABELS: Record<string, string> = {
  akta: '법인 정관 (Akta)',
  bank: '은행 거래내역',
  sales: '매출 자료',
  purchase: '매입 자료',
  payroll: '급여 자료',
  asset: '자산 목록',
  tax_payment: '납부 증빙',
  financial_statement: '재무제표',
  signed_statement: '서명 재무제표',
  other: '기타',
};

const fmtSize = (n: number | null) => {
  if (n === null) return '—';
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
};

export function AnnualReviewTable({ rows }: { rows: AnnualDocRow[] }) {
  return (
    <div className={styles.tbl}>
      <table style={{ minWidth: 640 }}>
        <thead>
          <tr><th>증빙 슬롯</th><th>파일명</th><th>크기</th><th>업로드</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={4} style={{ color: '#6b7280' }}>업로드된 결산 증빙 문서가 없습니다.</td></tr>
          )}
          {rows.map(r => (
            <tr key={r.id}>
              <td className={styles.name}><b>{DOC_TYPE_LABELS[r.docType] ?? r.docType}</b><span>{r.docType}</span></td>
              <td>{r.fileName}</td>
              <td>{fmtSize(r.sizeBytes)}</td>
              <td>{r.uploadedAt ? r.uploadedAt.slice(0, 10) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
