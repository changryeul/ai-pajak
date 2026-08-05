'use client';
import { useEffect, useState } from 'react';
import styles from './workqueue.module.css';

/**
 * 고객 요청 모달 — WhatsApp 스타일 (수정요청 11·18·23, 2026-08-05).
 * 워크큐 6개 패널의 '요청' 이 공유. 초안이 보내는 말풍선(초록)으로 보이고,
 * 그 안에서 바로 편집 → 전송. 실제 발송은 기존 /request POST 그대로
 * (고객 화면 해당 행 + 메신저에 표시).
 */
export function RequestChatModal({ toLabel, contextLabel, defaultMessage, onSend, onClose }: {
  toLabel: string;
  contextLabel?: string;
  defaultMessage: string;
  onSend: (message: string) => Promise<void>;
  onClose: () => void;
}) {
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
            <span>고객 화면의 해당 항목에 요청으로 표시됩니다</span>
          </div>
          <button className={styles.waClose} onClick={onClose} aria-label="닫기">×</button>
        </div>

        {/* 대화 영역 */}
        <div className={styles.waBody}>
          {contextLabel && <div className={styles.waContext}>{contextLabel}</div>}
          <div className={styles.waBubbleOut}>
            <textarea
              value={msg}
              onChange={e => setMsg(e.target.value)}
              rows={4}
              aria-label="고객에게 보낼 메시지"
            />
            <span className={styles.waMeta}>{hhmm} ✓</span>
          </div>
          <div className={styles.waHint}>말풍선을 눌러 내용을 수정할 수 있습니다</div>
        </div>

        {/* 입력줄 스타일 푸터 */}
        <div className={styles.waFoot}>
          <button className={styles.waCancel} onClick={onClose} disabled={sending}>취소</button>
          <button className={styles.waSend} onClick={send} disabled={sending || !msg.trim()} aria-label="보내기">
            {sending ? '…' : '➤'}
          </button>
        </div>
      </div>
    </div>
  );
}
