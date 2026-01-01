// src/pages/HomePage.tsx
import { Link } from 'react-router-dom';
import { Card, Button } from '../components/ui';
/*
export default function HomePage() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-black">AI Pajak UI Running</h1>

      <Card>
        <div className="text-sm text-slate-600 mb-3">
          아래 링크로 TaxCaseDetail UI(stage별 버튼 상태)를 확인하세요.
        </div>

        <div className="flex gap-2 flex-wrap">
          {[1,2,3,4,5].map((id) => (
            <Link key={id} to={`/tax-cases/${id}`}>
              <Button variant="outline">/tax-cases/{id}</Button>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
  */

export default function HomePage() {
     console.log('✅ HomePage rendered');
  return (
    <div style={{ padding: 40 }}>
      <h1>HOME PAGE</h1>
      <p>Router works</p>
    </div>
  );
}