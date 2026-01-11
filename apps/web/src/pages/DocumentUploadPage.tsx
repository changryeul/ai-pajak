import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DocumentUpload, UploadStatusCard } from '@/components/ocr';
import { toast } from 'sonner';
import { fetchAllTaxCases, type TaxCaseSummary } from '@/api/taxcase';

type UploadState = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

/**
 * DocumentUploadPage - Simple document upload flow
 * Auto-selects available TaxCase for linking OCR results
 */
export function DocumentUploadPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlTaxCaseId = searchParams.get('taxCaseId') || undefined;

  // Auto-select TaxCase for OCR result storage
  const [taxCaseId, setTaxCaseId] = useState<string | undefined>(urlTaxCaseId);
  const [isLoadingTaxCase, setIsLoadingTaxCase] = useState(!urlTaxCaseId);

  // Upload state
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [documentId, setDocumentId] = useState<string | null>(null);

  // Auto-load first available TaxCase if not provided in URL
  useEffect(() => {
    if (urlTaxCaseId) {
      setTaxCaseId(urlTaxCaseId);
      setIsLoadingTaxCase(false);
      return;
    }

    const loadTaxCase = async () => {
      try {
        const data = await fetchAllTaxCases();
        if (data.length > 0) {
          setTaxCaseId(data[0].id);
        }
      } catch (error) {
        console.error('Failed to load tax cases:', error);
      } finally {
        setIsLoadingTaxCase(false);
      }
    };
    loadTaxCase();
  }, [urlTaxCaseId]);

  const handleUploadComplete = useCallback(
    (docId: string, jobId?: string) => {
      setDocumentId(docId);
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
  }, []);

  const handleViewResult = useCallback(() => {
    if (documentId) {
      navigate(`/documents/${documentId}/review`);
    }
  }, [documentId, navigate]);

  const canUpload = !isLoadingTaxCase;

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
            {isLoadingTaxCase ? (
              <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                로딩 중...
              </div>
            ) : (
              <DocumentUpload
                taxCaseId={taxCaseId}
                onUploadComplete={handleUploadComplete}
                onUploadError={handleUploadError}
              />
            )}
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
