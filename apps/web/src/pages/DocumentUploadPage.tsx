import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DocumentUpload, UploadStatusCard } from '@/components/ocr';
import { toast } from 'sonner';

type UploadState = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

/**
 * DocumentUploadPage - Page for uploading tax documents
 * Supports optional taxCaseId query parameter for association
 */
export function DocumentUploadPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const taxCaseId = searchParams.get('taxCaseId') || undefined;

  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [ocrJobId, setOcrJobId] = useState<string | null>(null);

  const handleUploadComplete = useCallback(
    (docId: string, jobId?: string) => {
      setDocumentId(docId);
      setOcrJobId(jobId || null);
      setUploadState('processing');
      toast.success('파일 업로드 완료', {
        description: 'OCR 처리를 시작합니다.',
      });
    },
    [],
  );

  const handleUploadError = useCallback((error: string) => {
    setUploadState('error');
    toast.error('업로드 실패', {
      description: error,
    });
  }, []);

  const handleOcrComplete = useCallback(() => {
    setUploadState('completed');
    toast.success('OCR 처리 완료', {
      description: '문서 분석이 완료되었습니다.',
    });
  }, []);

  const handleOcrError = useCallback((error: string) => {
    setUploadState('error');
    toast.error('OCR 처리 실패', {
      description: error,
    });
  }, []);

  const handleReset = useCallback(() => {
    setUploadState('idle');
    setDocumentId(null);
    setOcrJobId(null);
  }, []);

  const handleViewResult = useCallback(() => {
    if (documentId) {
      // TODO: Navigate to OCR review page when implemented (Story 2-5)
      navigate(`/documents/${documentId}/review`);
    }
  }, [documentId, navigate]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6" />
            문서 업로드
          </h1>
          <p className="text-muted-foreground">
            세금 관련 문서를 업로드하면 OCR로 자동 분석됩니다.
          </p>
        </div>
      </div>

      {/* Tax Case Info (if linked) */}
      {taxCaseId && (
        <Card className="bg-muted/50">
          <CardContent className="py-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Tax Case ID:</span> {taxCaseId}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Upload Section */}
      {(uploadState === 'idle' || uploadState === 'uploading' || uploadState === 'error') && (
        <Card>
          <CardHeader>
            <CardTitle>파일 선택</CardTitle>
            <CardDescription>
              PDF, JPG, PNG 형식의 파일을 업로드할 수 있습니다. (최대 10MB)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DocumentUpload
              taxCaseId={taxCaseId}
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
            />
          </CardContent>
        </Card>
      )}

      {/* Processing Status Section */}
      {(uploadState === 'processing' || uploadState === 'completed') && documentId && (
        <div className="space-y-4">
          <UploadStatusCard
            documentId={documentId}
            onComplete={handleOcrComplete}
            onError={handleOcrError}
          />

          {/* Action Buttons */}
          <div className="flex gap-3">
            {uploadState === 'completed' && (
              <Button onClick={handleViewResult}>
                결과 확인
              </Button>
            )}
            <Button variant="outline" onClick={handleReset}>
              새 문서 업로드
            </Button>
          </div>
        </div>
      )}

      {/* Upload Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">업로드 안내</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• 지원 형식: PDF, JPG, JPEG, PNG</li>
            <li>• 최대 파일 크기: 10MB</li>
            <li>• 스캔 문서는 해상도 300dpi 이상을 권장합니다.</li>
            <li>• 텍스트가 선명하게 보이는 문서일수록 OCR 정확도가 높습니다.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export default DocumentUploadPage;
