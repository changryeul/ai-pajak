// ===================== filing/filing.controller.ts =====================
import { ApiTags, ApiHeader } from '@nestjs/swagger';
import { Controller, Post, Param, Req, UseGuards } from '@nestjs/common';
import { FilingService } from './filing.service';
import { AuthGuard } from '../common/auth.guard';

@ApiTags('tax-cases')
@Controller('api/tax-cases')
@UseGuards(AuthGuard)
export class FilingController {
  constructor(private readonly filing: FilingService) {}

  /**
   * 신고 실행 (APPROVED → FILED)
   */
  @Post(':id/file')
  file(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.filing.fileTaxCase(
      BigInt(id),
      req.user.id,
    );
  }
}