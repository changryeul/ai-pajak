import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, FileText, Building2, RefreshCw, Eye, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAllTaxCases, type TaxCaseSummary } from '@/api/taxcase';

/**
 * CompletedPage - Shows completed tax cases (FILED status)
 */
export function CompletedPage() {
  const navigate = useNavigate();
  const [taxCases, setTaxCases] = useState<TaxCaseSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTaxCases = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAllTaxCases();
      // Filter to only show completed cases (FILED)
      const completed = data.filter(tc => tc.workflowStage === 'FILED');
      setTaxCases(completed);
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
          <CheckCircle className="h-6 w-6 text-green-600" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">완료된 신고</h1>
            <p className="text-muted-foreground">
              신고가 완료된 세금 건을 확인합니다.
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
            <p>완료된 신고 건이 없습니다.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate('/tax-cases/in-progress')}
            >
              진행 중인 신고 보기
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
                  <Badge variant="default" className="bg-green-600">
                    신고 완료
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
                    <span className="text-muted-foreground">신고일:</span>{' '}
                    <span className="font-medium">
                      {new Date(tc.createdAt).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewCase(tc.id)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      상세보기
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled
                      title="Coming soon"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      영수증
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
        <Card className="bg-green-50 dark:bg-green-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                총 {taxCases.length}건 신고 완료
              </span>
              <div className="flex gap-2">
                <Button variant="link" onClick={() => navigate('/tax-cases/in-progress')}>
                  진행 중인 신고
                </Button>
                <Button variant="link" onClick={() => navigate('/documents/upload')}>
                  새 문서 업로드
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics (if there are completed cases) */}
      {!isLoading && !error && taxCases.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">이번 달 신고</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {taxCases.filter(tc => {
                  const date = new Date(tc.createdAt);
                  const now = new Date();
                  return date.getMonth() === now.getMonth() &&
                         date.getFullYear() === now.getFullYear();
                }).length}건
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">PPh21 신고</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {taxCases.filter(tc => tc.taxType === 'PPh21').length}건
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">VAT 신고</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {taxCases.filter(tc => tc.taxType === 'VAT').length}건
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default CompletedPage;
