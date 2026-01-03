import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '../components/ui';

import StageBadge from '../components/StageBadge';
import StageActions from '../components/StageActions';
import StageProgress from '../components/StageProgress';
import AuditTimeline from '../components/AuditTimeline';

import { fetchTaxCase, taxCaseAction } from '../api/taxCaseApi';

export default function TaxCaseDetail() {
  const { id } = useParams();
  const [taxCase, setTaxCase] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  /* ===== 최초 로딩 ===== */
  useEffect(() => {
    if (!id) return;

    fetchTaxCase(id)
      .then((data) => {
        console.log('TAX CASE DATA:', data);
        setTaxCase(data);
      })
      .catch(console.error);
  }, [id]);

  /* ===== 상태 액션 ===== */
  const onAction = async (action: string) => {
    if (!id) return;

    setLoading(true);
    try {
      const updated = await taxCaseAction(id, action);
      console.log('UPDATED STAGE:', updated.stage);

      setTaxCase((prev: any) => ({
        ...prev,
        stage: updated.stage,
      }));
    } finally {
      setLoading(false);
    }
  };

  if (!taxCase) {
    return (
      <div className="p-10 text-slate-400">
        Loading tax case…
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-10 space-y-8 text-slate-50">

      {/* ===== Header ===== */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-black">
          Tax Case #{taxCase.id}
        </h1>
        <StageBadge stage={taxCase.workflowStage} />
      </div>

      {/* ===== Progress ===== */}
      <StageProgress stage={taxCase.workflowStage} />

      {/* ===== Summary ===== */}
      <Card className="space-y-2">
        <p><b>Company ID:</b> {taxCase.companyId}</p>
        <p><b>Tax Type:</b> {taxCase.taxType}</p>
        <p><b>Period:</b> {taxCase.period}</p>
        <p><b>Status:</b> {taxCase.status}</p>
      </Card>

      {/* ===== AI Result ===== */}
      {taxCase.aiResult && (
        <Card className="space-y-2">
          <h3 className="font-semibold">AI Result</h3>
          <p>Suggested Tax: {taxCase.aiResult.suggestedTax}</p>
          <p>Confidence: {taxCase.aiResult.confidence}%</p>
        </Card>
      )}

      {/* ===== Actions ===== */}
      <Card>
       
          <StageActions
        stage={taxCase.workflowStage}   // 🔥 여기
        loading={loading}
        onAction={onAction}
      />
      </Card>

      {/* ===== Audit Timeline ===== */}
      <AuditTimeline logs={taxCase.auditLogs} />

    </div>
  );
}