# AI PAJAK Documentation

> 모든 문서의 시작점 | Last Updated: 2026-02-14

---

## Quick Start

| 문서 | 용도 |
|-----|------|
| [PRD/mvp-scope.md](PRD/mvp-scope.md) | MVP 범위 및 기능 목록 |
| [PRD/executive-summary.md](PRD/executive-summary.md) | 프로젝트 개요 |
| [API/implementation-status.md](API/implementation-status.md) | API 구현 상태 (48개 엔드포인트) |
| [ERD/README.md](ERD/README.md) | 데이터베이스 설계 |

---

## Implementation Status

| 기능 | 상태 | 비고 |
|------|------|------|
| 인증 (Auth) | 100% | 로그인, 회원가입, 프로필 |
| 세금 신고 (SPT) | 100% | 1770SS, 1770S, 1770, 1771 |
| 고객 관리 | 100% | NPWP/NIK 기반 |
| 문서 관리 | 100% | OCR 지원 |
| 위임장 (POA) | 100% | 디지털 서명 + QR |
| 결제 | 100% | Midtrans 연동 |
| DJP 연동 | 100% | 세무청 API |
| 리포트 | 100% | 세금 요약, 신고 이력 |
| 설정 | 100% | 프로필, 비밀번호, 알림 |
| 2FA | 준비 중 | 향후 구현 예정 |

---

## Folder Structure

```
docs/
├── PRD/          # Product Requirements (제품 요구사항)
├── ERD/          # Database Design (DB 설계)
├── API/          # API Specification (API 명세)
├── UI/           # UI/UX Design (화면 설계)
├── guides/       # Development Guides (개발 가이드)
├── specs/        # Feature Specifications (기능 스펙)
└── prompts/      # AI Prompts (AI 프롬프트)
```

---

## PRD (제품 요구사항)

| 파일 | 내용 |
|-----|------|
| `executive-summary.md` | 비전, 문제, 솔루션 |
| `legal-structure.md` | 3사 법적 구조 |
| `mvp-scope.md` | MVP 기능 범위 |
| `business-model.md` | 수익 모델 |
| `market-analysis.md` | 시장 분석 |

### Personas
| 파일 | 역할 |
|-----|------|
| `tax-consultant.md` | 세무사 |
| `accountant.md` | 회계사 |
| `ceo.md` | CEO |
| `cfo.md` | CFO |

### Workflows
| 파일 | 프로세스 |
|-----|---------|
| `phase-1-operator-workflow.md` | Phase 1 운영 워크플로우 |
| `consultant-manual.md` | 상담원 매뉴얼 |
| `operations-manual.md` | 운영 매뉴얼 |

---

## ERD (데이터베이스)

| 파일 | 내용 |
|-----|------|
| `README.md` | 전체 ERD 개요 |
| `erd-core-entities.md` | 핵심 엔티티 |
| `erd-tax-filing.md` | 세금 신고 |
| `erd-billing.md` | 청구/결제 |
| `data-dictionary.md` | 데이터 사전 |
| `rls-policies.md` | Row Level Security |
| `hard-rules-enforcement.md` | 5 Hard Rules |

---

## API

| 파일 | 내용 |
|-----|------|
| `implementation-status.md` | **API 구현 상태 (48개)** |
| `rest-api-spec.md` | REST API 명세 |
| `authentication.md` | 인증 |
| `billing-api.md` | 결제 API |
| `tax-filing-api.md` | 세금 신고 API |
| `customer-api.md` | 고객 API |

---

## UI

| 파일 | 내용 |
|-----|------|
| `design-system.md` | 디자인 시스템 |
| `user-flows.md` | 사용자 플로우 |
| `dashboard.md` | 대시보드 |
| `login-register.md` | 로그인/회원가입 |
| `tax-filing-form.md` | 세금 신고 양식 |
| `reports.md` | 리포트 화면 |

---

## Guides

| 파일 | 내용 |
|-----|------|
| `SETUP.md` | 개발 환경 설정 |
| `project-development-principles.md` | 개발 원칙 |
| `architecture.md` | **시스템 아키텍처** |
| `resilience-patterns.md` | **Resilience 패턴 가이드** |

### API Reference
| 파일 | 내용 |
|-----|------|
| `api-reference.md` | **API 레퍼런스 문서** |

---

## Specs

| 파일 | 내용 |
|-----|------|
| `001-initial-setup/spec.md` | 초기 설정 스펙 |
| `001-initial-setup/plan.md` | 구현 계획 |
| `001-initial-setup/data-model.md` | 데이터 모델 |

---

## Related Files

| 파일 | 위치 | 내용 |
|-----|------|------|
| `README.md` | 루트 | 프로젝트 개요 |
| `CLAUDE.md` | 루트 | 개발 가이드라인 |
| `supabase/README.md` | supabase/ | DB 마이그레이션 가이드 |

---

**Last Updated**: 2026-02-14
