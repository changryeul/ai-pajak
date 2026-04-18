'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AutoSaveIndicator } from '@/components/profile/AutoSaveIndicator';
import { useAutoSave } from '@/lib/profile/use-auto-save';
import { buildPTKPStatus } from '@/lib/tax/shared/tax-utils';
import { PTKP_RATES } from '@/lib/tax/shared/constants';
import type { PTKPStatus } from '@/lib/tax/shared/types';
import { deriveFromPtkp, type MaritalState, type FilingMode } from '@/lib/profile/spouse';

interface ProfileData {
  ptkp_status: PTKPStatus | null;
  spouse_name: string | null;
  spouse_npwp: string | null;
  spouse_annual_income: number | null;
  spouse_withheld_tax: number | null;
}

function formatRupiah(amount: number): string {
  return 'Rp ' + amount.toLocaleString('id-ID');
}

export function SpouseAndDependentsCard() {
  const t = useTranslations();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [marital, setMarital] = useState<MaritalState>('single');
  const [filing, setFiling] = useState<FilingMode>('separate');
  const [dependents, setDependents] = useState(0);
  const [spouseName, setSpouseName] = useState('');
  const [spouseNpwp, setSpouseNpwp] = useState('');
  const [spouseIncome, setSpouseIncome] = useState('');
  const [spouseWithheld, setSpouseWithheld] = useState('');

  // Seed from server
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/customer/profile', { credentials: 'include' });
        if (!res.ok) throw new Error('load_failed');
        const json = await res.json();
        const c: ProfileData = json?.data?.customer ?? {};
        if (!alive) return;
        const derived = deriveFromPtkp(c.ptkp_status);
        setMarital(derived.marital);
        setFiling(derived.filing);
        setDependents(derived.dependents);
        setSpouseName(c.spouse_name ?? '');
        setSpouseNpwp(c.spouse_npwp ?? '');
        setSpouseIncome(c.spouse_annual_income != null ? String(c.spouse_annual_income) : '');
        setSpouseWithheld(c.spouse_withheld_tax != null ? String(c.spouse_withheld_tax) : '');
      } catch {
        if (alive) setError(t('errors.serverError'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [t]);

  // Live PTKP derivation
  const ptkpStatus = useMemo<PTKPStatus>(
    () => buildPTKPStatus({
      isMarried: marital === 'married',
      spouseIncomeJoint: marital === 'married' && filing === 'joint',
      dependents,
    }),
    [marital, filing, dependents],
  );
  const ptkpAmount = PTKP_RATES[ptkpStatus];

  // Auto-save payload; server schema expects numbers for spouse_annual_income/withheld.
  const payload = useMemo(() => {
    const toNum = (s: string) => (s.trim() === '' ? null : Number(s));
    const isJoint = marital === 'married' && filing === 'joint';
    return {
      ptkp_status: ptkpStatus,
      spouse_name: isJoint ? (spouseName || null) : null,
      spouse_npwp: isJoint ? (spouseNpwp || null) : null,
      spouse_annual_income: isJoint ? toNum(spouseIncome) : null,
      spouse_withheld_tax: isJoint ? toNum(spouseWithheld) : null,
    };
  }, [marital, filing, ptkpStatus, spouseName, spouseNpwp, spouseIncome, spouseWithheld]);

  const save = useCallback(async (data: typeof payload) => {
    const res = await fetch('/api/customer/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('save_failed');
  }, []);

  // Gate autosave on seed completion — prevents the default TK/0 from
  // overwriting a persisted K/I/2 during the brief window between mount and
  // the GET completing on reload.
  const { status: saveStatus, retry } = useAutoSave(payload, {
    save,
    skipFirst: true,
    enabled: !loading,
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-red-600">{error}</CardContent>
      </Card>
    );
  }

  const showSpouseInputs = marital === 'married' && filing === 'joint';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-blue-600" />
            {t('spouse.title')}
          </CardTitle>
          <AutoSaveIndicator status={saveStatus} onRetry={retry} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Marital status */}
        <fieldset>
          <legend className="text-sm font-medium mb-2">{t('spouse.maritalStatus')}</legend>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="marital"
                value="single"
                checked={marital === 'single'}
                onChange={() => setMarital('single')}
              />
              {t('spouse.single')}
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="marital"
                value="married"
                checked={marital === 'married'}
                onChange={() => setMarital('married')}
              />
              {t('spouse.married')}
            </label>
          </div>
        </fieldset>

        {/* Filing mode (only if married) */}
        {marital === 'married' && (
          <fieldset>
            <legend className="text-sm font-medium mb-2">{t('spouse.filingMode')}</legend>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="filing"
                  value="separate"
                  checked={filing === 'separate'}
                  onChange={() => setFiling('separate')}
                />
                <span>
                  {t('spouse.separateFiling')}
                  <span className="ml-1 text-xs text-gray-500">({t('spouse.separateHint')})</span>
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="filing"
                  value="joint"
                  checked={filing === 'joint'}
                  onChange={() => setFiling('joint')}
                />
                <span>
                  {t('spouse.jointFiling')}
                  <span className="ml-1 text-xs text-gray-500">({t('spouse.jointHint')})</span>
                </span>
              </label>
            </div>
          </fieldset>
        )}

        {/* Spouse details (only when joint) */}
        {showSpouseInputs && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div>
              <Label className="text-xs">{t('spouse.spouseName')}</Label>
              <Input
                className="mt-1"
                value={spouseName}
                onChange={(e) => setSpouseName(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">{t('spouse.spouseNpwp')}</Label>
              <Input
                className="mt-1"
                value={spouseNpwp}
                onChange={(e) => setSpouseNpwp(e.target.value.replace(/\D/g, '').slice(0, 15))}
                placeholder="15 digits"
              />
            </div>
            <div>
              <Label className="text-xs">{t('spouse.spouseIncome')}</Label>
              <Input
                className="mt-1"
                type="number"
                inputMode="numeric"
                value={spouseIncome}
                onChange={(e) => setSpouseIncome(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs">{t('spouse.spouseWithheld')}</Label>
              <Input
                className="mt-1"
                type="number"
                inputMode="numeric"
                value={spouseWithheld}
                onChange={(e) => setSpouseWithheld(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        )}

        {/* Dependents */}
        <div>
          <Label className="text-sm font-medium">{t('spouse.dependents')}</Label>
          <p className="text-xs text-gray-500 mb-2">{t('spouse.dependentsHint')}</p>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDependents(n)}
                className={cn(
                  'w-12 h-10 rounded border text-sm font-medium transition-colors',
                  dependents === n
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Live PTKP preview */}
        <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-green-50 p-4 border border-emerald-200">
          <div className="text-xs text-emerald-700 font-medium">{t('spouse.ptkpStatus')}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-900">{ptkpStatus}</span>
            <span className="text-sm text-emerald-700">· {formatRupiah(ptkpAmount)}</span>
          </div>
          <div className="mt-1 text-xs text-emerald-600">{t('spouse.ptkpExplain')}</div>
        </div>
      </CardContent>
    </Card>
  );
}
