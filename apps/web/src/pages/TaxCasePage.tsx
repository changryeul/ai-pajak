// src/pages/TaxCasePage.tsx
import { useParams } from 'react-router-dom';

export default function TaxCasePage() {
  const { id } = useParams();

  return (
    <div className="p-10 text-white">
      <h1 className="text-2xl font-black">Tax Case Detail</h1>
      <p>Tax Case ID: {id}</p>
    </div>
  );
}