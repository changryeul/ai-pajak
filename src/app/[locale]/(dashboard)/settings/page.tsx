'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User,
  Shield,
  Bell,
  Globe,
  Save,
  Loader2,
  Check,
  AlertCircle,
  Link2,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

type SettingsTab = 'profile' | 'security' | 'notifications' | 'language' | 'integrations';

interface NotificationPreferences {
  email_enabled: boolean;
  deadline_reminders: boolean;
  payment_reminders: boolean;
  marketing_emails: boolean;
}

export default function SettingsPage() {
  const t = useTranslations();
  const ts = useTranslations('settings');
  const ti = useTranslations('settingsIntegrations');
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Login history state
  const [loginHistory, setLoginHistory] = useState<Array<{
    id: string;
    action: string;
    ipAddress: string | null;
    device: string;
    timestamp: string;
  }>>([]);

  // 2FA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaSetup, setMfaSetup] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  // Profile state
  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    phone: '',
    npwp: '',
    nik: '',
  });

  // Password state
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Notification state
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    email_enabled: true,
    deadline_reminders: true,
    payment_reminders: true,
    marketing_emails: false,
  });
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);

  const tabs = [
    { id: 'profile' as SettingsTab, label: t('settings.profile') || 'Profile', icon: User },
    { id: 'security' as SettingsTab, label: t('settings.security') || 'Security', icon: Shield },
    { id: 'notifications' as SettingsTab, label: t('settings.notifications') || 'Notifications', icon: Bell },
    { id: 'language' as SettingsTab, label: t('settings.language') || 'Language', icon: Globe },
    { id: 'integrations' as SettingsTab, label: ti('integrations'), icon: Link2 },
  ];

  const languages = [
    { value: 'en', label: 'English' },
    { value: 'id', label: 'Bahasa Indonesia' },
    { value: 'ko', label: '한국어' },
    { value: 'ja', label: '日本語' },
    { value: 'zh', label: '中文' },
  ];

  // Load user profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        if (data.success && data.user) {
          setProfile({
            fullName: data.user.fullName || '',
            email: data.user.email || '',
            phone: data.user.phone || '',
            npwp: data.user.npwp || '',
            nik: data.user.nik || '',
          });
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
      }
    };
    loadProfile();
  }, []);

  // Load notification preferences
  const loadNotifications = useCallback(async () => {
    if (notificationsLoaded) return;
    try {
      const response = await fetch('/api/settings/notifications');
      const data = await response.json();
      if (data.success && data.data) {
        setNotifications({
          email_enabled: data.data.email_enabled ?? true,
          deadline_reminders: data.data.deadline_reminders ?? true,
          payment_reminders: data.data.payment_reminders ?? true,
          marketing_emails: data.data.marketing_emails ?? false,
        });
        setNotificationsLoaded(true);
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    }
  }, [notificationsLoaded]);

  useEffect(() => {
    if (activeTab === 'notifications') {
      loadNotifications();
    }
  }, [activeTab, loadNotifications]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: profile.fullName,
          phone: profile.phone,
          nik: profile.nik,
        }),
      });

      const data = await response.json();

      if (data.success) {
        showMessage('success', t('settings.profileSaved') || 'Profile saved successfully');
      } else {
        showMessage('error', data.error || 'Failed to save profile');
      }
    } catch {
      showMessage('error', 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    // Validation
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      showMessage('error', t('settings.allFieldsRequired') || 'All password fields are required');
      return;
    }

    if (passwords.new !== passwords.confirm) {
      showMessage('error', t('errors.passwordMismatch') || 'Passwords do not match');
      return;
    }

    if (passwords.new.length < 8) {
      showMessage('error', t('errors.passwordTooShort') || 'Password must be at least 8 characters');
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetch('/api/settings/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwords.current,
          newPassword: passwords.new,
          confirmPassword: passwords.confirm,
        }),
      });

      const data = await response.json();

      if (data.success) {
        showMessage('success', t('settings.passwordChanged') || 'Password changed successfully');
        setPasswords({ current: '', new: '', confirm: '' });
      } else {
        showMessage('error', data.error || 'Failed to change password');
      }
    } catch {
      showMessage('error', 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // 2FA functions
  const fetchMfaStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/mfa', { credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        setMfaEnabled(json.data.enabled);
        setMfaFactorId(json.data.factorId);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchLoginHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/sessions', { credentials: 'include' });
      const json = await res.json();
      if (json.success) setLoginHistory(json.data.loginHistory || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchMfaStatus(); fetchLoginHistory(); }, [fetchMfaStatus, fetchLoginHistory]);

  const handleEnroll2FA = async () => {
    setMfaLoading(true);
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enroll' }),
      });
      const json = await res.json();
      if (json.success) {
        setMfaSetup({ factorId: json.data.factorId, qrCode: json.data.qrCode, secret: json.data.secret });
      } else {
        showMessage('error', json.error);
      }
    } catch { showMessage('error', ts('failedToSetup2FA')); }
    finally { setMfaLoading(false); }
  };

  const handleVerify2FA = async () => {
    if (!mfaSetup || !mfaCode) return;
    setMfaLoading(true);
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', factorId: mfaSetup.factorId, code: mfaCode }),
      });
      const json = await res.json();
      if (json.success) {
        showMessage('success', ts('twoFactorEnabledSuccess'));
        setMfaSetup(null);
        setMfaCode('');
        fetchMfaStatus();
      } else {
        showMessage('error', json.error || ts('invalidCode'));
      }
    } catch { showMessage('error', ts('verificationFailed')); }
    finally { setMfaLoading(false); }
  };

  const handleDisable2FA = async () => {
    if (!mfaFactorId) return;
    setMfaLoading(true);
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unenroll', factorId: mfaFactorId }),
      });
      const json = await res.json();
      if (json.success) {
        showMessage('success', ts('twoFactorDisabled'));
        fetchMfaStatus();
      } else {
        showMessage('error', json.error);
      }
    } catch { showMessage('error', ts('failedToDisable2FA')); }
    finally { setMfaLoading(false); }
  };

  const handleSaveNotifications = async () => {
    setIsSavingNotifications(true);
    try {
      const response = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifications),
      });

      const data = await response.json();

      if (data.success) {
        showMessage('success', t('settings.notificationsSaved') || 'Notification preferences saved');
      } else {
        showMessage('error', data.error || 'Failed to save preferences');
      }
    } catch {
      showMessage('error', 'Failed to save preferences');
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const handleLanguageChange = (newLocale: string) => {
    const currentPath = window.location.pathname;
    const newPath = currentPath.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Message Toast */}
      {message && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <Check className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          {t('settings.title') || 'Settings'}
        </h1>
        <p className="text-gray-500 mt-1">
          {t('settings.description') || 'Manage your account settings and preferences'}
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Tabs */}
        <div className="w-64 flex-shrink-0">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-2">
              <nav className="space-y-0.5">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-all duration-200 ${
                        activeTab === tab.id
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  {t('settings.profile') || 'Profile'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">{t('auth.fullName') || 'Full Name'}</Label>
                    <Input
                      id="fullName"
                      value={profile.fullName}
                      onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('auth.email') || 'Email'}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t('auth.phone') || 'Phone'}</Label>
                    <Input
                      id="phone"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="npwp">{t('auth.npwp') || 'NPWP'}</Label>
                    <Input
                      id="npwp"
                      value={profile.npwp}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nik">{t('auth.nik') || 'NIK'}</Label>
                    <Input
                      id="nik"
                      value={profile.nik}
                      onChange={(e) => setProfile({ ...profile, nik: e.target.value })}
                      placeholder="16-digit NIK"
                      maxLength={16}
                    />
                    <p className="text-xs text-gray-500">
                      {t('auth.nikDescription') || 'Nomor Induk Kependudukan (16 digits)'}
                    </p>
                  </div>
                </div>
                <div className="pt-4">
                  <Button onClick={handleSaveProfile} disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {t('common.save') || 'Save'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-600" />
                  {t('settings.security') || 'Security'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-medium">{t('settings.changePassword') || 'Change Password'}</h3>
                  <div className="space-y-3 max-w-md">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">{t('settings.currentPassword') || 'Current Password'}</Label>
                      <Input
                        id="currentPassword"
                        type="password"
                        value={passwords.current}
                        onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">{t('settings.newPassword') || 'New Password'}</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={passwords.new}
                        onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">{t('auth.confirmPassword') || 'Confirm Password'}</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={passwords.confirm}
                        onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                      />
                    </div>
                  </div>
                  <Button onClick={handleChangePassword} disabled={isChangingPassword}>
                    {isChangingPassword ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Shield className="h-4 w-4 mr-2" />
                    )}
                    {t('settings.changePassword') || 'Change Password'}
                  </Button>
                </div>

                <hr />

                <div className="space-y-4">
                  <h3 className="font-medium">{t('settings.twoFactorAuth') || 'Two-Factor Authentication'}</h3>
                  <p className="text-sm text-gray-500">
                    {t('settings.twoFactorDescription') || 'Add an extra layer of security to your account'}
                  </p>

                  {mfaEnabled ? (
                    <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <Check className="h-5 w-5 text-green-600" />
                      <div className="flex-1">
                        <p className="font-medium text-green-800">{ts('twoFactorActive')}</p>
                        <p className="text-sm text-green-600">{ts('twoFactorActiveDesc')}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleDisable2FA} disabled={mfaLoading}>
                        {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : ts('disable')}
                      </Button>
                    </div>
                  ) : mfaSetup ? (
                    <div className="space-y-4 max-w-md">
                      <div className="p-4 border rounded-lg bg-white text-center">
                        <p className="text-sm text-gray-600 mb-3">{ts('scanQrCode')}</p>
                        <img src={mfaSetup.qrCode} alt="2FA QR Code" className="mx-auto mb-3 w-48 h-48" />
                        <p className="text-xs text-gray-400">{ts('manualKey')}: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{mfaSetup.secret}</code></p>
                      </div>
                      <div className="space-y-2">
                        <Label>{ts('enterCode')}</Label>
                        <div className="flex gap-2">
                          <Input
                            value={mfaCode}
                            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            maxLength={6}
                            className="font-mono text-center text-lg tracking-widest max-w-[180px]"
                          />
                          <Button onClick={handleVerify2FA} disabled={mfaLoading || mfaCode.length !== 6}>
                            {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                            {ts('verify')}
                          </Button>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => { setMfaSetup(null); setMfaCode(''); }}>
                        {ts('cancelSetup')}
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" onClick={handleEnroll2FA} disabled={mfaLoading}>
                      {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                      {t('settings.enable2FA') || 'Enable 2FA'}
                    </Button>
                  )}
                </div>
                <hr />

                {/* Login History */}
                <div className="space-y-4">
                  <h3 className="font-medium">{ts('recentLoginActivity')}</h3>
                  {loginHistory.length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {loginHistory.slice(0, 20).map(entry => (
                        <div key={entry.id} className="flex items-center justify-between p-2.5 border rounded-lg text-sm">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              entry.action === 'LOGIN_SUCCESS' ? 'bg-green-500' :
                              entry.action === 'LOGIN_FAILURE' ? 'bg-red-500' : 'bg-gray-400'
                            }`} />
                            <div>
                              <p className="font-medium">
                                {entry.action === 'LOGIN_SUCCESS' ? ts('loginSuccess') :
                                 entry.action === 'LOGIN_FAILURE' ? ts('loginFailure') :
                                 entry.action.replace(/_/g, ' ')}
                              </p>
                              <p className="text-xs text-gray-500">{entry.device}{entry.ipAddress ? ` · ${entry.ipAddress}` : ''}</p>
                            </div>
                          </div>
                          <span className="text-xs text-gray-400">
                            {new Date(entry.timestamp).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">{ts('noLoginActivity')}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-amber-500" />
                  {t('settings.notifications') || 'Notifications'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="font-medium">{t('settings.emailNotifications') || 'Email Notifications'}</p>
                    <p className="text-sm text-gray-500">{t('settings.emailNotificationsDesc') || 'Receive updates via email'}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications.email_enabled}
                    onChange={(e) => setNotifications({ ...notifications, email_enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="font-medium">{t('settings.deadlineReminders') || 'Tax Filing Reminders'}</p>
                    <p className="text-sm text-gray-500">{t('settings.deadlineRemindersDesc') || 'Get notified before deadlines'}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications.deadline_reminders}
                    onChange={(e) => setNotifications({ ...notifications, deadline_reminders: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="font-medium">{t('settings.paymentAlerts') || 'Payment Alerts'}</p>
                    <p className="text-sm text-gray-500">{t('settings.paymentAlertsDesc') || 'Notifications about invoices and payments'}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications.payment_reminders}
                    onChange={(e) => setNotifications({ ...notifications, payment_reminders: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{t('settings.marketingUpdates') || 'Marketing Updates'}</p>
                    <p className="text-sm text-gray-500">{t('settings.marketingUpdatesDesc') || 'News and promotional offers'}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications.marketing_emails}
                    onChange={(e) => setNotifications({ ...notifications, marketing_emails: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-4">
                  <Button onClick={handleSaveNotifications} disabled={isSavingNotifications}>
                    {isSavingNotifications ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {t('common.save') || 'Save'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Language Tab */}
          {activeTab === 'language' && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-purple-600" />
                  {t('settings.language') || 'Language'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('settings.selectLanguage') || 'Select Language'}</Label>
                  <Select value={locale} onValueChange={handleLanguageChange}>
                    <SelectTrigger className="w-[240px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500">
                    {t('settings.languageDescription') || 'This will change the language across the entire application'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-indigo-600" />
                  {ti('integrations')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Accurate Online */}
                <div className="border rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
                        <span className="text-white font-bold text-xs">ACC</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Accurate Online</h3>
                        <p className="text-xs text-gray-500">{ti('accurateDesc')}</p>
                      </div>
                    </div>
                    <AccurateConnectButton />
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>{ti('featuresAfterConnect')}</p>
                    <ul className="list-disc list-inside text-xs text-gray-500 space-y-0.5">
                      <li>{t('integrations.accurateFeature1')}</li>
                      <li>{t('integrations.accurateFeature2')}</li>
                      <li>{t('integrations.accurateFeature3')}</li>
                      <li>{t('integrations.accurateFeature4')}</li>
                    </ul>
                  </div>
                </div>

                {/* Bank Integration */}
                <div className="border rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-sm">
                        <span className="text-white font-bold text-xs">BNK</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{ti('bankAccount')}</h3>
                        <p className="text-xs text-gray-500">{ti('bankDesc')}</p>
                      </div>
                    </div>
                    <BankConnectButton />
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>{t('integrations.supportedBanks')}:</p>
                    <div className="flex flex-wrap gap-2">
                      {['BCA', 'Mandiri', 'BNI', 'BRI', 'CIMB', 'Danamon'].map(bank => (
                        <span key={bank} className="text-xs bg-gray-100 px-2 py-1 rounded-md">{bank}</span>
                      ))}
                    </div>
                    <ul className="list-disc list-inside text-xs text-gray-500 space-y-0.5 mt-2">
                      <li>{t('integrations.bankFeature1')}</li>
                      <li>{t('integrations.bankFeature2')}</li>
                      <li>{t('integrations.bankFeature3')}</li>
                      <li>{t('integrations.bankFeature4')}</li>
                    </ul>
                  </div>
                </div>

                {/* Jurnal.id Integration */}
                <div className="border rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-sm">
                        <span className="text-white font-bold text-xs">JR</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Jurnal.id (Mekari)</h3>
                        <p className="text-xs text-gray-500">{ti('jurnalDesc')}</p>
                      </div>
                    </div>
                    <JurnalConnectButton />
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <ul className="list-disc list-inside text-xs text-gray-500 space-y-0.5">
                      <li>{t('integrations.jurnalFeature1')}</li>
                      <li>{t('integrations.jurnalFeature2')}</li>
                      <li>{t('integrations.jurnalFeature3')}</li>
                      <li>{t('integrations.jurnalFeature4')}</li>
                    </ul>
                  </div>
                </div>

                <div className="border rounded-xl p-5 opacity-60">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gray-200">
                      <span className="text-gray-500 font-bold text-xs">XE</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Xero</h3>
                      <p className="text-xs text-gray-500">{ti('comingSoon')}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function AccurateConnectButton() {
  const ti = useTranslations('settingsIntegrations');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<string | null>(null);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/integrations/accurate');
      const data = await response.json();
      if (data.success) {
        setIsConnected(data.data.isConnected);
        if (data.data.connection) {
          setConnectionInfo(data.data.connection.companyName);
        }
      }
    } catch { /* ignore */ }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/integrations/accurate');
      const data = await response.json();
      if (data.success && data.data.authorizationUrl) {
        window.location.href = data.data.authorizationUrl;
      }
    } catch (error) {
      console.error('Connect error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/integrations/accurate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      setIsConnected(false);
      setConnectionInfo(null);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  };

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-green-600 font-medium flex items-center gap-1">
          <Check className="h-3 w-3" />
          {connectionInfo || ti('connected')}
        </span>
        <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={isLoading}>
          {ti('disconnect')}
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" onClick={handleConnect} disabled={isLoading} className="bg-gradient-to-r from-blue-600 to-indigo-600">
      {isLoading ? (
        <Loader2 className="h-3 w-3 animate-spin mr-1" />
      ) : (
        <ExternalLink className="h-3 w-3 mr-1" />
      )}
      {ti('connect')}
    </Button>
  );
}

function BankConnectButton() {
  const ti = useTranslations('settingsIntegrations');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    checkBankConnection();
  }, []);

  const checkBankConnection = async () => {
    try {
      const response = await fetch('/api/integrations/banking');
      const data = await response.json();
      if (data.success) {
        setIsConnected(data.data.hasConnection);
      }
    } catch { /* ignore */ }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/integrations/banking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-widget-token' }),
      });
      const data = await response.json();
      if (data.success && data.data.redirectUrl) {
        window.location.href = data.data.redirectUrl;
      } else {
        alert('Bank connection requires Brick API credentials. Set BRICK_PUBLIC_KEY and BRICK_SECRET_KEY in .env.local');
      }
    } catch {
      alert('Bank connection service not configured yet.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-green-600 font-medium flex items-center gap-1">
          <Check className="h-3 w-3" />
          {ti('connected')}
        </span>
        <Button variant="outline" size="sm" disabled>
          {ti('manageBtn')}
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" onClick={handleConnect} disabled={isLoading} className="bg-gradient-to-r from-green-600 to-emerald-600">
      {isLoading ? (
        <Loader2 className="h-3 w-3 animate-spin mr-1" />
      ) : (
        <ExternalLink className="h-3 w-3 mr-1" />
      )}
      {ti('connect')}
    </Button>
  );
}

function JurnalConnectButton() {
  const ti = useTranslations('settingsIntegrations');
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/integrations/jurnal');
      const data = await response.json();
      if (data.success && data.data.authorizationUrl) {
        window.location.href = data.data.authorizationUrl;
      } else {
        alert('Jurnal.id connection requires API credentials. Set JURNAL_CLIENT_ID and JURNAL_CLIENT_SECRET in .env.local');
      }
    } catch {
      alert('Jurnal.id connection service not configured yet.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button size="sm" onClick={handleConnect} disabled={isLoading} className="bg-gradient-to-r from-teal-600 to-cyan-600">
      {isLoading ? (
        <Loader2 className="h-3 w-3 animate-spin mr-1" />
      ) : (
        <ExternalLink className="h-3 w-3 mr-1" />
      )}
      {ti('connect')}
    </Button>
  );
}
