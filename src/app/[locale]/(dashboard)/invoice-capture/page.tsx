'use client';

import { InvoiceCaptureFlow } from '@/components/invoice/InvoiceCaptureFlow';
import { Camera, Sparkles } from 'lucide-react';

export default function InvoiceCapturePage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-800 via-purple-700 to-indigo-900 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <p className="text-purple-300 text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" />AI Invoice Scanner
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1 flex items-center gap-3">
            <Camera className="h-7 w-7" />사진 신고
          </h1>
          <p className="text-purple-300 mt-2 text-sm">인보이스를 촬영하면 AI가 세목과 세율을 자동으로 분류합니다</p>
        </div>
      </div>

      {/* Flow */}
      <InvoiceCaptureFlow />
    </div>
  );
}
