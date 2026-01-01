import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class HumanReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    taxCaseId: bigint;
    reviewerId: bigint;
    finalTax: string;
    overrideFlag?: boolean;
    reason?: string | null;
  }) {
    return this.prisma.humanReview.create({
      data: {
        taxCaseId: data.taxCaseId,
        reviewerId: data.reviewerId,
        finalTax: data.finalTax,
        overrideFlag: data.overrideFlag ?? false,
        reason: data.reason ?? null,
      },
    });
  }

  latestByTaxCase(taxCaseId: bigint) {
    return this.prisma.humanReview.findFirst({
      where: { taxCaseId },
      orderBy: { reviewedAt: 'desc' },
    });
  }
}