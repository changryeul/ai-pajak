import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, RefreshCw, Eye, Upload, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface Document {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  taxCaseId?: string;
  ocrJobId?: string;
  createdAt: string;
}

async function fetchDocuments(): Promise<Document[]> {
  const response = await fetch('/api/documents');
  if (!response.ok) {
    throw new Error('Failed to fetch documents');
  }
  return response.json();
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'PROCESSING':
      return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
    case 'FAILED':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'COMPLETED':
      return 'default';
    case 'PROCESSING':
      return 'secondary';
    case 'FAILED':
      return 'destructive';
    default:
      return 'outline';
  }
}

function getStatusName(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'OCR 완료';
    case 'PROCESSING':
      return '처리 중';
    case 'FAILED':
      return '실패';
    case 'PENDING':
      return '대기 중';
    default:
      return status;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsPage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchDocuments();
      setDocuments(data);
    } catch (err) {
      setError('문서 목록을 불러오는데 실패했습니다.');
      console.error('Failed to load documents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleReview = (id: string) => {
    navigate(`/documents/${id}/review`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">문서 관리</h1>
            <p className="text-muted-foreground">
              업로드된 문서와 OCR 결과를 확인합니다.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadDocuments}>
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </Button>
          <Button size="sm" onClick={() => navigate('/documents/upload')}>
            <Upload className="h-4 w-4 mr-2" />
            새 문서 업로드
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-60" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>업로드된 문서가 없습니다.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate('/documents/upload')}
            >
              새 문서 업로드
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => (
            <Card key={doc.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {doc.originalName}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(doc.status)}
                    <Badge variant={getStatusBadgeVariant(doc.status)}>
                      {getStatusName(doc.status)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">ID:</span>{' '}
                    <span className="font-medium">{doc.id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">타입:</span>{' '}
                    <span className="font-medium">{doc.mimeType.split('/')[1].toUpperCase()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">크기:</span>{' '}
                    <span className="font-medium">{formatFileSize(doc.size)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">업로드:</span>{' '}
                    <span className="font-medium">
                      {new Date(doc.createdAt).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    {doc.status === 'COMPLETED' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReview(doc.id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        OCR 결과 보기
                      </Button>
                    )}
                    {doc.status === 'PROCESSING' && (
                      <span className="text-sm text-muted-foreground">처리 중...</span>
                    )}
                    {doc.status === 'FAILED' && (
                      <span className="text-sm text-red-500">OCR 실패</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {!isLoading && !error && documents.length > 0 && (
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                총 {documents.length}개 문서 |{' '}
                완료: {documents.filter(d => d.status === 'COMPLETED').length} |{' '}
                처리중: {documents.filter(d => d.status === 'PROCESSING').length}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default DocumentsPage;
