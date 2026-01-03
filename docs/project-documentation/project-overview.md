# AI Pajak - 프로젝트 개요

## 개요

AI Pajak는 인도네시아를 위한 AI 기반 세금 관리 플랫폼입니다. 개인, UMKM 사업체 및 법인을 위한 SPT Masa (월별) 및 SPT Tahunan (연간) 세금 신고를 DJP (세무국) 통합을 통해 처리합니다.

## 법적 구조

| 주체 | 역할 |
|------|------|
| **AI Pajak (플랫폼)** | Mono Flip Global이 운영 |
| **Jakarta Tax Consulting** | 세금 신고 서비스 제공 (독점) |

> **중요**: AI Pajak 플랫폼은 직접 세금 신고 서비스를 제공하지 않습니다.

## 저장소 구조

| 타입 | 설명 |
|------|------|
| **Monorepo** | npm workspaces 사용 |
| **파트 수** | 2개 (api, web) |

### 파트 구성

| Part ID | 타입 | 기술 스택 | 포트 |
|---------|------|----------|------|
| `api` | Backend | NestJS + Prisma + PostgreSQL | 3000 |
| `web` | Frontend | React + Vite + TailwindCSS | 5173 |

## 기술 스택 요약

### Backend (API)
- **Framework**: NestJS 10.x
- **Language**: TypeScript 5.x
- **ORM**: Prisma 5.x
- **Database**: PostgreSQL
- **Documentation**: Swagger

### Frontend (Web)
- **Framework**: React 18.x
- **Build Tool**: Vite 5.x
- **Styling**: TailwindCSS 3.x
- **Routing**: React Router 7.x

### OCR Service (마이그레이션 예정)
- **Engine**: PaddleOCR
- **Language**: Python
- **Purpose**: 세금 문서 OCR 처리

## 핵심 도메인

### 세금 타입
- `PPh21` - 직원 소득세
- `PPh23` - 원천징수세
- `VAT` - 부가가치세
- `ANNUAL` - 연간 세금

### 워크플로우 스테이지
```
UPLOADED → AI_ANALYZED → HUMAN_REVIEW → APPROVED → FILED
```

## 사용자 역할 (5개)

| 역할 | 권한 |
|------|------|
| `CUSTOMER` | 최종 고객 |
| `CONSULTANT_JTC` | 세금 계산만 가능 |
| `TAX_ADVISOR_JTC` | 세금 계산 + 신고 가능 (POA 필요) |
| `PLATFORM_ADMIN` | 세금 데이터 접근 불가 |
| `SYSTEM` | 빌링 전용, 세금 데이터 접근 불가 |

## 문서 링크

- [아키텍처 - API](./architecture-api.md)
- [아키텍처 - Web](./architecture-web.md)
- [API 계약](./api-contracts.md)
- [데이터 모델](./data-models.md)
- [개발 가이드](./development-guide.md)
- [통합 아키텍처](./integration-architecture.md)

## 기존 문서

- [PRD 문서](../PRD/README.md)
- [ERD 문서](../ERD/README.md)
