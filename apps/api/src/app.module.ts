import { Module } from '@nestjs/common';
import { RepositoryModule } from './repository/repository.module';
import { TaxCaseModule } from './taxcase/taxcase.module';
import { FilingModule } from './filing/filing.module';
import { CommunicationModule } from './communication/communication.module';
import { CompanyModule } from './company/company.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    HealthModule,
    RepositoryModule,
    TaxCaseModule,
    FilingModule,
    CommunicationModule,
    CompanyModule,
  ],
})
export class AppModule {}