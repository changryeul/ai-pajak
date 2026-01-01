import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { WorkflowRepository } from '../repository/repositories/workflow.repository';
import { TaxCaseRepository } from '../repository/repositories/taxcase.repository';
import { TaxFilingRepository } from '../repository/repositories/tax-filing.repository';
import { AuditLogRepository } from '../repository/repositories/audit-log.repository';

import { WorkflowStage, FilingStatus } from '@prisma/client';

@Injectable()
export class FilingService {
  constructor(
    private readonly workflowRepo: WorkflowRepository,
    private readonly taxCaseRepo: TaxCaseRepository,
    private readonly taxFilingRepo: TaxFilingRepository,
    private readonly auditLogRepo: AuditLogRepository,
  ) {}

  // =====================================================
  // 1️⃣ 신고 실행 (APPROVED → FILED)
  // =====================================================
  async fileTaxCase(
    taxCaseId: bigint,
    userId: bigint,
    submissionRef?: string,
  ) {
    // -------------------------------------------------
    // 1. TaxCase 존재 확인
    // -------------------------------------------------
    const taxCase = await this.taxCaseRepo.findById(taxCaseId);
    if (!taxCase) {
      throw new NotFoundException('TaxCase not found');
    }

    // -------------------------------------------------
    // 2. Workflow 단계 확인
    // -------------------------------------------------
    const stage = await this.workflowRepo.getStage(taxCaseId);

    if (stage !== WorkflowStage.APPROVED) {
      throw new BadRequestException(
        `TaxCase must be APPROVED before filing. Current stage: ${stage}`,
      );
    }

    // -------------------------------------------------
    // 3. Filing 기록 생성
    // -------------------------------------------------
    await this.taxFilingRepo.create({
      taxCaseId,
      filingStatus: FilingStatus.SUBMITTED,
      filedBy: userId,
      filedAt: new Date(),
      submissionRef,
    });

    // -------------------------------------------------
    // 4. Workflow 단계 FILED 로 이동
    // -------------------------------------------------
    await this.workflowRepo.moveToStage(
      taxCaseId,
      WorkflowStage.FILED,
    );

    // -------------------------------------------------
    // 5. Audit Log 기록 (⚠️ taxCaseId 필수)
    // -------------------------------------------------
    await this.auditLogRepo.create({
      taxCaseId,                 // ✅ 반드시 포함
     // entityType: 'TAX_CASE',
      // entityId: taxCaseId,
      action: 'FILED',
      actorId: userId,
    });

    return { ok: true };
  }
}