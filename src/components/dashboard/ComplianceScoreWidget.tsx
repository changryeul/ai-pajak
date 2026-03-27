'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ShieldCheck } from 'lucide-react';

interface ComplianceData {
  score: number;
  grade: string;
  breakdown: Record<string, { score: number; max: number; label: string }>;
  improvements: string[];
}

export function ComplianceScoreWidget() {
  const [data, setData] = useState<ComplianceData | null>(null);

  useEffect(() => {
    fetch('/api/tax/compliance-score')
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data); })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const gradeColor = data.grade === 'A' ? 'text-green-600' : data.grade === 'B' ? 'text-blue-600' : data.grade === 'C' ? 'text-yellow-600' : 'text-red-600';

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-sm text-gray-900">Skor Kepatuhan</span>
          </div>
          <span className={`text-2xl font-bold ${gradeColor}`}>{data.grade}</span>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <Progress value={data.score} className="flex-1 h-2" />
          <span className="text-sm font-mono font-medium text-gray-700">{data.score}/100</span>
        </div>
        <div className="grid grid-cols-5 gap-1 mb-3">
          {Object.values(data.breakdown).map((b) => (
            <div key={b.label} className="text-center">
              <div className="text-[10px] text-gray-400 truncate">{b.label}</div>
              <div className="text-xs font-medium">{b.score}/{b.max}</div>
            </div>
          ))}
        </div>
        {data.improvements.length > 0 && (
          <div className="text-[10px] text-gray-500">
            Tingkatkan: {data.improvements[0]}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
