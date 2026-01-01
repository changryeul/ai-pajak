
import React, { useState, useContext } from 'react';
import { Card, Badge, Button, Input, Label } from '../apps/web/src/components/ui';
import { FORMATTER } from '../constants';
import { StaffMember, TaxFiling, UserRole, TaxStatus, AssignmentHistory } from '../types';
import OperatorHelper from './OperatorHelper';
import { LanguageContext } from '../App';

const MOCK_STAFF: (StaffMember & { progress: number; lastFeedback?: string })[] = [
  { id: 'st-1', name: '김하나 상담원', role: UserRole.JTC_OPERATOR, activeTasks: 5, completedTasks: 120, status: 'ONLINE', performance: 94, progress: 78, lastFeedback: 'PPh 21 마감 건들에 집중해주세요.' },
  { id: 'st-2', name: '이민호 상담원', role: UserRole.JTC_OPERATOR, activeTasks: 8, completedTasks: 95, status: 'BUSY', performance: 88, progress: 45 },
];

const MOCK_GLOBAL_TASKS: TaxFiling[] = [
  { id: 't-1', clientName: 'PT ABC Tech', type: 'PPh 21', period: '12/2024', amount: 45000000, status: TaxStatus.AWAITING_ADVISOR_APPROVAL, dueDate: '2025-01-10', assignedStaffId: 'st-1', history: [] },
];

const TaxAdvisorQueue: React.FC = () => {
  const { t } = useContext(LanguageContext);
  const [staff, setStaff] = useState(MOCK_STAFF);
  const [tasks, setTasks] = useState<TaxFiling[]>(MOCK_GLOBAL_TASKS);
  const [selectedStaff, setSelectedStaff] = useState<(typeof MOCK_STAFF)[0] | null>(null);
  const [monitoringTask, setMonitoringTask] = useState<TaxFiling | null>(null);
  const [coachingText, setCoachingText] = useState('');
  const [showHistoryFor, setShowHistoryFor] = useState<string | null>(null);

  const sendCoaching = (staffId: string) => {
    if (!coachingText.trim()) return;
    setStaff(prev => prev.map(s => 
      s.id === staffId ? { ...s, lastFeedback: coachingText } : s
    ));
    setCoachingText('');
    setSelectedStaff(null);
  };

  const assignTask = (taskId: string, staffId: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id !== taskId) return task;
      const historyEntry: AssignmentHistory = {
        timestamp: new Date().toISOString(),
        fromStaffId: task.assignedStaffId,
        toStaffId: staffId,
        action: 'Operator Reassigned'
      };
      return { 
        ...task, 
        assignedStaffId: staffId, 
        history: [...(task.history || []), historyEntry] 
      };
    }));
  };

  const approveTask = (taskId: string) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, status: TaxStatus.AWAITING_ID_BILLING_ISSUANCE } : task
    ));
    setMonitoringTask(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto pb-20">
      <header className="flex justify-between items-end border-b border-slate-800 pb-6">
        <div>
          <Badge variant="destructive" className="mb-2 uppercase tracking-widest font-black">{t.advisor_workspace}</Badge>
          <h1 className="text-3xl font-bold italic">{t.live_ops}</h1>
          <p className="text-slate-400">{t.staff_monitoring_desc}</p>
        </div>
      </header>

      <div className="grid lg:grid-cols-12 gap-8">
        <section className="lg:col-span-4 space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            {t.staff_list}
          </h2>
          <div className="space-y-3">
            {staff.map(s => (
              <Card 
                key={s.id} 
                className={`p-5 cursor-pointer transition-all relative overflow-hidden ${selectedStaff?.id === s.id ? 'border-blue-500 bg-blue-500/5' : 'hover:bg-slate-900/50'}`}
                onClick={() => setSelectedStaff(s)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-lg ${s.status === 'ONLINE' ? 'bg-emerald-600' : 'bg-amber-600'}`}>
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-200">{s.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                        <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">{s.status}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                      <p className="text-[9px] text-slate-500 uppercase font-bold">Progress</p>
                      <p className="text-lg font-black text-blue-500">{s.progress}%</p>
                  </div>
                </div>
                
                {selectedStaff?.id === s.id && (
                  <div className="mt-5 pt-5 border-t border-slate-800 animate-in slide-in-from-top-2 duration-300 relative">
                      <button onClick={(e) => { e.stopPropagation(); setSelectedStaff(null); }} className="absolute top-2 right-0 w-8 h-8 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800 rounded-full transition-colors">✕</button>
                      <div className="space-y-3">
                          <Label className="text-[10px] uppercase text-blue-400 font-black">{t.lang === 'KR' ? '실시간 코칭 메시지 전송' : 'Send Coaching Message'}</Label>
                          <div className="flex gap-2">
                            <Input placeholder={t.placeholderChat} className="text-xs h-10 flex-1" value={coachingText} onClick={(e) => e.stopPropagation()} onChange={e => setCoachingText(e.target.value)} />
                            <Button variant="primary" className="h-10 px-4 text-xs font-bold" onClick={(e) => { e.stopPropagation(); sendCoaching(s.id); }}>{t.send}</Button>
                          </div>
                      </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </section>

        <section className="lg:col-span-8 space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            {t.workload_board}
          </h2>
          <Card className="overflow-hidden border-slate-800 shadow-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-slate-500 text-[10px] uppercase font-black border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">{t.lang === 'KR' ? '고객사 / 세무 유형' : 'Client / Tax Type'}</th>
                  <th className="px-6 py-4">{t.tax_amount}</th>
                  <th className="px-6 py-4">{t.lang === 'KR' ? '상태' : 'Status'}</th>
                  <th className="px-6 py-4">{t.lang === 'KR' ? '담당 상담원' : 'Assigned Staff'}</th>
                  <th className="px-6 py-4 text-right">{t.lang === 'KR' ? '관리' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/10">
                {tasks.map(task => (
                  <tr key={task.id} className="hover:bg-slate-800/40 transition-colors group">
                    <td className="px-6 py-4 relative">
                      <p className="font-bold text-slate-200">{task.clientName}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-slate-500 uppercase font-bold">{task.type} • {task.period}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 mono font-bold text-xs text-blue-400">{FORMATTER.format(task.amount)}</td>
                    <td className="px-6 py-4">
                      <Badge variant={task.status === TaxStatus.AWAITING_ADVISOR_APPROVAL ? 'warning' : 'outline'} className="text-[9px] font-black uppercase tracking-tighter">
                        {(t as any)[`status_${task.status}`] || task.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-[11px] outline-none focus:border-blue-500 text-slate-300 font-bold"
                        value={task.assignedStaffId || ''}
                        onChange={(e) => assignTask(task.id, e.target.value)}
                      >
                        <option value="">{t.lang === 'KR' ? '-- 미배정 --' : '-- Unassigned --'}</option>
                        {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button 
                        variant={task.status === TaxStatus.AWAITING_ADVISOR_APPROVAL ? 'primary' : 'outline'}
                        size="sm" 
                        className={`h-8 text-[10px] font-black px-3 transition-all ${task.status === TaxStatus.AWAITING_ADVISOR_APPROVAL ? 'animate-pulse' : 'opacity-0 group-hover:opacity-100'}`}
                        onClick={() => setMonitoringTask(task)}
                      >
                        {task.status === TaxStatus.AWAITING_ADVISOR_APPROVAL ? t.review_and_grant : t.monitoring}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      </div>

      {monitoringTask && (
          <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-3xl z-[200] flex flex-col animate-in fade-in duration-300">
              <nav className="bg-slate-900/80 border-b border-slate-800 px-8 py-4 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-6">
                      <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full animate-pulse ${monitoringTask.status === TaxStatus.AWAITING_ADVISOR_APPROVAL ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                          <h3 className="font-black text-white text-lg tracking-tighter uppercase italic">
                            {monitoringTask.status === TaxStatus.AWAITING_ADVISOR_APPROVAL ? t.final_review_mode : t.monitoring_mode}
                          </h3>
                      </div>
                  </div>
                  <Button variant="ghost" size="sm" className="font-black px-4 text-slate-500 hover:text-white" onClick={() => setMonitoringTask(null)}>{t.cancel}</Button>
              </nav>
              
              <main className="flex-1 overflow-y-auto p-12 custom-scrollbar pb-32">
                  <div className="max-w-[1400px] mx-auto opacity-90 select-none">
                      <OperatorHelper forceTaskId={monitoringTask.id} readOnly={true} />
                  </div>
              </main>

              {monitoringTask.status === TaxStatus.AWAITING_ADVISOR_APPROVAL && (
                <div className="fixed bottom-0 left-0 w-full bg-slate-900 border-t border-blue-500/30 p-6 flex justify-center items-center gap-8 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Total Tax Amount</p>
                    <p className="text-2xl font-black text-white mono">{FORMATTER.format(monitoringTask.amount)}</p>
                  </div>
                  <div className="h-10 w-px bg-slate-800"></div>
                  <div className="flex gap-4">
                    <Button variant="outline" className="h-12 px-8 font-black border-red-500/20 text-red-400 hover:bg-red-500/10" onClick={() => setMonitoringTask(null)}>
                      {t.request_correction}
                    </Button>
                    <Button variant="success" className="h-12 px-12 font-black shadow-xl shadow-emerald-500/20" onClick={() => approveTask(monitoringTask.id)}>
                      {t.grant_permission}
                    </Button>
                  </div>
                </div>
              )}
          </div>
      )}
    </div>
  );
};

export default TaxAdvisorQueue;
