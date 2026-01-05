import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RepositoryModule } from './repository/repository.module';
import { TaxCaseModule } from './taxcase/taxcase.module';
import { FilingModule } from './filing/filing.module';
import { CommunicationModule } from './communication/communication.module';
import { CompanyModule } from './company/company.module';
import { HealthModule } from './health/health.module';
import { QueueModule } from './queue/queue.module';
import { OcrModule } from './ocr/ocr.module';
import { DocumentModule } from './document/document.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    RepositoryModule,
    TaxCaseModule,
    FilingModule,
    CommunicationModule,
    CompanyModule,
    QueueModule,
    OcrModule,
    DocumentModule,
  ],
})
export class AppModule {}