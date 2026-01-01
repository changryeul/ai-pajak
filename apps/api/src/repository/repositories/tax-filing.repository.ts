import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { FilingStatus } from '@prisma/client';

@Injectable()
export class TaxFilingRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    taxCaseId: bigint;
    filingStatus: FilingStatus;
    filedBy?: bigint | null;
    filedAt?: Date | null;
    submissionRef?: string | null;
  }) {
    return this.prisma.taxFiling.create({
      data: {
        taxCaseId: data.taxCaseId,
        filingStatus: data.filingStatus,
        filedBy: data.filedBy ?? null,
        filedAt: data.filedAt ?? null,
        submissionRef: data.submissionRef ?? null,
      },
    });
  }

  listByTaxCase(taxCaseId: bigint) {
    return this.prisma.taxFiling.findMany({
      where: { taxCaseId },
      orderBy: { createdAt: 'desc' },
    });
  }
}