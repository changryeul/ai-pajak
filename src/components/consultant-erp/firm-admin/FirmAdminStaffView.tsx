'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
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

export function FirmAdminStaffView() {
  const t = useTranslations('firmAdmin');
  const locale = useLocale();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'CONSULTANT' | 'TAX_ADVISOR'>('CONSULTANT');

  const roleLabel = (role: string) =>
    role === 'TAX_ADVISOR'
      ? t('roleAdvisorShort')
      : role === 'FIRM_ADMIN'
        ? t('roleAdminShort')
        : t('roleConsultant');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/firm-admin/staff');
      const j = await r.json();
      if (!r.ok) {
        setError(typeof j.error === 'string' ? j.error : t('loadFailed'));
      } else {
        setStaff(j.data.staff);
        setInvitations(j.data.invitations);
      }
    } catch {
      setError(t('networkError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
        toast.error(typeof j.error === 'string' ? j.error : t('inviteFailed'));
      } else {
        toast.success(t('inviteSuccess', { email: inviteEmail }));
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
        toast.error(typeof j.error === 'string' ? j.error : t('saveFailed'));
      } else {
        toast.success(successMsg);
        void load();
      }
    } finally {
      setBusy(false);
    }
  };

  const cancelInvitation = async (invitationId: string, email: string) => {
    if (!window.confirm(t('cancelConfirm', { email }))) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/firm-admin/staff?invitationId=${invitationId}`, {
        method: 'DELETE',
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(typeof j.error === 'string' ? j.error : t('cancelFailed'));
      } else {
        toast.success(t('cancelDone'));
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
              {t('retry')}
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
          {t('advisorZeroBanner')}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600" />
            {t('staffListTitle')}
            <Badge variant="secondary">{staff.length}</Badge>
          </CardTitle>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="mr-1 h-4 w-4" />
                {t('inviteButton')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t('inviteDialogTitle')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  type="email"
                  placeholder={t('inviteEmailPlaceholder')}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <Input
                  placeholder={t('inviteNamePlaceholder')}
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
                    <SelectItem value="CONSULTANT">{t('roleConsultant')}</SelectItem>
                    <SelectItem value="TAX_ADVISOR">{t('roleAdvisor')}</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="w-full" disabled={busy || !inviteEmail} onClick={() => void invite()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('inviteSend')}
                </Button>
                <p className="text-xs text-slate-400">{t('inviteHint')}</p>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <div className="rounded-md bg-slate-50 py-8 text-center text-sm text-slate-400">
              {t('emptyStaff')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-slate-500">
                    <th className="py-2 pr-3">{t('colName')}</th>
                    <th className="py-2 pr-3">{t('colEmail')}</th>
                    <th className="py-2 pr-3">{t('colRole')}</th>
                    <th className="py-2 pr-3 text-right">{t('colClients')}</th>
                    <th className="py-2 pr-3">{t('colStatus')}</th>
                    <th className="py-2 text-right">{t('colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.consultantId} className="border-b last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-slate-800">
                        {s.fullName}
                        {s.isSelf && (
                          <span className="ml-1 text-xs text-indigo-500">{t('me')}</span>
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
                            {roleLabel(s.role)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">{t('noLogin')}</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{s.clientCount}</td>
                      <td className="py-2.5 pr-3">
                        {s.isActive ? (
                          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                            {t('active')}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-slate-500">
                            {t('inactive')}
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
                                window.confirm(t('appointConfirm', { name: s.fullName })) &&
                                void patch(
                                  s.consultantId,
                                  { role: 'TAX_ADVISOR' },
                                  t('appointDone'),
                                )
                              }
                            >
                              <ShieldCheck className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                              {t('appoint')}
                            </Button>
                          )}
                          {s.hasLogin && s.role === 'TAX_ADVISOR' && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                window.confirm(t('dismissConfirm', { name: s.fullName })) &&
                                void patch(
                                  s.consultantId,
                                  { role: 'CONSULTANT' },
                                  t('dismissDone'),
                                )
                              }
                            >
                              {t('dismiss')}
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
                                    ? t('deactivateConfirm', { name: s.fullName })
                                    : t('activateConfirm', { name: s.fullName }),
                                ) &&
                                void patch(
                                  s.consultantId,
                                  { isActive: !s.isActive },
                                  s.isActive ? t('deactivateDone') : t('activateDone'),
                                )
                              }
                            >
                              {s.isActive ? t('deactivate') : t('activate')}
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
            {t('pendingInvites')}
            <Badge variant="secondary">{invitations.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <div className="rounded-md bg-slate-50 py-6 text-center text-sm text-slate-400">
              {t('emptyInvites')}
            </div>
          ) : (
            <ul className="divide-y">
              {invitations.map((i) => (
                <li key={i.invitationId} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <span className="font-medium text-slate-800">{i.email}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      {roleLabel(i.role)}
                      {i.fullName ? ` · ${i.fullName}` : ''}
                    </span>
                    {i.expired ? (
                      <Badge variant="secondary" className="ml-2 text-red-600">
                        {t('expired')}
                      </Badge>
                    ) : (
                      <span className="ml-2 text-xs text-slate-400">
                        ~{new Date(i.expiresAt).toLocaleDateString(locale)}
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
                    {t('cancel')}
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
