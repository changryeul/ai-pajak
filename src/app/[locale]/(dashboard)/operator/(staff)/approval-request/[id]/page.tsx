'use client';

import { useParams } from 'next/navigation';
import { ApprovalRequestView } from '@/components/operator/ApprovalRequestView';

export default function ApprovalRequestPage() {
  const { id } = useParams<{ id: string }>();
  return <ApprovalRequestView caseId={id} />;
}
