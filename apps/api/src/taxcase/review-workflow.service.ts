
import { Injectable } from '@nestjs/common';
import { TaxCaseRepository } from '../repository/repositories/taxcase.repository';
import { WorkflowRepository } from '../repository/repositories/workflow.repository';
import { AuditLogRepository } from '../repository/repositories/audit-log.repository';

@Injectable()
export class ReviewWorkflowService {
  constructor(
  private readonly taxCaseRepo: TaxCaseRepository,
  private readonly workflowRepo: WorkflowRepository,
  private readonly auditLogRepo: AuditLogRepository, // ⭐ 여기
) {}

  async approve(taxCaseId: bigint, actorId: bigint) {
    await this.taxCaseRepo.updateStage(taxCaseId, 'APPROVED');
  }
}