'use client';
import type { QueueListItem } from './types';
interface Props {
  items: QueueListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  counts: { all: number; unreviewed: number; inReview: number; request: number; reviewed: number };
}
// TEMPORARY stub — Task 7 replaces this.
export function CustomerWorklist(_props: Props) {
  return <aside>worklist stub</aside>;
}
