'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MessageSquareWarning,
  Plus,
  Loader2,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface Complaint {
  id: string;
  customer_id: string;
  operator_id: string | null;
  queue_item_id: string | null;
  complaint_type: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  customer: { id: string; customer_name: string; npwp: string } | null;
  operator: { id: string; name: string; employee_id: string } | null;
}

interface ComplaintsData {
  items: Complaint[];
  summary: { open: number; in_progress: number; resolved: number; closed: number };
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function ComplaintsPage() {
  const t = useTranslations('operator');
  const [data, setData] = useState<ComplaintsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Create form state
  const [newComplaint, setNewComplaint] = useState({
    customerId: '',
    operatorId: '',
    complaintType: 'delay',
    subject: '',
    description: '',
    priority: 'medium',
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterPriority !== 'all') params.append('priority', filterPriority);
      const res = await fetch(`/api/operator/complaints?${params}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch {
      setMessage({ type: 'error', text: t('networkError') });
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, filterPriority, t]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    if (!newComplaint.customerId || !newComplaint.subject || !newComplaint.description) {
      setMessage({ type: 'error', text: t('errorOccurred') });
      return;
    }
    try {
      const res = await fetch('/api/operator/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          customerId: newComplaint.customerId,
          operatorId: newComplaint.operatorId || undefined,
          complaintType: newComplaint.complaintType,
          subject: newComplaint.subject,
          description: newComplaint.description,
          priority: newComplaint.priority,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: t('statusUpdated') });
        setShowCreateForm(false);
        setNewComplaint({ customerId: '', operatorId: '', complaintType: 'delay', subject: '', description: '', priority: 'medium' });
        loadData();
      } else {
        setMessage({ type: 'error', text: json.error || t('errorOccurred') });
      }
    } catch {
      setMessage({ type: 'error', text: t('networkError') });
    }
  };

  const handleStatusChange = async (complaintId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/operator/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-status',
          complaintId,
          status: newStatus,
          resolutionNotes: resolutionNotes || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: t('statusUpdated') });
        setResolutionNotes('');
        loadData();
      }
    } catch {
      setMessage({ type: 'error', text: t('networkError') });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OPEN': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'IN_PROGRESS': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'RESOLVED': return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'CLOSED': return <XCircle className="h-4 w-4 text-gray-400" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, string> = {
      OPEN: 'bg-red-100 text-red-700',
      IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
      RESOLVED: 'bg-emerald-100 text-emerald-700',
      CLOSED: 'bg-gray-100 text-gray-600',
    };
    const labels: Record<string, string> = {
      OPEN: t('statusOpen'),
      IN_PROGRESS: t('statusInProgress'),
      RESOLVED: t('statusResolved'),
      CLOSED: t('statusClosed'),
    };
    return <Badge className={config[status] || ''}>{labels[status] || status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const config: Record<string, string> = {
      low: 'bg-gray-100 text-gray-600',
      medium: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
      urgent: 'bg-red-100 text-red-700',
    };
    const labels: Record<string, string> = {
      low: t('priorityLow'),
      medium: t('priorityMedium'),
      high: t('priorityHigh'),
      urgent: t('priorityUrgent'),
    };
    return <Badge className={config[priority] || ''}>{labels[priority] || priority}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      delay: t('typeDelay'),
      error: t('typeError'),
      communication: t('typeCommunication'),
      other: t('typeOther'),
    };
    return <Badge variant="outline">{labels[type] || type}</Badge>;
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-rose-600" />
        <span className="ml-2 text-gray-500">{t('loadingData')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-600 via-pink-600 to-fuchsia-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-rose-200 text-sm flex items-center gap-2">
              <MessageSquareWarning className="h-4 w-4" />
              {t('complaintsTitle')}
            </p>
            <h1 className="text-2xl font-bold mt-1">{t('complaintsSubtitle')}</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="text-white border-white/30 hover:bg-white/10" onClick={loadData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setShowCreateForm(!showCreateForm)} className="bg-white/20 hover:bg-white/30">
              <Plus className="h-4 w-4 mr-2" /> {t('newComplaint')}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-rose-200">{t('openComplaints')}</p>
            <p className="text-2xl font-bold">{data.summary.open}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-rose-200">{t('inProgressComplaints')}</p>
            <p className="text-2xl font-bold">{data.summary.in_progress}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-rose-200">{t('resolvedComplaints')}</p>
            <p className="text-2xl font-bold">{data.summary.resolved}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-rose-200">{t('closedComplaints')}</p>
            <p className="text-2xl font-bold">{data.summary.closed}</p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>{t('newComplaint')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Customer ID *</Label>
                <Input
                  value={newComplaint.customerId}
                  onChange={e => setNewComplaint(prev => ({ ...prev, customerId: e.target.value }))}
                  placeholder="Customer UUID"
                />
              </div>
              <div>
                <Label>Operator ID</Label>
                <Input
                  value={newComplaint.operatorId}
                  onChange={e => setNewComplaint(prev => ({ ...prev, operatorId: e.target.value }))}
                  placeholder="Operator UUID (optional)"
                />
              </div>
              <div>
                <Label>{t('complaintType')}</Label>
                <Select value={newComplaint.complaintType} onValueChange={v => setNewComplaint(prev => ({ ...prev, complaintType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="delay">{t('typeDelay')}</SelectItem>
                    <SelectItem value="error">{t('typeError')}</SelectItem>
                    <SelectItem value="communication">{t('typeCommunication')}</SelectItem>
                    <SelectItem value="other">{t('typeOther')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('complaintPriority')}</Label>
                <Select value={newComplaint.priority} onValueChange={v => setNewComplaint(prev => ({ ...prev, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t('priorityLow')}</SelectItem>
                    <SelectItem value="medium">{t('priorityMedium')}</SelectItem>
                    <SelectItem value="high">{t('priorityHigh')}</SelectItem>
                    <SelectItem value="urgent">{t('priorityUrgent')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{t('complaintSubject')} *</Label>
              <Input
                value={newComplaint.subject}
                onChange={e => setNewComplaint(prev => ({ ...prev, subject: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t('complaintDescription')} *</Label>
              <Textarea
                value={newComplaint.description}
                onChange={e => setNewComplaint(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate}>{t('confirm')}</Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>{t('cancel')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('complaintStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filterAll')}</SelectItem>
            <SelectItem value="OPEN">{t('statusOpen')}</SelectItem>
            <SelectItem value="IN_PROGRESS">{t('statusInProgress')}</SelectItem>
            <SelectItem value="RESOLVED">{t('statusResolved')}</SelectItem>
            <SelectItem value="CLOSED">{t('statusClosed')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('complaintPriority')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filterAll')}</SelectItem>
            <SelectItem value="urgent">{t('priorityUrgent')}</SelectItem>
            <SelectItem value="high">{t('priorityHigh')}</SelectItem>
            <SelectItem value="medium">{t('priorityMedium')}</SelectItem>
            <SelectItem value="low">{t('priorityLow')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Complaint List */}
      {data.items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-300" />
          <p>{t('noComplaints')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.items.map(complaint => (
            <Card key={complaint.id} className="overflow-hidden">
              <div
                className="p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(expandedId === complaint.id ? null : complaint.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getStatusIcon(complaint.status)}
                    <div>
                      <p className="font-medium">{complaint.subject}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span>{complaint.customer?.customer_name || complaint.customer_id.slice(0, 8)}</span>
                        {complaint.operator && <span>→ {complaint.operator.name}</span>}
                        <span>{new Date(complaint.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getTypeBadge(complaint.complaint_type)}
                    {getPriorityBadge(complaint.priority)}
                    {getStatusBadge(complaint.status)}
                    {expandedId === complaint.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
              </div>

              {expandedId === complaint.id && (
                <div className="border-t p-4 bg-gray-50 space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{t('complaintDescription')}</p>
                    <p className="text-sm bg-white p-3 rounded border">{complaint.description}</p>
                  </div>

                  {complaint.resolution_notes && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">{t('resolutionNotes')}</p>
                      <p className="text-sm bg-emerald-50 p-3 rounded border border-emerald-200">{complaint.resolution_notes}</p>
                    </div>
                  )}

                  {(complaint.status === 'IN_PROGRESS' || complaint.status === 'RESOLVED') && (
                    <div>
                      <Label className="text-xs">{t('resolutionNotes')}</Label>
                      <Textarea
                        value={resolutionNotes}
                        onChange={e => setResolutionNotes(e.target.value)}
                        rows={2}
                        className="mt-1"
                      />
                    </div>
                  )}

                  <div className="flex gap-2">
                    {complaint.status === 'OPEN' && (
                      <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700" onClick={() => handleStatusChange(complaint.id, 'IN_PROGRESS')}>
                        {t('takeComplaint')}
                      </Button>
                    )}
                    {complaint.status === 'IN_PROGRESS' && (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStatusChange(complaint.id, 'RESOLVED')}>
                        {t('resolveComplaint')}
                      </Button>
                    )}
                    {complaint.status === 'RESOLVED' && (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(complaint.id, 'CLOSED')}>
                        {t('closeComplaint')}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
