import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import {
  getOcrResult,
  confirmOcrReview,
  type OcrResultResponse,
  type OcrFieldUpdate,
} from '@/api/document.api';

export interface UseOcrResultOptions {
  documentId: string;
}

export interface UseOcrResultReturn {
  ocrResult: OcrResultResponse | null;
  isLoading: boolean;
  isConfirming: boolean;
  error: string | null;
  fetchOcrResult: () => void;
  handleFieldUpdate: (index: number, newValue: string) => void;
  handleConfirm: (updates: OcrFieldUpdate[]) => Promise<void>;
  localUpdates: Map<number, string>;
}

/**
 * Story 2-5: useOcrResult Hook
 * Task 9.2: Uses React Query for OCR result fetching and mutations
 */
export function useOcrResult({ documentId }: UseOcrResultOptions): UseOcrResultReturn {
  const queryClient = useQueryClient();
  const [localUpdates, setLocalUpdates] = useState<Map<number, string>>(new Map());

  // Query for fetching OCR result
  const {
    data: ocrResult,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery<OcrResultResponse>({
    queryKey: ['ocr-result', documentId],
    queryFn: () => getOcrResult(documentId),
    enabled: !!documentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutation for confirming OCR review
  const confirmMutation = useMutation({
    mutationFn: (updates: OcrFieldUpdate[]) => confirmOcrReview(documentId, updates),
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['ocr-result', documentId] });
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      setLocalUpdates(new Map());
    },
  });

  const handleFieldUpdate = useCallback((index: number, newValue: string) => {
    setLocalUpdates(prev => {
      const next = new Map(prev);
      next.set(index, newValue);
      return next;
    });

    // Optimistically update the query cache
    queryClient.setQueryData<OcrResultResponse>(
      ['ocr-result', documentId],
      (old) => {
        if (!old) return old;
        const newResults = [...old.results];
        newResults[index] = { ...newResults[index], text: newValue };
        return { ...old, results: newResults };
      }
    );
  }, [documentId, queryClient]);

  const handleConfirm = useCallback(async (updates: OcrFieldUpdate[]) => {
    await confirmMutation.mutateAsync(updates);
  }, [confirmMutation]);

  const fetchOcrResult = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    ocrResult: ocrResult ?? null,
    isLoading,
    isConfirming: confirmMutation.isPending,
    error: queryError ? (queryError as Error).message : null,
    fetchOcrResult,
    handleFieldUpdate,
    handleConfirm,
    localUpdates,
  };
}
