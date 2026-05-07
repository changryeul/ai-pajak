'use client';

import { useParams } from 'next/navigation';
import { CoretaxView } from '@/components/operator/CoretaxView';

export default function CoretaxDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <CoretaxView caseId={id} />;
}
