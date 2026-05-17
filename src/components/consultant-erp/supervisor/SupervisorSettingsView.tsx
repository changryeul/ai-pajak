'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface CompanyInfo {
  id: string;
  name: string;
  legalName: string;
  npwp: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  partnerType: string;
}

interface RbacRow {
  role: 'TEAM_MEMBER' | 'SUPERVISOR' | 'OWNER';
  upload: boolean;
  parsingEdit: boolean;
  submit: boolean;
  teamView: boolean;
  approval: boolean;
  settings: boolean;
  credentialReveal: boolean;
}

interface ApprovalCfg {
  requireSupervisorApproval: boolean;
  allowRevisionAfterReject: boolean;
  autoAdvanceToBilling: boolean;
  slaMaxReviewDays: number;
  slaReminderHours: number;
}

interface SecurityCfg {
  passwordMasking: boolean;
  accessLog: boolean;
  sensitiveInfoGuard: boolean;
  twoFactor: boolean;
  sessionTimeoutMinutes: number;
  credentialRotationDays: number;
  ipAllowlist: string;
}

interface ChannelCfg {
  whatsApp: boolean;
  email: boolean;
  telegram: boolean;
  approvalPending: boolean;
  deadlineNearing: boolean;
  idBillingNtpn: boolean;
  revisionResubmit: boolean;
  legalityExpiry: boolean;
}

interface SettingsResp {
  company: CompanyInfo;
  rbac: RbacRow[];
  approval: ApprovalCfg;
  security: SecurityCfg;
  channels: ChannelCfg;
}

export function SupervisorSettingsView() {
  const t = useTranslations('supervisorErp');
  const [data, setData] = useState<SettingsResp | null>(null);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [approval, setApproval] = useState<ApprovalCfg | null>(null);
  const [channels, setChannels] = useState<ChannelCfg | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/consultant-erp/supervisor/settings')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (!j.success) {
          setError(j.error || 'failed');
          return;
        }
        const d = j.data as SettingsResp;
        setData(d);
        setCompany(d.company);
        setApproval(d.approval);
        setChannels(d.channels);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async () => {
    if (!company || !approval || !channels) return;
    setSaving(true);
    try {
      const r = await fetch('/api/consultant-erp/supervisor/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: {
            name: company.name,
            legalName: company.legalName,
            npwp: company.npwp,
            email: company.email ?? undefined,
            phone: company.phone ?? undefined,
            address: company.address ?? undefined,
          },
          approval,
          channels,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) {
        toast.error(j.error || t('errorToast'));
      } else {
        toast.success(t('savedToast'));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errorToast'));
    } finally {
      setSaving(false);
    }
  }, [company, approval, channels, t]);

  if (loading) {
    return <p className="text-sm text-slate-500"><Loader2 className="inline h-4 w-4 mr-1 animate-spin" /> …</p>;
  }
  if (error || !data || !company || !approval || !channels) {
    return <p className="text-sm text-rose-600">{error ?? 'no data'}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="min-h-10">
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          {t('saveBtn')}
        </Button>
      </div>

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">{t('tabCompany')}</TabsTrigger>
          <TabsTrigger value="roles">{t('tabRoles')}</TabsTrigger>
          <TabsTrigger value="approval">{t('tabApproval')}</TabsTrigger>
          <TabsTrigger value="security">{t('tabSecurity')}</TabsTrigger>
          <TabsTrigger value="channels">{t('tabChannels')}</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 grid gap-4 sm:grid-cols-2">
            <Field label={t('companyName')}>
              <Input value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} />
            </Field>
            <Field label={t('companyLegalName')}>
              <Input value={company.legalName} onChange={(e) => setCompany({ ...company, legalName: e.target.value })} />
            </Field>
            <Field label={t('companyNpwp')}>
              <Input value={company.npwp} onChange={(e) => setCompany({ ...company, npwp: e.target.value })} />
            </Field>
            <Field label={t('companyEmail')}>
              <Input value={company.email ?? ''} onChange={(e) => setCompany({ ...company, email: e.target.value })} />
            </Field>
            <Field label={t('companyPhone')}>
              <Input value={company.phone ?? ''} onChange={(e) => setCompany({ ...company, phone: e.target.value })} />
            </Field>
            <Field label={t('companyAddress')} span={2}>
              <Input value={company.address ?? ''} onChange={(e) => setCompany({ ...company, address: e.target.value })} />
            </Field>
          </div>
        </TabsContent>

        <TabsContent value="roles">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <p className="text-xs text-slate-500">{t('rbacIntro')}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left py-2 px-3">{t('tabRoles')}</th>
                    <th className="py-2 px-3">{t('rbacPermUpload')}</th>
                    <th className="py-2 px-3">{t('rbacPermParsing')}</th>
                    <th className="py-2 px-3">{t('rbacPermSubmit')}</th>
                    <th className="py-2 px-3">{t('rbacPermTeamView')}</th>
                    <th className="py-2 px-3">{t('rbacPermApproval')}</th>
                    <th className="py-2 px-3">{t('rbacPermSettings')}</th>
                    <th className="py-2 px-3">{t('rbacPermCredential')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.rbac.map((r) => (
                    <tr key={r.role}>
                      <td className="py-2 px-3 font-bold text-slate-900">
                        {r.role === 'TEAM_MEMBER' ? t('rbacRoleTeam') : r.role === 'SUPERVISOR' ? t('rbacRoleSupervisor') : t('rbacRoleOwner')}
                      </td>
                      <Cell on={r.upload} />
                      <Cell on={r.parsingEdit} />
                      <Cell on={r.submit} />
                      <Cell on={r.teamView} />
                      <Cell on={r.approval} />
                      <Cell on={r.settings} />
                      <Cell on={r.credentialReveal} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="approval">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <Toggle
              label={t('approvalRequireSupervisor')}
              value={approval.requireSupervisorApproval}
              onChange={(v) => setApproval({ ...approval, requireSupervisorApproval: v })}
            />
            <Toggle
              label={t('approvalAllowRevision')}
              value={approval.allowRevisionAfterReject}
              onChange={(v) => setApproval({ ...approval, allowRevisionAfterReject: v })}
            />
            <Toggle
              label={t('approvalAutoAdvance')}
              value={approval.autoAdvanceToBilling}
              onChange={(v) => setApproval({ ...approval, autoAdvanceToBilling: v })}
            />
            <div className="grid sm:grid-cols-2 gap-4 pt-2">
              <Field label={t('approvalSlaDays')}>
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={approval.slaMaxReviewDays}
                  onChange={(e) => setApproval({ ...approval, slaMaxReviewDays: parseInt(e.target.value, 10) || 0 })}
                />
              </Field>
              <Field label={t('approvalSlaHours')}>
                <Input
                  type="number"
                  min={0}
                  max={720}
                  value={approval.slaReminderHours}
                  onChange={(e) => setApproval({ ...approval, slaReminderHours: parseInt(e.target.value, 10) || 0 })}
                />
              </Field>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="security">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 grid gap-3 sm:grid-cols-2">
            <ReadonlyBadge label={t('securityMaskingTitle')} on={data.security.passwordMasking} />
            <ReadonlyBadge label={t('securityAccessLogTitle')} on={data.security.accessLog} />
            <ReadonlyBadge label={t('securitySensitiveTitle')} on={data.security.sensitiveInfoGuard} />
            <ReadonlyBadge label={t('security2faTitle')} on={data.security.twoFactor} />
            <Field label={t('securityTimeoutLabel')}>
              <Input value={data.security.sessionTimeoutMinutes} disabled />
            </Field>
            <Field label={t('securityRotationLabel')}>
              <Input value={data.security.credentialRotationDays} disabled />
            </Field>
            <Field label={t('securityIpLabel')} span={2}>
              <Input value={data.security.ipAllowlist} disabled />
            </Field>
          </div>
        </TabsContent>

        <TabsContent value="channels">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Toggle label={t('channelWhatsApp')} value={channels.whatsApp} onChange={(v) => setChannels({ ...channels, whatsApp: v })} />
            <Toggle label={t('channelEmail')} value={channels.email} onChange={(v) => setChannels({ ...channels, email: v })} />
            <Toggle label={t('channelTelegram')} value={channels.telegram} onChange={(v) => setChannels({ ...channels, telegram: v })} />
            <Toggle label={t('channelApprovalPending')} value={channels.approvalPending} onChange={(v) => setChannels({ ...channels, approvalPending: v })} />
            <Toggle label={t('channelDeadline')} value={channels.deadlineNearing} onChange={(v) => setChannels({ ...channels, deadlineNearing: v })} />
            <Toggle label={t('channelIdBilling')} value={channels.idBillingNtpn} onChange={(v) => setChannels({ ...channels, idBillingNtpn: v })} />
            <Toggle label={t('channelRevision')} value={channels.revisionResubmit} onChange={(v) => setChannels({ ...channels, revisionResubmit: v })} />
            <Toggle label={t('channelLegality')} value={channels.legalityExpiry} onChange={(v) => setChannels({ ...channels, legalityExpiry: v })} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({
  label,
  children,
  span = 1,
}: {
  label: string;
  children: React.ReactNode;
  span?: 1 | 2;
}) {
  return (
    <div className={span === 2 ? 'sm:col-span-2' : ''}>
      <Label className="text-[11px] text-slate-600">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Cell({ on }: { on: boolean }) {
  return (
    <td className="py-2 px-3 text-center">
      {on ? (
        <Check className="h-4 w-4 inline" style={{ color: '#009E73' }} />
      ) : (
        <span className="text-slate-300">—</span>
      )}
    </td>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50"
      onClick={() => onChange(!value)}
    >
      <span className="text-sm font-medium text-slate-900">{label}</span>
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-black"
        style={
          value
            ? { backgroundColor: '#D0F0E5', color: '#00684D' }
            : { backgroundColor: '#F1F5F9', color: '#64748B' }
        }
      >
        {value ? 'ON' : 'OFF'}
      </span>
    </div>
  );
}

function ReadonlyBadge({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-3 flex items-center justify-between">
      <span className="text-sm font-medium text-slate-900">{label}</span>
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-black"
        style={
          on
            ? { backgroundColor: '#D0F0E5', color: '#00684D' }
            : { backgroundColor: '#F1F5F9', color: '#64748B' }
        }
      >
        {on ? 'ON' : 'OFF'}
      </span>
    </div>
  );
}
