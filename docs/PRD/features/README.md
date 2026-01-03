# Core Features

**Navigation**: [Home](../README.md) | [Personas](../personas/README.md) | [User Stories](../user-stories/README.md)

---

## Overview

AI PAJAK's features are organized by user persona and tax filing type. All features integrate with DJP's official systems (e-Filing, e-Billing, e-Faktur, e-Bupot).

---

## Feature Categories

### [Tax Consultant Features](tax-consultant-features.md)
**For**: Individual taxpayers (근로소득자)
- Form 1721-A1 OCR
- SPT 1770 SS auto-generation
- PTKP auto-calculation
- March deadline reminders
- Tax refund tracking

---

### [Accountant Features](accountant-features.md)
**For**: UMKM business owners
- Monthly PPh Final automation (0.5%)
- Bank account integration
- Monthly reminders (15th deadline)
- Year 3→4 transition warnings
- Receipt OCR (expense tracking)

---

### [Executive Features](executive-features.md)
**For**: Corporate (PT) & Tax Consultants
- **Corporate**: Accurate integration, PPh 21 bulk processing, e-Faktur reconciliation
- **Consultants**: Multi-client dashboard, bulk submission, client portal

---

### [MVP Scope](mvp-scope.md)
**Phase 1 priorities**: P0 features for launch

---

## Feature Matrix by Persona

| Feature | Individual | UMKM | PT | Consultant |
|---------|-----------|------|-----|------------|
| **OCR Engine** | Form 1721-A1 | Receipts | - | - |
| **Tax Calc** | Progressive | PPh Final 0.5% | PPh 21 + 25 | All types |
| **Reminders** | March (D-30/14/7) | Monthly (D-5/1) | Monthly | Client deadlines |
| **e-Filing** | SPT 1770 SS | SPT Masa | SPT Masa + Badan | Bulk (35 clients) |
| **Integrations** | Email | Bank | Accurate + e-Faktur | All |
| **Dashboard** | Personal | Business | Corporate | Multi-client |

---

## Technical Architecture

### Stack
- **Cloud**: Amazon Web Services (AWS)
- **Frontend**: React + Vite + TailwindCSS
- **Backend**: NestJS + Prisma
- **Database**: RDS PostgreSQL
- **Auth**: TBD (AWS Cognito / Supabase Auth / Clerk 검토 중) + RBAC
- **Storage**: S3 (receipts, forms, BPE)
- **OCR**: PaddleOCR + Gemini Vision (Fallback)
- **Payments**: Midtrans
- **Notifications**: WhatsApp Business API + Email

### DJP Integration
- **e-Filing**: SPT Masa + SPT Tahunan submission
- **e-Billing**: Tax payment voucher generation
- **e-Faktur**: PPN invoice management (for PKP)
- **e-Bupot**: PPh withholding certificates

See: [Technical Architecture](../06-user-flows.md) for detailed system design

---

## Feature Development Roadmap

### Phase 0: Infrastructure (In Progress 🟡)
- AWS 프로젝트 설정
- Authentication 솔루션 결정 필요 (AWS Cognito / Supabase Auth / Clerk)
- RBAC 구현
- Database schema (RDS PostgreSQL)
- Basic UI components

### Phase 1: MVP (Months 1-3)
- Individual: Form 1721 OCR + SPT filing
- UMKM: PPh Final automation
- Consultant: Multi-client dashboard
- DJP e-Filing integration

### Phase 2: Automation (Months 4-6)
- Bank account integration
- Accurate integration
- e-Faktur integration
- Bulk submission

### Phase 3: Advanced (Months 7-12)
- Receipt OCR + auto-categorization
- SPT Badan auto-generation
- White-label for consultants
- Mobile app

### Phase 4: Scale (Year 2)
- AI tax optimization
- Multi-entity support
- API for enterprises
- Regional expansion

See: [Roadmap](../roadmap/phase-overview.md) for detailed timeline

---

## Related Documents

- [User Stories](../user-stories/README.md) - User requirements
- [MVP Scope](mvp-scope.md) - Phase 1 priorities
- [Technical Flows](../06-user-flows.md) - System architecture
- [Roadmap](../roadmap/phase-overview.md) - Development phases

---

**Last Updated**: 2025-12-23
**Source**: Extracted from PRD.md section 4
