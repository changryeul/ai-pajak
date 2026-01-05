import { useParams, useNavigate } from 'react-router-dom';
import { OCRReviewPanel } from '@/components/ocr/OCRReviewPanel';
import { useOcrResult } from '@/hooks/useOcrResult';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * Story 2-5: OCR Review Page
 * Page for reviewing and editing OCR extraction results
 * Uses React Query for data fetching (Task 9.2)
 */
export function OCRReview() {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();

  const {
    ocrResult,
    isLoading,
    isConfirming,
    error,
    handleFieldUpdate,
    handleConfirm,
  } = useOcrResult({ documentId: documentId || '' });

  const handleBack = () => {
    navigate(-1);
  };

  const handleConfirmReview = async (updates: Parameters<typeof handleConfirm>[0]) => {
    await handleConfirm(updates);
    // Navigate back after successful confirmation
    navigate(-1);
  };

  if (!documentId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900">Invalid Document</h1>
          <p className="text-gray-600 mt-2">No document ID provided</p>
          <Button onClick={handleBack} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading OCR results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900">Error Loading OCR Result</h1>
          <p className="text-gray-600 mt-2">{error}</p>
          <div className="flex gap-2 justify-center mt-4">
            <Button variant="outline" onClick={handleBack}>
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!ocrResult) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900">No OCR Result</h1>
          <p className="text-gray-600 mt-2">OCR processing may still be in progress</p>
          <div className="flex gap-2 justify-center mt-4">
            <Button variant="outline" onClick={handleBack}>
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Check if already reviewed
  if (ocrResult.status === 'REVIEWED') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900">Already Reviewed</h1>
          <p className="text-gray-600 mt-2">This document has already been reviewed</p>
          <Button onClick={handleBack} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">OCR Review</h1>
            <p className="text-sm text-gray-500">Document ID: {documentId}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 min-h-0">
        <OCRReviewPanel
          ocrResult={ocrResult}
          onFieldUpdate={handleFieldUpdate}
          onConfirm={handleConfirmReview}
          isConfirming={isConfirming}
        />
      </main>
    </div>
  );
}
