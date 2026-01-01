
import React, { useState, useContext } from 'react';
import { User, TaxStatus, TaxFiling, UserRole, TaxRegime, BusinessSector } from '../types';
import { Card, CardHeader, CardContent, Button, Badge, Input } from '../apps/web/src/components/ui';
import { Icons, FORMATTER } from '../constants';
import { LanguageContext } from '../App';
import { useNavigate } from 'react-router-dom';

const MOCK_CLIENTS: User[] = [
  { id: 'c-1', name: 'Warung Makan Padang Jaya', npwp: '01.222.333.4-555.000', role: UserRole.CUSTOMER, email: 'owner@padangjaya.com', taxRegime: TaxRegime.UMKM_05, businessSector: BusinessSector.RESTAURANT },
  { id: 'c-2', name: 'PT Tech Inovasi Indonesia', npwp: '02.444.555.6-777.000', role: UserRole.CUSTOMER, email: 'finance@techinovasi.id', taxRegime: TaxRegime.GENERAL_BOOKKEEPING, businessSector: BusinessSector.SERVICE },
  { id: 'c-3', name: 'Guest House Melati', npwp: '03.666.777.8-999.000', role: UserRole.CUSTOMER, email: 'melati@guesthouse.com', taxRegime: TaxRegime.UMKM_05, businessSector: BusinessSector.HOTEL },
  { id: 'c-4', name: 'Toko Baju Trendy', npwp: '04.888.999.0-111.000', role: UserRole.CUSTOMER, email: 'sales@trendy.com', taxRegime: TaxRegime.UMKM_05, businessSector: BusinessSector.TRADING },
];

const ConsultantDashboard: React.FC<{ user: User }> = ({ user }) => {
  const { t } = useContext(LanguageContext);
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClients = MOCK_CLIENTS.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.npwp?.includes(searchTerm)
  );

  const handleManageClient = (client: User) => {
    navigate('/upload');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 w-full pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="font-black uppercase tracking-widest text-[10px]">{t.role_pro_mode}</Badge>
          </div>
          <h1 className="text-4xl font-black tracking-tighter italic">{t.client_portfolio}</h1>
          <p className="text-slate-400 mt-2">{t.consultant_desc}</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input 
                  placeholder={t.search_placeholder} 
                  className="pl-10 bg-slate-900 border-slate-800" 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <Button variant="primary" className="font-bold">{t.new_client_reg}</Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6 bg-blue-600/5 border-blue-600/20 text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase mb-1">{t.total_clients}</p>
              <p className="text-3xl font-black text-white">{MOCK_CLIENTS.length}</p>
          </Card>
          <Card className="p-6 bg-emerald-600/5 border-emerald-600/20 text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase mb-1">UMKM 0.5% Schema</p>
              <p className="text-3xl font-black text-emerald-500">{MOCK_CLIENTS.filter(c => c.taxRegime === TaxRegime.UMKM_05).length}</p>
          </Card>
          <Card className="p-6 bg-amber-600/5 border-amber-600/20 text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase mb-1">General (22%) Schema</p>
              <p className="text-3xl font-black text-amber-500">{MOCK_CLIENTS.filter(c => c.taxRegime === TaxRegime.GENERAL_BOOKKEEPING).length}</p>
          </Card>
          <Card className="p-6 bg-red-600/5 border-red-600/20 text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase mb-1">{t.awaiting_data}</p>
              <p className="text-3xl font-black text-red-500">2</p>
          </Card>
      </div>

      <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map(client => (
          <Card key={client.id} className="group hover:border-blue-600/50 transition-all cursor-pointer overflow-hidden flex flex-col" onClick={() => handleManageClient(client)}>
            <div className={`h-2 w-full ${client.taxRegime === TaxRegime.UMKM_05 ? 'bg-emerald-600' : 'bg-blue-600'}`}></div>
            <CardContent className="p-6 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                 <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                    {client.businessSector === BusinessSector.RESTAURANT ? '🍜' : 
                     client.businessSector === BusinessSector.HOTEL ? '🏨' : 
                     client.businessSector === BusinessSector.SERVICE ? '💻' : '🛒'}
                 </div>
                 <Badge variant={client.taxRegime === TaxRegime.UMKM_05 ? 'success' : 'default'} className="text-[9px] font-black">
                   {client.taxRegime === TaxRegime.UMKM_05 ? 'UMKM' : 'GENERAL'}
                 </Badge>
              </div>

              <h3 className="text-lg font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">{client.name}</h3>
              <p className="text-xs text-slate-500 mono mb-6">{client.npwp}</p>

              <div className="space-y-3 mt-auto">
                 <div className="flex justify-between items-center text-[10px] border-b border-slate-800 pb-2">
                    <span className="text-slate-500 uppercase font-bold tracking-widest">Sector</span>
                    <span className="text-slate-300 font-bold">{(t as any)[`sector_${client.businessSector}`] || client.businessSector}</span>
                 </div>
                 <div className="flex justify-between items-center text-[10px] border-b border-slate-800 pb-2">
                    <span className="text-slate-500 uppercase font-bold tracking-widest">PB1</span>
                    {[BusinessSector.RESTAURANT, BusinessSector.HOTEL, BusinessSector.ENTERTAINMENT].includes(client.businessSector as BusinessSector) 
                      ? <span className="text-amber-500 font-black italic">SUBJECT TO PB1</span>
                      : <span className="text-slate-600">N/A</span>
                    }
                 </div>
              </div>

              <div className="mt-8">
                 <Button variant="outline" className="w-full text-xs font-bold gap-2 group-hover:bg-blue-600 group-hover:text-white transition-all">
                   {t.manage_tax_data} <Icons.ChevronRight className="w-3 h-3" />
                 </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="p-8 border-dashed border-slate-800 bg-transparent flex flex-col items-center justify-center text-center opacity-50 hover:opacity-100 transition-opacity">
          <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-4 text-2xl">➕</div>
          <h3 className="font-bold">{t.new_client_reg}</h3>
      </Card>
    </div>
  );
};

export default ConsultantDashboard;
