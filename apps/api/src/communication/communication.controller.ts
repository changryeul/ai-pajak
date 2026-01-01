// communication/communication.controller.ts
import { ApiTags, ApiHeader } from '@nestjs/swagger';
import {
  Controller,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { AuthGuard } from '../common/auth.guard';

@ApiTags('tax-cases')
@Controller('api/tax-cases')
@UseGuards(AuthGuard)
export class CommunicationController {
  constructor(private readonly communication: CommunicationService) {}

  /**
   * 사용자 메시지 등록
   * POST /api/tax-cases/:id/messages
   */
  @Post(':id/messages')
  async postHumanMessage(
    @Param('id') id: string,
    @Req() req: any,
    @Body('message') message: string,
  ) {
    return this.communication.postHumanMessage(
      BigInt(id),
      req.user.id,
      message,
    );
  }
}