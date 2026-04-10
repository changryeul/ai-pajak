'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui';
import { User, Building2, Briefcase, ArrowRight, ArrowLeft } from 'lucide-react';

type AccountType = 'INDIVIDUAL' | 'COMPANY' | 'TAX_PARTNER';

const ACCOUNT_TYPES: Array<{
  id: AccountType;
  icon: typeof User;
  title: string;
  description: string;
  features: string[];
  gradient: string;
}> = [
  {
    id: 'INDIVIDUAL',
    icon: User,
    title: '개인 납세자',
    description: '내 세금 신고를 직접 관리합니다',
    features: ['SPT 1770/1770S/1770SS', '개인 PPh 관리', '프리랜서 소득'],
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'COMPANY',
    icon: Building2,
    title: '법인 고객',
    description: '회사 세무를 위탁 관리합니다',
    features: ['월 SPT Masa (PPh 21/23, PPN)', 'SPT Badan 1771', '급여 자동 계산'],
    gradient: 'from-emerald-500 to-green-600',
  },
  {
    id: 'TAX_PARTNER',
    icon: Briefcase,
    title: '세무 컨설팅 법인',
    description: '우리 세무법인의 고객을 관리합니다',
    features: ['다수 고객 포트폴리오', '직원·세무사 관리', 'e-Filing 대행'],
    gradient: 'from-purple-500 to-pink-600',
  },
];

export default function RegisterPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const [step, setStep] = useState<'select' | 'form'>('select');
  const [accountType, setAccountType] = useState<AccountType | null>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    // Company-specific
    companyName: '',
    npwp: '',
    // Tax partner-specific
    firmName: '',
    firmRegistrationNumber: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountType) return;
    setIsLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError(t('errors.passwordMismatch'));
      setIsLoading(false);
      return;
    }
    if (formData.password.length < 8) {
      setError(t('errors.passwordTooShort'));
      setIsLoading(false);
      return;
    }

    try {
      // Server-side signup with email_confirm=true (즉시 로그인 가능)
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          phone: formData.phone || undefined,
          accountType,
          firmName: formData.firmName || undefined,
          firmRegistrationNumber: formData.firmRegistrationNumber || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || t('errors.serverError'));
        return;
      }

      setSuccess(true);
    } catch {
      setError(t('errors.serverError'));
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <CardTitle className="text-xl text-green-600">{t('common.success')}</CardTitle>
            <CardDescription>{t('auth.registerSuccess')}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href={`/${locale}/login`} className="w-full">
              <Button variant="outline" className="w-full">{t('auth.login')}</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Step 1: Account type selection
  if (step === 'select') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 py-10">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4">
              <img src="/logo.png" alt="AI Pajak" className="h-10 mx-auto" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">AI Pajak에 오신 것을 환영합니다</h1>
            <p className="text-sm text-gray-500 mt-2">어떤 목적으로 이용하시나요? (1/2 단계)</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ACCOUNT_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => {
                    if (type.id === 'COMPANY') {
                      router.push(`/${locale}/register/company`);
                      return;
                    }
                    setAccountType(type.id);
                    setStep('form');
                  }}
                  className="text-left rounded-2xl border-2 border-gray-200 bg-white p-5 hover:border-blue-500 hover:shadow-lg transition-all group"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${type.gradient} flex items-center justify-center mb-3 shadow-sm`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">{type.title}</h3>
                  <p className="text-xs text-gray-500 mb-3">{type.description}</p>
                  <ul className="space-y-1">
                    {type.features.map((f, i) => (
                      <li key={i} className="text-[11px] text-gray-600 flex items-center gap-1">
                        <span className="text-green-500">•</span>{f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center text-xs font-medium text-blue-600 group-hover:text-blue-700">
                    선택하기 <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-center text-sm text-gray-600 mt-6">
            이미 계정이 있으신가요?{' '}
            <Link href={`/${locale}/login`} className="text-blue-600 hover:underline font-medium">
              {t('auth.login')}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // Step 2: Form
  const selectedType = ACCOUNT_TYPES.find(t => t.id === accountType)!;
  const SelectedIcon = selectedType.icon;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className={`mx-auto mb-3 h-12 w-12 rounded-xl bg-gradient-to-br ${selectedType.gradient} flex items-center justify-center`}>
            <SelectedIcon className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-xl">{selectedType.title} 가입</CardTitle>
          <CardDescription className="text-xs">{selectedType.description} (2/2 단계)</CardDescription>
          <button
            type="button"
            onClick={() => setStep('select')}
            className="text-xs text-blue-600 mt-2 inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />다른 유형으로 변경
          </button>
        </CardHeader>

        <form onSubmit={handleRegister}>
          <CardContent className="space-y-4">
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

            <Input
              label={accountType === 'TAX_PARTNER' ? '대표자 이름' : t('auth.fullName')}
              name="fullName" type="text" value={formData.fullName}
              onChange={handleChange} placeholder="Nama Lengkap" required
            />

            {accountType === 'COMPANY' && (
              <>
                <Input
                  label="회사명" name="companyName" type="text"
                  value={formData.companyName} onChange={handleChange}
                  placeholder="PT Contoh Sejahtera" required
                />
                <Input
                  label="NPWP (회사)" name="npwp" type="text"
                  value={formData.npwp} onChange={handleChange}
                  placeholder="00.000.000.0-000.000"
                />
              </>
            )}

            {accountType === 'TAX_PARTNER' && (
              <>
                <Input
                  label="세무법인명" name="firmName" type="text"
                  value={formData.firmName} onChange={handleChange}
                  placeholder="Kantor Konsultan Pajak ABC" required
                />
                <Input
                  label="사업자 등록번호" name="firmRegistrationNumber" type="text"
                  value={formData.firmRegistrationNumber} onChange={handleChange}
                  placeholder="SIUP / NIB"
                />
              </>
            )}

            <Input
              label={t('auth.email')} name="email" type="email"
              value={formData.email} onChange={handleChange}
              placeholder="email@example.com" required
            />

            <Input
              label={t('auth.phone')} name="phone" type="tel"
              value={formData.phone} onChange={handleChange}
              placeholder="+62 812 3456 7890"
            />

            <Input
              label={t('auth.password')} name="password" type="password"
              value={formData.password} onChange={handleChange}
              placeholder="••••••••" required
              helperText="최소 8자"
            />

            <Input
              label={t('auth.confirmPassword')} name="confirmPassword" type="password"
              value={formData.confirmPassword} onChange={handleChange}
              placeholder="••••••••" required
            />
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Loading...' : t('auth.register')}
            </Button>
            <p className="text-center text-sm text-gray-600">
              이미 계정이 있으신가요?{' '}
              <Link href={`/${locale}/login`} className="text-blue-600 hover:underline font-medium">
                {t('auth.login')}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
