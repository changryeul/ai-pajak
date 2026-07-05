'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { useSession, hasRole } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Building2,
  Edit2,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  Shield,
  User,
  Users,
  X,
  Clock,
  AlertCircle,
  MessageSquare,
  Pin,
  Send,
  Trash2,
} from 'lucide-react';

interface CustomerDetail {
  id: string;
  full_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  npwp: string | null;
  nik?: string | null;
  address: string | null;
  customer_type: 'INDIVIDUAL' | 'COMPANY';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Filing {
  id: string;
  tax_type: string;
  tax_period: string;
  tax_year: number;
  status: string;
  filing_status?: string;
  total_income?: number;
  tax_due?: number;
  created_at: string;
  filed_at?: string;
}

interface POA {
  id: string;
  status: string;
  scope?: string[];
  created_at: string;
  signed_at?: string;
  expires_at?: string;
}

interface Consultant {
  id: string;
  isActive: boolean;
  assignedAt: string;
  consultant: {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
  };
}

interface Note {
  id: string;
  content: string;
  is_pinned: boolean;
  author_user_id: string;
  author_role: string;
  created_at: string;
  updated_at: string;
}

interface ActivityLog {
  id: string;
  action: string;
  activity_type?: string;
  actor_role?: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export default function CustomerDetailPage() {
  const t = useTranslations('customers');
  const tc = useTranslations('common');
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const customerId = params.id as string;
  const { session, isLoading: sessionLoading } = useSession();

  // Role guard: only consultants may view customer detail pages
  useEffect(() => {
    if (sessionLoading || !session) return;
    const isConsultant = hasRole(session, UserRole.CONSULTANT, UserRole.TAX_ADVISOR);
    if (!isConsultant) {
      router.replace(`/${locale}/dashboard`);
    }
  }, [session, sessionLoading, router, locale]);

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [filings, setFilings] = useState<Filing[]>([]);
  const [poas, setPoas] = useState<POA[]>([]);
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<Partial<CustomerDetail>>({});
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchCustomer = useCallback(async () => {
    try {
      const res = await fetch(`/api/customers/${customerId}`, { credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        setCustomer(json.data);
        setEditForm(json.data);
      } else {
        setError(json.error || 'Failed to load customer');
      }
    } catch {
      setError('Failed to load customer');
    }
  }, [customerId]);

  const fetchFilings = useCallback(async () => {
    try {
      const res = await fetch(`/api/customers/${customerId}/filings?limit=20`, { credentials: 'include' });
      const json = await res.json();
      if (json.success) setFilings(json.data || []);
    } catch { /* ignore */ }
  }, [customerId]);

  const fetchConsultants = useCallback(async () => {
    try {
      const res = await fetch(`/api/customers/${customerId}/assign`, { credentials: 'include' });
      const json = await res.json();
      if (json.success) setConsultants(json.data || []);
    } catch { /* ignore */ }
  }, [customerId]);

  const fetchPOAs = useCallback(async () => {
    try {
      const res = await fetch(`/api/poa?customerId=${customerId}`, { credentials: 'include' });
      const json = await res.json();
      if (json.success) setPoas(json.data || json.poas || []);
    } catch { /* ignore */ }
  }, [customerId]);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/customers/${customerId}/notes`, { credentials: 'include' });
      const json = await res.json();
      if (json.success) setNotes(json.data || []);
    } catch { /* ignore */ }
  }, [customerId]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSubmittingNote(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/notes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote }),
      });
      const json = await res.json();
      if (json.success) {
        setNewNote('');
        fetchNotes();
      }
    } catch { /* ignore */ }
    finally { setSubmittingNote(false); }
  };

  const handleTogglePin = async (noteId: string, currentPin: boolean) => {
    await fetch(`/api/customers/${customerId}/notes`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteId, is_pinned: !currentPin }),
    });
    fetchNotes();
  };

  const handleDeleteNote = async (noteId: string) => {
    await fetch(`/api/customers/${customerId}/notes?noteId=${noteId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    fetchNotes();
  };

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch(`/api/audit/logs?resourceId=${customerId}&limit=20`, { credentials: 'include' });
      const json = await res.json();
      if (json.success) setActivities(json.data || json.logs || []);
    } catch { /* ignore */ }
  }, [customerId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchCustomer(), fetchFilings(), fetchConsultants(), fetchPOAs(), fetchNotes(), fetchActivities()])
      .finally(() => setLoading(false));
  }, [fetchCustomer, fetchFilings, fetchConsultants, fetchPOAs, fetchNotes, fetchActivities]);

  const handleSave = async () => {
    if (!customer) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: editForm.full_name,
          company_name: editForm.company_name,
          email: editForm.email,
          phone: editForm.phone,
          address: editForm.address,
          npwp: editForm.npwp,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCustomer({ ...customer, ...json.data });
        setEditing(false);
        setSaveMessage({ type: 'success', text: t('saved') });
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage({ type: 'error', text: json.error || t('saveFailed') });
      }
    } catch {
      setSaveMessage({ type: 'error', text: t('saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale === 'ko' ? 'ko-KR' : locale === 'ja' ? 'ja-JP' : 'id-ID', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-700',
      SUBMITTED: 'bg-blue-100 text-blue-700',
      UNDER_REVIEW: 'bg-yellow-100 text-yellow-700',
      FILED: 'bg-green-100 text-green-700',
      ACCEPTED: 'bg-green-100 text-green-700',
      REJECTED: 'bg-red-100 text-red-700',
      ACTIVE: 'bg-green-100 text-green-700',
      PENDING_SIGNATURE: 'bg-yellow-100 text-yellow-700',
      EXPIRED: 'bg-gray-100 text-gray-500',
      REVOKED: 'bg-red-100 text-red-700',
    };
    return <Badge className={colors[status] || 'bg-gray-100 text-gray-700'}>{status.replace(/_/g, ' ')}</Badge>;
  };

  const formatActionName = (action: string) =>
    action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-lg font-medium">{error || 'Customer not found'}</p>
          <Button variant="outline" onClick={() => router.push(`/${locale}/customers`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('back')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Back + Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/${locale}/customers`)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('back')}
          </Button>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              customer.customer_type === 'COMPANY'
                ? 'bg-gradient-to-br from-purple-500 to-violet-600'
                : 'bg-gradient-to-br from-blue-500 to-indigo-600'
            }`}>
              {customer.customer_type === 'COMPANY'
                ? <Building2 className="h-6 w-6 text-white" />
                : <User className="h-6 w-6 text-white" />}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{customer.company_name || customer.full_name}</h1>
              {customer.company_name && <p className="text-muted-foreground">{customer.full_name}</p>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveMessage && (
            <span className={`text-sm ${saveMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {saveMessage.text}
            </span>
          )}
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Edit2 className="h-4 w-4 mr-1" />
              {t('editProfile')}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setEditing(false); setEditForm(customer); }}>
                <X className="h-4 w-4 mr-1" />
                {t('cancel')}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                {t('saveChanges')}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Profile Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {t('contactInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {editing ? (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">{t('fullName')}</label>
                  <Input value={editForm.full_name || ''} onChange={e => setEditForm({...editForm, full_name: e.target.value})} />
                </div>
                {customer.customer_type === 'COMPANY' && (
                  <div>
                    <label className="text-xs text-muted-foreground">{t('companyName')}</label>
                    <Input value={editForm.company_name || ''} onChange={e => setEditForm({...editForm, company_name: e.target.value})} />
                  </div>
                )}
                <div>
                  <label className="text-xs text-muted-foreground">{t('email')}</label>
                  <Input value={editForm.email || ''} onChange={e => setEditForm({...editForm, email: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t('phone')}</label>
                  <Input value={editForm.phone || ''} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t('address')}</label>
                  <Input value={editForm.address || ''} onChange={e => setEditForm({...editForm, address: e.target.value})} />
                </div>
              </>
            ) : (
              <>
                <InfoRow icon={<User className="h-4 w-4" />} label={t('fullName')} value={customer.full_name} />
                {customer.company_name && <InfoRow icon={<Building2 className="h-4 w-4" />} label={t('companyName')} value={customer.company_name} />}
                <InfoRow icon={<Mail className="h-4 w-4" />} label={t('email')} value={customer.email} />
                <InfoRow icon={<Phone className="h-4 w-4" />} label={t('phone')} value={customer.phone} />
                <InfoRow icon={<MapPin className="h-4 w-4" />} label={t('address')} value={customer.address} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Tax Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t('taxInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {editing ? (
              <div>
                <label className="text-xs text-muted-foreground">{t('npwp')}</label>
                <Input value={editForm.npwp || ''} onChange={e => setEditForm({...editForm, npwp: e.target.value})} className="font-mono" />
              </div>
            ) : (
              <InfoRow label={t('npwp')} value={customer.npwp} mono />
            )}
            <InfoRow label={t('customerType')} value={customer.customer_type === 'COMPANY' ? t('company') : t('individual')} />
            <InfoRow label={t('status')} value={customer.is_active ? t('active') : t('inactive')} />
            <InfoRow label={t('registeredAt')} value={formatDate(customer.created_at)} />
            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-1">{t('filings')}</p>
              <p className="text-2xl font-bold">{filings.length}</p>
            </div>
          </CardContent>
        </Card>

        {/* Assigned Consultants */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t('assignedConsultants')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {consultants.length > 0 ? (
              <div className="space-y-3">
                {consultants.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-2 border rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{c.consultant.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.consultant.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">{t('noConsultants')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Filings, POA, Activity */}
      <Tabs defaultValue="filings">
        <TabsList>
          <TabsTrigger value="filings" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            {t('taxFilings')} ({filings.length})
          </TabsTrigger>
          <TabsTrigger value="poa" className="flex items-center gap-1.5">
            <Shield className="h-4 w-4" />
            {t('poaHistory')} ({poas.length})
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" />
            Notes ({notes.length})
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {t('recentActivity')} ({activities.length})
          </TabsTrigger>
        </TabsList>

        {/* Filings Tab */}
        <TabsContent value="filings">
          <Card>
            <CardContent className="pt-6">
              {filings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('filingType')}</TableHead>
                      <TableHead>{t('filingPeriod')}</TableHead>
                      <TableHead>{t('filingStatus')}</TableHead>
                      <TableHead>{t('filingDate')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filings.map(f => (
                      <TableRow key={f.id} className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/${locale}/filings/${f.id}`)}>
                        <TableCell className="font-medium">{f.tax_type}</TableCell>
                        <TableCell>{f.tax_period || f.tax_year}</TableCell>
                        <TableCell>{getStatusBadge(f.filing_status || f.status)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(f.filed_at || f.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t('noFilings')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* POA Tab */}
        <TabsContent value="poa">
          <Card>
            <CardContent className="pt-6">
              {poas.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('status')}</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>{t('filingDate')}</TableHead>
                      <TableHead>Expires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {poas.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>{getStatusBadge(p.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {(p.scope || []).map(s => (
                              <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(p.created_at)}</TableCell>
                        <TableCell className="text-muted-foreground">{p.expires_at ? formatDate(p.expires_at) : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Shield className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t('noPoa')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <Card>
            <CardContent className="pt-6 space-y-4">
              {/* New note input */}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
                <Button
                  onClick={handleAddNote}
                  disabled={submittingNote || !newNote.trim()}
                  size="sm"
                  className="self-end"
                >
                  {submittingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>

              {/* Notes list */}
              {notes.length > 0 ? (
                <div className="space-y-3">
                  {notes.map(note => (
                    <div key={note.id} className={`p-3 border rounded-lg ${note.is_pinned ? 'border-yellow-300 bg-yellow-50/50' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <span>{note.author_role.replace(/_/g, ' ')}</span>
                            <span>·</span>
                            <span>{formatDate(note.created_at)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleTogglePin(note.id, note.is_pinned)}
                          >
                            <Pin className={`h-3.5 w-3.5 ${note.is_pinned ? 'text-yellow-600 fill-yellow-600' : 'text-muted-foreground'}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                            onClick={() => handleDeleteNote(note.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No notes yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardContent className="pt-6">
              {activities.length > 0 ? (
                <div className="space-y-3">
                  {activities.map(a => (
                    <div key={a.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{formatActionName(a.action || a.activity_type || '')}</p>
                        {a.actor_role && <p className="text-xs text-muted-foreground">{t('activityActor')}: {a.actor_role}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(a.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t('noActivity')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ icon, label, value, mono }: { icon?: React.ReactNode; label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="text-muted-foreground mt-0.5">{icon}</span>}
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm ${mono ? 'font-mono' : ''} ${value ? '' : 'text-muted-foreground'}`}>
          {value || '-'}
        </p>
      </div>
    </div>
  );
}
