// ===================== taxcase/query.module.ts =====================
import { Module } from '@nestjs/common';
import { TaxCaseQueryService } from './query.service';
import { TaxCaseQueryController } from './query.controller';
//import { CompanyQueryController } from '../company/company.query.controller';
import { PrismaClient } from '@prisma/client';

@Module({
  providers: [TaxCaseQueryService, PrismaClient],
  // controllers: [TaxCaseQueryController, CompanyQueryController],
  controllers: [TaxCaseQueryController],
})
export class TaxCaseQueryModule {}
