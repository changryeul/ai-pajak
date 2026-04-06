'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSession } from '@/hooks/useSession';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Upload, Camera, Image, FileText, Loader2, CheckCircle, AlertTriangle,
  X, Send, Eye, Trash2, Plus, Sparkles, MessageCircle,
} from 'lucide-react';
import { fmtRp } from '@/lib/utils';

interface UploadedDoc {
  id: string;
  file_name: string;
  document_type: string;
  upload_source: string;
  ocr_status: string;
  ocr_result?: {
    extractedData?: Record<string, unknown>;
    category?: string;
    confidence?: number;
  };
  file_url?: string;
  mime_type: string;
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

const DOC_TYPES = [
  { value: 'INVOICE', label: '인보이스 (Invoice)', desc: '매출/매입 거래 청구서' },
  { value: 'RECEIPT', label: '영수증 (Receipt)', desc: '결제 증빙' },
  { value: 'FAKTUR_PAJAK', label: '팍투르 파작 (Faktur Pajak)', desc: 'PPN 세금계산서' },
  { value: 'BANK_STATEMENT', label: '은행 거래내역', desc: '월별 은행 명세서' },
  { value: 'SALARY_SLIP', label: '급여 명세서', desc: '직원 급여 내역' },
  { value: 'EXPENSE_RECEIPT', label: '경비 영수증', desc: '사업 경비 증빙' },
  { value: 'OTHER', label: '기타 서류', desc: '' },
];

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

export default function DocumentUploadPage() {
  const { session } = useSession();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const isConsultant = session?.role === 'CONSULTANT_JTC' || session?.role === 'TAX_ADVISOR_JTC';
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customers, setCustomers] = useState<Array<{ id: string; full_name: string; company_name?: string }>>([]);

  // Resolve effective customerId: direct for CUSTOMER, selected for consultant
  const effectiveCustomerId = isConsultant ? selectedCustomerId : session?.customerId;

  // Load customer list for consultants
  useEffect(() => {
    if (!isConsultant) return;
    fetch('/api/customers')
      .then(r => r.json())
      .then(d => {
        const list = d.customers || [];
        setCustomers(list);
        if (list.length > 0 && !selectedCustomerId) setSelectedCustomerId(list[0].id);
      })
      .catch(() => {});
  }, [isConsultant]);

  const [period, setPeriod] = useState(`${currentYear}-${String(currentMonth).padStart(2, '0')}`);
  const [docType, setDocType] = useState('INVOICE');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [requests, setRequests] = useState<DocRequest[]>([]);
  const [previewDoc, setPreviewDoc] = useState<UploadedDoc | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [aiReview, setAiReview] = useState<{
    complete: boolean;
    missing: Array<{ type: string; description: string }>;
    suggestions: string[];
  } | null>(null);

  const showMsg = (type: 'success' | 'error' | 'warning', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 7000);
  };

  // Load uploaded documents + pending requests for period
  const loadData = useCallback(async () => {
    if (!effectiveCustomerId) return;
    try {
      const [docsRes, reqRes] = await Promise.all([
        fetch(`/api/documents?customerId=${effectiveCustomerId}&period=${period}`),
        fetch(`/api/documents/requests?customerId=${effectiveCustomerId}&period=${period}`),
      ]);
      const docsData = await docsRes.json();
      const reqData = await reqRes.json();
      if (docsData.success) setDocuments(docsData.data || []);
      if (reqData.success) setRequests(reqData.data || []);
    } catch { /* */ }
  }, [effectiveCustomerId, period]);

  useEffect(() => { loadData(); }, [loadData]);

  // Upload handler (shared for file/photo/camera)
  const handleUpload = async (files: FileList | null, source: string) => {
    if (!files || files.length === 0 || !effectiveCustomerId) return;
    setUploading(true);

    let successCount = 0;
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('customerId', effectiveCustomerId);
      formData.append('documentType', docType);
      formData.append('period', period);
      formData.append('uploadSource', source);

      try {
        const res = await fetch('/api/documents/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
          successCount++;
          // Auto-trigger OCR
          if (data.data?.id) {
            fetch(`/api/documents/${data.data.id}/ocr`, { method: 'POST' }).catch(() => {});
          }
        }
      } catch { /* */ }
    }

    if (successCount > 0) {
      showMsg('success', `${successCount}개 파일 업로드 완료. OCR 처리 중...`);
      // Reload after short delay (OCR needs time)
      setTimeout(loadData, 2000);
    } else {
      showMsg('error', '업로드 실패');
    }
    setUploading(false);
  };

  // Submit for AI review
  const handleSubmit = async () => {
    if (!effectiveCustomerId) return;
    if (documents.length === 0) {
      showMsg('warning', '먼저 자료를 업로드해 주세요');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/documents/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: effectiveCustomerId, period }),
      });
      const data = await res.json();
      if (data.success) {
        setAiReview(data.data.aiResult);
        if (data.data.aiResult?.complete) {
          showMsg('success', '모든 자료가 완비되었습니다! 담당자가 검토 후 처리됩니다.');
        } else {
          showMsg('warning', '부족한 자료가 있습니다. 아래 AI 안내를 확인해 주세요.');
        }
        loadData();
      } else {
        showMsg('error', data.error || '제출 실패');
      }
    } catch {
      showMsg('error', '서버 오류');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete document
  const handleDelete = async (docId: string) => {
    if (!confirm('이 자료를 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
      if (res.ok) loadData();
    } catch { /* */ }
  };

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - 1 - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const ocrComplete = documents.filter(d => d.ocr_status === 'COMPLETED').length;
  const ocrPending = documents.filter(d => d.ocr_status === 'PENDING' || d.ocr_status === 'PROCESSING').length;
  const pendingRequests = requests.filter(r => r.status === 'PENDING');

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Upload className="h-6 w-6 text-blue-600" />
          자료 업로드
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          영수증, 인보이스, 팍투르 파작 등을 업로드하면 AI가 자동으로 데이터를 추출합니다
        </p>
      </div>

      {/* Consultant: customer selector */}
      {isConsultant && (
        <div className="mb-4">
          <Label className="text-xs">고객 선택</Label>
          <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
            <SelectTrigger className="w-72"><SelectValue placeholder="고객을 선택하세요" /></SelectTrigger>
            <SelectContent>
              {customers.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.company_name || c.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Period + Type selector */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div>
          <Label className="text-xs">기간</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">서류 유형</Label>
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
          message.type === 'warning' ? 'bg-amber-50 border border-amber-200 text-amber-800' :
          'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> :
           message.type === 'warning' ? <AlertTriangle className="h-4 w-4" /> :
           <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Pending document requests from AI/operator */}
      {pendingRequests.length > 0 && (
        <div className="mb-4 space-y-2">
          {pendingRequests.map(req => (
            <div key={req.id} className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
              <div className="flex items-start gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm text-blue-900">{req.title}</p>
                  <p className="text-xs text-blue-700 mt-1">{req.message}</p>
                </div>
              </div>
              <div className="ml-6 space-y-1">
                {req.required_documents.map((rd, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <Badge className={rd.priority === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
                      {rd.priority}
                    </Badge>
                    <span className="text-gray-700">{rd.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload zone — 3 methods */}
      <Card className="mb-4 border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* File upload */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex flex-col items-center gap-3 p-6 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
            >
              <Upload className="h-8 w-8 text-blue-600" />
              <div className="text-center">
                <p className="font-medium text-sm text-blue-900">파일 업로드</p>
                <p className="text-[11px] text-blue-600">PDF, 이미지, Excel</p>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.xlsx,.xls,.csv"
              multiple
              onChange={e => handleUpload(e.target.files, 'FILE')}
            />

            {/* Photo from gallery */}
            <button
              type="button"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.multiple = true;
                input.onchange = (e) => handleUpload((e.target as HTMLInputElement).files, 'PHOTO');
                input.click();
              }}
              disabled={uploading}
              className="flex flex-col items-center gap-3 p-6 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <Image className="h-8 w-8 text-emerald-600" />
              <div className="text-center">
                <p className="font-medium text-sm text-emerald-900">사진 업로드</p>
                <p className="text-[11px] text-emerald-600">갤러리에서 선택</p>
              </div>
            </button>

            {/* Camera capture */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
              className="flex flex-col items-center gap-3 p-6 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer"
            >
              <Camera className="h-8 w-8 text-amber-600" />
              <div className="text-center">
                <p className="font-medium text-sm text-amber-900">사진 찍기</p>
                <p className="text-[11px] text-amber-600">카메라로 촬영 (모바일)</p>
              </div>
            </button>
            <input
              ref={cameraInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              capture="environment"
              onChange={e => handleUpload(e.target.files, 'CAMERA')}
            />
          </div>

          {uploading && (
            <div className="text-center mt-4">
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-blue-600" />
              <p className="text-xs text-gray-500 mt-1">업로드 + OCR 처리 중...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload summary */}
      {documents.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-xl border p-3 text-center">
            <p className="text-xs text-gray-500">총 업로드</p>
            <p className="text-xl font-bold">{documents.length}</p>
          </div>
          <div className="bg-white rounded-xl border p-3 text-center">
            <p className="text-xs text-green-600">OCR 완료</p>
            <p className="text-xl font-bold text-green-700">{ocrComplete}</p>
          </div>
          <div className="bg-white rounded-xl border p-3 text-center">
            <p className="text-xs text-amber-600">처리 대기</p>
            <p className="text-xl font-bold text-amber-700">{ocrPending}</p>
          </div>
        </div>
      )}

      {/* Uploaded documents list with OCR results */}
      {documents.length > 0 && (
        <Card className="mb-4">
          <CardContent className="p-5">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              업로드된 자료 ({documents.length}건)
            </h3>
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className="p-3 rounded-lg border hover:border-gray-300 transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="text-[9px] bg-indigo-100 text-indigo-700">{doc.document_type}</Badge>
                        <Badge className={
                          doc.ocr_status === 'COMPLETED' ? 'text-[9px] bg-green-100 text-green-700' :
                          doc.ocr_status === 'PROCESSING' ? 'text-[9px] bg-blue-100 text-blue-700' :
                          doc.ocr_status === 'FAILED' ? 'text-[9px] bg-red-100 text-red-700' :
                          'text-[9px] bg-gray-100 text-gray-600'
                        }>
                          {doc.ocr_status === 'COMPLETED' ? 'OCR 완료' :
                           doc.ocr_status === 'PROCESSING' ? 'OCR 처리중' :
                           doc.ocr_status === 'FAILED' ? 'OCR 실패' : 'OCR 대기'}
                        </Badge>
                        <Badge className="text-[9px] bg-gray-100 text-gray-600">{doc.upload_source}</Badge>
                        <span className="text-[10px] text-gray-400">{doc.file_name}</span>
                      </div>

                      {/* OCR extracted data preview */}
                      {doc.ocr_status === 'COMPLETED' && doc.ocr_result?.extractedData && (
                        <div className="mt-2 bg-green-50 rounded-lg p-2 text-xs space-y-1">
                          <p className="font-medium text-green-800 flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />AI 추출 결과
                            {doc.ocr_result.confidence && (
                              <span className="text-[10px] text-green-600">
                                (신뢰도 {(doc.ocr_result.confidence * 100).toFixed(0)}%)
                              </span>
                            )}
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-[11px]">
                            {Object.entries(doc.ocr_result.extractedData).slice(0, 8).map(([key, val]) => (
                              <div key={key}>
                                <span className="text-gray-500">{key}: </span>
                                <span className="font-mono text-gray-800">
                                  {typeof val === 'number' ? fmtRp(val) : String(val || '-')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      {doc.file_url && (
                        <Button size="sm" variant="ghost" onClick={() => setPreviewDoc(doc)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(doc.id)}>
                        <Trash2 className="h-3 w-3 text-red-400" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI review result */}
      {aiReview && (
        <Card className={`mb-4 border-l-4 ${aiReview.complete ? 'border-l-green-500' : 'border-l-amber-500'}`}>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Sparkles className={`h-5 w-5 flex-shrink-0 ${aiReview.complete ? 'text-green-600' : 'text-amber-600'}`} />
              <div className="flex-1">
                <p className={`font-bold text-sm ${aiReview.complete ? 'text-green-900' : 'text-amber-900'}`}>
                  {aiReview.complete ? '자료 검토 완료' : '추가 자료가 필요합니다'}
                </p>
                {!aiReview.complete && aiReview.missing.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {aiReview.missing.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-amber-800">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        <span><b>{m.type}</b> — {m.description}</span>
                      </div>
                    ))}
                  </div>
                )}
                {aiReview.suggestions.length > 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    <p className="font-medium">제안:</p>
                    {aiReview.suggestions.map((s, i) => <p key={i}>· {s}</p>)}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit button */}
      <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={submitting || documents.length === 0} className="flex-1">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          {period} 자료 제출 (AI 검증)
        </Button>
      </div>

      {/* Preview modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewDoc(null)}>
          <div className="bg-white rounded-xl max-w-3xl max-h-[80vh] w-full overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold">{previewDoc.file_name}</h3>
              <Button variant="ghost" size="sm" onClick={() => setPreviewDoc(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              {previewDoc.mime_type?.startsWith('image/') ? (
                <img src={previewDoc.file_url!} alt={previewDoc.file_name} className="max-w-full mx-auto rounded" />
              ) : previewDoc.mime_type === 'application/pdf' ? (
                <iframe src={previewDoc.file_url!} className="w-full h-[60vh] rounded" />
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">미리보기를 지원하지 않는 형식입니다</p>
              )}

              {/* OCR data below preview */}
              {previewDoc.ocr_status === 'COMPLETED' && previewDoc.ocr_result?.extractedData && (
                <div className="mt-4 bg-green-50 rounded-lg p-4">
                  <p className="font-bold text-sm text-green-800 mb-2">AI 추출 데이터</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(previewDoc.ocr_result.extractedData).map(([key, val]) => (
                      <div key={key} className="flex justify-between bg-white p-2 rounded">
                        <span className="text-gray-500">{key}</span>
                        <span className="font-mono text-gray-900">
                          {typeof val === 'number' ? fmtRp(val) : String(val || '-')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
