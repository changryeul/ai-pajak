// ===================== taxcase/query.service.ts =====================
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class TaxCaseQueryService {
  constructor(private readonly prisma: PrismaClient) {}

  // 단일 TaxCase Overview (UI 메인 화면)
  async getOverview(taxCaseId: bigint) {
    const taxCase = await this.prisma.taxCase.findUnique({
      where: { id: taxCaseId },
      include: {
        workflow: true,
        aiResults: { orderBy: { createdAt: 'desc' }, take: 1 },
        reviews: { orderBy: { reviewedAt: 'desc' }, take: 1 },
        filings: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!taxCase) return null;

    const workflowStage = taxCase.workflow?.stage;

    return {
      taxCase: {
        id: taxCase.id,
        taxType: taxCase.taxType,
        period: taxCase.period,
        status: taxCase.status,
      },
      workflow: {
        stage: workflowStage,
      },
      aiResult: taxCase.aiResults[0] ?? null,
      humanReview: taxCase.reviews[0] ?? null,
      filings: taxCase.filings,
      uiFlags: {
        canReview: workflowStage === 'AI_ANALYZED',
        canApprove: workflowStage === 'HUMAN_REVIEW',
        canFile: workflowStage === 'APPROVED',
      },
    };
  }

  // 타임라인 (감사용 / 화면 표시)
  async getTimeline(taxCaseId: bigint) {
    const audits = await this.prisma.auditLog.findMany({
      where: { taxCaseId },
      orderBy: { createdAt: 'asc' },
    });

    return audits.map(a => ({
      action: a.action,
      actorId: a.actorId,
      at: a.createdAt,
    }));
  }

  // 회사별 TaxCase 목록
  async listByCompany(companyId: bigint) {
    const cases = await this.prisma.taxCase.findMany({
      where: { companyId },
      include: { workflow: true },
      orderBy: { createdAt: 'desc' },
    });

    return cases.map(c => ({
      id: c.id,
      taxType: c.taxType,
      period: c.period,
      stage: c.workflow?.stage,
      createdAt: c.createdAt,
    }));
  }
}