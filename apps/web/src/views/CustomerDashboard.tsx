
import React, { useState, useContext, useRef, useEffect } from 'react';
import { User, TaxStatus, TaxFiling, ChatMessage, TaxRegime, BusinessSector, CustomerType } from '../types';
import { Card, CardHeader, CardContent, Badge, Button, Input } from '../apps/web/src/components/ui';
import { FORMATTER, Icons } from '../constants';
import { LanguageContext } from '../App';
import { useNavigate } from 'react-router-dom';
import EmployeeFiling from './EmployeeFiling';

const CustomerDashboard: React.FC<{ user: User }> = ({ user }) => {
  const { t } = useContext(LanguageContext);
  const navigate = useNavigate();
  const [chatFiling, setChatFiling] = useState<any>(null);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // New States for habit forming
  const [dataFreshness, setDataFreshness] = useState(85); 
  const [isFirstLogin, setIsFirstLogin] = useState(true);

  const isCorporate = user.customerType === CustomerType.CORPORATE;
  const isIndividualBusiness = user.customerType === CustomerType.INDIVIDUAL;
  const isEmployee = user.customerType === CustomerType.INDIVIDUAL_S || user.customerType === CustomerType.INDIVIDUAL_SS;
  const isPB1Subject = [BusinessSector.RESTAURANT, BusinessSector.HOTEL, BusinessSector.ENTERTAINMENT].includes(user.businessSector as BusinessSector);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatFiling?.chatHistory]);

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    setChatInput('');
  };

  const getFormLabel = () => {
    if (user.customerType === CustomerType.INDIVIDUAL_S) return 'SPT 1770S';
    if (user.customerType === CustomerType.INDIVIDUAL_SS) return 'SPT 1770SS';
    if (user.customerType === CustomerType.INDIVIDUAL) return 'SPT 1770';
    return 'SPT 1771';
  };

  if (isEmployee) {
    return <EmployeeFiling user={user} />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-[1500px] mx-auto pb-24">
      {/* 1. D-Day Urgency Banner - Conditional PB1 text */}
      <div className="bg-gradient-to-r from-red-600 to-amber-600 p-1 rounded-3xl shadow-2xl shadow-red-600/20">
        <div className="bg-slate-950/90 backdrop-blur-xl rounded-[1.4rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6">
           <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-red-600 rounded-2xl flex flex-col items-center justify-center text-white shadow-lg shrink-0">
                 <span className="text-[10px] font-black uppercase tracking-tighter">Jan</span>
                 <span className="text-2xl font-black">10</span>
              </div>
              <div>
                 <div className="flex items-center gap-2 mb-1">
                    <Badge variant="destructive" className="animate-pulse font-black text-[9px] uppercase tracking-widest">{t.d_day_label} D-4</Badge>
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Urgent Task</span>
                 </div>
                 <h4 className="text-xl font-black text-white italic">
                   {isPB1Subject ? t.d_day_desc_pb1 : t.d_day_desc_basic}
                 </h4>
              </div>
           </div>
           <Button className="bg-red-600 hover:bg-red-500 font-black h-12 px-8 rounded-xl shadow-xl shadow-red-600/20" onClick={() => navigate('/upload')}>
             지금 바로 납부 준비하기
           </Button>
        </div>
      </div>

      {/* 2. Onboarding Quick Guide for New Users */}
      {isFirstLogin && (
        <section className="bg-blue-600/5 border border-blue-500/20 p-8 rounded-[3rem] space-y-8 relative overflow-hidden">
          <div className="absolute top-[-10%] right-[-5%] text-9xl opacity-5 grayscale">🚀</div>
          <div className="flex justify-between items-center">
             <h3 className="text-2xl font-black italic text-blue-400">Quick Start Guide</h3>
             <button onClick={() => setIsFirstLogin(false)} className="text-slate-500 hover:text-white font-bold text-xs uppercase tracking-widest">✕ Close Guide</button>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
             {[
               { icon: '📸', title: t.onboarding_step1, desc: t.onboarding_step1_desc },
               { icon: '🤖', title: t.onboarding_step2, desc: t.onboarding_step2_desc },
               { icon: '⚖️', title: t.onboarding_step3, desc: t.onboarding_step3_desc }
             ].map((step, idx) => (
               <div key={idx} className="relative p-6 bg-slate-900/50 rounded-3xl border border-slate-800 group hover:border-blue-500/50 transition-all">
                  <div className="absolute -top-4 -left-2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-black text-sm">{idx + 1}</div>
                  <div className="text-4xl mb-4">{step.icon}</div>
                  <h4 className="font-black text-white uppercase tracking-tighter text-lg mb-2">{step.title}</h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">{step.desc}</p>
               </div>
             ))}
          </div>
        </section>
      )}

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left Column: Stats & Habits */}
        <div className="lg:col-span-8 space-y-8">
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800">
                <div className="flex items-center gap-6">
                  <div className={`w-20 h-20 rounded-[2.5rem] flex items-center justify-center text-4xl shadow-2xl border ${isEmployee ? 'border-amber-500/30 bg-amber-600/10' : isIndividualBusiness ? 'border-emerald-500/30 bg-emerald-600/10' : 'border-blue-500/30 bg-blue-600/10'} rotate-3`}>
                    {isEmployee ? '👔' : isIndividualBusiness ? '💼' : (user.businessSector === BusinessSector.RESTAURANT ? '🍜' : '🏢')}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge variant={user.taxRegime === TaxRegime.UMKM_05 ? 'success' : 'default'} className="uppercase text-[9px] font-black tracking-widest px-3 py-1">
                        {isEmployee ? getFormLabel() : (user.taxRegime === TaxRegime.UMKM_05 ? t.regime_UMKM_05 : t.regime_GENERAL)}
                      </Badge>
                      {isPB1Subject && <Badge variant="warning" className="text-[9px] font-black italic px-3 py-1 uppercase tracking-tighter">PB1 Subject</Badge>}
                    </div>
                    <h1 className="text-4xl font-black tracking-tighter text-white">{t.greeting} {user.name.split(' ')[0]}!</h1>
                    <p className="text-slate-500 text-sm font-medium mono mt-1">{user.npwp}</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 min-w-[180px] text-center">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">{t.data_freshness}</p>
                    <div className="relative inline-flex items-center justify-center">
                       <svg className="w-16 h-16">
                         <circle className="text-slate-800" strokeWidth="6" stroke="currentColor" fill="transparent" r="28" cx="32" cy="32" />
                         <circle className="text-emerald-500" strokeWidth="6" strokeDasharray={2 * Math.PI * 28} strokeDashoffset={2 * Math.PI * 28 * (1 - dataFreshness / 100)} strokeLinecap="round" stroke="currentColor" fill="transparent" r="28" cx="32" cy="32" />
                       </svg>
                       <span className="absolute text-sm font-black text-white">{dataFreshness}%</span>
                    </div>
                    <p className="text-[9px] text-emerald-500 font-bold uppercase mt-2 tracking-tighter">{t.data_fresh_good}</p>
                  </div>
                </div>
            </header>

            {/* Quick Dropzone for Daily Habits */}
            <Card className="p-8 border-dashed border-blue-500/30 bg-blue-600/5 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8 group hover:bg-blue-600/10 transition-all cursor-pointer" onClick={() => navigate('/upload')}>
               <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center text-4xl shadow-xl shadow-blue-600/20 group-hover:scale-110 transition-transform">📸</div>
               <div className="flex-1 text-center md:text-left">
                  <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">{t.quick_upload_title}</h3>
                  <p className="text-sm text-slate-400 font-medium">{t.quick_upload_desc}</p>
               </div>
               <Button size="lg" className="bg-blue-600 hover:bg-blue-500 font-black px-10 h-14 rounded-2xl">
                 지금 업로드
               </Button>
            </Card>

            <section className="space-y-6">
               <div className="flex items-center justify-between px-2">
                  <h2 className="text-2xl font-black italic text-white flex items-center gap-3 uppercase">
                     {t.monthly_filing_title} (Jan 2025)
                  </h2>
               </div>

               <div className="grid md:grid-cols-2 gap-6">
                  {isPB1Subject && (
                    <Card className="p-8 border-amber-500/30 bg-gradient-to-br from-amber-600/10 to-transparent relative overflow-hidden group hover:border-amber-500 transition-all cursor-pointer" onClick={() => navigate('/upload')}>
                       <div className="relative z-10 space-y-4">
                          <div className="flex justify-between items-start">
                             <div className="w-12 h-12 bg-amber-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-amber-600/20">🏛️</div>
                             <Badge variant="warning" className="font-black">PB1 (LOCAL)</Badge>
                          </div>
                          <div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter">{t.portal_local_tax_title}</h3>
                            <p className="text-xs text-slate-400 font-medium">Reporting for Restaurants & Hotels</p>
                          </div>
                          <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                             <span className="text-[10px] font-black text-slate-500 uppercase">{t.est_payable}</span>
                             <span className="text-lg font-black text-amber-500 mono italic">Rp 0</span>
                          </div>
                       </div>
                    </Card>
                  )}

                  <Card className="p-8 border-blue-500/20 bg-gradient-to-br from-blue-600/5 to-transparent relative overflow-hidden group hover:border-blue-500/50 transition-all cursor-pointer" onClick={() => navigate('/upload')}>
                     <div className="relative z-10 space-y-4">
                        <div className="flex justify-between items-start">
                           <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-blue-600/20">🛍️</div>
                           <Badge variant="outline" className="text-slate-500 border-slate-800 font-black">PPN / VAT</Badge>
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-white uppercase tracking-tighter">{t.portal_ppn_title}</h3>
                          <p className="text-xs text-slate-400 font-medium">Input & Output VAT reconciliation</p>
                        </div>
                        <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                           <span className="text-[10px] font-black text-slate-500 uppercase">{t.est_payable}</span>
                           <span className="text-lg font-black text-blue-400 mono italic">Rp 0</span>
                        </div>
                     </div>
                  </Card>
               </div>
            </section>
        </div>

        {/* Right Column: Mini Calendar & Annual */}
        <div className="lg:col-span-4 space-y-8">
            <Card className="p-8 bg-slate-900/60 border-slate-800 rounded-[2.5rem]">
               <h3 className="text-xl font-black italic text-white uppercase mb-6 flex items-center gap-2">
                 <span className="text-blue-500">📅</span> 2025 Calendar
               </h3>
               <div className="space-y-4">
                  {[
                    { date: 'Jan 10', label: 'PPh 21 Payment', status: 'URGENT' },
                    { date: 'Jan 15', label: 'PB1 Payment', status: 'SOON' },
                    { date: 'Jan 20', label: 'PPN & PPh 21 Filing', status: 'WAIT' },
                    { date: 'Mar 31', label: 'Individual Annual SPT', status: 'CLOSING' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50 group hover:border-blue-500/30 transition-all">
                       <div className="flex items-center gap-4">
                          <div className="text-xs font-black text-slate-500 uppercase w-12">{item.date}</div>
                          <div className="text-xs font-bold text-slate-300">{item.label}</div>
                       </div>
                       <Badge variant={item.status === 'URGENT' ? 'destructive' : item.status === 'SOON' ? 'warning' : 'outline'} className="text-[8px] font-black uppercase tracking-tighter">
                         {item.status}
                       </Badge>
                    </div>
                  ))}
               </div>
            </Card>

            <section className="space-y-4">
                <div className="flex items-center justify-between px-2">
                   <h2 className="text-xl font-black italic text-amber-500 flex items-center gap-3 uppercase">
                     {t.annual_filing_title}
                   </h2>
                </div>
                <Card className="p-8 border-amber-500/20 bg-gradient-to-br from-amber-600/5 to-transparent relative overflow-hidden group hover:border-amber-500 transition-all">
                   <div className="relative z-10 space-y-4">
                      <p className="text-[10px] text-slate-500 font-black uppercase">Closing Readiness</p>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                         <div className="w-[25%] h-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                      </div>
                      <p className="text-xs text-slate-400 font-medium leading-relaxed">
                        Keep uploading daily receipts to improve your 2024 closing speed.
                      </p>
                      <Button size="sm" variant="outline" onClick={() => navigate('/annual-filing')} className="w-full border-amber-500/30 text-amber-500 font-black uppercase h-10 rounded-xl hover:bg-amber-500 hover:text-white">
                        {t.start_closing}
                      </Button>
                   </div>
                </Card>
            </section>
        </div>
      </div>

      <div className="fixed bottom-10 right-10 z-[100]">
         <Button onClick={() => setChatFiling({type: 'General Help'})} className={`w-16 h-16 rounded-full ${isIndividualBusiness ? 'bg-emerald-600 shadow-emerald-600/40' : 'bg-blue-600 shadow-blue-600/40'} shadow-2xl flex items-center justify-center hover:scale-110 transition-transform`}>
            <span className="text-3xl">💬</span>
         </Button>
      </div>

      {chatFiling && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[150] flex items-center justify-end p-6">
          <Card className="w-full max-w-md h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-right-8 duration-300">
             <CardHeader title={t.chatTitle} subtitle={chatFiling.type}>
                <button onClick={() => setChatFiling(null)} className="text-xl hover:text-red-500 transition-colors" title={t.cancel}>✕</button>
             </CardHeader>
             <CardContent className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-950/20">
                <div className="p-4 bg-slate-900 rounded-2xl text-xs text-slate-400 leading-relaxed">
                   {t.greeting} AI PAJAK Expert is here to help!
                </div>
                <div ref={chatEndRef} />
             </CardContent>
             <div className="p-4 bg-slate-900 border-t border-slate-800 flex gap-2">
                <Input placeholder={t.placeholderChat} value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendChat()} />
                <Button onClick={handleSendChat} className="font-bold">{t.send}</Button>
             </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default CustomerDashboard;
