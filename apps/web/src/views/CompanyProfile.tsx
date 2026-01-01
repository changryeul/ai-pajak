
import React, { useState, useContext, useEffect } from 'react';
import { Card, Button, Input, Badge } from '../apps/web/src/components/ui';
import { LanguageContext } from '../App';
import { User, CustomerType } from '../types';
import { FORMATTER } from '../constants';

const MOCK_HISTORY = [
  { year: 2023, receiptNo: '12930492039402', status: 'FILED', type: '1770S', amount: 8500000, date: '2024-03-15' },
  { year: 2022, receiptNo: '84930294029482', status: 'FILED', type: '1770S', amount: 7200000, date: '2023-03-10' },
  { year: 2021, receiptNo: '29384029384029', status: 'FILED', type: '1770SS', amount: 0, date: '2022-03-05' },
];

const CompanyProfile: React.FC = () => {
  const { t } = useContext(LanguageContext);
  const [user, setUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: '',
    npwp: '',
    address: 'Jl. Jenderal Sudirman No. 10, Jakarta Selatan',
    phone: '0812-3456-7890',
    email: '',
    status: 'TK/0'
  });

  useEffect(() => {
    const saved = localStorage.getItem('pajak_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      setUser(parsed);
      setProfile(prev => ({
        ...prev,
        name: parsed.name,
        npwp: parsed.npwp || '',
        email: parsed.email || ''
      }));
    }
  }, []);

  if (!user) return null;

  const isEmployee = user.customerType === CustomerType.INDIVIDUAL_S || user.customerType === CustomerType.INDIVIDUAL_SS;

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20 pt-4">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tighter italic text-white uppercase">
            {isEmployee ? t.personal_profile : t.profile}
          </h1>
        </div>
        <Button 
          variant={isEditing ? "secondary" : "outline"} 
          onClick={() => setIsEditing(!isEditing)}
          className="font-bold h-11 px-6 gap-2"
        >
          {isEditing ? t.save : t.edit}
        </Button>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="p-8 border-slate-800 bg-slate-900/40 relative overflow-hidden">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">
              {isEmployee ? 'Personal Identity' : 'Legal Entity Info'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="text-xs text-slate-500 block mb-2 font-bold uppercase tracking-wider">{t.name_label}</label>
                  {isEditing ? <Input value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} /> : <p className="text-xl font-black text-white">{profile.name}</p>}
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-2 font-bold uppercase tracking-wider">{t.npwp_label}</label>
                  {isEditing ? <Input value={profile.npwp} onChange={e => setProfile({...profile, npwp: e.target.value})} /> : <p className="text-xl font-black text-blue-400 mono">{profile.npwp}</p>}
                </div>
                {isEmployee && (
                  <div>
                    <label className="text-xs text-slate-500 block mb-2 font-bold uppercase tracking-wider">PTKP Status</label>
                    {isEditing ? (
                      <select className="w-full bg-slate-950 border border-slate-800 rounded-md h-10 px-3 text-sm text-white" value={profile.status} onChange={e => setProfile({...profile, status: e.target.value})}>
                        <option value="TK/0">TK/0</option>
                        <option value="K/0">K/0</option>
                        <option value="K/1">K/1</option>
                        <option value="K/2">K/2</option>
                      </select>
                    ) : <Badge variant="warning" className="text-sm font-black px-4">{profile.status}</Badge>}
                  </div>
                )}
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-xs text-slate-500 block mb-2 font-bold uppercase tracking-wider">Address</label>
                  {isEditing ? <textarea className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white h-24 outline-none focus:border-blue-500" value={profile.address} onChange={e => setProfile({...profile, address: e.target.value})} /> : <p className="text-sm text-slate-300 leading-relaxed font-medium">{profile.address}</p>}
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-2 font-bold uppercase tracking-wider">Contact</label>
                  <p className="text-sm text-slate-300 font-bold">{profile.email}</p>
                  <p className="text-sm text-slate-500 font-medium">{profile.phone}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Filing History Section */}
          <div className="space-y-4">
             <h3 className="text-xl font-black italic text-white flex items-center gap-3">
               <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm not-italic">H</span>
               {t.filing_history}
             </h3>
             <Card className="overflow-hidden border-slate-800 bg-slate-900/20">
                <table className="w-full text-left text-xs">
                   <thead className="bg-slate-950 text-slate-500 font-black uppercase tracking-widest border-b border-slate-800">
                      <tr>
                        <th className="px-6 py-4">{t.filing_year}</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">{t.receipt_no}</th>
                        <th className="px-6 py-4">Tax Amount</th>
                        <th className="px-6 py-4">Status</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800">
                      {MOCK_HISTORY.map((hist, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                           <td className="px-6 py-4 font-black text-white">{hist.year}</td>
                           <td className="px-6 py-4"><Badge variant="outline">{hist.type}</Badge></td>
                           <td className="px-6 py-4 text-slate-400 mono">{hist.receiptNo}</td>
                           <td className="px-6 py-4 font-bold mono text-slate-200">{FORMATTER.format(hist.amount)}</td>
                           <td className="px-6 py-4">
                              <Badge variant="success" className="font-black">✓ {hist.status}</Badge>
                              <p className="text-[9px] text-slate-500 mt-1 uppercase font-bold">{hist.date}</p>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </Card>
          </div>
        </div>

        <aside className="space-y-6">
          <Card className="p-8 bg-blue-600/5 border-blue-600/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
              <span className="text-6xl italic font-black text-blue-500">JTC</span>
            </div>
            <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-6">{t.jtc_service_status}</h3>
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <span className="text-xs text-slate-500 font-bold uppercase">Main Consultant</span>
                <span className="text-sm font-black text-white text-right">Jakarta Tax Consulting Team</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-bold uppercase">PoA Status</span>
                <Badge variant="success" className="font-black px-3 py-1">ACTIVE</Badge>
              </div>
              <div className="flex justify-between items-center border-t border-slate-800 pt-6">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-tighter">Valid Until</span>
                <span className="text-sm font-black text-emerald-500 mono">31-12-2025</span>
              </div>
            </div>
          </Card>

          <Card className="p-8 border-dashed border-slate-800 bg-transparent flex flex-col items-center justify-center text-center opacity-50 hover:opacity-100 transition-opacity">
              <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center mb-4 text-xl">📄</div>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Tax Document Cloud</p>
              <p className="text-xs font-bold text-slate-400">Archive and access your documents safely.</p>
          </Card>
        </aside>
      </div>
    </div>
  );
};

export default CompanyProfile;
