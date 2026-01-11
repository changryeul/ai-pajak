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

  /**
   * 전체 TaxCase 목록 조회 (Company 정보 포함)
   */
  listAll() {
    return this.prisma.taxCase.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        company: {
          select: { id: true, name: true },
        },
        workflow: {
          select: { stage: true },
        },
      },
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
  // ⭐️ 여기 추가
 async updateStage(taxCaseId: bigint, stage: string) {
  console.log('[TaxCaseRepository] updateStage', {
    taxCaseId,
    stage,
  });

  return {
    id: taxCaseId,
    workflowStage: stage,
  };
}
}