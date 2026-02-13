'use client';

import { SPT1771Generator } from '@/components/spt';

export default function SPT1771TestPage() {
  // Test corporate customer data
  const testCustomer = {
    id: '00000000-0000-0000-0000-000000000099',
    name: 'PT Test Indonesia',
    npwp: '01.234.567.8-901.234',
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">SPT 1771 Test</h1>
        <p className="text-gray-600">
          Corporate Tax Return Generator - Test Page
        </p>
      </div>

      <SPT1771Generator
        customerId={testCustomer.id}
        customerName={testCustomer.name}
        customerNpwp={testCustomer.npwp}
        onComplete={(data) => {
          console.log('SPT 1771 Generated:', data);
        }}
      />
    </div>
  );
}
