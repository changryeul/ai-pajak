'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Users, UserPlus, ShieldCheck, Mail, Loader2, XCircle } from 'lucide-react';

interface StaffRow {
  consultantId: string;
  fullName: string;
  email: string;
  isActive: boolean;
  role: string | null;
  hasLogin: boolean;
  clientCount: number;
  since: string | null;
  isSelf: boolean;
}

interface InvitationRow {
  invitationId: string;
  email: string;
  fullName: string | null;
  role: string;
  expiresAt: string;
  expired: boolean;
  createdAt: string;
}

const ROLE_LABEL: Record<string, string> = {
  TAX_ADVISOR: '세무사',
  CONSULTANT: '컨설턴트',
  FIRM_ADMIN: '관리자',
};

export function FirmAdminStaffView() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'CONSULTANT' | 'TAX_ADVISOR'>('CONSULTANT');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/firm-admin/staff');
      const j = await r.json();
      if (!r.ok) {
        setError(typeof j.error === 'string' ? j.error : '불러오기 실패');
      } else {
        setStaff(j.data.staff);
        setInvitations(j.data.invitations);
      }
    } catch {
      setError('네트워크 오류');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async () => {
    if (!inviteEmail) return;
    setBusy(true);
    try {
      const r = await fetch('/api/firm-admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          fullName: inviteName || undefined,
          role: inviteRole,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(typeof j.error === 'string' ? j.error : '초대 실패');
      } else {
        toast.success(`${inviteEmail} 로 초대 메일을 보냈습니다`);
        setInviteOpen(false);
        setInviteEmail('');
        setInviteName('');
        setInviteRole('CONSULTANT');
        void load();
      }
    } finally {
      setBusy(false);
    }
  };

  const patch = async (
    consultantId: string,
    body: { isActive?: boolean; role?: 'CONSULTANT' | 'TAX_ADVISOR' },
    successMsg: string,
  ) => {
    setBusy(true);
    try {
      const r = await fetch('/api/firm-admin/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consultantId, ...body }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(typeof j.error === 'string' ? j.error : '저장 실패');
      } else {
        toast.success(successMsg);
        void load();
      }
    } finally {
      setBusy(false);
    }
  };

  const cancelInvitation = async (invitationId: string, email: string) => {
    if (!window.confirm(`${email} 초대를 취소할까요?`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/firm-admin/staff?invitationId=${invitationId}`, {
        method: 'DELETE',
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(typeof j.error === 'string' ? j.error : '취소 실패');
      } else {
        toast.success('초대를 취소했습니다');
        void load();
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-red-600">
          {error}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => void load()}>
              다시 시도
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const advisorCount = staff.filter((s) => s.role === 'TAX_ADVISOR' && s.isActive).length;

  return (
    <div className="space-y-6">
      {advisorCount === 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ShieldCheck className="mr-1 inline h-4 w-4" />
          활성 세무사(TAX_ADVISOR)가 없습니다 — 자기 이름 신고를 위해 최소 1명이 필요합니다
          (Hard Rule #3).
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            활성 직원 목록
            <Badge variant="secondary">{staff.length}</Badge>
          </CardTitle>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="mr-1 h-4 w-4" />
                직원 초대
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>직원 초대</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  type="email"
                  placeholder="이메일 (필수)"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <Input
                  placeholder="이름 (선택)"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as 'CONSULTANT' | 'TAX_ADVISOR')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONSULTANT">컨설턴트</SelectItem>
                    <SelectItem value="TAX_ADVISOR">세무사 (자격증 소지자)</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="w-full" disabled={busy || !inviteEmail} onClick={() => void invite()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : '초대 메일 보내기'}
                </Button>
                <p className="text-xs text-slate-400">
                  초대 링크는 7일간 유효하며, 수락 시 자동으로 우리 법인 소속으로 등록됩니다.
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <div className="rounded-md bg-slate-50 py-8 text-center text-sm text-slate-400">
              아직 등록된 직원이 없습니다. 우측 상단에서 초대하세요.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-slate-500">
                    <th className="py-2 pr-3">이름</th>
                    <th className="py-2 pr-3">이메일</th>
                    <th className="py-2 pr-3">역할</th>
                    <th className="py-2 pr-3 text-right">담당 클라이언트</th>
                    <th className="py-2 pr-3">상태</th>
                    <th className="py-2 text-right">동작</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.consultantId} className="border-b last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-slate-800">
                        {s.fullName}
                        {s.isSelf && (
                          <span className="ml-1 text-xs text-indigo-500">(나)</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-500">{s.email}</td>
                      <td className="py-2.5 pr-3">
                        {s.role ? (
                          <Badge
                            variant={s.role === 'TAX_ADVISOR' ? 'default' : 'secondary'}
                            className={
                              s.role === 'TAX_ADVISOR'
                                ? 'bg-emerald-600 hover:bg-emerald-600'
                                : s.role === 'FIRM_ADMIN'
                                  ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100'
                                  : undefined
                            }
                          >
                            {ROLE_LABEL[s.role] ?? s.role}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">로그인 계정 없음</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{s.clientCount}</td>
                      <td className="py-2.5 pr-3">
                        {s.isActive ? (
                          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                            활성
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-slate-500">
                            비활성
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          {s.hasLogin && s.role === 'CONSULTANT' && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                window.confirm(`${s.fullName} 을(를) 세무사로 임명할까요?`) &&
                                void patch(
                                  s.consultantId,
                                  { role: 'TAX_ADVISOR' },
                                  '세무사로 임명했습니다',
                                )
                              }
                            >
                              <ShieldCheck className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                              세무사 임명
                            </Button>
                          )}
                          {s.hasLogin && s.role === 'TAX_ADVISOR' && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                window.confirm(`${s.fullName} 의 세무사 임명을 해제할까요?`) &&
                                void patch(
                                  s.consultantId,
                                  { role: 'CONSULTANT' },
                                  '세무사 임명을 해제했습니다',
                                )
                              }
                            >
                              임명 해제
                            </Button>
                          )}
                          {!s.isSelf && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                window.confirm(
                                  s.isActive
                                    ? `${s.fullName} 을(를) 비활성화할까요?`
                                    : `${s.fullName} 을(를) 다시 활성화할까요?`,
                                ) &&
                                void patch(
                                  s.consultantId,
                                  { isActive: !s.isActive },
                                  s.isActive ? '비활성화했습니다' : '활성화했습니다',
                                )
                              }
                            >
                              {s.isActive ? '비활성화' : '활성화'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-slate-500" />
            대기중 초대
            <Badge variant="secondary">{invitations.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <div className="rounded-md bg-slate-50 py-6 text-center text-sm text-slate-400">
              대기중인 초대가 없습니다.
            </div>
          ) : (
            <ul className="divide-y">
              {invitations.map((i) => (
                <li key={i.invitationId} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <span className="font-medium text-slate-800">{i.email}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      {ROLE_LABEL[i.role] ?? i.role}
                      {i.fullName ? ` · ${i.fullName}` : ''}
                    </span>
                    {i.expired ? (
                      <Badge variant="secondary" className="ml-2 text-red-600">
                        만료됨
                      </Badge>
                    ) : (
                      <span className="ml-2 text-xs text-slate-400">
                        ~{new Date(i.expiresAt).toLocaleDateString('ko-KR')}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void cancelInvitation(i.invitationId, i.email)}
                  >
                    <XCircle className="mr-1 h-4 w-4 text-slate-400" />
                    취소
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
