import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AIResultRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    taxCaseId: bigint;
    suggestedTax: string;
    confidence: number;
    rawResponse: any;
  }) {
    return this.prisma.aIResult.create({
      data: {
        taxCaseId: data.taxCaseId,
        suggestedTax: data.suggestedTax,
        confidence: data.confidence,
        rawResponse: data.rawResponse,
      },
    });
  }

  latestByTaxCase(taxCaseId: bigint) {
    return this.prisma.aIResult.findFirst({
      where: { taxCaseId },
      orderBy: { createdAt: 'desc' },
    });
  }
}