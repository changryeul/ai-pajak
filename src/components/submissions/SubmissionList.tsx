'use client';

import { useState } from 'react';
import { SubmissionCard, type QueueItem } from './SubmissionCard';
import { Loader2, Inbox } from 'lucide-react';

const FILTER_TABS = [
  { key: 'all', label: '전체' },
  { key: 'in_progress', label: '진행 중' },
  { key: 'payment', label: '납부' },
  { key: 'completed', label: '완료' },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]['key'];

function filterItems(items: QueueItem[], filter: FilterKey): QueueItem[] {
  if (filter === 'all') return items;
  if (filter === 'in_progress') return items.filter(i => !['COMPLETED', 'FAILED', 'PAYMENT_PENDING', 'PAYMENT_UPLOADED'].includes(i.status));
  if (filter === 'payment') return items.filter(i => ['PAYMENT_PENDING', 'PAYMENT_UPLOADED', 'PAYMENT_VERIFIED'].includes(i.status));
  if (filter === 'completed') return items.filter(i => ['COMPLETED', 'FAILED'].includes(i.status));
  return items;
}

interface SubmissionListProps {
  items: QueueItem[];
  isLoading: boolean;
  onUploadPayment?: (itemId: string) => void;
}

export function SubmissionList({ items, isLoading, onUploadPayment }: SubmissionListProps) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const filtered = filterItems(items, filter);

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              filter === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.key !== 'all' && (
              <span className="ml-1 text-[10px] opacity-60">
                ({filterItems(items, tab.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Inbox className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">제출 내역이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <SubmissionCard key={item.id} item={item} onUploadPayment={onUploadPayment} />
          ))}
        </div>
      )}
    </div>
  );
}
