/**
 * AUTH & RBAC PRINCIPLES
 *
 * 1. Authorization is enforced at TWO levels:
 *    - API middleware (first gate)
 *    - Database RLS (final gate)
 *
 * 2. PLATFORM_ADMIN can NEVER access tax data (even read)
 *
 * 3. All tax actions must be traceable to:
 *    - Jakarta Tax Consulting
 *    - A specific consultant or tax advisor
 *
 * 4. Platform NEVER performs tax filing
 *
 * 5. Billing authority ≠ Tax service authority
 */

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  // P3 (2026-07-05): _JTC suffix 제거. 두 role 은 JTC 뿐 아니라 EXTERNAL
  // tax_partner (세무컨설팅 법인) 직원도 함께 사용. 소속은 consultant.tax_partner_id 로만 판정.
  CONSULTANT = 'CONSULTANT',
  TAX_ADVISOR = 'TAX_ADVISOR',
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
  // P6.1 (2026-07-07): MonoFlip 사업운영 최고권한. 요금·상품·통계·EXTERNAL 입점
  // 관리. 세무신고 실무 (Coretax·tax_filing insert) 는 절대 불가 (blockPlatformAdmin).
  PLATFORM_MASTER = 'PLATFORM_MASTER',
  // P6.2 (2026-07-07): 세무컨설팅 법인 (EXTERNAL tax_partner) 관리자. 자기 tenant
  // 안에서 직원·자격증·배정·청구 전권. 다른 tenant 는 절대 접근 불가 (Hard Rule #7).
  FIRM_ADMIN = 'FIRM_ADMIN',
  // Operator hierarchy (3 tiers):
  //   TAX_OPERATOR             - 상담원: per-customer queue work
  //   TAX_OPERATOR_SUPERVISOR  - 수퍼바이저: team approvals, queue distribution
  //   TAX_OPERATOR_MASTER      - 마스터: platform-wide stats, custom pricing, special-service quotes
  // TAX_OPERATOR_LEAD is retained for backward compatibility but should not be assigned to new users.
  TAX_OPERATOR = 'TAX_OPERATOR',
  TAX_OPERATOR_LEAD = 'TAX_OPERATOR_LEAD',
  TAX_OPERATOR_SUPERVISOR = 'TAX_OPERATOR_SUPERVISOR',
  TAX_OPERATOR_MASTER = 'TAX_OPERATOR_MASTER',
  SYSTEM = 'SYSTEM',
}

export enum OrganizationType {
  PLATFORM_OWNER = 'PLATFORM_OWNER',
  PLATFORM = 'PLATFORM',
  TAX_PARTNER = 'TAX_PARTNER',
}

export interface SessionContext {
  userId: string;
  role: UserRole;
  organizationId: string | null;
  organizationType: OrganizationType | null;
  email: string;
  customerId?: string;
  consultantId?: string;
}

export interface AuditContext {
  action: string;
  actorUserId: string;
  actorOrganizationId: string | null;
  actorRole: UserRole;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

import { NextRequest } from 'next/server';

export interface RequestWithSession extends NextRequest {
  session: SessionContext;
  audit?: AuditContext;
}

// Database user_roles table structure
export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  organization_id: string | null;
  organization_type: OrganizationType | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
