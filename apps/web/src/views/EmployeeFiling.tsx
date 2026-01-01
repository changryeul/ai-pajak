
import React, { useState, useContext, useRef } from 'react';
import { Card, Button, Input, Badge, Label } from '../apps/web/src/components/ui';
import { FORMATTER } from '../constants';
import { LanguageContext } from '../App';
import { User, CustomerType } from '../types';
import { simulateTaxCalculation } from '../apps/web/src/services/gemini';

const EmployeeFiling: React.FC<{ user: User }> = ({ user }) => {
  const { t } = useContext(LanguageContext);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: user.name,
    npwp: user.npwp || '',
    status: 'TK/0',
    grossIncome: 0,
    withheldTax: 0,
    otherIncome: 0,
    assets: 0,
    debts: 0,
    fileName: ''
  });

  const isSS = user.customerType === CustomerType.INDIVIDUAL_SS;
  const filingTitle = isSS ? t.file_1770ss : t.file_1770s;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLoading(true);
      // Simulate AI OCR Extraction from 1721-A1
      setTimeout(() => {
        setFormData({
          ...formData,
          fileName: file.name,
          grossIncome: isSS ? 55000000 : 125000000,
          withheldTax: isSS ? 0 : 8500000
        });
        setLoading(false);
      }, 1500);
    }
  };

  const handleNextStep = async () => {
    if (step === 5) {
      setLoading(true);
      try {
        const res = await simulateTaxCalculation({
          category: `Annual Individual Filing ${isSS ? '1770SS' : '1770S'}`,
          lang: t.lang,
          data: {
            customerType: user.customerType,
            grossAmount: formData.grossIncome + formData.otherIncome,
            expenses: 0,
            description: `Employee annual filing. Status: ${formData.status}. Assets: ${formData.assets}. Debts: ${formData.debts}. Withheld: ${formData.withheldTax}`
          }
        });
        setResults(res);
        setStep(6);
      } finally {
        setLoading(false);
      }
    } else {
      setStep(step + 1);
    }
  };

  const GuideBox = ({ title, content }: { title: string; content: string }) => (
    <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-6 mb-8 flex gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl shrink-0">💡</div>
      <div>
        <h4 className="font-black text-blue-400 text-xs uppercase tracking-widest mb-1">{title}</h4>
        <p className="text-sm text-slate-300 leading-relaxed font-medium">{content}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-10 py-10 animate-in fade-in duration-700">
      <header className="text-center space-y-4">
        <Badge variant="warning" className="font-black uppercase tracking-widest px-4">{isSS ? 'SPT 1770SS' : 'SPT 1770S'}</Badge>
        <h1 className="text-5xl font-black tracking-tighter italic text-white uppercase">{filingTitle} 2024</h1>
        <div className="flex justify-center gap-2 mt-4">
          {[1, 2, 3, 4, 5].map(s => (
            <div key={s} className={`h-1.5 w-12 rounded-full transition-all duration-500 ${step >= s ? 'bg-amber-500 shadow-lg shadow-amber-500/20' : 'bg-slate-800'}`}></div>
          ))}
        </div>
      </header>

      <Card className="p-10 border-slate-800 bg-slate-900/40 relative overflow-hidden">
        {step === 1 && (
          <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
            <h2 className="text-2xl font-black text-white italic">{t.emp_wizard_step1}</h2>
            <GuideBox title="STEP 1 Guide" content={t.emp_wizard_step1_guide} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>{t.name_label}</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>{t.npwp_label}</Label>
                <Input value={formData.npwp} className="mono" onChange={e => setFormData({...formData, npwp: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>{t.lang === 'KR' ? '인적공제 상태 (PTKP)' : 'PTKP Status'}</Label>
                <select className="w-full bg-slate-950 border border-slate-800 rounded-md h-10 px-3 text-sm text-white outline-none" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                   <option value="TK/0">TK/0 (Single)</option>
                   <option value="K/0">K/0 (Married)</option>
                   <option value="K/1">K/1 (Married, 1 Child)</option>
                   <option value="K/2">K/2 (Married, 2 Children)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
            <h2 className="text-2xl font-black text-white italic">{t.upload_a1_title}</h2>
            <GuideBox title="STEP 2 Guide" content={t.emp_wizard_step2_guide} />
            <div className="text-center space-y-2">
              <p className="text-xs text-slate-500 max-w-md mx-auto">{t.upload_a1_desc}</p>
            </div>

            {!formData.fileName ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="h-64 border-2 border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-amber-500/5 hover:border-amber-500/30 transition-all group"
              >
                <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">📄</div>
                <p className="text-sm font-bold text-slate-500">{t.lang === 'KR' ? '파일 업로드 (테스트 시 바로 다음 버튼 클릭)' : 'Click to Upload 1721-A1 (or just click Next for test)'}</p>
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg" />
              </div>
            ) : (
              <div className="p-8 bg-slate-950 rounded-3xl border border-emerald-500/30 space-y-6">
                 <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                    <span className="text-emerald-500 font-bold flex items-center gap-2">✓ {formData.fileName}</span>
                    <Button variant="ghost" size="sm" onClick={() => setFormData({...formData, fileName: '', grossIncome: 0, withheldTax: 0})} className="text-red-400">Re-upload</Button>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label className="text-emerald-500/60">{t.extracted_income}</Label>
                      <p className="text-2xl font-black text-white mono mt-1">{FORMATTER.format(formData.grossIncome)}</p>
                    </div>
                    <div>
                      <Label className="text-emerald-500/60">{t.extracted_tax}</Label>
                      <p className="text-2xl font-black text-white mono mt-1">{FORMATTER.format(formData.withheldTax)}</p>
                    </div>
                 </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
            <h2 className="text-2xl font-black text-white italic">{t.emp_wizard_step3}</h2>
            <GuideBox title="STEP 3 Guide" content={t.emp_wizard_step3_guide} />
            <p className="text-xs text-slate-500">{t.lang === 'KR' ? '이자, 배당금, 임대 소득 등 근로 소득 외에 다른 수입이 있으신가요?' : 'Do you have other income like interest, dividends, or rent?'}</p>
            <div className="space-y-4 max-w-md">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">Rp</span>
                <Input 
                  type="number" 
                  className="pl-10 h-12 text-lg font-black mono" 
                  value={formData.otherIncome || ''} 
                  onChange={e => setFormData({...formData, otherIncome: Number(e.target.value)})}
                />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
            <h2 className="text-2xl font-black text-white italic">{t.emp_wizard_step4}</h2>
            <GuideBox title="STEP 4 Guide" content={t.emp_wizard_step4_guide} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-2">
                 <Label>{t.lang === 'KR' ? '총 자산 합계' : 'Total Assets'}</Label>
                 <Input type="number" placeholder="Rp" value={formData.assets || ''} onChange={e => setFormData({...formData, assets: Number(e.target.value)})} />
               </div>
               <div className="space-y-2">
                 <Label>{t.lang === 'KR' ? '총 부채 합계' : 'Total Debts'}</Label>
                 <Input type="number" placeholder="Rp" value={formData.debts || ''} onChange={e => setFormData({...formData, debts: Number(e.target.value)})} />
               </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
            <h2 className="text-2xl font-black text-white italic">{t.emp_wizard_step5}</h2>
            <GuideBox title="STEP 5 Guide" content={t.emp_wizard_step5_guide} />
            <div className="p-8 bg-slate-950 rounded-3xl border border-slate-800 space-y-4">
               <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-xs text-slate-500">Form Type</span>
                  <span className="text-sm font-bold text-white">{isSS ? '1770SS' : '1770S'}</span>
               </div>
               <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-xs text-slate-500">Net Income</span>
                  <span className="text-sm font-bold text-white mono">{FORMATTER.format(formData.grossIncome + formData.otherIncome)}</span>
               </div>
               <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-xs text-slate-500">Tax Withheld</span>
                  <span className="text-sm font-bold text-emerald-500 mono">{FORMATTER.format(formData.withheldTax)}</span>
               </div>
            </div>
            <p className="text-xs text-slate-500 italic text-center leading-relaxed">
              {t.reconciliation_disclaimer}
            </p>
          </div>
        )}

        {step === 6 && results && (
           <div className="space-y-8 animate-in zoom-in-95 duration-500">
              <div className="text-center space-y-2">
                <div className="text-5xl mb-4">🎉</div>
                <h2 className="text-3xl font-black text-white italic">{t.lang === 'KR' ? '분석이 완료되었습니다!' : 'Analysis Complete!'}</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                 <Card className="p-6 bg-slate-950 border-slate-800">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">{t.lang === 'KR' ? '최종 납부/환급액' : 'Final Payable/Refund'}</p>
                    <p className={`text-3xl font-black mono ${results.totalTaxDue <= formData.withheldTax ? 'text-emerald-500' : 'text-amber-500'}`}>
                       {FORMATTER.format(results.totalTaxDue - formData.withheldTax)}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-2 font-medium">
                       {results.totalTaxDue <= formData.withheldTax ? 'Status: Lebih Bayar (Refundable)' : 'Status: Kurang Bayar (Payable)'}
                    </p>
                 </Card>
                 <Card className="p-6 bg-blue-600 shadow-xl shadow-blue-600/20 flex flex-col justify-center">
                    <p className="text-[10px] text-blue-100 font-black uppercase tracking-widest mb-1">{t.advice_label}</p>
                    <p className="text-xs text-white leading-relaxed italic">"{results.aiAdvice}"</p>
                 </Card>
              </div>

              <div className="flex gap-4">
                 <Button variant="outline" className="flex-1 h-14 font-black" onClick={() => setStep(1)}>{t.back}</Button>
                 <Button className="flex-[2] h-14 font-black text-xl bg-amber-600 shadow-xl shadow-amber-600/20">
                   {t.lang === 'KR' ? '상담원에게 신고 검토 요청' : 'Submit for Expert Review'}
                 </Button>
              </div>
           </div>
        )}

        {step < 6 && (
          <div className="flex gap-4 mt-12 pt-8 border-t border-slate-800">
             <Button variant="ghost" className="flex-1 h-12 font-bold" onClick={() => step > 1 ? setStep(step - 1) : window.history.back()}>{t.back}</Button>
             <Button 
               className="flex-[2] h-12 font-black bg-amber-600 shadow-xl shadow-amber-600/20" 
               onClick={handleNextStep}
               disabled={loading}
             >
               {loading ? t.analyzing : (step === 5 ? t.finish : t.next)}
             </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default EmployeeFiling;
