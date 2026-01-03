import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Landing from './views/Landing';
import TaxCaseDetail from './views/TaxCaseDetail';

function LandingWrapper() {
  const navigate = useNavigate();

  return (
    <Landing
      onStart={() => {
        console.log('🚀 NAVIGATE TO TAX CASE');
        navigate('/tax-cases/1');
      }}
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingWrapper />} />
        <Route path="/tax-cases/:id" element={<TaxCaseDetail />} />
      </Routes>
    </BrowserRouter>
  );
}