'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Trash2, Wallet, Star } from 'lucide-react';

type BankAccount = {
  id: string;
  bank_name: string;
  label: string | null;
  account_last4: string;
  currency: string;
  is_foreign: boolean;
  country: string | null;
  is_primary: boolean;
};

type DraftAccount = {
  bank_name: string;
  label: string;
  account_last4: string;
  currency: string;
  is_foreign: boolean;
  country: string;
  is_primary: boolean;
};

const EMPTY_DRAFT: DraftAccount = {
  bank_name: '',
  label: '',
  account_last4: '',
  currency: 'IDR',
  is_foreign: false,
  country: '',
  is_primary: false,
};

const COUNTRIES = ['ID', 'KR', 'US', 'JP'] as const;

/**
 * Minimal bank-account index for INDIVIDUAL customers.
 * We store only last4 of the account number, never the full string.
 * Used by KYC checks, anomaly-detection cross-references, and foreign-asset
 * reporting sanity checks.
 */
export function BankAccountsCard() {
  const t = useTranslations();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<DraftAccount>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/customer/bank-accounts', { credentials: 'include' });
      if (!res.ok) throw new Error('fetch_failed');
      const j = (await res.json()) as { data?: { accounts?: BankAccount[] } };
      setAccounts(j.data?.accounts ?? []);
    } catch {
      setError(t('errors.serverError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  async function submitDraft() {
    if (!draft.bank_name.trim() || !/^[0-9]{4}$/.test(draft.account_last4)) return;
    setSubmitting(true);
    try {
      const body = {
        bank_name: draft.bank_name.trim(),
        label: draft.label.trim() || null,
        account_last4: draft.account_last4,
        currency: draft.currency.toUpperCase(),
        is_foreign: draft.is_foreign,
        country: draft.is_foreign && draft.country ? draft.country : null,
        is_primary: draft.is_primary,
      };
      const res = await fetch('/api/customer/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setDraft(EMPTY_DRAFT);
      setAdding(false);
      await load();
    } catch {
      setError(t('errors.serverError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    setSubmitting(true);
    try {
      await fetch('/api/customer/bank-accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id }),
      });
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-blue-600" />
            {t('bankAccounts.title')}
          </CardTitle>
          {!adding && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="h-3 w-3 mr-1" />
              {t('bankAccounts.add')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-xs text-red-600">{error}</p>}

        {accounts.length === 0 && !adding && (
          <p className="text-sm text-gray-500">{t('bankAccounts.empty')}</p>
        )}

        {accounts.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between p-3 rounded-lg border bg-white"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="text-sm">
                <div className="flex items-center gap-1.5 font-medium">
                  {a.is_primary && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                  <span className="truncate">{a.bank_name}</span>
                  {a.label && <span className="text-xs text-gray-500">· {a.label}</span>}
                </div>
                <div className="text-xs text-gray-500 font-mono">
                  •••• {a.account_last4} · {a.currency}
                  {a.is_foreign && a.country && (
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
                      {t(`bankAccounts.country.${a.country}`)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              className="text-gray-400 hover:text-red-600 disabled:opacity-50"
              onClick={() => void remove(a.id)}
              disabled={submitting}
              title={t('common.delete')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        {adding && (
          <div className="rounded-lg border border-dashed p-3 space-y-2 bg-gray-50">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">
                <div className="text-gray-500 mb-0.5">{t('bankAccounts.bankName')}</div>
                <input
                  className="w-full p-1.5 border rounded text-sm"
                  value={draft.bank_name}
                  onChange={(e) => setDraft({ ...draft, bank_name: e.target.value })}
                  placeholder="BCA, Mandiri, OCBC..."
                />
              </label>
              <label className="text-xs">
                <div className="text-gray-500 mb-0.5">{t('bankAccounts.label')}</div>
                <input
                  className="w-full p-1.5 border rounded text-sm"
                  value={draft.label}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  placeholder={t('bankAccounts.labelPlaceholder')}
                />
              </label>
              <label className="text-xs">
                <div className="text-gray-500 mb-0.5">{t('bankAccounts.last4')}</div>
                <input
                  className="w-full p-1.5 border rounded text-sm font-mono"
                  value={draft.account_last4}
                  onChange={(e) =>
                    setDraft({ ...draft, account_last4: e.target.value.replace(/\D/g, '').slice(0, 4) })
                  }
                  placeholder="1234"
                  maxLength={4}
                />
              </label>
              <label className="text-xs">
                <div className="text-gray-500 mb-0.5">{t('bankAccounts.currency')}</div>
                <input
                  className="w-full p-1.5 border rounded text-sm font-mono"
                  value={draft.currency}
                  onChange={(e) =>
                    setDraft({ ...draft, currency: e.target.value.toUpperCase().slice(0, 3) })
                  }
                  maxLength={3}
                />
              </label>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={draft.is_foreign}
                  onChange={(e) => setDraft({ ...draft, is_foreign: e.target.checked })}
                />
                {t('bankAccounts.isForeign')}
              </label>
              {draft.is_foreign && (
                <select
                  className="p-1 border rounded text-xs"
                  value={draft.country}
                  onChange={(e) => setDraft({ ...draft, country: e.target.value })}
                >
                  <option value="">{t('bankAccounts.pickCountry')}</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`bankAccounts.country.${c}`)}
                    </option>
                  ))}
                </select>
              )}
              <label className="flex items-center gap-1.5 ml-auto">
                <input
                  type="checkbox"
                  checked={draft.is_primary}
                  onChange={(e) => setDraft({ ...draft, is_primary: e.target.checked })}
                />
                {t('bankAccounts.isPrimary')}
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAdding(false);
                  setDraft(EMPTY_DRAFT);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                disabled={submitting || !draft.bank_name.trim() || !/^[0-9]{4}$/.test(draft.account_last4)}
                onClick={() => void submitDraft()}
              >
                {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : t('common.save')}
              </Button>
            </div>
          </div>
        )}

        <p className="text-[11px] text-gray-400 leading-relaxed pt-1">
          {t('bankAccounts.disclaimer')}
        </p>
      </CardContent>
    </Card>
  );
}
