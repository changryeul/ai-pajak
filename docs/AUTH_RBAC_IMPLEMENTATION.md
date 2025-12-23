# Authentication & RBAC Implementation Guide
**Version**: 1.0
**Date**: 2025-12-23
**Status**: Implementation Ready

---

## ⚠️ CRITICAL AUTH & RBAC PRINCIPLES

**These 5 principles are MANDATORY and enforced at both API and Database levels:**

```typescript
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
```

---

## Table of Contents

1. [Authentication Structure](#authentication-structure)
2. [Session Context](#session-context)
3. [API Middleware](#api-middleware)
4. [Route Guards](#route-guards)
5. [Audit Trail](#audit-trail)
6. [Forbidden Patterns](#forbidden-patterns)
7. [Testing](#testing)

---

## 1. Authentication Structure

### 1.1 Supabase Auth + Custom Roles

```
┌─────────────────────────┐
│  Supabase Auth User     │
│  (auth.users)           │
│  - id (uuid)            │
│  - email                │
│  - encrypted_password   │
└────────┬────────────────┘
         │
         │ 1:1
         ▼
┌─────────────────────────┐
│  user_roles             │
│  - user_id (FK)         │
│  - role (ENUM)          │
│  - organization_id      │
│  - organization_type    │
└─────────────────────────┘
```

### 1.2 Role Enum

```typescript
// src/types/auth.ts
export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  CONSULTANT_JTC = 'CONSULTANT_JTC',
  TAX_ADVISOR_JTC = 'TAX_ADVISOR_JTC',
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
  SYSTEM = 'SYSTEM'
}

export enum OrganizationType {
  PLATFORM_OPERATOR = 'PLATFORM_OPERATOR',
  PLATFORM = 'PLATFORM',
  TAX_PARTNER = 'TAX_PARTNER'
}
```

### 1.3 Session Context Type

```typescript
// src/types/session.ts
export interface SessionContext {
  userId: string;
  role: UserRole;
  organizationId: string | null;
  organizationType: OrganizationType | null;
  email: string;
}

export interface RequestWithSession extends Request {
  session: SessionContext;
  audit?: AuditContext;
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
```

---

## 2. Session Context

### 2.1 Get Session Helper

```typescript
// src/lib/auth/session.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SessionContext, UserRole } from '@/types/session';

export async function getSessionContext(): Promise<SessionContext | null> {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  // Get user role and organization from database
  const { data: userRole, error } = await supabase
    .from('user_roles')
    .select('role, organization_id, organization_type')
    .eq('user_id', session.user.id)
    .eq('is_active', true)
    .single();

  if (error || !userRole) {
    console.error('Failed to get user role:', error);
    return null;
  }

  return {
    userId: session.user.id,
    role: userRole.role as UserRole,
    organizationId: userRole.organization_id,
    organizationType: userRole.organization_type,
    email: session.user.email!,
  };
}

export function isCustomer(session: SessionContext): boolean {
  return session.role === UserRole.CUSTOMER;
}

export function isJTCConsultant(session: SessionContext): boolean {
  return session.role === UserRole.CONSULTANT_JTC;
}

export function isJTCTaxAdvisor(session: SessionContext): boolean {
  return session.role === UserRole.TAX_ADVISOR_JTC;
}

export function isPlatformAdmin(session: SessionContext): boolean {
  return session.role === UserRole.PLATFORM_ADMIN;
}

export function isSystem(session: SessionContext): boolean {
  return session.role === UserRole.SYSTEM;
}

export function canAccessTaxData(session: SessionContext): boolean {
  // PLATFORM_ADMIN and SYSTEM can NEVER access tax data
  return ![UserRole.PLATFORM_ADMIN, UserRole.SYSTEM].includes(session.role);
}

export function canFileTax(session: SessionContext): boolean {
  // ONLY TAX_ADVISOR_JTC can file tax
  return session.role === UserRole.TAX_ADVISOR_JTC;
}
```

---

## 3. API Middleware

### 3.1 Base Authentication Middleware

```typescript
// src/middleware/auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/auth/session';
import { RequestWithSession } from '@/types/session';

export async function requireAuth(
  request: NextRequest,
  handler: (req: RequestWithSession) => Promise<Response>
): Promise<Response> {
  const session = await getSessionContext();

  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized - Please login' },
      { status: 401 }
    );
  }

  // Attach session to request
  const requestWithSession = request as RequestWithSession;
  requestWithSession.session = session;

  return handler(requestWithSession);
}
```

### 3.2 Role-Based Access Control (RBAC)

```typescript
// src/middleware/rbac.ts
import { NextResponse } from 'next/server';
import { RequestWithSession, SessionContext } from '@/types/session';
import { UserRole } from '@/types/auth';

export function requireRole(...allowedRoles: UserRole[]) {
  return async (
    request: RequestWithSession,
    handler: (req: RequestWithSession) => Promise<Response>
  ): Promise<Response> => {
    const { session } = request;

    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json(
        {
          error: 'Forbidden - Insufficient permissions',
          requiredRoles: allowedRoles,
          currentRole: session.role,
        },
        { status: 403 }
      );
    }

    return handler(request);
  };
}
```

### 3.3 🚨 Block Platform Admin (CRITICAL)

```typescript
// src/middleware/blockPlatformAdmin.ts
import { NextResponse } from 'next/server';
import { RequestWithSession } from '@/types/session';
import { UserRole } from '@/types/auth';

/**
 * CRITICAL MIDDLEWARE
 * Blocks PLATFORM_ADMIN from accessing tax data endpoints
 * This is enforced at BOTH API level (this middleware) and Database level (RLS)
 */
export async function blockPlatformAdmin(
  request: RequestWithSession,
  handler: (req: RequestWithSession) => Promise<Response>
): Promise<Response> {
  const { session } = request;

  if (session.role === UserRole.PLATFORM_ADMIN) {
    console.warn(
      `[SECURITY] PLATFORM_ADMIN attempted to access tax data: ${request.url}`,
      {
        userId: session.userId,
        email: session.email,
        timestamp: new Date().toISOString(),
      }
    );

    return NextResponse.json(
      {
        error: 'Forbidden - Platform admin cannot access tax data',
        message:
          'This endpoint contains sensitive tax data. Platform administrators do not have access.',
      },
      { status: 403 }
    );
  }

  return handler(request);
}
```

### 3.4 Audit Trail Middleware

```typescript
// src/middleware/audit.ts
import { RequestWithSession, AuditContext } from '@/types/session';

export function withAudit(action: string) {
  return async (
    request: RequestWithSession,
    handler: (req: RequestWithSession) => Promise<Response>
  ): Promise<Response> => {
    const { session } = request;

    // Get client IP and user agent
    const ipAddress = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Attach audit context to request
    request.audit = {
      action,
      actorUserId: session.userId,
      actorOrganizationId: session.organizationId,
      actorRole: session.role,
      timestamp: new Date(),
      ipAddress,
      userAgent,
    };

    // Execute handler
    const response = await handler(request);

    // Log audit trail (DB trigger will also create audit log)
    console.info('[AUDIT]', {
      action,
      userId: session.userId,
      role: session.role,
      organizationId: session.organizationId,
      ipAddress,
      timestamp: request.audit.timestamp.toISOString(),
      status: response.status,
    });

    return response;
  };
}
```

### 3.5 Middleware Composition Helper

```typescript
// src/middleware/compose.ts
import { RequestWithSession } from '@/types/session';

type Middleware = (
  request: RequestWithSession,
  handler: (req: RequestWithSession) => Promise<Response>
) => Promise<Response>;

export function composeMiddleware(...middlewares: Middleware[]) {
  return async (
    request: RequestWithSession,
    finalHandler: (req: RequestWithSession) => Promise<Response>
  ): Promise<Response> => {
    // Build middleware chain from right to left
    const handler = middlewares.reduceRight(
      (next, middleware) => (req: RequestWithSession) => middleware(req, next),
      finalHandler
    );

    return handler(request);
  };
}
```

---

## 4. API Route Examples

### 4.1 Customer Tax Profile (Read)

```typescript
// src/app/api/tax/profile/route.ts
import { NextRequest } from 'next/server';
import { requireAuth } from '@/middleware/auth';
import { blockPlatformAdmin } from '@/middleware/blockPlatformAdmin';
import { requireRole } from '@/middleware/rbac';
import { composeMiddleware } from '@/middleware/compose';
import { UserRole } from '@/types/auth';
import { RequestWithSession } from '@/types/session';

export async function GET(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.CUSTOMER, UserRole.CONSULTANT_JTC, UserRole.TAX_ADVISOR_JTC)
  )(request as RequestWithSession, async (req) => {
    // Handler implementation
    const { session } = req;

    // RLS policies will enforce row-level access
    const { data, error } = await supabase
      .from('tax_filing')
      .select('*')
      .eq('customer_id', session.userId); // If customer

    return NextResponse.json({ data });
  });
}
```

### 4.2 Tax Calculation / SPT Draft

```typescript
// src/app/api/tax/calculate/route.ts
import { withAudit } from '@/middleware/audit';

export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.CONSULTANT_JTC, UserRole.TAX_ADVISOR_JTC),
    withAudit('TAX_CALCULATION')
  )(request as RequestWithSession, async (req) => {
    // Handler implementation
    const body = await req.json();

    // Perform tax calculation
    const result = await calculateTax(body);

    return NextResponse.json({ result });
  });
}
```

### 4.3 🔥 Tax Filing Submission (MOST CRITICAL)

```typescript
// src/app/api/tax/file/route.ts
export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    blockPlatformAdmin,
    requireRole(UserRole.TAX_ADVISOR_JTC), // ONLY TAX_ADVISOR_JTC
    withAudit('TAX_FILING_SUBMIT')
  )(request as RequestWithSession, async (req) => {
    const { session } = req;
    const body = await req.json();

    // Validate POA exists and is active
    const { data: poa } = await supabase
      .from('power_of_attorney')
      .select('id')
      .eq('customer_id', body.customerId)
      .eq('status', 'ACTIVE')
      .gte('valid_to', new Date().toISOString())
      .single();

    if (!poa) {
      return NextResponse.json(
        { error: 'No active Power of Attorney found' },
        { status: 400 }
      );
    }

    // File tax (DB trigger will validate POA again)
    const { data, error } = await supabase
      .from('tax_filing')
      .update({
        status: 'FILED',
        filed_at: new Date().toISOString(),
        power_of_attorney_id: poa.id,
      })
      .eq('id', body.taxFilingId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  });
}
```

### 4.4 Billing Collection (SYSTEM Only)

```typescript
// src/app/api/billing/collect/route.ts
export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,
    requireRole(UserRole.SYSTEM)
  )(request as RequestWithSession, async (req) => {
    // Handler implementation
    const body = await req.json();

    // SYSTEM role can only access billing data
    // RLS policies block tax data access even for SYSTEM role
    const { data, error } = await supabase
      .from('billing_transaction')
      .insert({
        customer_id: body.customerId,
        platform_owner_id: MONO_FLIP_GLOBAL_ID,
        amount_total: body.amount,
        payment_status: 'PENDING',
      })
      .select()
      .single();

    return NextResponse.json({ data });
  });
}
```

---

## 5. Route Guards (Frontend)

### 5.1 Next.js Middleware

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set(name, value, options);
        },
        remove(name: string, options: any) {
          response.cookies.delete(name);
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Public routes
  const publicRoutes = ['/login', '/register', '/forgot-password'];
  const isPublicRoute = publicRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (!session && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (session && isPublicRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### 5.2 Client-Side Route Guard Hook

```typescript
// src/hooks/useRequireRole.ts
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { UserRole } from '@/types/auth';

export function useRequireRole(allowedRoles: UserRole[]) {
  const router = useRouter();
  const { session, loading } = useSession();

  useEffect(() => {
    if (loading) return;

    if (!session) {
      router.push('/login');
      return;
    }

    if (!allowedRoles.includes(session.role)) {
      router.push('/403'); // Forbidden page
    }
  }, [session, loading, allowedRoles, router]);

  return { session, loading };
}
```

### 5.3 Page-Level Protection

```typescript
// src/app/tax/file/page.tsx
'use client';

import { useRequireRole } from '@/hooks/useRequireRole';
import { UserRole } from '@/types/auth';

export default function TaxFilingPage() {
  // Only TAX_ADVISOR_JTC can access this page
  const { session, loading } = useRequireRole([UserRole.TAX_ADVISOR_JTC]);

  if (loading) return <div>Loading...</div>;

  return <div>Tax Filing Form</div>;
}
```

---

## 6. Forbidden Patterns ❌

### 6.1 Code Review Checklist

**NEVER allow these patterns:**

```typescript
// ❌ BAD: Frontend-only role check without API validation
if (session.role === 'PLATFORM_ADMIN') {
  // Hide UI
}
// API endpoint has no role check → SECURITY HOLE

// ❌ BAD: PLATFORM_ADMIN can call tax API
export async function GET(request: NextRequest) {
  return requireAuth(request, async (req) => {
    // No blockPlatformAdmin middleware → SECURITY HOLE
    const taxData = await getTaxData();
    return NextResponse.json(taxData);
  });
}

// ❌ BAD: Tax filing endpoint without role restriction
export async function POST(request: NextRequest) {
  // Anyone authenticated can file tax → SECURITY HOLE
  return requireAuth(request, async (req) => {
    await fileTax(req.body);
  });
}

// ❌ BAD: Mutation without audit trail
export async function POST(request: NextRequest) {
  return requireAuth(request, async (req) => {
    // No withAudit middleware → COMPLIANCE VIOLATION
    await updateTaxData(req.body);
  });
}

// ❌ BAD: SYSTEM role accessing customer data
export async function GET(request: NextRequest) {
  return requireRole(UserRole.SYSTEM)(request, async (req) => {
    // SYSTEM should NEVER read customer tax data
    const customerData = await getCustomerTaxData();
    return NextResponse.json(customerData);
  });
}
```

### 6.2 Correct Patterns ✅

```typescript
// ✅ GOOD: Complete protection stack
export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,                    // 1. Must be logged in
    blockPlatformAdmin,             // 2. Block platform admin
    requireRole(UserRole.TAX_ADVISOR_JTC), // 3. Only tax advisor
    withAudit('TAX_FILING_SUBMIT')  // 4. Audit trail
  )(request as RequestWithSession, async (req) => {
    // Handler implementation
    // RLS policies provide final database-level protection
  });
}
```

---

## 7. Testing

### 7.1 Unit Tests for Middleware

```typescript
// src/middleware/__tests__/rbac.test.ts
import { describe, it, expect } from 'vitest';
import { requireRole } from '../rbac';
import { UserRole } from '@/types/auth';

describe('requireRole middleware', () => {
  it('should block unauthorized role', async () => {
    const mockRequest = {
      session: { role: UserRole.CUSTOMER },
    } as any;

    const middleware = requireRole(UserRole.TAX_ADVISOR_JTC);
    const response = await middleware(mockRequest, async () => new Response());

    expect(response.status).toBe(403);
  });

  it('should allow authorized role', async () => {
    const mockRequest = {
      session: { role: UserRole.TAX_ADVISOR_JTC },
    } as any;

    const middleware = requireRole(UserRole.TAX_ADVISOR_JTC);
    const response = await middleware(mockRequest, async () =>
      new Response('OK')
    );

    expect(response.status).toBe(200);
  });
});
```

### 7.2 Integration Tests

```typescript
// src/app/api/tax/file/__tests__/route.test.ts
import { describe, it, expect } from 'vitest';
import { POST } from '../route';

describe('POST /api/tax/file', () => {
  it('should block PLATFORM_ADMIN', async () => {
    const request = createMockRequest({
      session: { role: UserRole.PLATFORM_ADMIN },
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it('should block CONSULTANT_JTC', async () => {
    const request = createMockRequest({
      session: { role: UserRole.CONSULTANT_JTC },
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it('should allow TAX_ADVISOR_JTC with valid POA', async () => {
    const request = createMockRequest({
      session: { role: UserRole.TAX_ADVISOR_JTC },
      body: { customerId: '...', taxFilingId: '...' },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
```

---

## 8. Developer Quick Reference

### 8.1 One-Line Rules

```
1. No API without role check = BUG
2. PLATFORM_ADMIN = Observer, NOT Administrator
3. Tax filing = TAX_ADVISOR_JTC ONLY
4. All mutations = Audit trail required
5. Two-layer defense: API middleware + Database RLS
```

### 8.2 Middleware Decision Tree

```
Is this a tax data endpoint?
├─ YES
│  ├─ requireAuth ✓
│  ├─ blockPlatformAdmin ✓
│  ├─ requireRole([...]) ✓
│  └─ withAudit('...') ✓
│
└─ NO (billing/platform management)
   ├─ requireAuth ✓
   └─ requireRole([...]) ✓
```

### 8.3 Common Middleware Stacks

```typescript
// Customer tax data (read)
composeMiddleware(
  requireAuth,
  blockPlatformAdmin,
  requireRole(UserRole.CUSTOMER, UserRole.CONSULTANT_JTC, UserRole.TAX_ADVISOR_JTC)
)

// Tax calculation/preparation
composeMiddleware(
  requireAuth,
  blockPlatformAdmin,
  requireRole(UserRole.CONSULTANT_JTC, UserRole.TAX_ADVISOR_JTC),
  withAudit('TAX_CALCULATION')
)

// Tax filing submission
composeMiddleware(
  requireAuth,
  blockPlatformAdmin,
  requireRole(UserRole.TAX_ADVISOR_JTC),
  withAudit('TAX_FILING_SUBMIT')
)

// Billing operations
composeMiddleware(
  requireAuth,
  requireRole(UserRole.SYSTEM)
)

// Platform admin operations
composeMiddleware(
  requireAuth,
  requireRole(UserRole.PLATFORM_ADMIN)
)
```

---

## 9. Security Audit Checklist

Before deploying ANY tax-related endpoint:

- [ ] `requireAuth` middleware present
- [ ] `blockPlatformAdmin` middleware present (for tax endpoints)
- [ ] `requireRole` with appropriate roles
- [ ] `withAudit` for all mutations
- [ ] Database RLS policies verified
- [ ] Unit tests for middleware stack
- [ ] Integration tests for happy path + blocked scenarios
- [ ] POA validation for filing endpoints
- [ ] Error messages don't leak sensitive info
- [ ] Logging configured for security events

---

## 10. References

- [DATABASE_DESIGN.md](DATABASE_DESIGN.md) - Database schema and RLS policies
- [POWER_OF_ATTORNEY.md](POWER_OF_ATTORNEY.md) - POA implementation
- [LEGAL_STRUCTURE.md](LEGAL_STRUCTURE.md) - Legal framework
- [PRD.md](PRD.md) - Product requirements

---

**Last Updated**: 2025-12-23
**Status**: Ready for implementation
