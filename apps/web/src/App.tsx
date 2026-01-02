import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Landing from './views/Landing';

function LandingWrapper() {
  const navigate = useNavigate();

  return (
    <Landing
      onStart={() => navigate('/tax-cases/1')}
    />
  );
}

function TaxCase() {
  return <h1 style={{ color: 'white' }}>📄 Tax Case OK</h1>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingWrapper />} />
        <Route path="/tax-cases/:id" element={<TaxCase />} />
      </Routes>
    </BrowserRouter>
  );
}