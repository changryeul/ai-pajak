import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TaxType } from '@prisma/client';

@Injectable()
export class TaxCaseRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    companyId: bigint;
    taxType: TaxType;   // ✅ enum
    period: string;
    status: string;
  }) {
    return this.prisma.taxCase.create({ data });
  }

  findById(id: bigint) {
    return this.prisma.taxCase.findUnique({ where: { id } });
  }

  listByCompany(companyId: bigint) {
    return this.prisma.taxCase.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // repository/repositories/taxcase.repository.ts
  async findDetail(id: bigint) {
    return this.prisma.taxCase.findUnique({
      where: { id },
      include: {
        workflow: true,
        aiResults: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        reviews: {
          orderBy: { reviewedAt: 'desc' },
          take: 1,
        },
        filings: {
          orderBy: { filedAt: 'desc' },
          take: 1,
        },
      },
    });
  }
}