'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/hooks/useSession';
import { SubmissionList } from '@/components/submissions/SubmissionList';
import { type QueueItem } from '@/components/submissions/SubmissionCard';
import { ClipboardList, CheckCircle, Clock, CreditCard, AlertTriangle } from 'lucide-react';

interface Summary {
  total: number;
  paymentPending: number;
  paymentUploaded: number;
  completed: number;
  inProgress: number;
}

export default function SubmissionsPage() {
  const { session, isLoading: sessionLoading } = useSession();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, paymentPending: 0, paymentUploaded: 0, completed: 0, inProgress: 0 });
  const [dataLoading, setDataLoading] = useState(false);

  const isLoading = sessionLoading || dataLoading;

  const loadData = useCallback(async () => {
    if (!session) return;
    setDataLoading(true);
    try {
      const res = await fetch('/api/customer/queue');
      if (!res.ok) throw new Error(`queue: ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.data.items || []);
        setSummary(data.data.summary || { total: 0, paymentPending: 0, paymentUploaded: 0, completed: 0, inProgress: 0 });
      }
    } catch { /* */ }
    finally { setDataLoading(false); }
  }, [session]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUploadPayment = (itemId: string) => {
    // TODO: Open payment proof upload dialog
    alert(`납부증빙 업로드: ${itemId}`);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-800 via-indigo-700 to-indigo-900 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-indigo-300 text-sm flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />My Submissions
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">제출 현황</h1>
          <p className="text-indigo-300 mt-2 text-sm">신고 접수부터 완료까지 진행 상태를 확인합니다</p>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-indigo-300 text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" />진행 중
              </p>
              <p className="font-bold text-lg">{summary.inProgress}건</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-indigo-300 text-xs flex items-center gap-1">
                <CreditCard className="h-3 w-3 text-amber-300" />납부 대기
              </p>
              <p className="font-bold text-lg text-amber-300">{summary.paymentPending}건</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-indigo-300 text-xs flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-300" />완료
              </p>
              <p className="font-bold text-lg">{summary.completed}건</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-indigo-300 text-xs flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />전체
              </p>
              <p className="font-bold text-lg">{summary.total}건</p>
            </div>
          </div>
        </div>
      </div>

      {/* Submission List */}
      <SubmissionList items={items} isLoading={isLoading} onUploadPayment={handleUploadPayment} />
    </div>
  );
}
