
import React, { useState, useContext, useEffect } from 'react';
import { User, UserRole, CustomerType, TaxRegime, BusinessSector } from '../types';
import { Button, Card, CardHeader, CardContent, Input, Badge, Label } from '../apps/web/src/components/ui';
import { LanguageContext, NavControlContext } from '../App';

interface OnboardingProps {
  onComplete: (user: User) => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const { t } = useContext(LanguageContext);
  const { registerBackHandler } = useContext(NavControlContext);
  const [step, setStep] = useState(0); 
  const [subStep, setSubStep] = useState<'NONE' | 'CHOOSE_EMPLOYEE_TYPE'>('NONE');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    npwp: '',
    type: CustomerType.CORPORATE,
    agreedMFG: false,
    startYear: new Date().getFullYear(),
    revenueRange: 0, 
    sector: BusinessSector.TRADING,
    licenseNumber: '' // Added for Consultants
  });

  const isEmployeeType = formData.type === CustomerType.INDIVIDUAL_S || formData.type === CustomerType.INDIVIDUAL_SS;
  const isConsultant = selectedRole === UserRole.CONSULTANT;

  const next = () => {
    if (step === 1 && (isEmployeeType || isConsultant)) {
      setStep(3); // Skip business diagnosis for employees and consultants
    } else {
      setStep(s => s + 1);
    }
  };

  const back = () => {
    if (subStep !== 'NONE') {
      setSubStep('NONE');
      return;
    }
    if (step === 0) return;
    if (step >= 10) setStep(0);
    else if (step === 3 && (isEmployeeType || isConsultant)) {
      setStep(1);
    } else {
      setStep(s => Math.max(0, s - 1));
    }
  };

  useEffect(() => {
    registerBackHandler(back);
    return () => {
      registerBackHandler(null);
    };
  }, [step, subStep]);

  const handleRoleSelect = (type: CustomerType | 'CONSULTANT') => {
    if (type === 'CONSULTANT') {
      setSelectedRole(UserRole.CONSULTANT);
      setFormData({ ...formData, type: CustomerType.CORPORATE }); // Default for firm
      setStep(1);
    } else if (type === CustomerType.INDIVIDUAL_S) {
      setSubStep('CHOOSE_EMPLOYEE_TYPE');
    } else {
      setSelectedRole(UserRole.CUSTOMER);
      setFormData({ ...formData, type: type as CustomerType });
      setStep(1);
    }
  };

  const selectEmployeeType = (type: CustomerType) => {
    setSelectedRole(UserRole.CUSTOMER);
    setFormData({ ...formData, type });
    setSubStep('NONE');
    setStep(1);
  };

  const calculateRegime = () => {
    if (isConsultant || isEmployeeType) return TaxRegime.GENERAL_BOOKKEEPING;
    if (formData.type === CustomerType.CORPORATE) return TaxRegime.GENERAL_BOOKKEEPING;
    const currentYear = new Date().getFullYear();
    const isNewBusiness = (currentYear - formData.startYear) <= 7;
    const isSmallRevenue = formData.revenueRange === 0;
    return (isNewBusiness && isSmallRevenue) ? TaxRegime.UMKM_05 : TaxRegime.GENERAL_BOOKKEEPING;
  };

  const handleFinish = () => {
    onComplete({
      id: `user-${Date.now()}`,
      name: formData.name,
      role: selectedRole || UserRole.CUSTOMER,
      email: formData.email,
      npwp: formData.npwp,
      customerType: selectedRole === UserRole.CUSTOMER ? formData.type : undefined,
      taxRegime: calculateRegime(),
      businessSector: formData.sector,
      businessStartDate: `${formData.startYear}-01-01`,
      annualRevenue: formData.revenueRange === 0 ? 4000000000 : 5000000000
    });
  };

  const handleStaffLogin = (role: UserRole) => {
    onComplete({
      id: `staff-${Date.now()}`,
      name: role === UserRole.JTC_ADVISOR ? 'Jakarta Tax Consulting Advisor' : 'Jakarta Tax Consulting Staff',
      role: role,
      email: 'staff@jakartataxconsulting.co.id',
    });
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6 bg-transparent relative overflow-hidden w-full font-sans">
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[150px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/10 rounded-full blur-[150px]"></div>
      </div>

      <div className="w-full max-w-2xl z-10">
        <div className="mb-12 text-center">
            <h1 className="text-6xl font-black tracking-tighter text-blue-500 mb-2 italic">{t.welcome_title}</h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">{t.welcome_subtitle}</p>
        </div>

        {step === 0 && subStep === 'NONE' && (
          <div className="grid md:grid-cols-2 gap-4 animate-in zoom-in-95 duration-300">
               <button onClick={() => handleRoleSelect(CustomerType.CORPORATE)} className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 hover:border-blue-500 text-left group">
                  <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">🏢</div>
                  <h3 className="text-lg font-bold text-white leading-tight">{t.role_corporate}</h3>
                  <p className="text-[10px] text-slate-500 font-medium mt-1 uppercase tracking-tighter">Business Taxpayer</p>
               </button>
               <button onClick={() => handleRoleSelect(CustomerType.INDIVIDUAL)} className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 hover:border-blue-500 text-left group">
                  <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">💼</div>
                  <h3 className="text-lg font-bold text-white leading-tight">{t.role_individual}</h3>
                  <p className="text-[10px] text-slate-500 font-medium mt-1 uppercase tracking-tighter">Freelancer / Professional</p>
               </button>
               <button onClick={() => handleRoleSelect(CustomerType.INDIVIDUAL_S)} className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 hover:border-amber-500 text-left group">
                  <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">👔</div>
                  <h3 className="text-lg font-bold text-white leading-tight">{t.role_employee_combined}</h3>
                  <p className="text-[10px] text-slate-500 font-medium mt-1 uppercase tracking-tighter">1770S / 1770SS</p>
               </button>
               <button onClick={() => handleRoleSelect('CONSULTANT')} className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500 text-left group relative overflow-hidden">
                  <div className="absolute top-2 right-4">
                    <Badge variant="success" className="font-black text-[8px] uppercase">Pro Mode</Badge>
                  </div>
                  <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">👨‍⚖️</div>
                  <h3 className="text-lg font-bold text-white leading-tight">{t.role_pro_mode}</h3>
                  <p className="text-[10px] text-slate-500 font-medium mt-1 uppercase tracking-tighter">Accounting Firm / Consultant</p>
               </button>
               
               <button onClick={() => setStep(10)} className="md:col-span-2 p-4 rounded-2xl bg-slate-900/30 border border-slate-800/50 text-slate-500 text-xs font-bold hover:bg-slate-800 transition-colors">
                  {t.role_staff} 🔐
               </button>
          </div>
        )}

        {subStep === 'CHOOSE_EMPLOYEE_TYPE' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500">
            <h2 className="text-2xl font-black text-white italic tracking-tighter text-center mb-8">{t.role_employee_combined}</h2>
            <div className="grid md:grid-cols-2 gap-4">
               <button onClick={() => selectEmployeeType(CustomerType.INDIVIDUAL_S)} className="p-8 rounded-3xl bg-slate-900 border-2 border-slate-800 hover:border-amber-500 text-left group transition-all">
                  <Badge variant="warning" className="mb-4">SPT 1770S</Badge>
                  <h3 className="text-lg font-bold text-white mb-2">{t.role_individual_s}</h3>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                    Pendapatan bruto di atas 60 juta rupiah per tahun, atau bekerja di lebih dari satu perusahaan.
                  </p>
               </button>
               <button onClick={() => selectEmployeeType(CustomerType.INDIVIDUAL_SS)} className="p-8 rounded-3xl bg-slate-900 border-2 border-slate-800 hover:border-slate-500 text-left group transition-all">
                  <Badge variant="outline" className="mb-4">SPT 1770SS</Badge>
                  <h3 className="text-lg font-bold text-white mb-2">{t.role_individual_ss}</h3>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                    Pendapatan bruto di bawah 60 juta rupiah per tahun, dan hanya bekerja di satu perusahaan.
                  </p>
               </button>
            </div>
            
            <div className="mt-12 p-8 rounded-3xl border border-dashed border-emerald-500/30 bg-emerald-500/5 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-center md:text-left">
                  <p className="text-xs text-slate-400 font-bold mb-1 italic">"{t.goto_1770_desc}"</p>
                  <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">SPT 1770 (INDIVIDUAL BUSINESS)</p>
                </div>
                <Button variant="secondary" onClick={() => handleRoleSelect(CustomerType.INDIVIDUAL)} className="font-black h-12 px-8 shadow-xl shadow-emerald-600/20">
                  {t.goto_1770_btn}
                </Button>
            </div>
            
            <button onClick={() => setSubStep('NONE')} className="w-full text-center text-slate-500 text-xs font-bold pt-4">← {t.back}</button>
          </div>
        )}

        {step === 10 && (
          <div className="grid md:grid-cols-2 gap-4 animate-in slide-in-from-bottom-4 duration-300">
             <button onClick={() => handleStaffLogin(UserRole.JTC_OPERATOR)} className="p-8 rounded-3xl bg-slate-900 border border-slate-800 hover:border-amber-500 text-left">
                <div className="text-3xl mb-4">🎧</div>
                <h3 className="font-bold text-white">{t.role_operator}</h3>
             </button>
             <button onClick={() => handleStaffLogin(UserRole.JTC_ADVISOR)} className="p-8 rounded-3xl bg-slate-900 border border-slate-800 hover:border-red-500 text-left">
                <div className="text-3xl mb-4">⚖️</div>
                <h3 className="font-bold text-white">{t.role_advisor}</h3>
             </button>
             <button onClick={() => setStep(0)} className="md:col-span-2 p-2 text-blue-500 text-xs font-bold">← {t.back}</button>
          </div>
        )}

        {step === 1 && subStep === 'NONE' && (
          <Card className="animate-in slide-in-from-right-8 duration-300">
            <CardHeader title={isConsultant ? "Firm Profile" : t.profile} />
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{isEmployeeType ? t.name_label : isConsultant ? "Firm / Professional Name" : t.name_entity_label}</Label>
                <Input placeholder={isEmployeeType ? "Full Name" : isConsultant ? "Accounting Firm Name" : "Company/Full Name"} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>{t.npwp_label}</Label>
                <Input placeholder="00.000.000.0-000.000" className="mono" value={formData.npwp} onChange={e => setFormData({...formData, npwp: e.target.value})} />
              </div>
              {isConsultant && (
                <div className="space-y-2">
                  <Label>License Number (Optional)</Label>
                  <Input placeholder="SK/KIP/..." value={formData.licenseNumber} onChange={e => setFormData({...formData, licenseNumber: e.target.value})} />
                </div>
              )}
              <div className="flex gap-4 pt-4">
                <Button variant="outline" onClick={back} className="flex-1">{t.back}</Button>
                <Button onClick={next} className="flex-1">{t.next}</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && subStep === 'NONE' && (
          <Card className="animate-in slide-in-from-right-8 duration-300">
            <CardHeader title={t.diagnosis_title} subtitle={t.diagnosis_subtitle} />
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>{t.diagnosis_q3}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {id: BusinessSector.TRADING, label: t.sector_TRADING},
                    {id: BusinessSector.RESTAURANT, label: t.sector_RESTAURANT},
                    {id: BusinessSector.HOTEL, label: t.sector_HOTEL},
                    {id: BusinessSector.SERVICE, label: t.sector_SERVICE},
                    {id: BusinessSector.ENTERTAINMENT, label: t.sector_ENTERTAINMENT},
                    {id: BusinessSector.OTHERS, label: t.sector_OTHERS}
                  ].map(sec => (
                    <button key={sec.id} onClick={() => setFormData({...formData, sector: sec.id})} className={`p-3 rounded-xl border text-[11px] font-bold transition-all ${formData.sector === sec.id ? 'border-blue-500 bg-blue-600/10 text-white' : 'border-slate-800 bg-slate-900 text-slate-500'}`}>
                      {sec.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>{t.diagnosis_q1}</Label>
                  <select className="w-full bg-slate-950 border border-slate-800 rounded-md h-10 px-3 text-xs outline-none text-white" value={formData.startYear} onChange={e => setFormData({...formData, startYear: Number(e.target.value)})}>
                    {Array.from({length: 20}, (_, i) => 2025 - i).map(year => <option key={year} value={year}>{year}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{t.diagnosis_q2}</Label>
                  <select className="w-full bg-slate-950 border border-slate-800 rounded-md h-10 px-3 text-xs outline-none text-white" value={formData.revenueRange} onChange={e => setFormData({...formData, revenueRange: Number(e.target.value)})}>
                    <option value={0}>{t.lang === 'KR' ? '48억 루피아 미만' : '< 4.8B IDR'}</option>
                    <option value={1}>{t.lang === 'KR' ? '48억 루피아 이상' : '>= 4.8B IDR'}</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4">
                <Button variant="outline" onClick={back} className="flex-1">{t.back}</Button>
                <Button onClick={next} className="flex-1 font-bold">{t.next}</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && subStep === 'NONE' && (
           <Card className="animate-in slide-in-from-right-8 duration-300">
             <CardHeader title={t.terms_title} />
             <CardContent className="space-y-6">
               <div className="w-full h-64 overflow-y-auto p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 leading-relaxed whitespace-pre-line custom-scrollbar">
                  {t.terms_content}
               </div>

               <label className="flex items-start gap-4 p-4 rounded-2xl bg-slate-900/50 border border-slate-800 cursor-pointer transition-all hover:bg-blue-600/5 hover:border-blue-500/30">
                   <input type="checkbox" checked={formData.agreedMFG} onChange={e => setFormData({...formData, agreedMFG: e.target.checked})} className="mt-1 w-5 h-5 accent-blue-600" />
                   <span className="text-xs text-slate-400 font-medium">{t.agreed_terms}</span>
               </label>

               <div className="flex gap-4">
                <Button variant="outline" onClick={back} className="flex-1">{t.back}</Button>
                <Button disabled={!formData.agreedMFG} onClick={handleFinish} className="flex-1 font-black h-12 text-lg shadow-xl shadow-blue-600/20">
                   {t.finish}
                </Button>
               </div>
             </CardContent>
           </Card>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
