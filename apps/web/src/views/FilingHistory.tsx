
import React, { useState, useContext } from 'react';
import { Card, Badge, Button } from '../apps/web/src/components/ui';
import { FORMATTER } from '../constants';
import { LanguageContext } from '../App';

const MOCK_MONTHLY_HISTORY = [
  { id: 'm-1', period: 'Jan 2025', type: 'PPh 21 & WHT', amount: 12500000, ntpn: 'A92039402938', status: 'FILED', date: '2025-02-10' },
  { id: 'm-2', period: 'Dec 2024', type: 'PPN (VAT)', amount: 45000000, ntpn: 'B82930492837', status: 'FILED', date: '2025-01-28' },
  { id: 'm-3', period: 'Nov 2024', type: 'PPh 21 & WHT', amount: 11800000, ntpn: 'C28394029384', status: 'FILED', date: '2024-12-10' },
  { id: 'm-4', period: 'Oct 2024', type: 'PPN (VAT)', amount: 38000000, ntpn: 'D19203948273', status: 'FILED', date: '2024-11-28' },
];

const MOCK_ANNUAL_HISTORY = [
  { id: 'a-1', year: 2024, type: 'Annual Corporate (1771)', amount: 1250000000, bpn: 'ANN-2024-9203', status: 'PENDING_REVIEW', date: '2025-01-15' },
  { id: 'a-2', year: 2023, type: 'Annual Corporate (1771)', amount: 980000000, bpn: 'ANN-2023-8493', status: 'FILED', date: '2024-04-25' },
  { id: 'a-3', year: 2022, type: 'Annual Corporate (1771)', amount: 840000000, bpn: 'ANN-2022-1928', status: 'FILED', date: '2023-04-28' },
];

const FilingHistory: React.FC = () => {
  const { t } = useContext(LanguageContext);
  const [activeTab, setActiveTab] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 pt-4">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <Badge variant="outline" className="mb-2 uppercase tracking-widest font-black text-blue-500 border-blue-500/30">Tax Records</Badge>
          <h1 className="text-4xl font-black tracking-tighter italic text-white uppercase">{t.filing_history}</h1>
          <p className="text-slate-500 text-sm font-medium">Archive of all submitted tax documents and payments.</p>
        </div>
        
        <div className="flex bg-slate-900 rounded-2xl p-1 border border-slate-800 w-full md:w-auto shadow-xl">
           <button 
             onClick={() => setActiveTab('MONTHLY')} 
             className={`flex-1 md:w-40 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'MONTHLY' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-white'}`}
           >
             {t.tab_monthly_history}
           </button>
           <button 
             onClick={() => setActiveTab('ANNUAL')} 
             className={`flex-1 md:w-40 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'ANNUAL' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-slate-500 hover:text-white'}`}
           >
             {t.tab_annual_history}
           </button>
        </div>
      </header>

      <Card className="overflow-hidden border-slate-800 bg-slate-900/20 shadow-2xl rounded-[2rem]">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-500 font-black uppercase tracking-widest border-b border-slate-800">
            <tr>
              <th className="px-8 py-5">{activeTab === 'MONTHLY' ? 'Tax Period' : 'Tax Year'}</th>
              <th className="px-8 py-5">Filing Type</th>
              <th className="px-8 py-5">Amount</th>
              <th className="px-8 py-5">Receipt No (NTPN/BPN)</th>
              <th className="px-8 py-5">Status</th>
              <th className="px-8 py-5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {activeTab === 'MONTHLY' ? (
              MOCK_MONTHLY_HISTORY.map(item => (
                <tr key={item.id} className="hover:bg-slate-900/40 transition-colors group">
                  <td className="px-8 py-5 font-black text-white">{item.period}</td>
                  <td className="px-8 py-5 font-bold text-slate-400">{item.type}</td>
                  <td className="px-8 py-5 font-black text-blue-400 mono">{FORMATTER.format(item.amount)}</td>
                  <td className="px-8 py-5 text-slate-500 mono tracking-tighter">{item.ntpn}</td>
                  <td className="px-8 py-5">
                    <Badge variant="success" className="font-black uppercase tracking-tighter px-3">✓ {item.status}</Badge>
                    <p className="text-[9px] text-slate-600 mt-1 uppercase font-bold">{item.date}</p>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <Button variant="outline" size="sm" className="h-8 text-[9px] font-black border-slate-700 hover:bg-blue-600 hover:text-white transition-all">
                       {t.doc_download}
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              MOCK_ANNUAL_HISTORY.map(item => (
                <tr key={item.id} className="hover:bg-slate-900/40 transition-colors group">
                  <td className="px-8 py-5 font-black text-white text-lg italic">{item.year}</td>
                  <td className="px-8 py-5 font-bold text-slate-400">{item.type}</td>
                  <td className="px-8 py-5 font-black text-amber-500 mono">{FORMATTER.format(item.amount)}</td>
                  <td className="px-8 py-5 text-slate-500 mono tracking-tighter">{item.bpn}</td>
                  <td className="px-8 py-5">
                    <Badge variant={item.status === 'FILED' ? 'success' : 'warning'} className="font-black uppercase tracking-tighter px-3">
                      {item.status === 'FILED' ? '✓ FILED' : '⚠ IN REVIEW'}
                    </Badge>
                    <p className="text-[9px] text-slate-600 mt-1 uppercase font-bold">{item.date}</p>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <Button variant="outline" size="sm" className={`h-8 text-[9px] font-black border-slate-700 hover:bg-amber-600 hover:text-white transition-all ${item.status === 'PENDING_REVIEW' ? 'opacity-30 pointer-events-none' : ''}`}>
                       {t.doc_download}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
      
      <div className="p-8 bg-blue-600/5 border border-dashed border-blue-500/20 rounded-2xl flex items-center gap-6">
         <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-3xl shadow-2xl">📥</div>
         <div>
           <h4 className="text-white font-black italic">Need a full tax archive?</h4>
           <p className="text-sm text-slate-400">You can request a consolidated tax report for the last 5 years from Jakarta Tax Consulting.</p>
         </div>
         <Button variant="outline" className="ml-auto font-black h-12 px-8">Request Audit File</Button>
      </div>
    </div>
  );
};

export default FilingHistory;
