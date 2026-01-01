
// ===================== taxcase/taxcase.module.ts =====================
import { Module } from '@nestjs/common';
import { TaxCaseController } from './taxcase.controller';
import { ReviewWorkflowService } from './taxcase.service';
import { RepositoryModule } from '../repository/repository.module';

@Module({
  imports: [RepositoryModule],
  controllers: [TaxCaseController],
  providers: [ReviewWorkflowService],
})
export class TaxCaseModule {}