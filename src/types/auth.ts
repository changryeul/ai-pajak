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
  CONSULTANT_JTC = 'CONSULTANT_JTC',
  TAX_ADVISOR_JTC = 'TAX_ADVISOR_JTC',
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
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
