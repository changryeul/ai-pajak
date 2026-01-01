
import React, { useContext, useState } from 'react';
import { LanguageContext } from '../App';
import { Button, Card, Badge } from '../apps/web/src/components/ui';
import { FORMATTER } from '../constants';

interface LandingProps {
  onStart: () => void;
}

const Landing: React.FC<LandingProps> = ({ onStart }) => {
  const { t } = useContext(LanguageContext);
  const [pricingTab, setPricingTab] = useState<'MONTHLY' | 'ANNUAL' | 'PRO'>('MONTHLY');

  const proClientsExample = [
    { name: 'Client A (3 Staff)', tier: 'STARTER', fee: 143190 },
    { name: 'Client B (15 Staff)', tier: 'CORE', fee: 276390 },
    { name: 'Client C (35 Staff)', tier: 'GROWTH', fee: 553890 },
    { name: 'Client D (Individual)', tier: 'ANNUAL FILING', fee: 331890 },
  ];

  const totalProFee = proClientsExample.reduce((acc, curr) => acc + curr.fee, 0);

  return (
    <div className="space-y-24 pb-32 font-sans">
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 text-center overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-600/20 rounded-full blur-[160px] pointer-events-none"></div>
        <div className="relative z-10 max-w-4xl mx-auto px-6">
          <Badge variant="outline" className="mb-6 uppercase tracking-widest text-blue-500 border-blue-500/30 px-6 py-2">Powered by Jakarta Tax Consulting</Badge>
          <h1 className="text-7xl font-black tracking-tighter text-white uppercase italic leading-[0.9] mb-8">
            AI-Driven Tax <br /> Management for <br /> <span className="text-blue-500">Modern Businesses</span>
          </h1>
          <p className="text-xl text-slate-400 font-medium mb-12 max-w-2xl mx-auto leading-relaxed">
            Revolutionizing Indonesian tax compliance with AI OCR, real-time auditing, and expert verification from Jakarta Tax Consulting.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Button size="lg" onClick={onStart} className="h-16 px-12 text-xl font-black bg-blue-600 shadow-2xl shadow-blue-600/30 rounded-2xl">Get Started Now</Button>
            <Button size="lg" variant="outline" className="h-16 px-12 text-xl font-black border-slate-800 rounded-2xl hover:bg-slate-900">View Demo</Button>
          </div>
        </div>
      </section>

      {/* Target Fit Section - 5 Columns */}
      <section className="max-w-7xl mx-auto px-6 space-y-12">
        <h2 className="text-4xl font-black tracking-tighter text-white text-center uppercase italic">Perfectly Fit For</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {[
            { icon: '🏢', title: t.role_corporate, desc: 'PT/CV with monthly compliance needs.' },
            { icon: '💼', title: t.role_individual, desc: 'Professional owners and freelancers.' },
            { icon: '👔', title: 'High Income Employee', desc: 'Earnings above Rp 60M annually.' },
            { icon: '👤', title: 'Standard Employee', desc: 'Single employer, simple filing.' },
            { icon: '💼', title: t.role_pro_mode, desc: 'Accounting firms & Tax consultants.', pro: true },
          ].map((fit, idx) => (
            <Card key={idx} className={`p-8 border-slate-800 bg-slate-900/40 flex flex-col items-center text-center transition-all hover:border-blue-500/50 ${fit.pro ? 'border-emerald-500/30 bg-emerald-500/5' : ''}`}>
              <div className="text-5xl mb-6">{fit.icon}</div>
              <h3 className="font-black text-white text-sm mb-3 uppercase tracking-tighter leading-tight">{fit.title}</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">{fit.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing Section - 3 Tabs */}
      <section className="max-w-5xl mx-auto px-6 space-y-12">
        <div className="text-center space-y-4">
           <h2 className="text-4xl font-black tracking-tighter text-white uppercase italic">Simple & Transparent Pricing</h2>
           <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 w-fit mx-auto shadow-2xl">
              <button onClick={() => setPricingTab('MONTHLY')} className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${pricingTab === 'MONTHLY' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{t.pricing_monthly_tab}</button>
              <button onClick={() => setPricingTab('ANNUAL')} className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${pricingTab === 'ANNUAL' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{t.pricing_annual_tab}</button>
              <button onClick={() => setPricingTab('PRO')} className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${pricingTab === 'PRO' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{t.pricing_pro_tab}</button>
           </div>
        </div>

        <div className="animate-in fade-in duration-500">
           {pricingTab === 'PRO' ? (
             <div className="space-y-10">
                <Card className="p-10 border-emerald-500/30 bg-emerald-500/5">
                   <div className="grid md:grid-cols-2 gap-12">
                      <div className="space-y-6">
                         <Badge variant="success" className="font-black uppercase italic">Professional Aggregator</Badge>
                         <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">{t.pro_pricing_title}</h3>
                         <p className="text-slate-400 font-medium leading-relaxed">{t.pro_pricing_desc}</p>
                         <div className="space-y-3 pt-6">
                            {[t.pro_benefit_1, t.pro_benefit_2, t.pro_benefit_3, t.pro_benefit_4].map((b, i) => (
                              <div key={i} className="flex items-center gap-3 text-xs font-bold text-slate-300">
                                <span className="text-emerald-500">✔</span> {b}
                              </div>
                            ))}
                         </div>
                      </div>

                      <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-6">
                         <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.pro_total_example}</h4>
                         <div className="space-y-4">
                            {proClientsExample.map((c, i) => (
                              <div key={i} className="flex justify-between items-center text-xs border-b border-slate-900 pb-3 last:border-0">
                                 <div>
                                    <p className="font-black text-white uppercase tracking-tighter">{c.name}</p>
                                    <span className="text-[9px] text-slate-500 font-bold">{c.tier}</span>
                                 </div>
                                 <span className="mono font-bold text-slate-400">{FORMATTER.format(c.fee)}</span>
                              </div>
                            ))}
                            <div className="pt-4 mt-4 border-t-2 border-slate-800 flex justify-between items-center">
                               <span className="font-black text-emerald-500 text-sm italic uppercase tracking-widest">Total Monthly Bill</span>
                               <span className="text-2xl font-black text-white mono">{FORMATTER.format(totalProFee)}</span>
                            </div>
                         </div>
                         <Button className="w-full h-12 bg-emerald-600 font-black rounded-xl">Register as Consultant</Button>
                      </div>
                   </div>
                </Card>
             </div>
           ) : (
             <div className="grid md:grid-cols-3 gap-6">
                {/* Standard Pricing Cards would go here, simplified for this change */}
                <Card className="p-8 border-slate-800 bg-slate-900/40 text-center space-y-6">
                   <p className="font-black text-slate-500 uppercase text-[10px] tracking-widest">Starter</p>
                   <p className="text-4xl font-black text-white mono">Rp 143.190</p>
                   <p className="text-xs text-slate-500">Ideal for small business with 1-5 staff members.</p>
                   <Button variant="outline" className="w-full">Select Plan</Button>
                </Card>
                <Card className="p-8 border-blue-600/50 bg-blue-600/10 text-center space-y-6 shadow-2xl shadow-blue-600/10">
                   <p className="font-black text-blue-500 uppercase text-[10px] tracking-widest">Core (Most Popular)</p>
                   <p className="text-4xl font-black text-white mono">Rp 276.390</p>
                   <p className="text-xs text-slate-400">Perfect for growing companies up to 20 staff.</p>
                   <Button className="w-full bg-blue-600 font-black">Select Plan</Button>
                </Card>
                <Card className="p-8 border-slate-800 bg-slate-900/40 text-center space-y-6">
                   <p className="font-black text-slate-500 uppercase text-[10px] tracking-widest">Growth</p>
                   <p className="text-4xl font-black text-white mono">Rp 553.890</p>
                   <p className="text-xs text-slate-500">Unlimited scaling for large entities.</p>
                   <Button variant="outline" className="w-full">Select Plan</Button>
                </Card>
             </div>
           )}
        </div>
      </section>
    </div>
  );
};

export default Landing;
