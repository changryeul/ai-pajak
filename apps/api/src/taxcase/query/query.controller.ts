// ===================== taxcase/query.controller.ts =====================
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { TaxCaseQueryService } from './query.service';
import { AuthGuard } from '../../common/auth.guard';

@Controller('tax-cases')
@UseGuards(AuthGuard)
export class TaxCaseQueryController {
  constructor(private readonly query: TaxCaseQueryService) {}

  @Get(':id/overview')
  getOverview(@Param('id') id: string) {
    return this.query.getOverview(BigInt(id));
  }

  @Get(':id/timeline')
  getTimeline(@Param('id') id: string) {
    return this.query.getTimeline(BigInt(id));
  }
}
