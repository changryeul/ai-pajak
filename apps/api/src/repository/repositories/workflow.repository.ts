import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WorkflowStage } from '@prisma/client';

@Injectable()
export class WorkflowRepository {
  constructor(private readonly prisma: PrismaService) {}

  init(taxCaseId: bigint) {
    return this.prisma.workflowState.create({
      data: {
        taxCaseId,
        stage: WorkflowStage.UPLOADED, // ✅ 존재하는 enum
      },
    });
  }

  moveToStage(taxCaseId: bigint, stage: WorkflowStage) {
    return this.prisma.workflowState.update({
      where: { taxCaseId },
      data: { stage },
    });
  }

  async getStage(taxCaseId: bigint): Promise<WorkflowStage> {
    const state = await this.prisma.workflowState.findUnique({
      where: { taxCaseId },
    });

    if (!state) {
      throw new NotFoundException('WorkflowState not found');
    }

    return state.stage;
  }
}