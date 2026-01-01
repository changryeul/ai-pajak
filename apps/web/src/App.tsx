import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import TaxCasePage from './pages/TaxCasePage';

export default function App() {
     console.log('✅ App rendered');
     
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tax-cases/:id" element={<TaxCasePage />} />
      </Routes>
    </BrowserRouter>
  );
}