'use client';

import { useParams } from 'next/navigation';
import { HistoryView } from '@/components/operator/HistoryView';

export default function OperatorHistoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <HistoryView caseId={id} />;
}
