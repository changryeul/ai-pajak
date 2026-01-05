import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { OCRConfidenceIndicator } from './OCRConfidenceIndicator';
import { cn } from '@/lib/utils';
import { Check, X, Pencil } from 'lucide-react';

export interface ExtractedDataFieldProps {
  index: number;
  text: string;
  confidence: number | null;
  onUpdate: (index: number, newValue: string) => void;
  isHighlighted?: boolean;
  onFocus?: () => void;
}

/**
 * Story 2-5: Extracted Data Field
 * Editable field for OCR results with inline editing and confidence display
 */
export function ExtractedDataField({
  index,
  text,
  confidence,
  onUpdate,
  isHighlighted = false,
  onFocus,
}: ExtractedDataFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(text);

  const handleEdit = useCallback(() => {
    setEditValue(text);
    setIsEditing(true);
  }, [text]);

  const handleSave = useCallback(() => {
    if (editValue !== text) {
      onUpdate(index, editValue);
    }
    setIsEditing(false);
  }, [editValue, text, index, onUpdate]);

  const handleCancel = useCallback(() => {
    setEditValue(text);
    setIsEditing(false);
  }, [text]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  const isLowConfidence = confidence !== null && confidence < 70;

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 rounded-md border transition-colors',
        isHighlighted && 'ring-2 ring-blue-500 bg-blue-50',
        isLowConfidence && !isHighlighted && 'bg-red-50 border-red-200',
        !isHighlighted && !isLowConfidence && 'bg-white border-gray-200 hover:border-gray-300'
      )}
      onClick={onFocus}
    >
      <span className="text-xs text-gray-400 w-8 shrink-0">#{index + 1}</span>

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="h-8"
          />
        ) : (
          <span className="block truncate text-sm">{text}</span>
        )}
      </div>

      <OCRConfidenceIndicator confidence={confidence} size="sm" />

      <div className="flex items-center gap-1 shrink-0">
        {isEditing ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              className="h-7 w-7 p-0"
            >
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-7 w-7 p-0"
            >
              <X className="h-4 w-4 text-red-600" />
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEdit}
            className="h-7 w-7 p-0"
          >
            <Pencil className="h-4 w-4 text-gray-400" />
          </Button>
        )}
      </div>
    </div>
  );
}
