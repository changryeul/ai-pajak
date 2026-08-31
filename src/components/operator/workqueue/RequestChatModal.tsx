'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './workqueue.module.css';

/**
 * 고객 요청 모달 — WhatsApp 스타일 (수정요청 11·18·23, 2026-08-05).
 * 워크큐 6개 패널의 '요청' 이 공유. 초안이 보내는 말풍선(초록)으로 보이고,
 * 그 안에서 바로 편집 → 전송. 실제 발송은 기존 /request POST 그대로
 * (고객 화면 해당 행 + 메신저에 표시).
 */
export function RequestChatModal({ toLabel, subtitle, contextLabel, defaultMessage, onSend, onClose }: {
  toLabel: string;
  subtitle?: string;      // 헤더 보조문구 (기본 = 고객 요청 안내). 승인요청 등 재사용 시 교체.
  contextLabel?: string;
  defaultMessage: string;
  onSend: (message: string) => Promise<void>;
  onClose: () => void;
}) {
  const tw = useTranslations('workqueue');
  const [msg, setMsg] = useState(defaultMessage);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = async () => {
    if (!msg.trim() || sending) return;
    setSending(true);
    try { await onSend(msg.trim()); }
    finally { setSending(false); }
  };

  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <div className={`${styles.modalbg} ${styles.open}`} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.waModal} onClick={e => e.stopPropagation()}>
        {/* 헤더 — 대상 */}
        <div className={styles.waHead}>
          <div className={styles.waAvatar}>{toLabel.slice(0, 1)}</div>
          <div className={styles.waWho}>
            <b>{toLabel}</b>
            <span>{subtitle ?? tw('chatDefaultSubtitle')}</span>
          </div>
          <button className={styles.waClose} onClick={onClose} aria-label={tw('close')}>×</button>
        </div>

        {/* 대화 영역 */}
        <div className={styles.waBody}>
          {contextLabel && <div className={styles.waContext}>{contextLabel}</div>}
          <div className={styles.waBubbleOut}>
            <textarea
              value={msg}
              onChange={e => setMsg(e.target.value)}
              rows={4}
              aria-label={tw('chatMessageAria')}
            />
            <span className={styles.waMeta}>{hhmm} ✓</span>
          </div>
          <div className={styles.waHint}>{tw('chatEditHint')}</div>
        </div>

        {/* 입력줄 스타일 푸터 */}
        <div className={styles.waFoot}>
          <button className={styles.waCancel} onClick={onClose} disabled={sending}>{tw('cancel')}</button>
          <button className={styles.waSend} onClick={send} disabled={sending || !msg.trim()} aria-label={tw('send')}>
            {sending ? '…' : '➤'}
          </button>
        </div>
      </div>
    </div>
  );
}
