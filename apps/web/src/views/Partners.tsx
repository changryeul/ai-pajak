
import React, { useState, useContext } from 'react';
/* Fix: Added Label to imports to resolve the 'Cannot find name Label' error on line 80 */
import { Card, Button, Input, Badge, Label } from '../apps/web/src/components/ui';
import { Partner, PartnerType } from '../types';
import { LanguageContext } from '../App';

const MOCK_PARTNERS: Partner[] = [
  { id: '1', name: 'PT Vendor Makmur', npwp: '02.111.222.3-444.000', type: PartnerType.VENDOR, email: 'sales@vendormakmur.com', address: 'Kawasan Industri Cikarang' },
  { id: '2', name: 'PT Global Client', npwp: '03.333.444.5-666.000', type: PartnerType.CLIENT, email: 'finance@globalclient.id', address: 'Mega Kuningan, Jakarta' },
  { id: '3', name: 'CV Logistik Cepat', npwp: '04.555.666.7-888.000', type: PartnerType.VENDOR, email: 'admin@logistikcepat.id', address: 'Tanjung Priok, Jakarta' },
];

const Partners: React.FC = () => {
  const { t } = useContext(LanguageContext);
  const [partners, setPartners] = useState<Partner[]>(MOCK_PARTNERS);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<'ALL' | PartnerType>('ALL');

  const filteredPartners = filter === 'ALL' ? partners : partners.filter(p => p.type === filter);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 w-full">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{t.partners}</h1>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2">
          <span className="text-lg">+</span> {t.new_client_reg}
        </Button>
      </header>

      <div className="flex gap-2 p-1 bg-slate-900 border border-slate-800 rounded-lg w-fit">
        <button 
          onClick={() => setFilter('ALL')}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${filter === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          {t.all}
        </button>
        <button 
          onClick={() => setFilter(PartnerType.VENDOR)}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${filter === PartnerType.VENDOR ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          Vendor
        </button>
        <button 
          onClick={() => setFilter(PartnerType.CLIENT)}
          className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${filter === PartnerType.CLIENT ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          Client
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPartners.map(partner => (
          <Card key={partner.id} className="p-5 hover:border-blue-500/50 transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-blue-500">
                {partner.name.charAt(0)}
              </div>
              <Badge variant={partner.type === PartnerType.VENDOR ? 'default' : 'success'}>
                {partner.type}
              </Badge>
            </div>
            <h3 className="font-bold text-lg mb-1 group-hover:text-blue-400 transition-colors">{partner.name}</h3>
            <p className="text-xs text-slate-500 mono mb-4">{partner.npwp}</p>
            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end gap-2">
              <Button variant="ghost" size="sm">{t.edit}</Button>
              <Button variant="ghost" size="sm" className="text-red-400">{t.delete}</Button>
            </div>
          </Card>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <Card className="w-full max-w-lg p-8 animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-bold mb-6">{t.new_client_reg}</h2>
            <div className="space-y-4">
              <div>
                <Label>{t.name_entity_label}</Label>
                <Input placeholder="PT Sukses Selalu" />
              </div>
              <div className="flex gap-4 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowAdd(false)}>{t.cancel}</Button>
                <Button variant="primary" className="flex-1" onClick={() => setShowAdd(false)}>{t.save}</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Partners;
