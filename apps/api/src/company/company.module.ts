// =====================================================
// company 도메인 전체 구성 (Module / Service / Controller)
// 목적: 회사 단위 조회/권한의 단일 진입점
// =====================================================

// ===================== company/company.module.ts =====================
import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { RepositoryModule } from '../repository/repository.module';

@Module({
  imports: [RepositoryModule],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}

