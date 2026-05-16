/**
 * Builds the "고객 확인요청" markdown that a consultant copy-pastes (or
 * eventually sends via WhatsApp/email) when a session has unresolved
 * CRITICAL/WARNING parse rows.
 */

interface ParseRowLite {
  entity_label: string | null;
  field_name: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'OK';
  message_ko: string | null;
  message_id: string | null;
  is_resolved: boolean;
}

interface BuildOptions {
  rows: ParseRowLite[];
  customerName: string;
  consultantName: string;
  locale?: 'ko' | 'id';
  includeInfo?: boolean;
}

export function buildClientMessage(opts: BuildOptions): string {
  const locale = opts.locale ?? 'ko';
  const includeInfo = opts.includeInfo ?? false;
  const open = locale === 'ko'
    ? `안녕하세요, ${opts.customerName} 담당자님.\n${opts.consultantName} 입니다. 이번 신고 자료를 정리하다가 아래 항목의 확인이 필요해 메시지 드립니다.`
    : `Halo, tim ${opts.customerName}.\nIni dari ${opts.consultantName}. Saat memproses dokumen pelaporan, kami menemukan beberapa hal yang perlu Anda konfirmasi:`;

  const unresolved = opts.rows.filter((r) => !r.is_resolved && (includeInfo || r.severity !== 'INFO'));
  if (unresolved.length === 0) {
    return locale === 'ko'
      ? `${open}\n\n현재 확인이 필요한 항목은 없습니다. 감사합니다.`
      : `${open}\n\nSaat ini tidak ada item yang perlu konfirmasi. Terima kasih.`;
  }

  const critical = unresolved.filter((r) => r.severity === 'CRITICAL');
  const warning = unresolved.filter((r) => r.severity === 'WARNING');
  const info = unresolved.filter((r) => r.severity === 'INFO');

  const section = (title: string, list: ParseRowLite[]) => {
    if (list.length === 0) return '';
    const items = list
      .map((r, i) => {
        const msg = locale === 'ko' ? r.message_ko : r.message_id;
        const label = r.entity_label ? `${r.entity_label} · ` : '';
        return `${i + 1}. ${label}${r.field_name}: ${msg || ''}`;
      })
      .join('\n');
    return `\n\n**${title}**\n${items}`;
  };

  const close = locale === 'ko'
    ? '\n\n확인되는 대로 회신 부탁드립니다. 감사합니다.'
    : '\n\nMohon balas setelah dicek. Terima kasih.';

  return (
    open +
    section(locale === 'ko' ? '🚨 필수 확인 항목' : '🚨 Wajib dikonfirmasi', critical) +
    section(locale === 'ko' ? '⚠️ 확인 권장 항목' : '⚠️ Disarankan dicek', warning) +
    (includeInfo ? section(locale === 'ko' ? 'ℹ️ 참고' : 'ℹ️ Info', info) : '') +
    close
  );
}
