'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ProfileCompletionBar } from '@/components/profile/ProfileCompletionBar';
import { AutoSaveIndicator } from '@/components/profile/AutoSaveIndicator';
import { useAutoSave } from '@/lib/profile/use-auto-save';
import {
  calculateCompletion,
  isNameValid,
  isIdValid,
  isEmailValid,
  isPhoneValid,
  type IdType,
} from '@/lib/profile/completion';

export interface CustomerProfileInitial {
  full_name?: string | null;
  npwp?: string | null;
  nik?: string | null;
  email?: string | null;
  phone?: string | null;
  coretax_id?: string | null;
  djp_password_hint?: string | null;
  efin?: string | null;
}

interface Props {
  initial: CustomerProfileInitial;
}

type Field = 'name' | 'id' | 'email' | 'phone' | 'taxCredentials';

export function CustomerProfileCard({ initial }: Props) {
  const t = useTranslations();

  const [idType, setIdType] = useState<IdType>(initial.npwp ? 'npwp' : 'nik');
  const [name, setName] = useState(initial.full_name ?? '');
  const [npwp, setNpwp] = useState(initial.npwp ?? '');
  const [nik, setNik] = useState(initial.nik ?? '');
  const [email, setEmail] = useState(initial.email ?? '');
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [coretaxId, setCoretaxId] = useState(initial.coretax_id ?? '');
  const [djpPassword, setDjpPassword] = useState(initial.djp_password_hint ?? '');
  const [efin, setEfin] = useState(initial.efin ?? '');

  const completion = calculateCompletion({
    name,
    idType,
    npwp,
    nik,
    email,
    phone,
    coretaxId,
    djpPassword,
    efin,
  });

  const nameRef = useRef<HTMLInputElement>(null);
  const idRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const credRef = useRef<HTMLInputElement>(null);

  const fieldRefs: Record<Field, React.RefObject<HTMLInputElement | null>> = {
    name: nameRef,
    id: idRef,
    email: emailRef,
    phone: phoneRef,
    taxCredentials: credRef,
  };

  const scrollToFirstMissing = useCallback(() => {
    if (!completion.firstMissing) return;
    fieldRefs[completion.firstMissing].current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    fieldRefs[completion.firstMissing].current?.focus();
  }, [completion.firstMissing, fieldRefs]);

  const payload = {
    full_name: name || null,
    email: email || null,
    phone: phone || null,
    npwp: idType === 'npwp' && npwp ? npwp : null,
    nik: idType === 'nik' && nik ? nik : null,
    coretax_id: coretaxId || null,
    djp_password_hint: djpPassword || null,
    efin: efin || null,
  };

  const save = useCallback(async (data: typeof payload) => {
    const res = await fetch('/api/customer/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('save failed');
  }, []);

  const { status, retry } = useAutoSave(payload, { save });

  // Keep idType switchable without losing the other value.
  useEffect(() => {
    if (idType === 'npwp' && nik) setNik('');
    if (idType === 'nik' && npwp) setNpwp('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idType]);

  return (
    <div className="space-y-6">
      {/* Header with completion bar + autosave indicator */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>{t('profile.title')}</CardTitle>
            <AutoSaveIndicator status={status} onRetry={retry} />
          </div>
        </CardHeader>
        <CardContent>
          <ProfileCompletionBar
            score={completion.score}
            label={t('profile.completionLabel')}
            hint={completion.score < 100 ? t('profile.completionHint') : undefined}
          />
          {completion.score < 100 && (
            <button
              type="button"
              onClick={scrollToFirstMissing}
              className="mt-3 text-xs text-blue-600 hover:underline"
            >
              {t('profile.jumpToFirstMissing')}
            </button>
          )}
        </CardContent>
      </Card>

      {/* Basic info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.basicInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t('profile.fullName')}</Label>
            <div className="relative mt-1">
              <Input
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={cn(
                  'pr-8',
                  !isNameValid(name) && 'border-red-400',
                  isNameValid(name) && 'border-green-500',
                )}
                placeholder={t('profile.fullName')}
              />
              {isNameValid(name) && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600">✔</span>
              )}
            </div>
          </div>

          <div>
            <Label>{t('profile.identifier')}</Label>
            <div className="flex gap-2 mt-1">
              <select
                className="p-2 border rounded text-sm"
                value={idType}
                onChange={(e) => setIdType(e.target.value as IdType)}
              >
                <option value="npwp">NPWP</option>
                <option value="nik">NIK</option>
              </select>
              <div className="relative flex-1">
                <Input
                  ref={idRef}
                  value={idType === 'npwp' ? npwp : nik}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    if (idType === 'npwp') setNpwp(digits.slice(0, 15));
                    else setNik(digits.slice(0, 16));
                  }}
                  inputMode="numeric"
                  maxLength={idType === 'npwp' ? 15 : 16}
                  placeholder={idType === 'npwp' ? '15 digit' : '16 digit'}
                  className={cn(
                    'pr-8',
                    !isIdValid(idType, npwp, nik) && 'border-red-400',
                    isIdValid(idType, npwp, nik) && 'border-green-500',
                  )}
                />
                {isIdValid(idType, npwp, nik) && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600">✔</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>{t('profile.email')}</Label>
              <div className="relative mt-1">
                <Input
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(
                    'pr-8',
                    !isEmailValid(email) && 'border-red-400',
                    isEmailValid(email) && 'border-green-500',
                  )}
                />
                {isEmailValid(email) && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600">✔</span>
                )}
              </div>
            </div>
            <div>
              <Label>{t('profile.phone')}</Label>
              <div className="relative mt-1">
                <Input
                  ref={phoneRef}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={cn(
                    'pr-8',
                    !isPhoneValid(phone) && 'border-red-400',
                    isPhoneValid(phone) && 'border-green-500',
                  )}
                />
                {isPhoneValid(phone) && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600">✔</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tax credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.taxCredentials')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Coretax ID</Label>
            <Input
              ref={credRef}
              value={coretaxId}
              onChange={(e) => setCoretaxId(e.target.value)}
              className="mt-1"
              placeholder="Coretax user id"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>DJP password hint</Label>
              <Input
                type="password"
                value={djpPassword}
                onChange={(e) => setDjpPassword(e.target.value)}
                className="mt-1"
                autoComplete="off"
              />
            </div>
            <div>
              <Label>EFIN</Label>
              <Input
                value={efin}
                onChange={(e) => setEfin(e.target.value)}
                className="mt-1"
                placeholder="EFIN"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">{t('profile.credentialsNote')}</p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" onClick={retry} disabled={status === 'saving'}>
          {t('profile.forceSave')}
        </Button>
      </div>
    </div>
  );
}
