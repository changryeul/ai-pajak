// ===================== filing/filing.module.ts =====================
import { Module } from '@nestjs/common';
import { FilingController } from './filing.controller';
import { FilingService } from './filing.service';
import { RepositoryModule } from '../repository/repository.module';

@Module({
  imports: [RepositoryModule],
  controllers: [FilingController],
  providers: [FilingService],
})
export class FilingModule {}