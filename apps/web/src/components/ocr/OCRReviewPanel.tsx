import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DocumentPreview } from './DocumentPreview';
import { ExtractedDataField } from './ExtractedDataField';
import { ExtractedDataTable } from './ExtractedDataTable';
import { OCRConfidenceIndicator } from './OCRConfidenceIndicator';
import type { OcrResultResponse, OcrFieldUpdate } from '@/api/document.api';
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

export interface OCRReviewPanelProps {
  ocrResult: OcrResultResponse;
  onFieldUpdate: (index: number, newValue: string) => void;
  onConfirm: (updates: OcrFieldUpdate[]) => Promise<void>;
  isConfirming?: boolean;
}

/**
 * Story 2-5: OCR Review Panel
 * Main panel for reviewing and editing OCR results
 */
export function OCRReviewPanel({
  ocrResult,
  onFieldUpdate,
  onConfirm,
  isConfirming = false,
}: OCRReviewPanelProps) {
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState<Map<number, string>>(new Map());

  // Helper to normalize confidence from decimal (0-1) to percentage (0-100)
  const normalizeConfidence = (conf: number | null) => {
    if (conf === null) return null;
    return conf <= 1 ? conf * 100 : conf;
  };

  // Calculate average confidence
  const avgConfidence = useMemo(() => {
    const validResults = ocrResult.results.filter(r => r.confidence !== null);
    if (validResults.length === 0) return null;
    const sum = validResults.reduce((acc, r) => acc + (normalizeConfidence(r.confidence) || 0), 0);
    return sum / validResults.length;
  }, [ocrResult.results]);

  // Count low confidence fields (< 70%)
  const lowConfidenceCount = useMemo(() => {
    return ocrResult.results.filter(r => {
      const normalized = normalizeConfidence(r.confidence);
      return normalized !== null && normalized < 70;
    }).length;
  }, [ocrResult.results]);

  const handleFieldUpdate = (index: number, newValue: string) => {
    setPendingUpdates(prev => new Map(prev).set(index, newValue));
    onFieldUpdate(index, newValue);
  };

  const handleConfirm = async () => {
    const updates: OcrFieldUpdate[] = Array.from(pendingUpdates.entries()).map(
      ([index, newValue]) => ({ index, newValue })
    );
    await onConfirm(updates);
    setPendingUpdates(new Map());
  };

  const highlightedBbox = highlightedIndex !== null
    ? ocrResult.results[highlightedIndex]?.bbox
    : undefined;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
      {/* Left Panel - Document Preview */}
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Document Preview</CardTitle>
        </CardHeader>
        <CardContent className="h-[calc(100%-60px)]">
          <DocumentPreview
            fileUrl={ocrResult.fileUrl}
            mimeType={ocrResult.mimeType}
            highlightedBbox={highlightedBbox}
          />
        </CardContent>
      </Card>

      {/* Right Panel - Extracted Data */}
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Extracted Data</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {ocrResult.engine}
              </Badge>
              {ocrResult.fallbackUsed && (
                <Badge variant="secondary" className="text-xs">
                  Fallback
                </Badge>
              )}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <span>Confidence:</span>
              <OCRConfidenceIndicator confidence={avgConfidence} size="sm" />
            </div>
            <div className="flex items-center gap-1">
              <span>Fields:</span>
              <span className="font-medium">{ocrResult.results.length}</span>
            </div>
            {lowConfidenceCount > 0 && (
              <div className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span>{lowConfidenceCount} low confidence</span>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-2">
              {ocrResult.results.map((result, index) => (
                <ExtractedDataField
                  key={index}
                  index={index}
                  text={pendingUpdates.get(index) ?? result.text}
                  confidence={result.confidence}
                  onUpdate={handleFieldUpdate}
                  isHighlighted={highlightedIndex === index}
                  onFocus={() => setHighlightedIndex(index)}
                />
              ))}
            </div>

            {/* Tables */}
            {ocrResult.tables && ocrResult.tables.length > 0 && (
              <div className="mt-6 space-y-4">
                <h3 className="font-medium text-gray-700">Tables</h3>
                {ocrResult.tables.map((table, index) => (
                  <ExtractedDataTable
                    key={index}
                    table={table}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-4 mt-4 border-t">
            <div className="text-sm text-gray-500">
              {pendingUpdates.size > 0 && (
                <span className="text-amber-600">
                  {pendingUpdates.size} pending changes
                </span>
              )}
            </div>
            <Button
              onClick={handleConfirm}
              disabled={isConfirming}
              className="min-w-[150px]"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Review
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
