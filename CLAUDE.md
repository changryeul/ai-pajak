# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Pajak is an AI-powered tax management platform for Indonesia. It handles SPT Masa (monthly) and SPT Tahunan (annual) tax filings for individuals, UMKM businesses, and corporations via integration with DJP (Directorate General of Taxes).

**Legal Structure**: AI Pajak (Platform) is operated by Mono Flip Global. Tax filing services are provided exclusively by Jakarta Tax Consulting - the platform does NOT provide tax filing services directly.

## Commands

```bash
# Install dependencies (from root)
npm install

# Development (runs both API and Web concurrently)
npm run dev

# Run only API (NestJS on port 3000)
npm run dev:api

# Run only Web (Vite React on port 5173)
npm run dev:web

# Build
npm run build:api
npm run build:web

# Prisma
npm run prisma:generate    # Generate Prisma client
npm run prisma:studio      # Open Prisma Studio

# API-specific (from apps/api)
npm run lint               # ESLint
npm run test               # Jest tests
npm run prisma:migrate     # Run migrations
```

## Architecture

### Monorepo Structure

```
ai-pajak/
├── apps/
│   ├── api/          # NestJS backend (port 3000)
│   └── web/          # Vite + React frontend (port 5173)
├── prisma/           # Shared Prisma schema
└── docs/             # PRD, ERD, and feature specs
```

### API Architecture (NestJS)

The API follows a modular NestJS pattern with a centralized repository layer:

```
apps/api/src/
├── repository/
│   ├── prisma.service.ts        # Prisma client singleton
│   └── repositories/            # Domain-specific repositories
│       ├── taxcase.repository.ts
│       ├── workflow.repository.ts
│       ├── company.repository.ts
│       └── ...
├── taxcase/                     # Core domain module
│   ├── taxcase.service.ts       # Basic CRUD
│   ├── review-workflow.service.ts  # Workflow state machine
│   └── utils/workflow-actions.ts   # Stage-based action permissions
├── filing/                      # Tax filing submissions
├── communication/               # AI/Human messaging
└── company/                     # Company management
```

**Key Pattern**: All database access goes through repositories in `repository/repositories/`. Services inject these repositories via NestJS DI.

### Workflow State Machine

TaxCase entities follow a strict workflow with 5 stages:

```
UPLOADED → AI_ANALYZED → HUMAN_REVIEW → APPROVED → FILED
```

Stage transitions are managed by `ReviewWorkflowService` and permissions are determined by `getWorkflowActions()`:

| Stage | Allowed Actions |
|-------|-----------------|
| UPLOADED | Apply AI result |
| AI_ANALYZED | Move to human review |
| HUMAN_REVIEW | Override AI / Approve |
| APPROVED | File tax case |
| FILED | (terminal state) |

### Frontend Architecture (React + Vite)

```
apps/web/src/
├── api/              # API client functions
├── components/       # Reusable UI components
├── domain/           # Business logic (workflow actions)
├── pages/            # Route-level components
├── services/         # External service integrations (Gemini AI)
├── views/            # Feature views (Landing, TaxCaseDetail, etc.)
└── types/            # TypeScript interfaces
```

Routes are defined in `App.tsx`. The app uses React Router v7 with TailwindCSS for styling.

### Database Schema (Prisma)

Core entities:
- `Company` → `TaxCase` → `WorkflowState`
- `TaxCase` has: `AIResult[]`, `HumanReview[]`, `TaxFiling[]`, `Communication[]`, `AuditLog[]`

Tax types: `PPh21`, `PPh23`, `VAT`, `ANNUAL`

**Note**: BigInt is used for IDs. The API includes a BigInt JSON serialization patch in `main.ts`.

### API Documentation

Swagger UI available at `http://localhost:3000/swagger` when running the API.

## Domain-Specific Considerations

### Legal Compliance (Critical)

- Platform admins **CANNOT** access customer tax data
- All tax consultants are Jakarta Tax Consulting employees, not AI Pajak employees
- All DJP filings must be logged as Jakarta Tax Consulting actions
- UI messaging must never say "AI Pajak will file your taxes" - use "Connect with Tax Consultant" instead

### User Roles (5 roles)

1. `CUSTOMER` - End customer
2. `CONSULTANT_JTC` - Can calculate taxes only
3. `TAX_ADVISOR_JTC` - Can calculate + file (requires POA)
4. `PLATFORM_ADMIN` - No tax data access
5. `SYSTEM` - Billing only, no tax data access

### Key Documentation

- `docs/PRD/` - Product requirements and personas
- `docs/ERD/` - Database schema documentation
- `docs/PRD/workflows/` - Operational workflows for tax filing
