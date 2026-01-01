import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// repositories
import { WorkflowRepository } from './repositories/workflow.repository';
import { TaxCaseRepository } from './repositories/taxcase.repository';
import { TaxFilingRepository } from './repositories/tax-filing.repository';
import { AuditLogRepository } from './repositories/audit-log.repository';
import { CommunicationRepository } from './repositories/communication.repository';
// import { CompanyRepository } from './repositories/Company.repository';
import { CompanyRepository } from './repositories/company.repository';
import { AIResultRepository } from './repositories/ai-result.repository';
import { HumanReviewRepository } from './repositories/human-review.repository';

@Module({
  providers: [
    PrismaService,
    CompanyRepository,
    WorkflowRepository,
    TaxCaseRepository,
    TaxFilingRepository,   // ✅ 반드시 있어야 함
    AuditLogRepository,
    CommunicationRepository,
    AIResultRepository,
    HumanReviewRepository,
  ],
  exports: [
    CompanyRepository,   // ✅ 반드시 export
    WorkflowRepository,
    TaxCaseRepository,
    TaxFilingRepository,   // ✅ 반드시 export
    AuditLogRepository,
    CommunicationRepository,
    AIResultRepository,
    HumanReviewRepository,
  ],
})
export class RepositoryModule {}