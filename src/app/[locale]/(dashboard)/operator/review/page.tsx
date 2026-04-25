'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Loader2, CheckCircle, AlertTriangle, FileText, Upload, Camera,
  Sparkles, Send, Eye, Users, DollarSign, Shield, X,
  ClipboardList, MessageCircle, Plus,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { fmtRp } from '@/lib/utils';
import FlagFieldsPanel from '@/components/operator/FlagFieldsPanel';

interface Document {
  id: string;
  file_name: string;
  document_type: string;
  ocr_status: string;
  ocr_result?: { extractedData?: Record<string, unknown>; confidence?: number };
  file_url?: string;
  created_at: string;
}

interface DocRequest {
  id: string;
  title: string;
  message: string;
  required_documents: Array<{ type: string; description: string; priority: string }>;
  status: string;
  created_at: string;
}

interface QueueItem {
  id: string;
  customer_id: string;
  tax_type: string;
  tax_period_month: number;
  tax_period_year: number;
  amount: number;
  status: string;
  customer?: { full_name: string; company_name?: string; npwp?: string };
}

/**
 * /operator/review?customerId=xxx&queueId=yyy
 *
 * Operator reviews customer's uploaded documents, OCR results,
 * and can request additional documents (shown as AI to customer).
 */
export default function OperatorReviewPage() {
  const t = useTranslations('operatorReview');
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = params.locale as string;
  const customerId = searchParams.get('customerId') || '';
  const queueId = searchParams.get('queueId') || '';

  const [customerName, setCustomerName] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [requests, setRequests] = useState<DocRequest[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Request form
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [reqTitle, setReqTitle] = useState('');
  const [reqMessage, setReqMessage] = useState('');
  const [reqDocs, setReqDocs] = useState<Array<{ type: string; description: string; priority: string }>>([
    { type: '', description: '', priority: 'MEDIUM' },
  ]);
  const [sendWhatsapp, setSendWhatsapp] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/documents?customerId=${customerId}`).then(r => r.json()),
      fetch(`/api/documents/requests?customerId=${customerId}`).then(r => r.json()),
      fetch(`/api/operator/queue?customerId=${customerId}`).then(r => r.json()),
      fetch(`/api/customers/${customerId}`).then(r => r.json()),
    ]).then(([docsData, reqData, queueData, custData]) => {
      if (docsData.success) setDocuments(docsData.data || []);
      if (reqData.success) setRequests(reqData.data || []);
      if (queueData.success) setQueueItems(queueData.data || []);
      if (custData.success) setCustomerName(custData.data?.company_name || custData.data?.full_name || '');
    }).finally(() => setLoading(false));
  }, [customerId]);

  const handleSendRequest = async () => {
    const validDocs = reqDocs.filter(d => d.description.trim());
    if (!reqTitle || validDocs.length === 0) {
      showMsg('error', t('errorTitleAndDocsRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/documents/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
          title: reqTitle,
          message: reqMessage || t('defaultRequestMessage'),
          requiredDocuments: validDocs,
          sendWhatsapp,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('success', data.message || t('requestSentSuccess'));
        setShowRequestForm(false);
        setReqTitle('');
        setReqMessage('');
        setReqDocs([{ type: '', description: '', priority: 'MEDIUM' }]);
        // Refresh
        const reqRes = await fetch(`/api/documents/requests?customerId=${customerId}`);
        const reqData = await reqRes.json();
        if (reqData.success) setRequests(reqData.data || []);
      } else {
        showMsg('error', data.error || t('sendFailed'));
      }
    } catch {
      showMsg('error', t('serverError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!customerId) {
    return (
      <div className="container mx-auto py-16 px-4 max-w-md text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <p className="text-sm text-gray-600">{t('noCustomerIdMessage')}</p>
        <a href={`/${locale}/operator/queue`} className="text-blue-600 hover:underline text-xs mt-2 block">
          {t('goToQueue')}
        </a>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  const ocrCompleted = documents.filter(d => d.ocr_status === 'COMPLETED').length;
  const pendingRequests = requests.filter(r => r.status === 'PENDING').length;
  const activeQueue = queueItems.filter(q => !['COMPLETED', 'FAILED'].includes(q.status));

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Eye className="h-6 w-6 text-blue-600" />
          {t('pageTitle')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          <b>{customerName}</b> — {t('pageSubtitle')}
        </p>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card className="border-0 shadow-sm"><CardContent className="p-3">
          <p className="text-[10px] text-gray-500">{t('uploadedDocs')}</p>
          <p className="text-xl font-bold">{documents.length}{t('countSuffix')}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm border-l-4 border-l-green-500"><CardContent className="p-3">
          <p className="text-[10px] text-green-600">{t('ocrCompleted')}</p>
          <p className="text-xl font-bold text-green-700">{ocrCompleted}{t('countSuffix')}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm border-l-4 border-l-amber-500"><CardContent className="p-3">
          <p className="text-[10px] text-amber-600">{t('pendingRequests')}</p>
          <p className="text-xl font-bold text-amber-700">{pendingRequests}{t('countSuffix')}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm border-l-4 border-l-blue-500"><CardContent className="p-3">
          <p className="text-[10px] text-blue-600">{t('activeQueue')}</p>
          <p className="text-xl font-bold text-blue-700">{activeQueue.length}{t('countSuffix')}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="documents">
        <TabsList className="mb-4">
          <TabsTrigger value="documents"><FileText className="h-3 w-3 mr-1" />{t('tabDocuments')} ({documents.length})</TabsTrigger>
          <TabsTrigger value="requests"><MessageCircle className="h-3 w-3 mr-1" />{t('tabRequests')} ({requests.length})</TabsTrigger>
          <TabsTrigger value="queue"><ClipboardList className="h-3 w-3 mr-1" />{t('tabQueue')} ({queueItems.length})</TabsTrigger>
        </TabsList>

        {/* Tab: Documents */}
        <TabsContent value="documents">
          <Card><CardContent className="p-4">
            {documents.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">{t('noDocuments')}</p>
            ) : (
              <div className="space-y-2">
                {documents.map(doc => (
                  <div key={doc.id} className="p-3 rounded-lg border hover:border-gray-300">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="text-[9px] bg-indigo-100 text-indigo-700">{doc.document_type}</Badge>
                          <Badge className={
                            doc.ocr_status === 'COMPLETED' ? 'text-[9px] bg-green-100 text-green-700' :
                            doc.ocr_status === 'PROCESSING' ? 'text-[9px] bg-blue-100 text-blue-700' :
                            'text-[9px] bg-gray-100 text-gray-600'
                          }>{doc.ocr_status}</Badge>
                          <span className="text-xs text-gray-500 truncate">{doc.file_name}</span>
                          <span className="text-[10px] text-gray-400">{doc.created_at?.substring(0, 10)}</span>
                        </div>
                        {doc.ocr_status === 'COMPLETED' && doc.ocr_result?.extractedData && (
                          <div className="mt-1 bg-green-50 rounded p-2 text-[11px] grid grid-cols-2 md:grid-cols-4 gap-1">
                            {Object.entries(doc.ocr_result.extractedData).slice(0, 8).map(([k, v]) => (
                              <div key={k}>
                                <span className="text-gray-500">{k}: </span>
                                <span className="font-mono">{typeof v === 'number' ? fmtRp(v) : String(v || '-')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {doc.file_url && (
                        <a href={doc.file_url} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="ghost"><Eye className="h-3 w-3" /></Button>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* Tab: Document Requests */}
        <TabsContent value="requests">
          <Card><CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">{t('requestHistory')}</h3>
              <Button size="sm" onClick={() => setShowRequestForm(!showRequestForm)}>
                {showRequestForm ? <X className="h-3 w-3 mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                {showRequestForm ? t('close') : t('requestAdditionalDocs')}
              </Button>
            </div>

            {/* Request form */}
            {showRequestForm && (
              <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <p className="text-xs font-bold text-blue-900">
                    {t('requestFormDescription')}
                  </p>
                </div>
                <div>
                  <Label className="text-xs">{t('requestTitle')}</Label>
                  <Input value={reqTitle} onChange={e => setReqTitle(e.target.value)}
                    placeholder={t('requestTitlePlaceholder')} />
                </div>
                <div>
                  <Label className="text-xs">{t('messageLabel')}</Label>
                  <Input value={reqMessage} onChange={e => setReqMessage(e.target.value)}
                    placeholder={t('messagePlaceholder')} />
                </div>
                <div>
                  <Label className="text-xs">{t('requiredDocuments')} ({reqDocs.length}{t('countSuffix')})</Label>
                  {reqDocs.map((rd, i) => (
                    <div key={i} className="flex gap-2 mt-1">
                      <select value={rd.type} onChange={e => {
                        const next = [...reqDocs]; next[i] = { ...next[i], type: e.target.value }; setReqDocs(next);
                      }} className="h-8 px-2 border rounded text-xs w-32">
                        <option value="">{t('docTypeLabel')}</option>
                        <option value="INVOICE">{t('docTypeInvoice')}</option>
                        <option value="RECEIPT">{t('docTypeReceipt')}</option>
                        <option value="FAKTUR_PAJAK">Faktur Pajak</option>
                        <option value="BANK_STATEMENT">{t('docTypeBankStatement')}</option>
                        <option value="SALARY_SLIP">{t('docTypeSalarySlip')}</option>
                        <option value="OTHER">{t('docTypeOther')}</option>
                      </select>
                      <Input className="h-8 text-xs flex-1" value={rd.description}
                        onChange={e => { const next = [...reqDocs]; next[i] = { ...next[i], description: e.target.value }; setReqDocs(next); }}
                        placeholder={t('docDescriptionPlaceholder')} />
                      <select value={rd.priority} onChange={e => {
                        const next = [...reqDocs]; next[i] = { ...next[i], priority: e.target.value }; setReqDocs(next);
                      }} className="h-8 px-2 border rounded text-xs w-20">
                        <option value="HIGH">{t('priorityHigh')}</option>
                        <option value="MEDIUM">{t('priorityMedium')}</option>
                        <option value="LOW">{t('priorityLow')}</option>
                      </select>
                      {reqDocs.length > 1 && (
                        <Button size="sm" variant="ghost" onClick={() => setReqDocs(reqDocs.filter((_, j) => j !== i))}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button size="sm" variant="outline" className="mt-1" onClick={() => setReqDocs([...reqDocs, { type: '', description: '', priority: 'MEDIUM' }])}>
                    <Plus className="h-3 w-3 mr-1" />{t('addDocument')}
                  </Button>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={sendWhatsapp} onChange={e => setSendWhatsapp(e.target.checked)} className="accent-blue-600" />
                  {t('sendViaWhatsapp')}
                </label>
                <Button onClick={handleSendRequest} disabled={submitting}>
                  {submitting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                  {t('sendRequest')}
                </Button>
              </div>
            )}

            {requests.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">{t('noRequests')}</p>
            ) : (
              <div className="space-y-2">
                {requests.map(req => (
                  <div key={req.id} className="p-3 rounded-lg border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{req.title}</span>
                      <Badge className={req.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : req.status === 'FULFILLED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                        {req.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500">{req.message}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {req.required_documents.map((rd, i) => (
                        <Badge key={i} className={rd.priority === 'HIGH' ? 'text-[8px] bg-red-100 text-red-700' : 'text-[8px] bg-gray-100 text-gray-600'}>
                          {rd.description}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{req.created_at?.substring(0, 16)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* Tab: Queue items — each row has an inline "🚩 AI 플래그" toggle */}
        <TabsContent value="queue">
          <Card><CardContent className="p-4">
            {queueItems.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">{t('noQueueItems')}</p>
            ) : (
              <div className="space-y-2">
                {queueItems.map(q => (
                  <QueueRowWithFlagPanel
                    key={q.id}
                    queueItem={q}
                  />
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Queue row that expands to reveal the FlagFieldsPanel so the operator
 * can write red-bordered field flags that surface on the customer's
 * /tax/billing page (keynote slide-21).
 */
function QueueRowWithFlagPanel({ queueItem }: { queueItem: QueueItem }) {
  const [open, setOpen] = useState(false);
  const isDataReview = queueItem.status === 'DATA_REVIEW';

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <Badge className="bg-indigo-100 text-indigo-700 text-[10px]">{queueItem.tax_type}</Badge>
          <span className="text-sm">{queueItem.tax_period_year}-{String(queueItem.tax_period_month).padStart(2, '0')}</span>
          {queueItem.amount > 0 && (
            <span className="text-xs font-mono text-gray-500">{fmtRp(queueItem.amount)}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isDataReview && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">
              고객 수정 대기
            </span>
          )}
          <Badge className="text-[9px]">{queueItem.status}</Badge>
          <span className="text-[10px] text-gray-400">{open ? '−' : '+'}</span>
        </div>
      </button>
      {open && (
        <div className="border-t p-3">
          <FlagFieldsPanel queueItemId={queueItem.id} />
        </div>
      )}
    </div>
  );
}
