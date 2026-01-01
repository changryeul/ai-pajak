import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CompanyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { name: string; npwp: string }) {
    return this.prisma.company.create({
      data,
    });
  }

  async findById(companyId: bigint) {
    return this.prisma.company.findUnique({
      where: { id: companyId },
    });
  }

  async findTaxCases(companyId: bigint) {
    return this.prisma.taxCase.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }
}