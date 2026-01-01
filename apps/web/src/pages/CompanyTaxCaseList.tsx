import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchCompanyTaxCases, TaxCaseSummary } from '../api/taxcase';
import { Card, CardHeader, CardContent, Badge, Button } from '../components/ui';

export function CompanyTaxCaseListPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [cases, setCases] = useState<TaxCaseSummary[]>([]);
  const nav = useNavigate();

  useEffect(() => {
    if (companyId) {
      fetchCompanyTaxCases(companyId).then(setCases);
    }
  }, [companyId]);

  return (
    <Card>
      <CardHeader title={`Tax Cases (Company #${companyId})`} />
      <CardContent>
        {cases.map(tc => (
          <div key={tc.id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>Case #{tc.id}</div>
            <Badge variant="secondary">{tc.workflowStage}</Badge>
            <Button onClick={() => nav(`/tax-cases/${tc.id}`)}>
              Open
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}