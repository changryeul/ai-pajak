// repository/repositories/audit-log.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    taxCaseId: bigint;
    action: string;
    actorId: bigint;
  }) {
    return this.prisma.auditLog.create({
      data: {
        taxCaseId: input.taxCaseId,
        action: input.action,
        actorId: input.actorId,
      },
    });
  }
}