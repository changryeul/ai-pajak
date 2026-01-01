import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MembershipRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 회사 내 사용자 role 조회 (없으면 null) */
  async getCompanyRole(companyId: bigint, userId: bigint) {
    return this.prisma.companyUser.findUnique({
      where: {
        companyId_userId: {
          companyId,
          userId,
        },
      },
      select: { role: true, joinedAt: true },
    });
  }
}