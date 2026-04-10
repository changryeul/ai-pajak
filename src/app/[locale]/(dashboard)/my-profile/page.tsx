'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession, hasRole } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  User, Save, Loader2, CheckCircle, AlertTriangle, Mail, Phone,
  MapPin, FileText, IdCard, Trash2,
} from 'lucide-react';

interface PersonalProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  npwp: string | null;
  nik: string | null;
  customer_type: 'INDIVIDUAL' | 'COMPANY';
  created_at: string;
}

export default function MyProfilePage() {
  const { session, isLoading: sessionLoading } = useSession();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [profile, setProfile] = useState<PersonalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    npwp: '',
    nik: '',
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Role guard: only INDIVIDUAL customers should access this page.
  // Corporate customers and consultants have /company-profile instead.
  useEffect(() => {
    if (sessionLoading || !session) return;
    const isCustomer = hasRole(session, UserRole.CUSTOMER);
    if (!isCustomer || session.customerType !== 'INDIVIDUAL') {
      router.replace(`/${locale}/dashboard`);
    }
  }, [session, sessionLoading, router, locale]);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const loadProfile = useCallback(async () => {
    if (!session?.customerId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${session.customerId}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.data) {
        const p = data.data as PersonalProfile;
        setProfile(p);
        setForm({
          full_name: p.full_name || '',
          email: p.email || '',
          phone: p.phone || '',
          address: p.address || '',
          npwp: p.npwp || '',
          nik: p.nik || '',
        });
      } else {
        showMsg('error', data.error || '프로필을 불러올 수 없습니다');
      }
    } catch {
      showMsg('error', '서버 오류');
    } finally {
      setLoading(false);
    }
  }, [session?.customerId]);

  useEffect(() => {
    if (session?.customerId) loadProfile();
  }, [session?.customerId, loadProfile]);

  const handleSave = async () => {
    if (!profile) return;
    if (!form.full_name.trim()) {
      showMsg('error', '이름은 필수입니다');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          phone: form.phone || null,
          address: form.address || null,
          npwp: form.npwp || null,
          nik: form.nik || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', '프로필이 저장되었습니다');
        setEditing(false);
        loadProfile();
      } else {
        showMsg('error', data.error || '저장 실패');
      }
    } catch {
      showMsg('error', '서버 오류');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteField = (field: 'phone' | 'address' | 'npwp' | 'nik') => {
    if (!confirm(`${field === 'phone' ? '전화번호' : field === 'address' ? '주소' : field === 'npwp' ? 'NPWP' : 'NIK'}를 삭제하시겠습니까?`)) return;
    setForm({ ...form, [field]: '' });
    if (!editing) setEditing(true);
  };

  if (loading || sessionLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto py-16 px-4 max-w-md text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <p className="text-sm text-gray-500">프로필을 불러올 수 없습니다</p>
      </div>
    );
  }

  // Profile completeness calculation
  const filledCount = [
    profile.full_name, profile.email, profile.phone,
    profile.address, profile.npwp, profile.nik,
  ].filter(Boolean).length;
  const totalFields = 6;
  const completeness = Math.round((filledCount / totalFields) * 100);

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="h-6 w-6 text-blue-600" />
          내 정보
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          가입 시 입력하신 개인 정보를 관리합니다. 필요한 항목을 추가하거나 삭제할 수 있습니다.
        </p>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Completeness summary */}
      <Card className="mb-4 border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-900 font-medium">프로필 완성도</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">{completeness}%</p>
              <p className="text-[11px] text-blue-700 mt-0.5">
                {filledCount}/{totalFields} 항목 입력됨
              </p>
            </div>
            <div className="text-right">
              <Badge className="bg-blue-600 text-white">
                {profile.customer_type === 'INDIVIDUAL' ? '개인' : '법인'}
              </Badge>
              <p className="text-[10px] text-blue-600 mt-1">
                가입일: {new Date(profile.created_at).toLocaleDateString('ko-KR')}
              </p>
            </div>
          </div>
          <div className="h-2 bg-white rounded-full overflow-hidden mt-3">
            <div
              className="h-full bg-blue-600 transition-all duration-500"
              style={{ width: `${completeness}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Profile form */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5 space-y-4">
          {/* Full name */}
          <div>
            <Label className="text-xs flex items-center gap-1">
              <User className="h-3 w-3" />
              이름 <span className="text-red-500">*</span>
            </Label>
            <Input
              value={form.full_name}
              onChange={e => { setForm({ ...form, full_name: e.target.value }); setEditing(true); }}
              placeholder="홍길동"
              className="text-sm"
            />
          </div>

          {/* Email */}
          <div>
            <Label className="text-xs flex items-center gap-1">
              <Mail className="h-3 w-3" />
              이메일
            </Label>
            <Input
              type="email"
              value={form.email}
              onChange={e => { setForm({ ...form, email: e.target.value }); setEditing(true); }}
              placeholder="example@domain.com"
              className="text-sm"
            />
          </div>

          {/* NPWP */}
          <div>
            <Label className="text-xs flex items-center gap-1">
              <FileText className="h-3 w-3" />
              NPWP (세금 번호)
            </Label>
            <div className="flex gap-2">
              <Input
                value={form.npwp}
                onChange={e => { setForm({ ...form, npwp: e.target.value }); setEditing(true); }}
                placeholder="XX.XXX.XXX.X-XXX.XXX"
                className="text-sm font-mono tracking-wider flex-1"
              />
              {form.npwp && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteField('npwp')}
                  className="text-red-500 hover:bg-red-50 flex-shrink-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
            <p className="text-[10px] text-gray-500 mt-1">SPT 신고에 필요합니다. 미발급 시 비워두셔도 됩니다.</p>
          </div>

          {/* NIK */}
          <div>
            <Label className="text-xs flex items-center gap-1">
              <IdCard className="h-3 w-3" />
              NIK (주민증 번호, 16자리)
            </Label>
            <div className="flex gap-2">
              <Input
                value={form.nik}
                onChange={e => { setForm({ ...form, nik: e.target.value }); setEditing(true); }}
                placeholder="16자리 숫자"
                maxLength={16}
                className="text-sm font-mono tracking-wider flex-1"
              />
              {form.nik && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteField('nik')}
                  className="text-red-500 hover:bg-red-50 flex-shrink-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Phone */}
          <div>
            <Label className="text-xs flex items-center gap-1">
              <Phone className="h-3 w-3" />
              전화번호
            </Label>
            <div className="flex gap-2">
              <Input
                type="tel"
                value={form.phone}
                onChange={e => { setForm({ ...form, phone: e.target.value }); setEditing(true); }}
                placeholder="08xx-xxxx-xxxx"
                className="text-sm flex-1"
              />
              {form.phone && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteField('phone')}
                  className="text-red-500 hover:bg-red-50 flex-shrink-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Address */}
          <div>
            <Label className="text-xs flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              주소
            </Label>
            <div className="flex gap-2">
              <Input
                value={form.address}
                onChange={e => { setForm({ ...form, address: e.target.value }); setEditing(true); }}
                placeholder="Jl. Sudirman No. 1, Jakarta"
                className="text-sm flex-1"
              />
              {form.address && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteField('address')}
                  className="text-red-500 hover:bg-red-50 flex-shrink-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              onClick={handleSave}
              disabled={saving || !editing}
              className="flex-1"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              저장
            </Button>
            {editing && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setForm({
                    full_name: profile.full_name || '',
                    email: profile.email || '',
                    phone: profile.phone || '',
                    address: profile.address || '',
                    npwp: profile.npwp || '',
                    nik: profile.nik || '',
                  });
                  setEditing(false);
                }}
              >
                취소
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-[11px] text-gray-400 text-center mt-4">
        * NPWP와 NIK는 세금 신고 시 자동으로 반영됩니다. 필요한 시점에 언제든지 입력/수정/삭제할 수 있습니다.
      </p>
    </div>
  );
}
