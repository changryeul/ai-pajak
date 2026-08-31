'use client';
import { useTranslations } from 'next-intl';
import styles from './workqueue.module.css';
import type { AnnualDocRow } from './types';

// closing_document.doc_type 슬롯 라벨 키 (미지 슬롯은 raw 표기)
const DOC_TYPE_KEYS: Record<string, string> = {
  akta: 'docAkta',
  bank: 'docBank',
  sales: 'docSales',
  purchase: 'docPurchase',
  payroll: 'docPayroll',
  asset: 'docAsset',
  tax_payment: 'docTaxPayment',
  financial_statement: 'docFinancialStatement',
  signed_statement: 'docSignedStatement',
  other: 'docOther',
};

const fmtSize = (n: number | null) => {
  if (n === null) return '—';
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
};

export function AnnualReviewTable({ rows }: { rows: AnnualDocRow[] }) {
  const tw = useTranslations('workqueue');
  const docLabel = (docType: string) => (DOC_TYPE_KEYS[docType] ? tw(DOC_TYPE_KEYS[docType]) : docType);
  return (
    <div className={styles.tbl}>
      <table style={{ minWidth: 640 }}>
        <thead>
          <tr><th>{tw('colDocSlot')}</th><th>{tw('colFileName')}</th><th>{tw('colSize')}</th><th>{tw('colUploaded')}</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={4} style={{ color: '#6b7280' }}>{tw('noClosingDocs')}</td></tr>
          )}
          {rows.map(r => (
            <tr key={r.id}>
              <td className={styles.name}><b>{docLabel(r.docType)}</b><span>{r.docType}</span></td>
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
