'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Users, Search, Loader2, Shield, UserCheck, UserX, KeyRound,
  ChevronDown, ChevronUp, Mail, Calendar, Building2, User, Plus, X,
} from 'lucide-react';

interface UserItem {
  id: string; email: string; fullName: string; npwp: string;
  role: string; isActive: boolean; customerType?: string;
  createdAt: string; lastSignIn?: string; emailConfirmed: boolean;
}

interface Stats {
  total: number;
  byRole: Record<string, number>;
  active: number; inactive: number;
}

export default function AdminUsersPage() {
  const t = useTranslations('admin');

  const roleConfig: Record<string, { label: string; color: string; gradient: string }> = {
    CUSTOMER: { label: t('customer'), color: 'bg-blue-100 text-blue-700', gradient: 'from-blue-500 to-indigo-600' },
    CONSULTANT_JTC: { label: t('consultant'), color: 'bg-green-100 text-green-700', gradient: 'from-green-500 to-emerald-600' },
    TAX_ADVISOR_JTC: { label: t('taxAdvisor'), color: 'bg-purple-100 text-purple-700', gradient: 'from-purple-500 to-violet-600' },
    PLATFORM_ADMIN: { label: t('admin'), color: 'bg-orange-100 text-orange-700', gradient: 'from-orange-500 to-red-500' },
    UNKNOWN: { label: 'Unknown', color: 'bg-gray-100 text-gray-500', gradient: 'from-gray-400 to-gray-500' },
  };
  const [users, setUsers] = useState<UserItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '', password: '', fullName: '', role: 'CUSTOMER', npwp: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const p = new URLSearchParams();
      if (search) p.append('search', search);
      if (roleFilter && roleFilter !== 'all') p.append('role', roleFilter);
      const res = await fetch(`/api/admin/users?${p}`);
      const data = await res.json();
      if (data.success) { setUsers(data.data.users || []); setStats(data.data.stats || null); }
      else { console.error('API error:', data.error); }
    } catch { /* */ }
    finally { setIsLoading(false); }
  }, [search, roleFilter]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const doAction = async (action: string, userId: string, email?: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId, email }),
      });
      const data = await res.json();
      setMessage(data.message || data.error);
      setTimeout(() => setMessage(null), 3000);
      loadUsers();
    } catch { /* */ }
    finally { setActionLoading(null); }
  };

  const changeRole = async (userId: string, newRole: string) => {
    setActionLoading(userId);
    try {
      await fetch('/api/admin/users', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });
      setMessage(t('roleUpdated'));
      setTimeout(() => setMessage(null), 3000);
      loadUsers();
    } catch { /* */ }
    finally { setActionLoading(null); }
  };

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.password) return;
    setIsCreating(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-user',
          userId: 'new',
          email: createForm.email,
          password: createForm.password,
          fullName: createForm.fullName,
          role: createForm.role,
          npwp: createForm.npwp,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(data.message);
        setShowCreateForm(false);
        setCreateForm({ email: '', password: '', fullName: '', role: 'CUSTOMER', npwp: '' });
        loadUsers();
      } else {
        setMessage(data.error || 'Failed to create user');
      }
    } catch { setMessage('Error creating user'); }
    finally { setIsCreating(false); setTimeout(() => setMessage(null), 5000); }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-600 via-red-600 to-rose-700 p-6 md:p-8 text-white mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-200 text-sm flex items-center gap-2"><Users className="h-4 w-4" />{t('admin')}</p>
              <h1 className="text-2xl md:text-3xl font-bold mt-1">{t('userMgmt')}</h1>
            </div>
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-white/20 hover:bg-white/30 text-white border-0"
            >
              <Plus className="h-4 w-4 mr-2" />{t('createUser')}
            </Button>
          </div>

          {stats && (
            <div className="grid grid-cols-5 gap-3 mt-6">
              <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                <p className="text-2xl font-bold">{stats.total}</p><p className="text-[10px] text-orange-200">{t('totalLabel')}</p>
              </div>
              {Object.entries(stats.byRole).map(([role, count]) => (
                <div key={role} className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold">{count}</p><p className="text-[10px] text-orange-200">{roleConfig[role]?.label || role}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">{message}</div>
      )}

      {/* Create User Form */}
      {showCreateForm && (
        <Card className="border-0 shadow-md mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t('createUserTitle')}</CardTitle>
              <button onClick={() => setShowCreateForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">{t('email')}</Label>
                <Input
                  type="email"
                  value={createForm.email}
                  onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <Label className="text-xs">{t('password')}</Label>
                <Input
                  type="password"
                  value={createForm.password}
                  onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder={t('passwordPlaceholder')}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">{t('name')}</Label>
                <Input
                  value={createForm.fullName}
                  onChange={e => setCreateForm({ ...createForm, fullName: e.target.value })}
                  placeholder={t('namePlaceholder')}
                />
              </div>
              <div>
                <Label className="text-xs">{t('role')}</Label>
                <Select value={createForm.role} onValueChange={v => setCreateForm({ ...createForm, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CUSTOMER">{t('customerOption')}</SelectItem>
                    <SelectItem value="CONSULTANT_JTC">{t('consultantOption')}</SelectItem>
                    <SelectItem value="TAX_ADVISOR_JTC">{t('taxAdvisorOption')}</SelectItem>
                    <SelectItem value="TAX_OPERATOR">{t('operatorOption')}</SelectItem>
                    <SelectItem value="TAX_OPERATOR_LEAD">Operator Lead</SelectItem>
                    <SelectItem value="TAX_OPERATOR_SUPERVISOR">Operator Supervisor</SelectItem>
                    <SelectItem value="PLATFORM_ADMIN">{t('adminOption')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">NPWP</Label>
                <Input
                  value={createForm.npwp}
                  onChange={e => setCreateForm({ ...createForm, npwp: e.target.value })}
                  placeholder="XX.XXX.XXX.X-XXX.XXX"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>{t('cancel')}</Button>
              <Button
                onClick={handleCreateUser}
                disabled={isCreating || !createForm.email || !createForm.password}
                className="bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {t('register')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search & Filter */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder={t('searchUsers')} value={search} onChange={e => setSearch(e.target.value)} className="pl-10 rounded-xl" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder={t('allRoles')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allRoles')}</SelectItem>
            <SelectItem value="CUSTOMER">{t('customer')}</SelectItem>
            <SelectItem value="CONSULTANT_JTC">{t('consultant')}</SelectItem>
            <SelectItem value="TAX_ADVISOR_JTC">{t('taxAdvisor')}</SelectItem>
            <SelectItem value="PLATFORM_ADMIN">{t('admin')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* User List */}
      {isLoading ? (
        <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-600" /></div>
      ) : users.length === 0 ? (
        <div className="text-center py-20 text-gray-400"><Users className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>{t('noUsersFound')}</p></div>
      ) : (
        <div className="space-y-2">
          {users.map(u => {
            const rc = roleConfig[u.role] || roleConfig.UNKNOWN;
            const isExpanded = expandedUser === u.id;
            const isActionLoading = actionLoading === u.id;

            return (
              <Card key={u.id} className="border-0 shadow-sm">
                <CardContent className="p-0">
                  {/* Main Row */}
                  <button onClick={() => setExpandedUser(isExpanded ? null : u.id)} className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 transition-colors">
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${rc.gradient} ${!u.isActive ? 'opacity-40' : ''}`}>
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-gray-900 truncate">{u.fullName || u.email}</span>
                        <Badge className={`text-[10px] ${rc.color}`}>{rc.label}</Badge>
                        {!u.isActive && <Badge className="text-[10px] bg-red-100 text-red-700">{t('inactive')}</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{u.email}</span>
                        {u.npwp && <span className="font-mono">{u.npwp}</span>}
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-400 hidden sm:block">
                      <p>{new Date(u.createdAt).toLocaleDateString()}</p>
                      <p>{u.lastSignIn ? `${t('lastLogin')} ${new Date(u.lastSignIn).toLocaleDateString()}` : t('neverLoggedIn')}</p>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </button>

                  {/* Expanded Actions */}
                  {isExpanded && (
                    <div className="border-t bg-gray-50 p-4 space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div><span className="text-gray-500">User ID</span><p className="font-mono text-[10px] truncate">{u.id}</p></div>
                        <div><span className="text-gray-500">{t('joined')}</span><p>{new Date(u.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p></div>
                        <div><span className="text-gray-500">{t('lastLoginLabel')}</span><p>{u.lastSignIn ? new Date(u.lastSignIn).toLocaleString('id-ID') : '-'}</p></div>
                        <div><span className="text-gray-500">{t('emailVerified')}</span><p>{u.emailConfirmed ? '✅ Yes' : '❌ No'}</p></div>
                      </div>

                      <div className="flex items-center gap-3 pt-2">
                        {/* Role Change */}
                        <Select value={u.role} onValueChange={v => changeRole(u.id, v)}>
                          <SelectTrigger className="w-[160px] text-xs h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CUSTOMER">{t('customer')}</SelectItem>
                            <SelectItem value="CONSULTANT_JTC">{t('consultant')}</SelectItem>
                            <SelectItem value="TAX_ADVISOR_JTC">{t('taxAdvisor')}</SelectItem>
                            <SelectItem value="PLATFORM_ADMIN">{t('admin')}</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Actions */}
                        <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => doAction('reset-password', u.id, u.email)} disabled={isActionLoading}>
                          <KeyRound className="h-3 w-3 mr-1" />{t('resetPassword')}
                        </Button>

                        {u.isActive ? (
                          <Button size="sm" variant="outline" className="text-xs h-8 text-red-600 hover:bg-red-50" onClick={() => doAction('deactivate', u.id)} disabled={isActionLoading}>
                            <UserX className="h-3 w-3 mr-1" />{t('deactivate')}
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="text-xs h-8 text-green-600 hover:bg-green-50" onClick={() => doAction('activate', u.id)} disabled={isActionLoading}>
                            <UserCheck className="h-3 w-3 mr-1" />{t('activate')}
                          </Button>
                        )}

                        {isActionLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
