'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Edit2 } from 'lucide-react';

interface OCRConfidenceFieldProps {
  label: string;
  value: string | number;
  confidence: number;
  onValueChange: (newValue: string) => void;
  type?: 'text' | 'number';
  format?: (v: string | number) => string;
}

/**
 * OCR Confidence Field — Shows extracted value with confidence indicator
 *
 * - High confidence (>= 0.8): Green checkmark
 * - Medium confidence (0.5-0.8): Yellow warning, editable
 * - Low confidence (< 0.5): Red warning, highlighted for manual input
 */
export function OCRConfidenceField({
  label,
  value,
  confidence,
  onValueChange,
  type = 'text',
  format,
}: OCRConfidenceFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));

  const isHigh = confidence >= 0.8;
  const isMedium = confidence >= 0.5 && confidence < 0.8;
  const isLow = confidence < 0.5;

  const displayValue = format ? format(value) : String(value);
  const confidencePct = `${Math.round(confidence * 100)}%`;

  if (isEditing) {
    return (
      <div>
        <Label className="text-xs flex items-center gap-1">
          {label}
          <Badge className="text-[8px] bg-blue-100 text-blue-700">수정 중</Badge>
        </Label>
        <div className="flex gap-1">
          <Input
            className="h-8 text-xs"
            type={type}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            autoFocus
          />
          <button
            className="px-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => {
              onValueChange(editValue);
              setIsEditing(false);
            }}
          >
            OK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Label className="text-xs flex items-center gap-1">
        {label}
        {isHigh && <CheckCircle className="h-3 w-3 text-green-500" />}
        {isMedium && <AlertTriangle className="h-3 w-3 text-yellow-500" />}
        {isLow && <AlertTriangle className="h-3 w-3 text-red-500" />}
        <Badge className={`text-[8px] ${isHigh ? 'bg-green-100 text-green-700' : isMedium ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
          {confidencePct}
        </Badge>
      </Label>
      <div
        className={`h-8 px-2 flex items-center justify-between rounded border text-xs cursor-pointer transition-colors ${
          isLow ? 'bg-red-50 border-red-200 text-red-800' :
          isMedium ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
          'bg-gray-50 border-gray-200 text-gray-800'
        }`}
        onClick={() => setIsEditing(true)}
      >
        <span className={type === 'number' ? 'font-mono' : ''}>{displayValue || '—'}</span>
        <Edit2 className="h-3 w-3 text-gray-400" />
      </div>
    </div>
  );
}
