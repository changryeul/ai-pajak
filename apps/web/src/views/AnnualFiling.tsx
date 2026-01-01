
import React, { useState, useContext, useMemo, useRef } from 'react';
import { Card, Button, Input, Badge, Label } from '../components/ui';
import { FORMATTER } from '../constants';
import { LanguageContext } from '../App';
import { simulateTaxCalculation } from '../services/gemini';

interface UploadDoc {
  id: string;
  labelKey: string;
  descriptionKey?: string;
  required: boolean;
  status: 'PENDING' | 'UPLOADED';
  fileName?: string;
}

type FilingPath = 'HAS_REPORT' | 'NEED_BUILDER' | null;

const AnnualFiling: React.FC = () => {
  const { t } = useContext(LanguageContext);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Select Path, 0: Doc Upload, 2: Final Review, 3: Results
  const [path, setPath] = useState<FilingPath>(null);
  const [results, setResults] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);

  // Define documents based on path
  const [docs, setDocs] = useState<UploadDoc[]>([]);

  const startPath = (selectedPath: FilingPath) => {
    setPath(selectedPath);
    if (selectedPath === 'HAS_REPORT') {
      setDocs([
        { id: 'bs', labelKey: 'balance_sheet', required: true, status: 'PENDING' },
        { id: 'pl', labelKey: 'income_statement', required: true, status: 'PENDING' },
        { id: 'gl', labelKey: 'doc_gl', descriptionKey: 'doc_gl_desc', required: true, status: 'PENDING' },
      ]);
    } else {
      setDocs([
        { id: 'bank', labelKey: 'doc_bank_statement', required: true, status: 'PENDING' },
        { id: 'sales', labelKey: 'doc_sales_ledger', required: true, status: 'PENDING' },
        { id: 'purchase', labelKey: 'doc_purchase_ledger', required: true, status: 'PENDING' },
        { id: 'payroll', labelKey: 'doc_payroll', required: false, status: 'PENDING' },
      ]);
    }
    setStep(0);
  };

  const [finData, setFinData] = useState({
    revenue: 5000000000,
    cogs: 3000000000,
    opex: 1000000000,
    assets: 12000000000,
    liabilities: 4000000000,
    equity: 8000000000
  });

  const uploadProgress = useMemo(() => {
    if (docs.length === 0) return 0;
    const uploaded = docs.filter(d => d.status === 'UPLOADED').length;
    return Math.round((uploaded / docs.length) * 100);
  }, [docs]);

  const canProceed = useMemo(() => {
    return docs.filter(d => d.required).every(d => d.status === 'UPLOADED');
  }, [docs]);

  const isBalanced = useMemo(() => {
    return finData.assets === (finData.liabilities + finData.equity);
  }, [finData]);

  const accuracyScore = useMemo(() => {
    let score = isBalanced ? 60 : 20;
    if (path === 'HAS_REPORT' && docs.find(d => d.id === 'gl')?.status === 'UPLOADED') score += 40;
    if (path === 'NEED_BUILDER' && uploadProgress === 100) score += 30;
    return Math.min(score, 100);
  }, [finData, isBalanced, docs, uploadProgress, path]);

  const triggerUpload = (id: string) => {
    setActiveUploadId(id);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeUploadId) {
      setDocs(prev => prev.map(d => 
        d.id === activeUploadId 
          ? { ...d, status: 'UPLOADED', fileName: file.name } 
          : d
      ));
    }
    // Reset input
    e.target.value = '';
    setActiveUploadId(null);
  };

  const removeFile = (id: string) => {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, status: 'PENDING', fileName: undefined } : d));
  };

  const handleAnalyze = async () => {
    if (!isBalanced) {
      alert(t.integrity_warning);
      return;
    }
    setLoading(true);
    try {
      const res = await simulateTaxCalculation({
        category: 'Annual Fiscal Reconciliation',
        lang: t.lang,
        data: {
          grossAmount: finData.revenue,
          expenses: finData.cogs + finData.opex,
          description: `Year-end audit. Path: ${path}. Balanced: ${isBalanced}. Integrity: ${accuracyScore}%. Has GL: ${docs.find(d => d.id === 'gl')?.status === 'UPLOADED'}.`,
          taxRegime: 'GENERAL_BOOKKEEPING'
        }
      });
      setResults(res);
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 pt-4">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleFileChange}
        accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx"
      />
      
      <header className="text-center space-y-2">
        <Badge variant="destructive" className="uppercase font-black px-4">Fiscal Year 2024</Badge>
        <h1 className="text-4xl font-black tracking-tighter italic">{t.annual_filing_title}</h1>
        <p className="text-slate-500 text-sm">{t.annual_filing_subtitle}</p>
      </header>

      {step === 1 && (
        <div className="grid md:grid-cols-2 gap-8">
           <Card className="flex flex-col items-center justify-center p-12 border-2 border-slate-800 bg-slate-900/20 hover:border-blue-500 transition-all cursor-pointer group" onClick={() => startPath('HAS_REPORT')}>
              <div className="text-6xl mb-6 group-hover:scale-110 transition-transform">📄</div>
              <h2 className="text-xl font-bold mb-2">{t.upload_report}</h2>
              <p className="text-xs text-slate-500 text-center max-w-[250px]">
                {t.lang === 'KR' ? '이미 BS, PL, GL이 준비되어 있습니다.' : 'Already have final BS, PL, and General Ledger.'}
              </p>
              <Button variant="outline" className="mt-8 pointer-events-none">{t.next} (Upload Files)</Button>
           </Card>

           <Card className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-800 bg-blue-600/5 hover:border-emerald-500 transition-all cursor-pointer group" onClick={() => startPath('NEED_BUILDER')}>
              <div className="text-6xl mb-6 group-hover:scale-110 transition-transform">🤖</div>
              <h2 className="text-xl font-bold mb-2 text-emerald-400">{t.no_report_yet}</h2>
              <p className="text-xs text-slate-500 text-center max-w-[250px]">{t.ai_ledger_helper}</p>
              <Button variant="secondary" className="mt-8 pointer-events-none">AI Smart Builder</Button>
           </Card>
        </div>
      )}

      {step === 0 && (
        <div className="space-y-6 animate-in zoom-in-95 duration-300">
           <Card className={`p-10 border-t-4 ${path === 'HAS_REPORT' ? 'border-t-blue-500' : 'border-t-emerald-500'} bg-slate-900/40`}>
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full ${path === 'HAS_REPORT' ? 'bg-blue-600' : 'bg-emerald-500'} flex items-center justify-center text-2xl`}>
                    {path === 'HAS_REPORT' ? '📁' : '⚡'}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {path === 'HAS_REPORT' ? (t.lang === 'KR' ? '재무제표 및 원장 업로드' : 'Upload Reports & GL') : (t.lang === 'KR' ? '기초 증빙 자료 업로드' : 'Upload Evidence Docs')}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {path === 'HAS_REPORT' 
                        ? (t.lang === 'KR' ? '세무 조정을 위해 총계정원장(GL)이 반드시 포함되어야 합니다.' : 'General Ledger (GL) is mandatory for tax reconciliation.')
                        : (t.lang === 'KR' ? '항목별 자료를 하나씩 업로드해 주세요.' : 'Please upload requested documents one by one.')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black text-slate-500 uppercase">{t.lang === 'KR' ? '자료 준비도' : 'Ready Score'}</p>
                   <p className={`text-3xl font-black ${uploadProgress === 100 ? 'text-emerald-500' : 'text-blue-400'}`}>{uploadProgress}%</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                 {docs.map(doc => (
                   <div key={doc.id} className={`p-5 rounded-2xl bg-slate-950 border transition-all ${doc.status === 'UPLOADED' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-800'}`}>
                      <div className="flex justify-between items-center">
                        <div className="space-y-1">
                          <h4 className="font-bold text-sm text-slate-200">
                            {t[doc.labelKey] || doc.labelKey}
                            {doc.required && <span className="text-red-500 ml-1">*</span>}
                          </h4>
                          {doc.fileName && <p className="text-[10px] text-emerald-400 font-mono truncate max-w-[200px]">{doc.fileName}</p>}
                          {doc.descriptionKey && !doc.fileName && <p className="text-[9px] text-slate-500 uppercase font-black">{t[doc.descriptionKey]}</p>}
                        </div>
                        {doc.status === 'UPLOADED' ? (
                          <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs">
                             <span className="flex items-center gap-1"><span className="text-sm">✓</span> {t.finish}</span>
                             <button onClick={() => removeFile(doc.id)} className="ml-2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors">✕</button>
                          </div>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => triggerUpload(doc.id)} className="text-[10px] h-8 px-4 font-black">UPLOAD FILE</Button>
                        )}
                      </div>
                   </div>
                 ))}
              </div>

              {!canProceed && (
                <div className="mt-8 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3">
                   <span className="text-xl">⚠️</span>
                   <p className="text-xs text-amber-500 font-medium">
                     {t.lang === 'KR' ? '필수 서류(*)가 모두 업로드되어야 다음 단계로 진행할 수 있습니다.' : 'All required documents (*) must be uploaded to proceed.'}
                   </p>
                </div>
              )}

              <div className="flex justify-between mt-12 pt-8 border-t border-slate-800">
                 <Button variant="ghost" onClick={() => setStep(1)}>{t.back}</Button>
                 <Button onClick={() => setStep(2)} disabled={!canProceed} className={`px-10 h-12 font-black shadow-xl ${path === 'HAS_REPORT' ? 'bg-blue-600 shadow-blue-600/20' : 'bg-emerald-600 shadow-emerald-500/20'}`}>
                   {t.next}: {t.data_integrity_check}
                 </Button>
              </div>
           </Card>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-8 animate-in slide-in-from-right-8 duration-300">
          <div className="grid lg:grid-cols-3 gap-6">
             <Card className="p-6 lg:col-span-1 h-fit">
                <h3 className="font-black text-slate-500 uppercase text-[10px] tracking-widest mb-4">{t.data_integrity_check}</h3>
                <div className="space-y-6">
                   <div className="flex justify-between items-end">
                      <span className="text-xs text-slate-400">{t.accuracy_score}</span>
                      <span className={`text-2xl font-black ${accuracyScore > 75 ? 'text-emerald-500' : 'text-amber-500'}`}>{accuracyScore}%</span>
                   </div>
                   <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-1000 ${accuracyScore > 75 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{width: `${accuracyScore}%`}}></div>
                   </div>
                   
                   <div className="space-y-2">
                     <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t.lang === 'KR' ? '무결성 점검 항목' : 'Integrity Checklist'}</p>
                     <div className="flex justify-between text-xs border-b border-slate-800 py-2">
                        <span>Balance Sheet Balance</span>
                        <span className={isBalanced ? 'text-emerald-500 font-bold' : 'text-red-500 font-bold'}>{isBalanced ? 'MATCH' : 'MISMATCH'}</span>
                     </div>
                     <div className="flex justify-between text-xs border-b border-slate-800 py-2">
                        <span>General Ledger (GL) Presence</span>
                        <span className={docs.find(d => d.id === 'gl')?.status === 'UPLOADED' ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'}>
                          {docs.find(d => d.id === 'gl')?.status === 'UPLOADED' ? 'VERIFIED' : 'AI SYNTHESIZED'}
                        </span>
                     </div>
                   </div>

                   {!isBalanced && (
                     <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                        <p className="text-[10px] text-red-400 font-bold leading-relaxed">{t.integrity_warning}</p>
                     </div>
                   )}
                </div>
             </Card>

             <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-8 space-y-6">
                  <h3 className="font-bold text-blue-400 uppercase tracking-widest text-xs">{t.balance_sheet}</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div><Label>{t.assets}</Label><Input type="number" value={finData.assets} onChange={e => setFinData({...finData, assets: Number(e.target.value)})} /></div>
                    <div><Label>{t.liabilities}</Label><Input type="number" value={finData.liabilities} onChange={e => setFinData({...finData, liabilities: Number(e.target.value)})} /></div>
                    <div><Label>{t.equity}</Label><Input type="number" value={finData.equity} onChange={e => setFinData({...finData, equity: Number(e.target.value)})} /></div>
                  </div>
                </Card>
                <Card className="p-8 space-y-6">
                  <h3 className="font-bold text-emerald-400 uppercase tracking-widest text-xs">{t.income_statement}</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div><Label>{t.revenue_total}</Label><Input type="number" value={finData.revenue} onChange={e => setFinData({...finData, revenue: Number(e.target.value)})} /></div>
                    <div><Label>{t.cogs}</Label><Input type="number" value={finData.cogs} onChange={e => setFinData({...finData, cogs: Number(e.target.value)})} /></div>
                    <div><Label>{t.opex}</Label><Input type="number" value={finData.opex} onChange={e => setFinData({...finData, opex: Number(e.target.value)})} /></div>
                  </div>
                </Card>
             </div>
          </div>
          <div className="flex flex-col items-center gap-6">
            <p className="text-[10px] text-slate-500 text-center max-w-2xl px-10 leading-relaxed uppercase tracking-tighter italic">
               {t.reconciliation_disclaimer}
            </p>
            <div className="flex gap-4 w-full max-w-md">
              <Button variant="outline" className="flex-1 h-14 font-black" onClick={() => setStep(0)}>{t.back}</Button>
              <Button className="flex-2 h-14 px-12 font-black text-lg bg-blue-600 shadow-xl shadow-blue-600/20" onClick={handleAnalyze} disabled={loading || !isBalanced}>
                {loading ? t.analyzing : t.analyze_reconciliation}
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && results && (
        <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6 bg-slate-900 border-slate-800">
               <Label className="text-[10px] uppercase font-bold text-slate-500">Accounting Profit</Label>
               <div className="text-2xl font-black text-white">{FORMATTER.format(finData.revenue - finData.cogs - finData.opex)}</div>
            </Card>
            <Card className="p-6 bg-slate-900 border-red-500/20">
               <Label className="text-[10px] uppercase font-bold text-red-400">{t.non_deductible}</Label>
               <div className="text-2xl font-black text-red-500">{FORMATTER.format(results.totalTaxDue * 0.15)}</div>
            </Card>
            <Card className="p-6 bg-blue-600 shadow-xl shadow-blue-600/20">
               <Label className="text-[10px] uppercase font-bold text-blue-100">{t.fiscal_profit}</Label>
               <div className="text-2xl font-black text-white">{FORMATTER.format(finData.revenue - finData.cogs - finData.opex + (results.totalTaxDue * 0.15))}</div>
            </Card>
          </div>

          <Card className="p-8 bg-slate-900 border-slate-800">
            <h3 className="font-bold mb-4 flex items-center gap-2">🤖 {t.advice_label}</h3>
            <p className="text-sm text-slate-400 leading-relaxed italic">"{results.aiAdvice}"</p>
            <div className="mt-8 flex gap-4">
               <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>{t.back}</Button>
               <Button className="flex-1 font-black">{t.lang === 'KR' ? '상담원에게 결산 검토 요청' : 'Send to Consultant for Final Review'}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AnnualFiling;
