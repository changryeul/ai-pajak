'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';

type SettingsTab = 'profile' | 'security' | 'notifications' | 'language' | 'company';

export default function SettingsPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    phone: '',
    npwp: '',
  });

  const tabs = [
    { id: 'profile' as SettingsTab, label: t('settings.profile') || 'Profile', icon: User },
    { id: 'security' as SettingsTab, label: t('settings.security') || 'Security', icon: Shield },
    { id: 'notifications' as SettingsTab, label: t('settings.notifications') || 'Notifications', icon: Bell },
    { id: 'language' as SettingsTab, label: t('settings.language') || 'Language', icon: Globe },
  ];

  const languages = [
    { value: 'en', label: 'English' },
    { value: 'id', label: 'Bahasa Indonesia' },
    { value: 'ko', label: '한국어' },
    { value: 'ja', label: '日本語' },
    { value: 'zh', label: '中文' },
  ];

  useEffect(() => {
    // Load user profile
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
          });
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
      }
    };
    loadProfile();
  }, []);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: profile.fullName,
          phone: profile.phone,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(t('common.success') || 'Profile saved successfully');
      } else {
        alert(data.error || 'Failed to save profile');
      }
    } catch (error) {
      alert('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLanguageChange = (newLocale: string) => {
    const currentPath = window.location.pathname;
    const newPath = currentPath.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('settings.title') || 'Settings'}
        </h1>
        <p className="text-gray-500 mt-1">
          {t('settings.description') || 'Manage your account settings and preferences'}
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Tabs */}
        <div className="w-64 flex-shrink-0">
          <Card>
            <CardContent className="p-2">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                        activeTab === tab.id
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-50'
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {t('settings.security') || 'Security'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-medium">{t('auth.resetPassword') || 'Change Password'}</h3>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Current Password</Label>
                      <Input type="password" />
                    </div>
                    <div className="space-y-2">
                      <Label>New Password</Label>
                      <Input type="password" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('auth.confirmPassword') || 'Confirm Password'}</Label>
                      <Input type="password" />
                    </div>
                  </div>
                  <Button>{t('common.change') || 'Change'} Password</Button>
                </div>

                <hr />

                <div className="space-y-4">
                  <h3 className="font-medium">{t('auth.twoFactorAuth') || 'Two-Factor Authentication'}</h3>
                  <p className="text-sm text-gray-500">
                    Add an extra layer of security to your account
                  </p>
                  <Button variant="outline">
                    {t('auth.enableTwoFactor') || 'Enable 2FA'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  {t('settings.notifications') || 'Notifications'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-gray-500">Receive updates via email</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4" />
                </div>
                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="font-medium">Tax Filing Reminders</p>
                    <p className="text-sm text-gray-500">Get notified before deadlines</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4" />
                </div>
                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="font-medium">Payment Alerts</p>
                    <p className="text-sm text-gray-500">Notifications about invoices and payments</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4" />
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">Marketing Updates</p>
                    <p className="text-sm text-gray-500">News and promotional offers</p>
                  </div>
                  <input type="checkbox" className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Language Tab */}
          {activeTab === 'language' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  {t('settings.language') || 'Language'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Language</Label>
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
                    This will change the language across the entire application
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
