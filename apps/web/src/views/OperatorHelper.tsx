
import React, { useState, useMemo, useContext, useEffect, useRef } from 'react';
import { Card, Button, Badge, Input, Label } from '../apps/web/src/components/ui';
import { Icons, FORMATTER } from '../constants';
import { TaxFiling, TaxStatus, TaxDataRow, ChatMessage } from '../types';
import { LanguageContext } from '../App';

const TAX_TYPE_OPTIONS = [
  'PPh 21', 'PPh 22', 'PPh 23', 'PPh 26', 'PPh 4(2)', 'PPh 15', 'PPN', 'PPh Badan', 'PPh 25', 'Pajak Daerah'
];

const MOCK_ASSIGNED_TASKS: TaxFiling[] = [
    { 
      id: 't-1', clientName: 'PT Global Tech Solutions', type: 'PPh & PPN Audit', period: '12/2024', amount: 540000000, 
      status: TaxStatus.AI_PROPOSED, dueDate: '2025-01-20', 
      chatHistory: [],
      submittedData: [
        { id: 'row-1', label: 'Employee Salaries (Dec)', partnerName: 'All Employees', baseAmount: 1200000000, taxType: 'PPh 21', rate: 5, taxAmount: 60000000, status: 'VERIFIED' }
      ]
    },
];

interface OperatorHelperProps {
  forceTaskId?: string;
  readOnly?: boolean;
}

const OperatorHelper: React.FC<OperatorHelperProps> = ({ forceTaskId, readOnly = false }) => {
  const { t } = useContext(LanguageContext);
  const [tasks, setTasks] = useState<TaxFiling[]>(MOCK_ASSIGNED_TASKS);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(forceTaskId || null);
  const [viewMode, setViewMode] = useState<'LIST' | 'DETAIL'>(forceTaskId ? 'DETAIL' : 'LIST');
  const [activeTab, setActiveTab] = useState<'DATA' | 'CHAT' | 'RECEIPT'>('DATA');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [idBillingCode, setIdBillingCode] = useState('');
  const [bpnCode, setBpnCode] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const selectedTask = useMemo(() => 
    tasks.find(t => t.id === (forceTaskId || selectedTaskId)), 
    [tasks, selectedTaskId, forceTaskId]
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedTask?.chatHistory, activeTab]);

  const formatInputDisplay = (val: number) => {
    if (!val) return "";
    return new Intl.NumberFormat('id-ID').format(val);
  };

  const handleUpdateRow = (rowId: string, updates: Partial<TaxDataRow>) => {
    if (readOnly) return;
    setTasks(prev => prev.map(task => {
        if (task.id !== selectedTask?.id || !task.submittedData) return task;
        const newData = task.submittedData.map(row => {
            if (row.id !== rowId) return row;
            const updatedRow = { ...row, ...updates };
            updatedRow.taxAmount = (updatedRow.baseAmount * updatedRow.rate) / 100;
            return updatedRow;
        });
        return { ...task, submittedData: newData, amount: newData.reduce((sum, r) => sum + r.taxAmount, 0) };
    }));
  };

  const handleBaseAmountChange = (rowId: string, value: string) => {
    const numericValue = value.replace(/\D/g, '');
    handleUpdateRow(rowId, { baseAmount: numericValue === '' ? 0 : parseInt(numericValue, 10) });
  };

  const sendMessage = () => {
    if (!chatInput.trim() || !selectedTask) return;
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderId: 'operator-1',
      senderName: 'JTC Operator',
      text: chatInput,
      timestamp: new Date().toISOString()
    };
    setTasks(prev => prev.map(task => 
      task.id === selectedTask.id ? { ...task, chatHistory: [...(task.chatHistory || []), newMessage] } : task
    ));
    setChatInput('');
  };

  const handleIssueBilling = () => {
    if (!idBillingCode) return;
    setTasks(prev => prev.map(task => 
      task.id === selectedTask?.id ? { ...task, status: TaxStatus.WAITING_FEE_PAYMENT, idBilling: idBillingCode } : task
    ));
    setViewMode('LIST');
  };

  const handleUpdateBpn = () => {
    if (!bpnCode) return;
    setTasks(prev => prev.map(task => 
      task.id === selectedTask?.id ? { ...task, bpn: bpnCode, status: TaxStatus.FILED } : task
    ));
  };

  return (
    <div className={`max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 ${readOnly ? 'pointer-events-none' : ''}`}>
      {!forceTaskId && viewMode === 'LIST' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tasks.map(task => (
                <Card key={task.id} className={`p-6 cursor-pointer border-l-4 transition-all ${task.status === TaxStatus.AWAITING_ID_BILLING_ISSUANCE ? 'border-l-amber-500 bg-amber-500/5 shadow-lg' : 'border-l-transparent hover:border-l-blue-500'}`} onClick={() => { setSelectedTaskId(task.id); setViewMode('DETAIL'); }}>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="font-bold text-lg">{task.clientName}</h3>
                            <p className="text-[10px] text-slate-500 uppercase font-black">{task.type}</p>
                        </div>
                        <Badge variant={task.status === TaxStatus.AWAITING_ID_BILLING_ISSUANCE ? 'warning' : 'default'}>
                          {task.status === TaxStatus.AWAITING_ID_BILLING_ISSUANCE ? t.coretax_ready : ((t as any)[`status_${task.status}`] || task.status)}
                        </Badge>
                    </div>
                    <div className="mt-8 flex justify-between items-center border-t border-slate-800 pt-4">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Total Tax</span>
                        <span className="text-white mono font-bold text-xl">{FORMATTER.format(task.amount)}</span>
                    </div>
                </Card>
            ))}
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
                <header className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      {!readOnly && <Button variant="ghost" size="sm" onClick={() => setViewMode('LIST')} className="p-2"><Icons.ChevronRight className="rotate-180" /></Button>}
                      <div>
                          <Badge variant="destructive" className="mb-1 uppercase tracking-tighter font-black">{t.operator_workspace}</Badge>
                          <h1 className="text-3xl font-bold italic">{selectedTask?.clientName}</h1>
                      </div>
                    </div>
                    <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                      <button onClick={() => setActiveTab('DATA')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'DATA' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{t.data_review}</button>
                      <button onClick={() => setActiveTab('CHAT')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'CHAT' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{t.consultation_request}</button>
                      <button onClick={() => setActiveTab('RECEIPT')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'RECEIPT' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{t.receipt_management}</button>
                    </div>
                </header>

                {activeTab === 'DATA' && (
                  <Card className="overflow-hidden animate-in fade-in duration-300">
                      <table className="w-full text-left text-[11px]">
                          <thead className="bg-slate-950 text-slate-500 uppercase font-black border-b border-slate-800">
                              <tr>
                                  <th className="px-5 py-4 w-[25%]">{t.lang === 'KR' ? '항목 / 파트너' : 'Item / Partner'}</th>
                                  <th className="px-5 py-4">{t.tax_base}</th>
                                  <th className="px-5 py-4">{t.tax_rate}</th>
                                  <th className="px-5 py-4">{t.tax_type}</th>
                                  <th className="px-5 py-4">{t.tax_amount}</th>
                                  {!readOnly && <th className="px-5 py-4 text-right">{t.lang === 'KR' ? '관리' : 'Action'}</th>}
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                              {selectedTask?.submittedData?.map(row => {
                                  const isEditing = editingRowId === row.id;
                                  return (
                                      <tr key={row.id} className={`transition-colors ${isEditing ? 'bg-blue-600/10' : 'hover:bg-slate-900/40'}`}>
                                          <td className="px-5 py-4">
                                              <p className="font-bold text-slate-200 text-sm">{row.label}</p>
                                              <span className="text-[10px] text-slate-500">{row.partnerName}</span>
                                          </td>
                                          <td className="px-5 py-4 mono">
                                              {isEditing ? <Input type="text" className="h-8 w-32" value={formatInputDisplay(row.baseAmount)} onChange={e => handleBaseAmountChange(row.id, e.target.value)} /> : FORMATTER.format(row.baseAmount)}
                                          </td>
                                          <td className="px-5 py-4 font-bold">
                                              {isEditing ? <Input type="number" className="h-8 w-16" value={row.rate} onChange={e => handleUpdateRow(row.id, {rate: Number(e.target.value)})} /> : `${row.rate}%`}
                                          </td>
                                          <td className="px-5 py-4">
                                            {isEditing ? (
                                              <select className="bg-slate-900 border border-slate-700 rounded h-8 px-2 text-[10px]" value={row.taxType} onChange={e => handleUpdateRow(row.id, {taxType: e.target.value})}>
                                                {TAX_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                              </select>
                                            ) : <Badge variant="outline">{row.taxType}</Badge>}
                                          </td>
                                          <td className="px-5 py-4 font-black text-blue-400 mono">{FORMATTER.format(row.taxAmount)}</td>
                                          {!readOnly && (
                                              <td className="px-5 py-4 text-right">
                                                  {isEditing ? <Button variant="success" size="sm" onClick={() => setEditingRowId(null)}>{t.save}</Button> : <Button variant="outline" size="sm" onClick={() => setEditingRowId(row.id)}>{t.edit}</Button>}
                                              </td>
                                          )}
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  </Card>
                )}

                {activeTab === 'CHAT' && (
                  <Card className="h-[600px] flex flex-col animate-in fade-in duration-300 overflow-hidden">
                      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-950/30">
                          {selectedTask?.chatHistory?.map(msg => (
                              <div key={msg.id} className={`flex flex-col ${msg.senderId === 'operator-1' ? 'items-end' : 'items-start'}`}>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[9px] font-black text-slate-500 uppercase">{msg.senderName}</span>
                                    <span className="text-[8px] text-slate-600">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                  </div>
                                  <div className={`max-w-[80%] p-3 rounded-2xl text-xs font-medium ${msg.senderId === 'operator-1' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none'}`}>
                                      {msg.text}
                                  </div>
                              </div>
                          ))}
                          <div ref={chatEndRef} />
                      </div>
                      <div className="p-4 bg-slate-900 border-t border-slate-800 flex gap-2">
                          <Input 
                            placeholder={t.placeholderChat} 
                            value={chatInput} 
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendMessage()}
                          />
                          <Button onClick={sendMessage} className="px-6 font-bold">{t.send}</Button>
                      </div>
                  </Card>
                )}

                {activeTab === 'RECEIPT' && (
                  <div className="grid md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                      <Card className="p-6">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">{t.ntpn_info}</h3>
                        <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800 text-center">
                            {selectedTask?.ntpn ? (
                              <div className="space-y-2">
                                <p className="text-[10px] text-emerald-500 font-black">{t.client_paid_confirm}</p>
                                <p className="text-2xl font-black text-white mono tracking-widest">{selectedTask.ntpn}</p>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 italic">{t.waiting_client_receipt}</p>
                            )}
                        </div>
                      </Card>
                      <Card className="p-6">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">{t.finish_filing}</h3>
                        <div className="space-y-4">
                            <Label className="text-[10px] uppercase text-blue-400 font-black">{t.bpn_input}</Label>
                            <Input 
                              placeholder={t.bpn_placeholder} 
                              value={bpnCode} 
                              onChange={e => setBpnCode(e.target.value)}
                              className="mono font-bold"
                            />
                            <Button variant="secondary" className="w-full font-black" onClick={handleUpdateBpn}>{t.finish_filing}</Button>
                        </div>
                      </Card>
                  </div>
                )}
            </div>

            <aside className="lg:col-span-4 space-y-6">
                <Card className="p-6 bg-blue-600/5 border-blue-600/20">
                    <h3 className="text-[11px] font-black text-blue-400 uppercase tracking-widest mb-4">{t.lang === 'KR' ? 'CoreTax 발행 가이드' : 'CoreTax Issuance Guide'}</h3>
                    <div className="space-y-4">
                        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase"><span>Client NPWP</span> <span className="text-white mono">{selectedTask?.clientId || '01.234.567.8...'}</span></div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase"><span>MAP Code</span> <span className="text-white mono">411121</span></div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase"><span>KJS Code</span> <span className="text-white mono">100</span></div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase"><span>Amount</span> <span className="text-blue-400 mono font-black">{FORMATTER.format(selectedTask?.amount || 0)}</span></div>
                        </div>
                        
                        {selectedTask?.status === TaxStatus.AWAITING_ID_BILLING_ISSUANCE && (
                          <div className="space-y-3 pt-4 border-t border-slate-800">
                             <Label className="text-[10px] uppercase text-amber-500 font-black">{t.issue_billing}</Label>
                             <Input 
                                placeholder="30xxxxxxxxxxxxx" 
                                value={idBillingCode} 
                                onChange={e => setIdBillingCode(e.target.value)}
                                className="mono text-lg font-black text-center"
                             />
                             <Button variant="primary" className="w-full h-12 font-black bg-amber-600 hover:bg-amber-700" onClick={handleIssueBilling}>{t.issue_billing}</Button>
                          </div>
                        )}
                    </div>
                </Card>
            </aside>
        </div>
      )}
    </div>
  );
};

export default OperatorHelper;
