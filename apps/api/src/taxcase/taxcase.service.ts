import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TaxType, WorkflowStage } from '@prisma/client';

import { TaxCaseRepository } from '../repository/repositories/taxcase.repository';
import { CompanyRepository } from '../repository/repositories/company.repository';
import { WorkflowRepository } from '../repository/repositories/workflow.repository';
import { AIResultRepository } from '../repository/repositories/ai-result.repository';
import { HumanReviewRepository } from '../repository/repositories/human-review.repository';
import { AuditLogRepository } from '../repository/repositories/audit-log.repository';

import { ApplyAIResultDto } from './dto/apply-ai-result.dto';
import { getWorkflowActions } from './utils/workflow-actions';

@Injectable()
export class ReviewWorkflowService {
  constructor(
    private readonly taxCaseRepo: TaxCaseRepository,
    private readonly companyRepo: CompanyRepository,
    private readonly workflowRepo: WorkflowRepository,
    private readonly aiResultRepo: AIResultRepository,
    private readonly humanReviewRepo: HumanReviewRepository,
    private readonly auditLogRepo: AuditLogRepository,
  ) {}

  // =====================================================
  // 1️⃣ TaxCase 생성 (UPLOADED)
  // =====================================================
  async createTaxCase(
    companyId: bigint,
    taxType: string,
    period: string,
    userId: bigint,
  ) {
    const company = await this.companyRepo.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // string → Prisma enum 변환
    const taxTypeEnum =
      TaxType[taxType as keyof typeof TaxType];

    if (!taxTypeEnum) {
      throw new BadRequestException(`Invalid taxType: ${taxType}`);
    }

    const taxCase = await this.taxCaseRepo.create({
      companyId,
      taxType: taxTypeEnum,
      period,
      status: 'OPEN',
    });

    // Workflow 초기화
    await this.workflowRepo.init(taxCase.id);

    // Audit log
    await this.auditLogRepo.create({
      taxCaseId: taxCase.id,
      action: 'CREATE_TAX_CASE',
      actorId: userId,
    });

    return {
      id: taxCase.id.toString(),
      stage: WorkflowStage.UPLOADED,
    };
  }

  // =====================================================
  // 2️⃣ AI 결과 반영
  // =====================================================
  async applyAIResult(
    taxCaseId: bigint,
    userId: bigint,
    input: ApplyAIResultDto,
  ) {
    if (input.confidence === undefined) {
      throw new BadRequestException('confidence is required');
    }

    await this.aiResultRepo.create({
      taxCaseId,
      suggestedTax: input.suggestedTax,
      confidence: input.confidence,
      rawResponse: input.rawResponse ?? {},
    });

    await this.workflowRepo.moveToStage(
      taxCaseId,
      WorkflowStage.AI_ANALYZED,
    );

    await this.auditLogRepo.create({
      taxCaseId,
      action: 'APPLY_AI_RESULT',
      actorId: userId,
    });

    return { ok: true };
  }

  // =====================================================
  // 3️⃣ 사람 검토 단계 이동
  // =====================================================
  async moveToHumanReview(
    taxCaseId: bigint,
    reviewerId: bigint,
  ) {
    const taxCase = await this.taxCaseRepo.findById(taxCaseId);
    if (!taxCase) {
      throw new NotFoundException('TaxCase not found');
    }

    await this.workflowRepo.moveToStage(
      taxCaseId,
      WorkflowStage.HUMAN_REVIEW,
    );

    await this.auditLogRepo.create({
      taxCaseId,
      action: 'MOVE_TO_HUMAN_REVIEW',
      actorId: reviewerId,
    });

    return { ok: true };
  }

  // =====================================================
  // 4️⃣ AI 결과 Override (사람 판단)
  // =====================================================
  async overrideAIResult(input: {
    taxCaseId: bigint;
    reviewerId: bigint;
    finalTax: string;
    reason: string;
  }) {
    const taxCase = await this.taxCaseRepo.findById(input.taxCaseId);
    if (!taxCase) {
      throw new NotFoundException('TaxCase not found');
    }

    await this.humanReviewRepo.create({
      taxCaseId: input.taxCaseId,
      reviewerId: input.reviewerId,
      finalTax: input.finalTax,
      reason: input.reason,
    });

    await this.workflowRepo.moveToStage(
      input.taxCaseId,
      WorkflowStage.APPROVED,
    );

    await this.auditLogRepo.create({
      taxCaseId: input.taxCaseId,
      action: 'OVERRIDE_AI_RESULT',
      actorId: input.reviewerId,
    });

    return { ok: true };
  }

  // =====================================================
  // 5️⃣ 최종 승인
  // =====================================================
  async approveReview(
    taxCaseId: bigint,
    approverId: bigint,
  ) {
    const stage = await this.workflowRepo.getStage(taxCaseId);

    if (stage !== WorkflowStage.HUMAN_REVIEW) {
      throw new BadRequestException(
        `Cannot approve tax case in stage ${stage}`,
      );
    }

    await this.workflowRepo.moveToStage(
      taxCaseId,
      WorkflowStage.APPROVED,
    );

    await this.auditLogRepo.create({
      taxCaseId,
      action: 'APPROVE_REVIEW',
      actorId: approverId,
    });

    return { ok: true };
  }

  // =====================================================
  // 6️⃣ 전체 TaxCase 목록 조회
  // =====================================================
  async listAllTaxCases() {
    const taxCases = await this.taxCaseRepo.listAll();
    return taxCases.map((tc) => ({
      id: tc.id.toString(),
      companyId: tc.companyId.toString(),
      companyName: tc.company.name,
      taxType: tc.taxType,
      period: tc.period,
      status: tc.status,
      workflowStage: tc.workflow?.stage ?? null,
      createdAt: tc.createdAt,
    }));
  }

  // =====================================================
  // 7️⃣ TaxCase 상세 조회 (UI용)
  // =====================================================
  async getTaxCaseDetail(
    taxCaseId: bigint,
    userId: bigint,
  ) {
    const taxCase = await this.taxCaseRepo.findDetail(taxCaseId);
    if (!taxCase) {
      throw new NotFoundException('TaxCase not found');
    }

    const stage = taxCase.workflow?.stage ?? null;

    return {
      id: taxCase.id.toString(),
      companyId: taxCase.companyId.toString(),
      taxType: taxCase.taxType,
      period: taxCase.period,
      status: taxCase.status,
      workflowStage: stage,
      actions: stage ? getWorkflowActions(stage) : [],
      humanReview: taxCase.reviews?.[0]
        ? {
            id: taxCase.reviews[0].id.toString(),
            reviewerId: taxCase.reviews[0].reviewerId.toString(),
            finalTax: taxCase.reviews[0].finalTax,
            reason: taxCase.reviews[0].reason,
            reviewedAt: taxCase.reviews[0].reviewedAt,
          }
        : null,
      filing: taxCase.filings?.[0]
        ? {
            id: taxCase.filings[0].id.toString(),
            filingStatus: taxCase.filings[0].filingStatus,
            filedAt: taxCase.filings[0].filedAt,
            submissionRef: taxCase.filings[0].submissionRef,
          }
        : null,
      createdAt: taxCase.createdAt,
    };
  }
}