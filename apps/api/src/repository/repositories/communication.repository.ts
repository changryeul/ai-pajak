// src/repository/repositories/communication.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CommunicationRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    taxCaseId: bigint;
    senderType: any;
    senderId?: bigint;
    message: string;
  }) {
    return this.prisma.communication.create({ data });
  }
}