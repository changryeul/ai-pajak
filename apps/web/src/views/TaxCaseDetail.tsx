// src/views/TaxCaseDetail.tsx
import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge, Button, Card, Input, Label } from '../components/ui';

type WorkflowStage = 'UPLOADED' | 'AI_ANALYZED' | 'HUMAN_REVIEW' | 'APPROVED' | 'FILED';

type TaxCaseView = {
  id: number;
  companyId: number;
  companyName: string;
  taxType: string;
  period: string;
  stage: WorkflowStage;
  aiResult?: { suggestedTax: string; confidence: number };
  humanReview?: { finalTax: string; reviewer: string; reason?: string };
  filings?: { status: 'SUBMITTED' | 'ACCEPTED' | 'REJECTED'; submissionRef?: string }[];
};

function stageColor(stage: WorkflowStage) {
  switch (stage) {
    case 'UPLOADED':
      return 'bg-slate-100 text-slate-700';
    case 'AI_ANALYZED':
      return 'bg-blue-100 text-blue-700';
    case 'HUMAN_REVIEW':
      return 'bg-amber-100 text-amber-800';
    case 'APPROVED':
      return 'bg-emerald-100 text-emerald-800';
    case 'FILED':
      return 'bg-purple-100 text-purple-800';
  }
}

function mockTaxCase(id: number): TaxCaseView {
  // id에 따라 stage만 바꿔서 화면 테스트가 쉽게
  const stages: WorkflowStage[] = ['UPLOADED', 'AI_ANALYZED', 'HUMAN_REVIEW', 'APPROVED', 'FILED'];
  const stage = stages[(id - 1) % stages.length];

  const base: TaxCaseView = {
    id,
    companyId: 1,
    companyName: 'PT SAMPLE COMPANY',
    taxType: 'VAT',
    period: '2024-12',
    stage,
  };

  if (stage !== 'UPLOADED') {
    base.aiResult = { suggestedTax: '12500000', confidence: 0.82 };
  }
  if (stage === 'HUMAN_REVIEW' || stage === 'APPROVED' || stage === 'FILED') {
    base.humanReview = { finalTax: '12000000', reviewer: 'Consultant #2', reason: 'Invoice mismatch fixed' };
  }
  if (stage === 'FILED') {
    base.filings = [{ status: 'ACCEPTED', submissionRef: 'DJP-REF-2025-000123' }];
  }
  return base;
}

function actionsByStage(stage: WorkflowStage) {
  return {
    canApplyAI: stage === 'UPLOADED',
    canMoveToReview: stage === 'AI_ANALYZED',
    canApprove: stage === 'HUMAN_REVIEW',
    canFile: stage === 'APPROVED',
  };
}

export default function TaxCaseDetail() {
  const { id } = useParams();
  const taxCaseId = Number(id || '1');

  // ✅ 지금은 API 없이 mock로 고정
  const [data, setData] = useState<TaxCaseView>(() => mockTaxCase(taxCaseId));

  const actions = useMemo(() => actionsByStage(data.stage), [data.stage]);

  // form states (UI 고정 목적)
  const [suggestedTax, setSuggestedTax] = useState('12500000');
  const [confidence, setConfidence] = useState('0.82');

  const [finalTax, setFinalTax] = useState('12000000');
  const [reason, setReason] = useState('Manual adjustment');

  // ✅ stage 전이(지금은 화면만)
  const applyAI = () => {
    setData((prev) => ({
      ...prev,
      stage: 'AI_ANALYZED',
      aiResult: { suggestedTax, confidence: Number(confidence) || 0 },
    }));
  };

  const moveToReview = () => {
    setData((prev) => ({ ...prev, stage: 'HUMAN_REVIEW' }));
  };

  const approve = () => {
    setData((prev) => ({
      ...prev,
      stage: 'APPROVED',
      humanReview: { finalTax, reviewer: 'You', reason },
    }));
  };

  const fileTax = () => {
    setData((prev) => ({
      ...prev,
      stage: 'FILED',
      filings: [{ status: 'ACCEPTED', submissionRef: 'DJP-REF-LOCAL-MOCK' }],
    }));
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Tax Case #{data.id}</h1>
          <div className="text-sm text-slate-600 mt-1">
            {data.companyName} · {data.taxType} · {data.period}
          </div>
        </div>
        <Badge className={stageColor(data.stage)}>{data.stage}</Badge>
      </div>

      <Card>
        <h2 className="text-lg font-bold mb-3">Current Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div><b>Company ID:</b> {data.companyId}</div>
          <div><b>Tax Type:</b> {data.taxType}</div>
          <div><b>Period:</b> {data.period}</div>
          <div><b>Stage:</b> {data.stage}</div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-bold mb-4">AI Result</h2>

          {data.aiResult ? (
            <div className="space-y-2 text-sm">
              <div><b>Suggested Tax:</b> {data.aiResult.suggestedTax}</div>
              <div><b>Confidence:</b> {data.aiResult.confidence}</div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">No AI result yet.</div>
          )}

          <div className="mt-5 space-y-3">
            <div>
              <Label>suggestedTax</Label>
              <Input value={suggestedTax} onChange={(e) => setSuggestedTax(e.target.value)} />
            </div>
            <div>
              <Label>confidence (0~1)</Label>
              <Input value={confidence} onChange={(e) => setConfidence(e.target.value)} />
            </div>

            <Button
              onClick={applyAI}
              disabled={!actions.canApplyAI}
              className="w-full"
            >
              Apply AI Result
            </Button>

            <Button
              variant="outline"
              onClick={moveToReview}
              disabled={!actions.canMoveToReview}
              className="w-full"
            >
              Move To Human Review
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-bold mb-4">Human Review / Approval</h2>

          {data.humanReview ? (
            <div className="space-y-2 text-sm">
              <div><b>Final Tax:</b> {data.humanReview.finalTax}</div>
              <div><b>Reviewer:</b> {data.humanReview.reviewer}</div>
              {data.humanReview.reason && <div><b>Reason:</b> {data.humanReview.reason}</div>}
            </div>
          ) : (
            <div className="text-sm text-slate-500">No human review yet.</div>
          )}

          <div className="mt-5 space-y-3">
            <div>
              <Label>finalTax</Label>
              <Input value={finalTax} onChange={(e) => setFinalTax(e.target.value)} />
            </div>
            <div>
              <Label>reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>

            <Button
              onClick={approve}
              disabled={!actions.canApprove}
              className="w-full"
            >
              Approve
            </Button>

            <Button
              variant="outline"
              onClick={fileTax}
              disabled={!actions.canFile}
              className="w-full"
            >
              File Tax Case
            </Button>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-bold mb-3">Filing</h2>
        {data.filings?.length ? (
          <div className="space-y-2 text-sm">
            {data.filings.map((f, idx) => (
              <div key={idx} className="flex justify-between">
                <span>{f.status}</span>
                <span className="text-slate-600">{f.submissionRef || '-'}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500">No filing record.</div>
        )}
      </Card>
    </div>
  );
}