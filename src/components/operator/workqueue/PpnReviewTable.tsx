'use client';
import { useTranslations } from 'next-intl';
import styles from './workqueue.module.css';
import { type PpnRow } from './types';

const rp = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');

interface Props {
  rows: PpnRow[];
  onRequest: (row: PpnRow) => void;
  onOpenDetail?: (row: PpnRow) => void; // 더블클릭 상세 팝업 (요청 24)
}

export function PpnReviewTable({ rows, onRequest, onOpenDetail }: Props) {
  const tw = useTranslations('workqueue');
  const reviewText = (level: string) =>
    level === 'green' ? tw('reviewDone') : level === 'red' ? tw('reviewIssue') : tw('reviewUnconfirmed');
  const dirText = (t: string) => (t === 'MASUKAN' ? tw('dirIn') : tw('dirOut'));
  // 수정요청 20번 — 부가세 요율 표기. dpp 대비 실효 요율(반올림 %); 사치품은 12%.
  const rateText = (r: { dpp: number; ppn: number; isLuxury: boolean }): string => {
    if (r.dpp <= 0) return '—';
    const pct = Math.round((r.ppn / r.dpp) * 100);
    return r.isLuxury ? `${pct}% (${tw('luxurySuffix')})` : `${pct}%`;
  };
  // recon_status → [표시문구, badge 색 클래스]
  const reconBadge = (status: string | null): [string, string] => {
    switch (status) {
      case 'MATCH': return [tw('reconMatch'), 'green'];
      case 'DIFF': return [tw('reconDiff'), 'red'];
      case 'MISSING_CORETAX': return [tw('reconMissingCoretax'), 'amber'];
      case 'MISSING_CUSTOMER': return [tw('reconMissingCustomer'), 'amber'];
      default: return [tw('reconPending'), 'gray'];
    }
  };
  return (
    <div className={styles.tbl}>
      <table>
        <thead><tr>
          <th>{tw('colStatus')}</th><th>{tw('colDirection')}</th><th>{tw('colFakturNumber')}</th><th>{tw('colCounterparty')}</th><th>{tw('colNpwp')}</th>
          <th className={styles.money}>DPP</th><th className={styles.money}>PPN</th><th>{tw('colRate')}</th>
          <th>{tw('colCoretaxRecon')}</th><th>{tw('colIssue')}</th><th>{tw('request')}</th>
        </tr></thead>
        <tbody>
          {rows.map(r => {
            const [reconText, reconCls] = reconBadge(r.reconStatus);
            return (
              <tr key={r.id} onDoubleClick={() => onOpenDetail?.(r)} title={tw('dblClickEdit')} style={{ cursor: onOpenDetail ? 'pointer' : undefined }}>
                <td><span className={`${styles.badge} ${styles[r.flags.level]}`}>{reviewText(r.flags.level)}</span></td>
                <td>{dirText(r.fakturType)}</td>
                <td className={styles.name}><b>{r.fakturNumber ?? tw('noNumber')}</b><span>{r.fakturDate ?? ''}</span></td>
                <td>{r.counterpartyName}</td>
                <td>{r.counterpartyNpwp ?? tw('noNpwp')}</td>
                <td className={styles.money}>{rp(r.dpp)}</td>
                <td className={styles.money}>{rp(r.ppn)}</td>
                <td>{rateText(r)}</td>
                <td><span className={`${styles.badge} ${styles[reconCls]}`}>{reconText}</span></td>
                <td><span className={`${styles.badge} ${styles[r.flags.level]}`}>{r.flags.label}</span></td>
                <td><button className={`${styles.btn} ${styles.blue}`} onClick={() => onRequest(r)}>{tw('request')}</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
