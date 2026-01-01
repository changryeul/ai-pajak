
import React, { useState, useContext, useEffect, useMemo, useRef } from 'react';
import { Card, Button, Input, Badge, Label } from '../apps/web/src/components/ui';
import { FORMATTER, Icons } from '../constants';
import { simulateTaxCalculation } from '../apps/web/src/services/gemini';
import { TaxRegime, User, BusinessSector, TaxDataRow, CustomerType } from '../types';
import { LanguageContext } from '../App';

type PortalType = 'PPN' | 'P21' | 'WHT_OTHER' | 'INCOME' | 'LOCAL';

const DataUpload: React.FC = () => {
  const { t } = useContext(LanguageContext);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [activePortal, setActivePortal] = useState<PortalType>('P21');
  const [activeTab, setActiveTab] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dataRows, setDataRows] = useState<TaxDataRow[]>([]);
  const [summaryData, setSummaryData] = useState({ description: '' });

  const isIndividual = user?.customerType === CustomerType.INDIVIDUAL;
  const isUMKM = user?.taxRegime === TaxRegime.UMKM_05;
  const isPB1Subject = user && [BusinessSector.RESTAURANT, BusinessSector.HOTEL, BusinessSector.ENTERTAINMENT].includes(user.businessSector as BusinessSector);

  useEffect(() => {
    const saved = localStorage.getItem('pajak_user');
    if (saved) {
      const parsedUser = JSON.parse(saved);
      setUser(parsedUser);
      
      if (activePortal === 'PPN') {
        setActiveTab('SALES');
      } else if (activePortal === 'P21') {
        setActiveTab('PERMANENT');
      } else if (activePortal === 'WHT_OTHER') {
        setActiveTab(parsedUser.customerType === CustomerType.INDIVIDUAL ? 'P42' : 'P23');
      } else if (activePortal === 'LOCAL') {
        setActiveTab('PB1');
      } else {
        setActiveTab('P25');
      }
    }
  }, [activePortal]);

  const totals = useMemo(() => {
    return dataRows.reduce((acc, row) => {
      if (row.taxType === 'PPN_OUT') acc.ppnOut += row.taxAmount;
      if (row.taxType === 'PPN_IN') acc.ppnIn += row.taxAmount;
      if (row.taxType === 'PPh 21') acc.p21 += row.taxAmount;
      if (row.taxType === 'PPh 23') acc.p23 += row.taxAmount;
      if (row.taxType === 'PPh 22') acc.p22 += row.taxAmount;
      if (row.taxType === 'PPh 15') acc.p15 += row.taxAmount;
      if (row.taxType === 'PPh 26') acc.p26 += row.taxAmount;
      if (row.taxType === 'PPh 4(2)') acc.p42 += row.taxAmount;
      if (row.taxType === 'PPh 25') acc.p25 += row.taxAmount;
      if (row.taxType === 'PPh Final') acc.pFinal += row.taxAmount;
      if (row.taxType === 'Pajak Daerah') acc.pLocal += row.taxAmount;
      return acc;
    }, { ppnOut: 0, ppnIn: 0, p21: 0, p23: 0, p22: 0, p15: 0, p26: 0, p42: 0, p25: 0, pFinal: 0, pLocal: 0 });
  }, [dataRows]);

  const portalTotal = useMemo(() => {
    switch(activePortal) {
      case 'PPN': return Math.max(0, totals.ppnOut - totals.ppnIn);
      case 'P21': return totals.p21;
      case 'WHT_OTHER': return totals.p23 + totals.p22 + totals.p15 + totals.p26 + totals.p42;
      case 'INCOME': return totals.p25 + totals.pFinal;
      case 'LOCAL': return totals.pLocal;
      default: return 0;
    }
  }, [activePortal, totals]);

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsScanning(true);
      // Simulate AI Scanning Animation
      setTimeout(() => {
        setIsScanning(false);
        // Mock extracted data
        const mockRows: TaxDataRow[] = [
          { id: 'ocr-1', partnerName: 'Vendor A', label: 'INV-001', baseAmount: 10000000, rate: 11, taxAmount: 1100000, taxType: 'PPN_OUT', status: 'VERIFIED' },
          { id: 'ocr-2', partnerName: 'Vendor B', label: 'INV-002', baseAmount: 25000000, rate: 11, taxAmount: 2750000, taxType: 'PPN_OUT', status: 'VERIFIED' },
        ];
        setDataRows([...dataRows, ...mockRows]);
      }, 3000);
    }
  };

  const handleAddRow = () => {
    let taxType = '';
    let rate = 0;

    if (activePortal === 'PPN') {
      taxType = activeTab === 'SALES' ? 'PPN_OUT' : 'PPN_IN';
      rate = 11;
    } else if (activePortal === 'P21') {
      taxType = 'PPh 21';
      rate = 5; 
    } else if (activePortal === 'LOCAL') {
      taxType = 'Pajak Daerah';
      rate = 10;
    } else if (activePortal === 'WHT_OTHER') {
      taxType = activeTab === 'P22' ? 'PPh 22' : 
                activeTab === 'P23' ? 'PPh 23' : 
                activeTab === 'P26' ? 'PPh 26' : 
                activeTab === 'P15' ? 'PPh 15' : 'PPh 4(2)';
      
      if (taxType === 'PPh 23') rate = 2;
      else if (taxType === 'PPh 22') rate = 1.5; 
      else if (taxType === 'PPh 26') rate = 20;
      else if (taxType === 'PPh 15') rate = 1.2; 
      else if (taxType === 'PPh 4(2)') rate = 10; 
    } else {
      taxType = activeTab === 'P25' ? 'PPh 25' : 'PPh Final';
      rate = 0; 
    }

    const newRow: TaxDataRow = {
      id: `row-${Date.now()}`,
      label: '', 
      partnerName: '',
      baseAmount: 0,
      taxType: taxType,
      rate: rate,
      taxAmount: 0,
      status: 'PENDING'
    };
    setDataRows([...dataRows, newRow]);
  };

  const updateRow = (id: string, updates: Partial<TaxDataRow>) => {
    setDataRows(prev => prev.map(row => {
      if (row.id !== id) return row;
      const next = { ...row, ...updates };
      if (updates.baseAmount !== undefined || updates.rate !== undefined) {
        if (next.taxType === 'PPh 25' || next.taxType === 'PPh Final') {
          next.taxAmount = next.baseAmount;
        } else {
          next.taxAmount = Math.round((next.baseAmount * next.rate) / 100);
        }
      }
      return next;
    }));
  };

  const removeRow = (id: string) => {
    setDataRows(dataRows.filter(r => r.id !== id));
  };

  const handleCalculate = async () => {
    setLoading(true);
    try {
      const res = await simulateTaxCalculation({
        category: `Comprehensive ${activePortal} Audit`,
        lang: t.lang,
        data: {
          customerType: user?.customerType,
          taxRegime: user?.taxRegime,
          businessSector: user?.businessSector,
          grossAmount: activePortal === 'PPN' ? totals.ppnOut * (100/11) : totals.pLocal * (100/10), 
          expenses: totals.ppnIn * (100/11),
          description: `PORTAL: ${activePortal}. USER_TYPE: ${user?.customerType}. Full breakdown including WHT ${activeTab}. Sub-totals: ${JSON.stringify(totals)}. Notes: ${summaryData.description}`
        }
      });
      setAiResult(res);
    } finally {
      setLoading(false);
    }
  };

  const activeRows = dataRows.filter(row => {
    if (activePortal === 'PPN') return (activeTab === 'SALES' ? row.taxType === 'PPN_OUT' : row.taxType === 'PPN_IN');
    if (activePortal === 'P21') return row.taxType === 'PPh 21';
    if (activePortal === 'LOCAL') return row.taxType === 'Pajak Daerah';
    if (activePortal === 'WHT_OTHER') {
        const mapping: Record<string, string> = { 'P22': 'PPh 22', 'P23': 'PPh 23', 'P26': 'PPh 26', 'P15': 'PPh 15', 'P42': 'PPh 4(2)' };
        return row.taxType === mapping[activeTab];
    }
    if (activePortal === 'INCOME') return row.taxType === (activeTab === 'P25' ? 'PPh 25' : 'PPh Final');
    return false;
  });

  if (!user) return null;

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-24 pt-4">
      {/* Security Badge Footer equivalent at top */}
      <div className="flex justify-center">
         <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 px-4 py-1.5 rounded-full shadow-sm">
            <span className="text-emerald-500">🔒</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.security_notice}</span>
         </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-2 justify-center">
          <button onClick={() => setActivePortal('P21')} className={`px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-wider transition-all border ${activePortal === 'P21' ? 'bg-emerald-600 border-emerald-400 text-white shadow-xl shadow-emerald-600/20' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white'}`}>
            👤 {isIndividual ? 'WHT Receipts' : t.portal_pph21_title}
          </button>
          <button onClick={() => setActivePortal('WHT_OTHER')} className={`px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-wider transition-all border ${activePortal === 'WHT_OTHER' ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl shadow-indigo-600/20' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white'}`}>
            🧾 {t.portal_wht_title}
          </button>
          <button onClick={() => setActivePortal('INCOME')} className={`px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-wider transition-all border ${activePortal === 'INCOME' ? 'bg-amber-600 border-amber-400 text-white shadow-xl shadow-amber-600/20' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white'}`}>
            🏢 {isIndividual ? t.portal_individual_tax_title : t.portal_income_tax_title}
          </button>
          {isPB1Subject && (
            <button onClick={() => setActivePortal('LOCAL')} className={`px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-wider transition-all border ${activePortal === 'LOCAL' ? 'bg-amber-500 border-amber-300 text-white shadow-xl shadow-amber-600/20' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white'}`}>
              🏛️ {t.portal_local_tax_title}
            </button>
          )}
          <button onClick={() => setActivePortal('PPN')} className={`px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-wider transition-all border ${activePortal === 'PPN' ? 'bg-blue-600 border-blue-400 text-white shadow-xl shadow-blue-600/20' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white'}`}>
            🛍️ {t.portal_ppn_title}
          </button>
      </div>

      <header className="flex flex-col xl:flex-row justify-between items-center gap-8 bg-slate-900/40 p-10 rounded-[3rem] border border-slate-800 relative overflow-hidden">
        <div className="relative z-10 space-y-2 text-center xl:text-left">
           <div className="flex justify-center xl:justify-start gap-2">
             <Badge variant="outline" className="text-blue-500 border-blue-500/30 uppercase font-black px-4 py-1 italic tracking-widest">JAN 2025</Badge>
             <Badge variant="default" className="font-black px-4 py-1 uppercase">{activePortal} WORKSPACE</Badge>
           </div>
           <h1 className="text-5xl font-black tracking-tighter italic text-white uppercase">
              {activePortal === 'PPN' ? t.portal_ppn_title : 
               activePortal === 'P21' ? (isIndividual ? 'WHT Receipts' : t.portal_pph21_title) : 
               activePortal === 'LOCAL' ? t.portal_local_tax_title :
               activePortal === 'WHT_OTHER' ? t.portal_wht_title : 
               (isIndividual ? t.portal_individual_tax_title : t.portal_income_tax_title)}
           </h1>
           <p className="text-slate-500 text-sm font-medium">{t.monthly_input_subtitle}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto z-10">
           <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 min-w-[240px] shadow-2xl">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">{t.portal_subtotal}</p>
              <p className="text-4xl font-black text-white mono">{FORMATTER.format(portalTotal)}</p>
           </div>
           <div className="flex flex-col gap-2">
              <Button variant="outline" className="text-[10px] font-black h-12 px-8 border-slate-700 bg-slate-800 hover:bg-slate-700 gap-2 rounded-2xl">
                 <span className="text-xl">📥</span> {t.download_template}
              </Button>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black h-12 px-8 shadow-xl shadow-emerald-500/10 gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500">
                 <span className="text-xl">⚡</span> {t.bulk_upload}
              </Button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.csv,.pdf,.png,.jpg" onChange={handleBulkUpload} />
           </div>
        </div>
      </header>

      {isScanning && (
        <div className="p-12 bg-slate-900/60 rounded-[3rem] border border-blue-500/30 flex flex-col items-center justify-center animate-pulse">
           <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
           <h3 className="text-2xl font-black italic text-white uppercase tracking-tighter">AI Scanning Document...</h3>
           <p className="text-sm text-slate-400 mt-2">Extracting amounts, dates, and partner names from your files.</p>
        </div>
      )}

      <div className="grid xl:grid-cols-12 gap-10">
        <div className="xl:col-span-8 space-y-6">
            <div className="flex bg-slate-900 rounded-3xl p-1.5 border border-slate-800 overflow-x-auto no-scrollbar">
               {activePortal === 'PPN' && (
                 <>
                   <button onClick={() => setActiveTab('SALES')} className={`flex-1 min-w-[140px] py-4 text-[10px] font-black uppercase rounded-2xl transition-all ${activeTab === 'SALES' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-white'}`}>{t.tab_sales_ppn}</button>
                   <button onClick={() => setActiveTab('PURCHASES')} className={`flex-1 min-w-[140px] py-4 text-[10px] font-black uppercase rounded-2xl transition-all ${activeTab === 'PURCHASES' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-white'}`}>{t.tab_purchase_ppn}</button>
                 </>
               )}
               {activePortal === 'LOCAL' && (
                 <button onClick={() => setActiveTab('PB1')} className={`flex-1 min-w-[140px] py-4 text-[10px] font-black uppercase rounded-2xl transition-all ${activeTab === 'PB1' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-slate-500 hover:text-white'}`}>PB1 (Pajak Daerah)</button>
               )}
               {activePortal === 'P21' && (
                 <>
                   <button onClick={() => setActiveTab('PERMANENT')} className={`flex-1 min-w-[140px] py-4 text-[10px] font-black uppercase rounded-2xl transition-all ${activeTab === 'PERMANENT' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{isIndividual ? 'My Income' : t.cat_permanent}</button>
                   <button onClick={() => setActiveTab('NON_PERMANENT')} className={`flex-1 min-w-[140px] py-4 text-[10px] font-black uppercase rounded-2xl transition-all ${activeTab === 'NON_PERMANENT' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{t.cat_non_permanent}</button>
                   <button onClick={() => setActiveTab('FREELANCER')} className={`flex-1 min-w-[140px] py-4 text-[10px] font-black uppercase rounded-2xl transition-all ${activeTab === 'FREELANCER' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{t.cat_freelancer}</button>
                   <button onClick={() => setActiveTab('PNS')} className={`flex-1 min-w-[140px] py-4 text-[10px] font-black uppercase rounded-2xl transition-all ${activeTab === 'PNS' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{t.cat_pns}</button>
                   <button onClick={() => setActiveTab('PENSIONER')} className={`flex-1 min-w-[140px] py-4 text-[10px] font-black uppercase rounded-2xl transition-all ${activeTab === 'PENSIONER' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{t.cat_pensioner}</button>
                 </>
               )}
               {activePortal === 'WHT_OTHER' && (
                 <>
                   {!isIndividual && (
                     <>
                        <button onClick={() => setActiveTab('P22')} className={`flex-1 min-w-[120px] py-4 text-[10px] font-black uppercase rounded-2xl transition-all ${activeTab === 'P22' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>PPh 22</button>
                        <button onClick={() => setActiveTab('P23')} className={`flex-1 min-w-[120px] py-4 text-[10px] font-black uppercase rounded-2xl transition-all ${activeTab === 'P23' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>PPh 23</button>
                        <button onClick={() => setActiveTab('P26')} className={`flex-1 min-w-[120px] py-4 text-[10px] font-black uppercase rounded-2xl transition-all ${activeTab === 'P26' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>PPh 26</button>
                        <button onClick={() => setActiveTab('P15')} className={`flex-1 min-w-[120px] py-4 text-[10px] font-black uppercase rounded-2xl transition-all ${activeTab === 'P15' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>PPh 15</button>
                     </>
                   )}
                   <button onClick={() => setActiveTab('P42')} className={`flex-1 min-w-[120px] py-4 text-[10px] font-black uppercase rounded-2xl transition-all ${activeTab === 'P42' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>PPh 4(2)</button>
                 </>
               )}
               {activePortal === 'INCOME' && (
                 <>
                   <button onClick={() => setActiveTab('P25')} className={`flex-1 min-w-[140px] py-4 text-[10px] font-black uppercase rounded-2xl transition-all ${activeTab === 'P25' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{t.tab_pph_25}</button>
                   <button onClick={() => setActiveTab('P_FINAL')} className={`flex-1 min-w-[140px] py-4 text-[10px] font-black uppercase rounded-2xl transition-all ${activeTab === 'P_FINAL' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{t.tab_pph_final}</button>
                 </>
               )}
            </div>

            <Card className="border-slate-800 bg-slate-950 overflow-hidden rounded-[2.5rem] shadow-2xl">
              <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/30">
                 <div className="flex items-center gap-3">
                    <span className="w-2 h-6 bg-blue-600 rounded-full"></span>
                    <h3 className="font-black text-slate-100 uppercase tracking-tighter italic text-xl">
                       {activeTab} DATA ENTRY
                    </h3>
                 </div>
                 <Button onClick={handleAddRow} size="sm" className={`font-black h-11 px-8 gap-2 rounded-xl ${activePortal === 'PPN' ? 'bg-blue-600' : activePortal === 'P21' ? 'bg-emerald-600' : activePortal === 'WHT_OTHER' ? 'bg-indigo-600' : 'bg-amber-600'}`}>
                    <span className="text-xl">+</span> {t.add_item}
                 </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-500 font-black uppercase tracking-widest border-b border-slate-800">
                     <tr>
                        <th className="px-8 py-5">{t.partner_name} / {t.doc_number}</th>
                        <th className="px-8 py-5 w-48">{t.base_amount}</th>
                        <th className="px-8 py-5 w-24 text-center">Rate (%)</th>
                        <th className="px-8 py-5 w-48">{t.tax_amount}</th>
                        <th className="px-8 py-5 w-10 text-right"></th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                     {activeRows.length === 0 ? (
                       <tr>
                          <td colSpan={5} className="px-6 py-24 text-center text-slate-600 italic">
                             <div className="text-6xl mb-6 grayscale opacity-40">📄</div>
                             <p className="font-bold text-lg">{t.no_data_yet}</p>
                          </td>
                       </tr>
                     ) : (
                       activeRows.map(row => (
                         <tr key={row.id} className="hover:bg-slate-900/40 transition-colors group">
                            <td className="px-8 py-6 space-y-2">
                               <Input 
                                 placeholder={activePortal === 'LOCAL' ? 'Kategori Penjualan' : t.partner_name}
                                 className="bg-slate-900 h-10 font-bold border-slate-800 focus:border-blue-500 rounded-xl"
                                 value={row.partnerName}
                                 onChange={e => updateRow(row.id, { partnerName: e.target.value })}
                               />
                               <div className="flex items-center gap-2">
                                 <Input 
                                   placeholder={t.doc_number}
                                   className="bg-slate-950 border-slate-800 h-8 text-[10px] mono rounded-lg"
                                   value={row.label}
                                   onChange={e => updateRow(row.id, { label: e.target.value })}
                                 />
                                 {row.status === 'VERIFIED' && <Badge variant="success" className="text-[8px] h-4">Verified by AI</Badge>}
                               </div>
                            </td>
                            <td className="px-8 py-6">
                               <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 font-bold text-[10px]">Rp</span>
                                  <Input 
                                    type="number"
                                    className={`pl-10 h-10 bg-slate-900 font-black mono text-white rounded-xl border-slate-800`}
                                    value={row.baseAmount || ''}
                                    onChange={e => updateRow(row.id, { baseAmount: Number(e.target.value) })}
                                  />
                               </div>
                            </td>
                            <td className="px-8 py-6">
                               <Input 
                                 type="number"
                                 className="h-10 bg-slate-900 font-black text-center rounded-xl border-slate-800"
                                 value={row.rate}
                                 onChange={e => updateRow(row.id, { rate: Number(e.target.value) })}
                               />
                            </td>
                            <td className="px-8 py-6">
                               <p className="font-black text-lg text-blue-400 mono">{FORMATTER.format(row.taxAmount)}</p>
                            </td>
                            <td className="px-8 py-6 text-right">
                               <button 
                                 onClick={() => removeRow(row.id)} 
                                 title={t.delete}
                                 className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-red-500/10 text-slate-600 hover:text-red-500 transition-all border border-transparent hover:border-red-500/20"
                               >
                                 ✕
                               </button>
                            </td>
                         </tr>
                       ))
                     )}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="p-8 bg-blue-600/5 border border-dashed border-blue-500/20 rounded-3xl flex items-center gap-6">
               <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-3xl shadow-2xl">🤖</div>
               <div className="flex-1">
                  <h4 className="text-blue-400 font-black uppercase text-xs tracking-widest mb-1">{t.ai_helper_tip}</h4>
                  <p className="text-sm text-slate-400 font-medium">AI can automatically suggest tax types based on partner names or descriptions.</p>
               </div>
            </div>

            <Button 
              className={`w-full h-18 text-2xl font-black shadow-2xl rounded-3xl transition-all ${activePortal === 'PPN' ? 'bg-blue-600 shadow-blue-600/20' : activePortal === 'P21' ? 'bg-emerald-600 shadow-emerald-600/20' : activePortal === 'LOCAL' ? 'bg-amber-600 shadow-amber-600/20' : activePortal === 'WHT_OTHER' ? 'bg-indigo-600 shadow-indigo-600/20' : 'bg-amber-600 shadow-amber-600/20'}`}
              onClick={handleCalculate}
              disabled={loading || dataRows.length === 0}
            >
              {loading ? t.analyzing : t.calculate_button}
            </Button>
        </div>

        <div className="xl:col-span-4 space-y-6">
          {!aiResult && !loading ? (
            <div className="h-full border-2 border-dashed border-slate-800 rounded-[3rem] flex flex-col items-center justify-center p-12 text-slate-700 bg-slate-900/10">
               <div className="text-8xl mb-8 grayscale opacity-30">🤖</div>
               <p className="font-black text-2xl mb-3 text-slate-200">{activePortal} AI ANALYZER</p>
               <p className="text-xs text-center max-w-xs leading-relaxed font-medium">
                 {activePortal === 'P21' ? (isIndividual ? "AI will analyze your income and suggest proper PTKP status." : "AI will check PTKP status and tiered rates for your payroll data.") : 
                  activePortal === 'PPN' ? "AI will verify VAT validity and potential input credit." : 
                  activePortal === 'LOCAL' ? "AI will analyze your sales data for PB1 reporting." :
                  "AI will ensure tax compliance for all WHT types (22, 23, 15, 26, 4.2)."}
               </p>
               <div className="mt-10 p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center gap-3">
                  <span className="text-emerald-500">🛡️</span>
                  <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Validated by JTC Experts</span>
               </div>
            </div>
          ) : loading ? (
            <div className="h-full bg-slate-900/20 rounded-[3rem] flex flex-col items-center justify-center p-12 border border-slate-800">
               <div className={`w-24 h-24 border-4 ${activePortal === 'PPN' ? 'border-blue-600' : 'border-emerald-600'} border-t-transparent rounded-full animate-spin mb-10`}></div>
               <p className="text-slate-100 text-2xl font-black animate-pulse uppercase tracking-widest italic">{t.analyzing}</p>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-700">
               <Card className="p-8 bg-slate-900 border-slate-800 rounded-[2.5rem] shadow-2xl">
                  <div className="flex items-center gap-3 mb-8">
                    <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm">📊</span>
                    <h3 className="font-black text-slate-100 uppercase tracking-tighter italic text-xl">{activePortal} SUMMARY</h3>
                  </div>
                  <div className="space-y-4">
                    {aiResult.taxList.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-6 bg-slate-950 rounded-2xl border border-slate-800 hover:border-blue-500/30 transition-all group">
                        <div className="space-y-1">
                           <span className={`text-[10px] font-black uppercase text-blue-500 tracking-widest`}>{item.type}</span>
                           <p className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{item.reason}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-xl font-black text-white mono">{FORMATTER.format(item.amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
               </Card>

               <Card className={`p-8 bg-slate-950 border-slate-800 rounded-3xl border-l-8 shadow-2xl border-l-blue-600 relative overflow-hidden`}>
                  <div className="absolute top-[-10%] right-[-5%] opacity-5 text-9xl">✨</div>
                  <div className="flex items-center gap-3 mb-4 relative z-10">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold bg-blue-500/10 text-blue-500 text-xl`}>💡</div>
                    <p className={`text-xs font-black uppercase tracking-widest text-blue-500`}>{t.advice_label}</p>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed italic font-medium relative z-10">
                    "{aiResult.aiAdvice}"
                  </p>
               </Card>

               <div className="flex gap-4">
                 <Button variant="outline" className="flex-1 h-16 font-black rounded-2xl text-slate-400" onClick={() => setAiResult(null)}>{t.back}</Button>
                 <Button variant="secondary" className="flex-[2] h-16 font-black text-2xl rounded-2xl shadow-2xl shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-500">
                    {t.finish} & {t.send}
                 </Button>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataUpload;
