'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Button, Input } from '@/components/ui';
import { CheckCircle, Loader2, AlertTriangle, Shield } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  TAX_OPERATOR: '백오피스 상담원',
  TAX_OPERATOR_SUPERVISOR: '백오피스 수퍼바이저',
  TAX_ADVISOR_JTC: '세무사 (Tax Advisor)',
  CONSULTANT_JTC: '컨설턴트',
};

function AcceptInvitationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<{ email: string; role: string; team: string | null; fullName: string | null } | null>(null);
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('초대 토큰이 없습니다');
      setLoading(false);
      return;
    }
    fetch(`/api/auth/accept-invitation?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setInvitation(data.data);
          setFullName(data.data.fullName || '');
        } else {
          setError(data.error || '유효하지 않은 초대');
        }
      })
      .catch(() => setError('초대 확인 실패'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }
    if (password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, fullName }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || '가입 실패');
      }
    } catch {
      setError('서버 오류');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-lg text-red-700">초대를 사용할 수 없습니다</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 text-center">{error}</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push(`/${locale}/login`)} variant="outline" className="w-full">
              로그인 페이지로
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-lg text-green-700">가입이 완료되었습니다</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 text-center">
              AI Pajak 팀의 일원이 되신 것을 환영합니다.
              <br />로그인 후 업무를 시작하세요.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push(`/${locale}/login`)} className="w-full">
              로그인하기
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-xl">AI Pajak 팀 초대</CardTitle>
          <div className="mt-3 text-xs bg-blue-50 rounded-lg p-3 text-left">
            <p className="text-gray-600">초대받은 이메일</p>
            <p className="font-medium text-gray-900">{invitation?.email}</p>
            <p className="text-gray-600 mt-2">역할</p>
            <p className="font-medium text-blue-700">{ROLE_LABELS[invitation?.role || ''] || invitation?.role}</p>
            {invitation?.team && (
              <>
                <p className="text-gray-600 mt-2">팀</p>
                <p className="font-medium text-gray-900">{invitation.team}</p>
              </>
            )}
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-3">
            {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-600">{error}</div>}
            <div>
              <label className="text-xs font-medium text-gray-700">이름</label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="본인 이름" required />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">비밀번호</label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="최소 8자" required />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700">비밀번호 확인</label>
              <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="다시 입력" required />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              초대 수락 및 가입
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <AcceptInvitationContent />
    </Suspense>
  );
}
