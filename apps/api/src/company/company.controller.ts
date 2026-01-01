
import { ApiTags, ApiHeader } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
  Post,
  Body,
} from '@nestjs/common';
import { CompanyService } from './company.service';
import { AuthGuard } from '../common/auth.guard';
import { CreateCompanyDto } from './dto/create-company.dto';

@ApiTags('companies')
@Controller('api/companies')
@UseGuards(AuthGuard)
export class CompanyController {
  constructor(private readonly company: CompanyService) {}

  /**
   * 회사 생성
   * POST /api/companies
   */
  @Post()
  create(@Body() body: CreateCompanyDto) {
    return this.company.createCompany(body);
  }

  /**
  /**
   * 회사 상세 조회 (기본 정보)
   * GET /api/companies/:id
   */
  @Get(':id')
  getCompany(@Param('id') id: string, @Req() req: any) {
    // return this.company.getCompany(BigInt(id), req.user.id);
    return this.company.getCompany(BigInt(id));
  }

  /**
   * 회사 소속 TaxCase 목록 조회
   * GET /api/companies/:id/tax-cases
   */
  @Get(':id/tax-cases')
  listCompanyTaxCases(@Param('id') id: string, @Req() req: any) {
   // return this.company.listCompanyTaxCases(BigInt(id), req.user.id);
   return this.company.listCompanyTaxCases(BigInt(id)); 

  }
}