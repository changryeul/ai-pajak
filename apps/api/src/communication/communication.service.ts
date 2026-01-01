import { Injectable } from '@nestjs/common';
import { CommunicationRepository } from '../repository/repositories/communication.repository';
import { AuditLogRepository } from '../repository/repositories/audit-log.repository';

@Injectable()
export class CommunicationService {
  constructor(
    private readonly commRepo: CommunicationRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  /**
   * 사람 → 메시지
   */
  async postHumanMessage(
    taxCaseId: bigint,
    userId: bigint,
    message: string,
  ) {
    await this.commRepo.create({
      taxCaseId,
      senderType: 'HUMAN',
      senderId: userId,
      message,
    });

    // ❌ log() → ✅ create()
    await this.auditRepo.create({
      taxCaseId,
      actorId: userId,
      action: 'POST_MESSAGE',
      // entityType: 'COMMUNICATION',
      // entityId: taxCaseId,
    });

    return { ok: true };
  }

  /**
   * AI → 메시지 (자동 응답, 분석 결과 등)
   */
  async postAIMessage(
    taxCaseId: bigint,
    payload: any,
  ) {
    await this.commRepo.create({
      taxCaseId,
      senderType: 'AI',
      message: JSON.stringify(payload),
    });

    // AI는 actorId 없음 → 시스템으로 처리
    await this.auditRepo.create({
      taxCaseId,
      actorId: BigInt(0),
      action: 'POST_AI_MESSAGE',
      // entityType: 'COMMUNICATION',
      // entityId: taxCaseId,
    });

    return { ok: true };
  }
}