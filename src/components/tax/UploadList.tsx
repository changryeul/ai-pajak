'use client';

import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';

export interface UploadItem {
  id: number | string;
  name: string;
  type?: string;
  size?: number;
}

interface UploadListProps {
  uploads: UploadItem[];
  onRemove: (id: UploadItem['id']) => void;
  emptyText: string;
}

export function UploadList({ uploads, onRemove, emptyText }: UploadListProps) {
  const t = useTranslations('taxScreen');

  if (uploads.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {uploads.map((u) => (
        <div key={u.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm bg-white">
          <span className="truncate flex-1 mr-2">{u.name}</span>
          <button
            type="button"
            onClick={() => onRemove(u.id)}
            className="text-slate-400 hover:text-red-600 transition-colors"
            title={t('delete')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
