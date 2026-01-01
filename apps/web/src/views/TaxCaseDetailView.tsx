import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getTaxCase } from '../services/taxCase.api';
import AnnualFiling from '../views/AnnualFiling';

export default function TaxCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const [taxCase, setTaxCase] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    getTaxCase(id)
      .then(setTaxCase)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!taxCase) return <div>No data</div>;

  return <AnnualFiling taxCase={taxCase} />;
}