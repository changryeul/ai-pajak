'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import styles from './workqueue.module.css';

export function RequestDrawer() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'id';
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={styles.float} onClick={() => setOpen(o => !o)}>💬 메신저 / 요청함</button>
      <div className={`${styles.drawer} ${open ? styles.open : ''}`}>
        <div className={styles.dh}>
          <b>메신저 / 요청함</b>
          <button className={styles.btn} onClick={() => setOpen(false)}>닫기</button>
        </div>
        <div className={styles.db}>
          <p style={{ fontSize: 13, color: '#6b7280' }}>
            직원 행의 [요청] 버튼으로 고객에게 자료 요청을 보냅니다. 대화 이력은 고객 인박스에서 확인하세요.
          </p>
          {/* 새 탭으로 열어 업무함 화면을 잃지 않는다. */}
          <a className={`${styles.btn} ${styles.blue}`} href={`/${locale}/operator/customer-inbox`} target="_blank" rel="noreferrer">고객 인박스 열기</a>
        </div>
      </div>
    </>
  );
}
