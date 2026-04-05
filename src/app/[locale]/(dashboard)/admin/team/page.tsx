'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users, UserPlus, Loader2, CheckCircle, AlertTriangle, X,
  Clock, Mail, Shield, Briefcase,
} from 'lucide-react';

interface Invitation {
  id: string;
  email: string;
  role: string;
  team: string | null;
  full_name: string | null;
  expires_at: string;
  accepted_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  TAX_OPERATOR: '백오피스 상담원',
  TAX_OPERATOR_SUPERVISOR: '백오피스 수퍼바이저',
  TAX_ADVISOR_JTC: '세무사 (Tax Advisor)',
  CONSULTANT_JTC: '컨설턴트',
};

const TEAMS = ['CORPORATE', 'INDIVIDUAL', 'PAYROLL', 'ADMIN'];

export default function TeamManagementPage() {
  const { session } = useSession();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('TAX_OPERATOR');
  const [inviteTeam, setInviteTeam] = useState<string>('none');
  const [inviteFullName, setInviteFullName] = useState('');

  const isMaster = session?.role === 'TAX_ADVISOR_JTC';
  const isSupervisor = session?.role === 'TAX_OPERATOR_SUPERVISOR';

  const availableRoles = isMaster
    ? ['TAX_OPERATOR', 'TAX_OPERATOR_SUPERVISOR', 'CONSULTANT_JTC', 'TAX_ADVISOR_JTC']
    : isSupervisor
      ? ['TAX_OPERATOR']
      : [];

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const loadInvitations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/invitations');
      const data = await res.json();
      if (data.success) setInvitations(data.data || []);
    } catch { /* */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadInvitations(); }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteRole) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          team: inviteTeam && inviteTeam !== 'none' ? inviteTeam : undefined,
          fullName: inviteFullName || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', data.message);
        setInviteEmail('');
        setInviteFullName('');
        setInviteTeam('none');
        setShowInviteForm(false);
        loadInvitations();
      } else {
        showMsg('error', data.error || '초대 실패');
      }
    } catch {
      showMsg('error', '초대 중 오류');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('초대를 취소하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/admin/invitations/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showMsg('success', data.message);
        loadInvitations();
      }
    } catch {
      showMsg('error', '취소 실패');
    }
  };

  const getStatus = (inv: Invitation) => {
    if (inv.accepted_at) return { label: '수락됨', color: 'bg-green-100 text-green-700', icon: CheckCircle };
    if (inv.cancelled_at) return { label: '취소됨', color: 'bg-gray-100 text-gray-500', icon: X };
    if (new Date(inv.expires_at).getTime() < Date.now())
      return { label: '만료됨', color: 'bg-red-100 text-red-700', icon: AlertTriangle };
    return { label: '대기 중', color: 'bg-blue-100 text-blue-700', icon: Clock };
  };

  if (!isMaster && !isSupervisor) {
    return (
      <div className="container mx-auto py-16 px-4 max-w-md text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <p className="text-sm text-gray-600">이 페이지는 마스터 또는 수퍼바이저만 접근 가능합니다</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-blue-600" />
          직원 관리
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isMaster
            ? '세무사, 컨설턴트, 백오피스 직원을 초대하고 관리합니다'
            : '백오피스 상담원을 초대합니다'}
        </p>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Invite button / form */}
      <Card className="mb-4">
        <CardContent className="p-5">
          {!showInviteForm ? (
            <Button onClick={() => setShowInviteForm(true)}>
              <UserPlus className="h-4 w-4 mr-2" />직원 초대
            </Button>
          ) : (
            <form onSubmit={handleInvite} className="space-y-3">
              <h3 className="font-bold text-sm mb-2">새 직원 초대</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">이메일 *</Label>
                  <Input type="email" value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="staff@jtc.co.id" required />
                </div>
                <div>
                  <Label className="text-xs">이름 (선택)</Label>
                  <Input value={inviteFullName}
                    onChange={e => setInviteFullName(e.target.value)}
                    placeholder="직원 이름" />
                </div>
                <div>
                  <Label className="text-xs">역할 *</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availableRoles.map(r => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">팀 (선택)</Label>
                  <Select value={inviteTeam} onValueChange={setInviteTeam}>
                    <SelectTrigger><SelectValue placeholder="선택 안 함" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">선택 안 함</SelectItem>
                      {TEAMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={submitting || !inviteEmail}>
                  {submitting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Mail className="h-3 w-3 mr-1" />}
                  초대 메일 발송
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowInviteForm(false)}>취소</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Invitations list */}
      <Card>
        <CardContent className="p-5">
          <h3 className="font-bold text-sm mb-3">초대 이력 ({invitations.length})</h3>
          {loading ? (
            <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" /></div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">초대 이력이 없습니다</div>
          ) : (
            <div className="space-y-2">
              {invitations.map(inv => {
                const status = getStatus(inv);
                const StatusIcon = status.icon;
                const isPending = !inv.accepted_at && !inv.cancelled_at && new Date(inv.expires_at).getTime() >= Date.now();

                return (
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{inv.email}</span>
                        <Badge className={`text-[10px] ${status.color}`}>
                          <StatusIcon className="h-2.5 w-2.5 mr-1 inline" />{status.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1"><Shield className="h-3 w-3" />{ROLE_LABELS[inv.role] || inv.role}</span>
                        {inv.team && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{inv.team}</span>}
                        {inv.full_name && <span>{inv.full_name}</span>}
                        <span>· 만료 {new Date(inv.expires_at).toLocaleDateString('ko-KR')}</span>
                      </div>
                    </div>
                    {isPending && (
                      <Button size="sm" variant="ghost" onClick={() => handleCancel(inv.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
