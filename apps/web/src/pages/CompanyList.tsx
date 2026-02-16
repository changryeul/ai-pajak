import { useEffect, useState } from 'react';
import { fetchAllCompanies, CompanySummary as Company } from '../api/company';
import { Card, CardHeader, CardContent, Button } from '../components/ui';
import { useNavigate } from 'react-router-dom';

export function CompanyListPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const nav = useNavigate();

  useEffect(() => {
    fetchAllCompanies().then(setCompanies);
  }, []);

  return (
    <Card>
      <CardHeader title="Companies" />
      <CardContent>
        {companies.map(c => (
          <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>{c.name}</div>
            <Button
              variant="secondary"
              onClick={() => nav(`/companies/${c.id}/tax-cases`)}
            >
              View Tax Cases
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}