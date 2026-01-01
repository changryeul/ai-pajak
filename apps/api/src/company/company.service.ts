import { Injectable, NotFoundException } from '@nestjs/common';
import { CompanyRepository } from '../repository/repositories/company.repository';
import { TaxCaseRepository } from '../repository/repositories/taxcase.repository';
import { CreateCompanyDto } from './dto/create-company.dto';


@Injectable()
export class CompanyService {
  constructor(
    private readonly companyRepo: CompanyRepository,
    private readonly taxCaseRepo: TaxCaseRepository,
  ) {}

  
  /**
   * 회사 생성
   */
  async createCompany(body: CreateCompanyDto) {
    const company = await this.companyRepo.create({
      name: body.name,
      npwp: body.npwp,
    });

    return {
      id: company.id.toString(),
    };
  } 
  /**
   * 회사 단건 조회
   */
  async getCompany(companyId: bigint) {
    const company = await this.companyRepo.findById(companyId);

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  /**
   * 회사에 속한 세무 케이스 목록 조회
   */
  async listCompanyTaxCases(companyId: bigint) {
    // 회사 존재 여부 먼저 확인 (안정성)
    const company = await this.companyRepo.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return this.taxCaseRepo.listByCompany(companyId);
  }
}