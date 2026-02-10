# AI Pajak - Tax Preparation Platform
**Version**: 1.0
**Status**: Architecture & Implementation Ready
**Date**: 2025-12-23

---

## 🎯 Overview

AI Pajak is a tax preparation platform that connects Indonesian taxpayers with licensed tax consultants from Jakarta Tax Consulting (JTC). The platform facilitates tax calculation, document management, and filing preparation while maintaining strict legal separation between platform operations and tax service delivery.

**Core Principle**: AI Pajak is a **technology platform**, NOT a tax filing service provider.

---

## 🏗️ Architecture

### Legal Structure

```
Mono Flip Global (Platform Owner)
  └── AI Pajak (Platform)
        └── Jakarta Tax Consulting (Tax Service Provider)
              ├── Consultants (Tax preparation)
              └── Tax Advisors (Licensed filing authority)
```

### 6 Hard Rules (Enforced at Database + API levels)

1. **PLATFORM_ADMIN Cannot Access Tax Data** - Enforced via RLS + Middleware
2. **Consultant MUST Belong to JTC** - Enforced via FK + Validation
3. **Tax Filing Actor ≠ Platform** - Enforced via POA + Audit Trail
4. **Billing Collector ≠ Service Provider** - Enforced via Schema Design
5. **Audit Trail Required** - Enforced via Triggers + Middleware
6. **Legal Authorization via POA** - Enforced via Validation Trigger

---

## 📁 Project Structure

```
ai-pajak/
├── docs/                              # Documentation
│   ├── PRD.md                         # Product requirements (v3.2)
│   ├── LEGAL_STRUCTURE.md             # Legal & operational framework
│   ├── DATABASE_DESIGN.md             # ERD and schema design
│   ├── DATABASE_IMPLEMENTATION_SUMMARY.md
│   ├── POWER_OF_ATTORNEY.md           # POA implementation guide
│   ├── AUTH_RBAC_IMPLEMENTATION.md    # Auth/RBAC complete guide
│   └── AUTH_IMPLEMENTATION_SUMMARY.md
│
├── supabase/
│   ├── migrations/                    # Database migrations
│   │   ├── 20251223000001_initial_schema.sql      (~650 lines)
│   │   ├── 20251223000002_rls_policies.sql        (~550 lines)
│   │   ├── 20251223000003_seed_data.sql           (~100 lines)
│   │   └── 20251223000004_power_of_attorney.sql   (~450 lines)
│   └── README.md                      # Database usage guide
│
└── src/
    ├── types/
    │   └── auth.ts                    # Auth types and enums
    ├── lib/
    │   └── auth/
    │       └── session.ts             # Session management
    └── middleware/
        ├── auth.ts                    # requireAuth
        ├── rbac.ts                    # requireRole
        ├── blockPlatformAdmin.ts      # CRITICAL security middleware
        ├── audit.ts                   # withAudit
        └── compose.ts                 # Middleware composition
```

---

## 🗄️ Database Schema

### Core Tables (15 total)

**Organizational**:
- `platform_owner` - Mono Flip Global
- `platform` - AI Pajak
- `tax_partner` - Jakarta Tax Consulting

**Personnel**:
- `consultant` - JTC employees
- `tax_advisor` - Licensed tax professionals

**Users**:
- `auth.users` - Supabase Auth
- `user_roles` - Role assignments
- `customer` - End users

**Legal**:
- `power_of_attorney` - Legal authorization

**Tax Data** (Protected):
- `tax_filing` - Tax submissions
- `tax_document` - Supporting documents
- `tax_activity_log` - Audit trail (immutable)

**Billing**:
- `billing_transaction` - Payment collection
- `revenue_split` - Accounting separation
- `subscription` - Platform subscriptions

**Communication**:
- `consultation_message` - Customer ↔ Consultant messaging

### Database Statistics

- **Tables**: 15 core + 5 Supabase auth
- **Migrations**: 4 files (~1,750 lines SQL)
- **RLS Policies**: 47 policies
- **Triggers**: 15 triggers
- **Constraints**: 41 constraints (FK, unique, check)
- **Indexes**: 67 indexes

---

## 🔐 Authentication & Authorization

### User Roles

```typescript
enum UserRole {
  CUSTOMER           // End user
  CONSULTANT_JTC     // Tax consultant
  TAX_ADVISOR_JTC    // Licensed tax advisor
  PLATFORM_ADMIN     // Platform management (NO tax data access)
  SYSTEM             // Billing operations only
}
```

### Access Control Matrix

| Role | Tax Data | Tax Filing | POA | Billing | Platform Admin |
|------|----------|-----------|-----|---------|----------------|
| CUSTOMER | Own only | ❌ No | Create/Sign | Own only | ❌ No |
| CONSULTANT_JTC | Assigned | ❌ No | Sign Partner | ❌ No | ❌ No |
| TAX_ADVISOR_JTC | All JTC | ✅ Yes | Sign Partner | ❌ No | ❌ No |
| PLATFORM_ADMIN | ❌ **BLOCKED** | ❌ No | View only | View only | ✅ Yes |
| SYSTEM | ❌ No | ❌ No | ❌ No | ✅ Full | ❌ No |

### Middleware Stack

Every tax endpoint MUST use this pattern:

```typescript
export async function POST(request: NextRequest) {
  return composeMiddleware(
    requireAuth,                      // 1. Authentication
    blockPlatformAdmin,               // 2. Block platform admin
    requireRole(UserRole.TAX_ADVISOR_JTC), // 3. Role check
    withAudit('TAX_FILING_SUBMIT')    // 4. Audit trail
  )(request as RequestWithSession, handler);
}
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Supabase CLI
- PostgreSQL 15+ (via Supabase)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd ai-pajak

# Install dependencies
npm install

# Set up Supabase
supabase init
supabase start

# Apply migrations
supabase db reset

# Start development server
npm run dev
```

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

---

## 📚 Documentation

### For Product/Legal Teams
- [PRD.md](docs/PRD.md) - Product requirements and features
- [LEGAL_STRUCTURE.md](docs/LEGAL_STRUCTURE.md) - Legal framework and compliance

### For Developers
- [DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md) - Complete database schema and ERD
- [AUTH_RBAC_IMPLEMENTATION.md](docs/AUTH_RBAC_IMPLEMENTATION.md) - Auth/RBAC implementation guide
- [POWER_OF_ATTORNEY.md](docs/POWER_OF_ATTORNEY.md) - POA workflow and implementation

### For Operations
- [supabase/README.md](supabase/README.md) - Database management and common queries
- [DATABASE_IMPLEMENTATION_SUMMARY.md](docs/DATABASE_IMPLEMENTATION_SUMMARY.md) - Quick reference
- [AUTH_IMPLEMENTATION_SUMMARY.md](docs/AUTH_IMPLEMENTATION_SUMMARY.md) - Auth quick reference

---

## 🛡️ Security

### Two-Layer Defense

1. **API Layer** (First Gate)
   - Authentication check
   - Role-based access control
   - Platform admin blocking
   - Audit trail creation

2. **Database Layer** (Final Gate)
   - Row Level Security (RLS) policies
   - Foreign key constraints
   - Check constraints
   - Automatic audit triggers

### Security Checklist

Before deploying any endpoint:

- [ ] Authentication required
- [ ] Platform admin blocked (for tax endpoints)
- [ ] Correct role(s) enforced
- [ ] Audit trail enabled (for mutations)
- [ ] RLS policies verified
- [ ] Integration tests pass
- [ ] Security review completed

---

## 📊 Key Features

### For Customers
- Tax calculation and estimation
- Document upload with OCR
- Power of Attorney (digital signature)
- Tax filing status tracking
- Consultation with tax experts
- Billing and payment management

### For Consultants (JTC)
- Customer assignment
- Tax preparation tools
- Document review
- POA management
- Customer communication

### For Tax Advisors (JTC)
- All consultant features
- Tax filing submission authority
- POA signing for tax partner
- Complete case management

### For Platform Admins
- User management
- Platform analytics (anonymized)
- Subscription management
- Billing oversight
- **NO ACCESS** to customer tax data

---

## 🔄 Development Workflow

### Adding a New Tax Endpoint

1. **Design API Contract**
   ```typescript
   // Define request/response types
   interface TaxCalculationRequest { ... }
   interface TaxCalculationResponse { ... }
   ```

2. **Implement Handler**
   ```typescript
   async function handler(req: RequestWithSession) {
     // Business logic
     // RLS policies automatically enforce access
   }
   ```

3. **Apply Middleware**
   ```typescript
   export async function POST(request: NextRequest) {
     return composeMiddleware(
       requireAuth,
       blockPlatformAdmin,
       requireRole(...),
       withAudit(...)
     )(request as RequestWithSession, handler);
   }
   ```

4. **Write Tests**
   - Unit tests for business logic
   - Integration tests for middleware stack
   - Security tests (blocked scenarios)

5. **Security Review**
   - Verify middleware stack
   - Check RLS policies
   - Validate audit trail
   - Test error scenarios

---

## 🎉 Status

- ✅ **Database Schema** - Complete (15 tables, 1,750 lines SQL)
- ✅ **RLS Policies** - Complete (47 policies)
- ✅ **Auth/RBAC** - Complete (5 middleware, types, helpers)
- ✅ **Power of Attorney** - Complete (table, validation, workflow)
- ✅ **Documentation** - Complete (8 comprehensive guides)
- ⏭️ **API Implementation** - Ready to start
- ⏭️ **Frontend** - Ready to start
- ⏭️ **Testing** - Ready to start

**Ready for development sprint!** 🚀

---

## 📞 Support

- **Technical Issues**: dev@ai-pajak.com
- **Security Concerns**: security@ai-pajak.com
- **Legal Questions**: legal@ai-pajak.com

---

## 📄 License

Proprietary - Mono Flip Global © 2025
