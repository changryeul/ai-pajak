import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiHeader,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

import { AuthGuard } from '../common/auth.guard';
import { ReviewWorkflowService } from './taxcase.service';

import { CreateTaxCaseDto } from './dto/create-taxcase.dto';
import { ApplyAIResultDto } from './dto/apply-ai-result.dto';
import { OverrideAIResultDto } from './dto/override-ai-result.dto';

@ApiTags('tax-cases')
@ApiHeader({ name: 'x-user-id', required: true })
@Controller('api/tax-cases')
@UseGuards(AuthGuard)
export class TaxCaseController {
  constructor(
    private readonly workflow: ReviewWorkflowService,
  ) {}

  /**
   * TaxCase 생성
   */
  @Post()
  @ApiBody({ type: CreateTaxCaseDto })
  createTaxCase(
    @Body() body: CreateTaxCaseDto,
    @Req() req: any,
  ) {
    return this.workflow.createTaxCase(
      BigInt(body.companyId),
      body.taxType,
      body.period,
      req.user.id,
    );
  }

  /**
   * AI 결과 적용
   */
  @Post(':id/ai-result')
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: ApplyAIResultDto })
  applyAI(
    @Param('id') id: string,
    @Body() body: ApplyAIResultDto,
    @Req() req: any,
  ) {
    return this.workflow.applyAIResult(
      BigInt(id),
      req.user.id,
      body, // DTO 그대로 전달
    );
  }

  /**
   * 인간 검토 단계로 이동
   */
  @Post(':id/review')
  moveToReview(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.workflow.moveToHumanReview(
      BigInt(id),
      req.user.id,
    );
  }

  /**
   * AI 결과 override
   */
  @Post(':id/override')
  @ApiBody({ type: OverrideAIResultDto })
  overrideAI(
    @Param('id') id: string,
    @Body() body: OverrideAIResultDto,
    @Req() req: any,
  ) {
    return this.workflow.overrideAIResult({
      taxCaseId: BigInt(id),
      reviewerId: req.user.id,
      finalTax: body.finalTax,
      reason: body.reason,
    });
  }

  /**
   * 승인
   */
  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.workflow.approveReview(
      BigInt(id),
      req.user.id,
    );
  }

  /**
   * 단건 조회 (stage + actions)
   */
  @Get(':id')
  getTaxCase(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.workflow.getTaxCaseDetail(
      BigInt(id),
      req.user.id,
    );
  }
}