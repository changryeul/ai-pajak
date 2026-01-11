import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, FileText, Building2, RefreshCw, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAllTaxCases, type TaxCaseSummary } from '@/api/taxcase';

/**
 * Get workflow stage badge variant
 */
function getStageVariant(stage: string): 'default' | 'secondary' | 'outline' {
  switch (stage) {
    case 'UPLOADED':
      return 'outline';
    case 'AI_ANALYZED':
      return 'secondary';
    case 'HUMAN_REVIEW':
      return 'default';
    case 'APPROVED':
      return 'secondary';
    default:
      return 'outline';
  }
}

/**
 * Get workflow stage display name
 */
function getStageName(stage: string): string {
  switch (stage) {
    case 'UPLOADED':
      return '업로드됨';
    case 'AI_ANALYZED':
      return 'AI 분석 완료';
    case 'HUMAN_REVIEW':
      return '검토 중';
    case 'APPROVED':
      return '승인됨';
    case 'FILED':
      return '신고 완료';
    default:
      return stage;
  }
}

/**
 * InProgressPage - Shows tax cases that are currently in progress
 * (Not yet FILED)
 */
export function InProgressPage() {
  const navigate = useNavigate();
  const [taxCases, setTaxCases] = useState<TaxCaseSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTaxCases = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAllTaxCases();
      // Filter to only show in-progress cases (not FILED)
      const inProgress = data.filter(tc => tc.workflowStage !== 'FILED');
      setTaxCases(inProgress);
    } catch (err) {
      setError('TaxCase 목록을 불러오는데 실패했습니다.');
      console.error('Failed to load tax cases:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTaxCases();
  }, []);

  const handleViewCase = (id: string) => {
    navigate(`/tax-cases/${id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">진행 중인 신고</h1>
            <p className="text-muted-foreground">
              현재 처리 중인 세금 신고 건을 확인합니다.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadTaxCases}>
          <RefreshCw className="h-4 w-4 mr-2" />
          새로고침
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-40" />
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
      ) : taxCases.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>진행 중인 신고 건이 없습니다.</p>
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
          {taxCases.map((tc) => (
            <Card key={tc.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {tc.companyName}
                  </CardTitle>
                  <Badge variant={getStageVariant(tc.workflowStage || 'UPLOADED')}>
                    {getStageName(tc.workflowStage || 'UPLOADED')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">세금 유형:</span>{' '}
                    <span className="font-medium">{tc.taxType}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">기간:</span>{' '}
                    <span className="font-medium">{tc.period}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">생성일:</span>{' '}
                    <span className="font-medium">
                      {new Date(tc.createdAt).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewCase(tc.id)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      상세보기
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {!isLoading && !error && taxCases.length > 0 && (
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">총 {taxCases.length}건 진행 중</span>
              <Button variant="link" onClick={() => navigate('/documents/upload')}>
                새 문서 업로드
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default InProgressPage;
