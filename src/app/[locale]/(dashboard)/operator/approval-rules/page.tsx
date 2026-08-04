'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Settings2,
  Loader2,
  RefreshCw,
  Save,
  Zap,
  Shield,
  CheckCircle,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';

interface ApprovalRule {
  id: string;
  name: string;
  is_active: boolean;
  min_ocr_confidence: number;
  max_risk_score: number;
  min_compliance_score: number;
  min_validation_score: number;
  min_trust_score: number;
  max_auto_approve_amount: number;
}

interface Statistics {
  totalProcessed: number;
  autoApproved: number;
  pendingManualReview: number;
  autoApprovalRate: number;
}

export default function ApprovalRulesPage() {
  const t = useTranslations('operator');
  const [_rule, setRule] = useState<ApprovalRule | null>(null);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Editable form state
  const [form, setForm] = useState({
    minOcrConfidence: 0.85,
    maxRiskScore: 30,
    minComplianceScore: 75,
    minValidationScore: 85,
    minTrustScore: 70,
    maxAutoApproveAmount: 10000000,
    isActive: true,
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/operator/approval-rules');
      const json = await res.json();
      if (json.success) {
        if (json.data.rule) {
          setRule(json.data.rule);
          setForm({
            minOcrConfidence: json.data.rule.min_ocr_confidence,
            maxRiskScore: json.data.rule.max_risk_score,
            minComplianceScore: json.data.rule.min_compliance_score,
            minValidationScore: json.data.rule.min_validation_score,
            minTrustScore: json.data.rule.min_trust_score,
            maxAutoApproveAmount: json.data.rule.max_auto_approve_amount,
            isActive: json.data.rule.is_active,
          });
        }
        setStats(json.data.statistics);
      }
    } catch {
      setMessage({ type: 'error', text: t('networkError') });
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/operator/approval-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: t('statusUpdated') });
        setRule(json.data);
      } else {
        setMessage({ type: 'error', text: json.error || t('errorOccurred') });
      }
    } catch {
      setMessage({ type: 'error', text: t('networkError') });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        <span className="ml-2 text-gray-500">{t('loadingData')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-amber-200 text-sm flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              {t('approvalRulesTitle')}
            </p>
            <h1 className="text-2xl font-bold mt-1">{t('approvalRulesSubtitle')}</h1>
          </div>
          <Button variant="outline" className="text-white border-white/30 hover:bg-white/10" onClick={loadData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-xs text-amber-200">{t('totalProcessed')}</p>
              <p className="text-2xl font-bold">{stats.totalProcessed}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-xs text-amber-200">{t('autoApprovedCount')}</p>
              <p className="text-2xl font-bold">{stats.autoApproved}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-xs text-amber-200">{t('autoApprovalRate')}</p>
              <p className="text-2xl font-bold">{stats.autoApprovalRate}%</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-xs text-amber-200">{t('pendingApprovals')}</p>
              <p className="text-2xl font-bold">{stats.pendingManualReview}</p>
            </div>
          </div>
        )}
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Status Toggle */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className={`h-6 w-6 ${form.isActive ? 'text-amber-500' : 'text-gray-400'}`} />
              <div>
                <p className="font-medium">{t('autoApprovalEngine')}</p>
                <p className="text-sm text-gray-500">{t('autoApprovalEngineDesc')}</p>
              </div>
            </div>
            <Button
              variant={form.isActive ? 'default' : 'outline'}
              onClick={() => setForm(prev => ({ ...prev, isActive: !prev.isActive }))}
              className={form.isActive ? 'bg-amber-600 hover:bg-amber-700' : ''}
            >
              {form.isActive ? t('enabled') : t('disabled')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Threshold Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* OCR Confidence */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              {t('ocrConfidenceThreshold')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-500">{t('minimum')} (0.0 - 1.0)</Label>
                <Badge variant="outline">{form.minOcrConfidence}</Badge>
              </div>
              <Input
                type="number"
                min={0} max={1} step={0.05}
                value={form.minOcrConfidence}
                onChange={e => setForm(prev => ({ ...prev, minOcrConfidence: parseFloat(e.target.value) || 0 }))}
              />
              <p className="text-xs text-gray-400">{t('ocrConfidenceDesc')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Risk Score */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              {t('riskScoreThreshold')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-500">{t('maximum')} (0 - 100)</Label>
                <Badge variant="outline">{form.maxRiskScore}</Badge>
              </div>
              <Input
                type="number"
                min={0} max={100} step={5}
                value={form.maxRiskScore}
                onChange={e => setForm(prev => ({ ...prev, maxRiskScore: parseInt(e.target.value) || 0 }))}
              />
              <p className="text-xs text-gray-400">{t('riskScoreDesc')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Score */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              {t('complianceScoreThreshold')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-500">{t('minimum')} (0 - 100)</Label>
                <Badge variant="outline">{form.minComplianceScore}</Badge>
              </div>
              <Input
                type="number"
                min={0} max={100} step={5}
                value={form.minComplianceScore}
                onChange={e => setForm(prev => ({ ...prev, minComplianceScore: parseInt(e.target.value) || 0 }))}
              />
              <p className="text-xs text-gray-400">{t('complianceScoreDesc')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Validation Score */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              {t('validationScoreThreshold')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-500">{t('minimum')} (0 - 100)</Label>
                <Badge variant="outline">{form.minValidationScore}</Badge>
              </div>
              <Input
                type="number"
                min={0} max={100} step={5}
                value={form.minValidationScore}
                onChange={e => setForm(prev => ({ ...prev, minValidationScore: parseInt(e.target.value) || 0 }))}
              />
              <p className="text-xs text-gray-400">{t('validationScoreDesc')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Trust Score */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-teal-500" />
              {t('trustScoreThreshold')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-500">{t('minimum')} (0 - 100)</Label>
                <Badge variant="outline">{form.minTrustScore}</Badge>
              </div>
              <Input
                type="number"
                min={0} max={100} step={5}
                value={form.minTrustScore}
                onChange={e => setForm(prev => ({ ...prev, minTrustScore: parseInt(e.target.value) || 0 }))}
              />
              <p className="text-xs text-gray-400">{t('trustScoreDesc')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Max Amount */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              💰 {t('maxAmountThreshold')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-500">{t('maximum')} (Rp)</Label>
                <Badge variant="outline">Rp {form.maxAutoApproveAmount.toLocaleString('id-ID')}</Badge>
              </div>
              <Input
                type="number"
                min={0} step={1000000}
                value={form.maxAutoApproveAmount}
                onChange={e => setForm(prev => ({ ...prev, maxAutoApproveAmount: parseInt(e.target.value) || 0 }))}
              />
              <p className="text-xs text-gray-400">{t('maxAmountDesc')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} className="bg-amber-600 hover:bg-amber-700">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {t('saveRules')}
        </Button>
      </div>
    </div>
  );
}
