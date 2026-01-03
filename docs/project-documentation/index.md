# AI Pajak - 프로젝트 문서 인덱스

> **생성일**: 2026-01-03
> **스캔 레벨**: Quick Scan
> **BMAD 버전**: 6.0.0

---

## 프로젝트 개요

| 항목 | 값 |
|------|-----|
| **저장소 타입** | Monorepo (npm workspaces) |
| **파트 수** | 2개 (api, web) |
| **주요 언어** | TypeScript |
| **아키텍처** | Modular Monolith + SPA |

### 파트별 요약

| Part ID | 타입 | 기술 스택 | 루트 |
|---------|------|----------|------|
| `api` | Backend | NestJS + Prisma + PostgreSQL | `apps/api/` |
| `web` | Frontend | React + Vite + TailwindCSS | `apps/web/` |

---

## 생성된 문서

### 핵심 문서

| 문서 | 설명 |
|------|------|
| [프로젝트 개요](./project-overview.md) | 프로젝트 소개 및 구조 |
| [아키텍처 - API](./architecture-api.md) | API 아키텍처 및 모듈 구조 |
| [아키텍처 - Web](./architecture-web.md) | Web 아키텍처 및 컴포넌트 구조 |
| [통합 아키텍처](./integration-architecture.md) | 파트 간 통합 방법 |

### 기술 문서

| 문서 | 설명 |
|------|------|
| [API 계약](./api-contracts.md) | REST API 엔드포인트 명세 |
| [데이터 모델](./data-models.md) | Prisma 스키마 및 엔티티 관계 |
| [개발 가이드](./development-guide.md) | 로컬 개발 환경 설정, Docker, 마이그레이션 |

---

## 기존 문서

### PRD (제품 요구사항)

| 문서 | 경로 |
|------|------|
| PRD 인덱스 | [../PRD/README.md](../PRD/README.md) |
| 비즈니스 분석 | [../PRD/core/](../PRD/core/) |
| 기능 명세 | [../PRD/features/](../PRD/features/) |
| 페르소나 | [../PRD/personas/](../PRD/personas/) |
| 운영 워크플로우 | [../PRD/workflows/](../PRD/workflows/) |

### ERD (데이터베이스)

| 문서 | 경로 |
|------|------|
| ERD 인덱스 | [../ERD/README.md](../ERD/README.md) |
| 도메인별 ERD | [../ERD/erd-*.md](../ERD/) |
| 스키마 상세 | [../ERD/schemas/](../ERD/schemas/) |

---

## 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
# DATABASE_URL 및 PADDLEOCR_SERVICE_URL 설정
```

### 3. 데이터베이스 마이그레이션

```bash
npm run prisma:generate
cd apps/api && npm run prisma:migrate
```

### 4. 개발 서버 실행

```bash
npm run dev
```

- **Web**: http://localhost:5173
- **API**: http://localhost:3000
- **Swagger**: http://localhost:3000/swagger

---

## 기술 부채 및 개선 필요사항

| 영역 | 현재 상태 | 권장 조치 | 우선순위 |
|------|----------|----------|----------|
| UI 컴포넌트 | TailwindCSS만 사용 | shadcn/ui 도입 | 높음 |
| UI 렌더링 | 문제 있음 | 디버깅 필요 | 높음 |
| 컨테이너화 | Docker 없음 | Dockerfile 추가 | 중간 |
| DB 가이드 | 문서 부족 | 마이그레이션 가이드 작성 | 중간 |
| API 중복 | `api/` + `services/` 중복 | 통합 필요 | 낮음 |

---

## 다음 단계

BMAD 워크플로우에서 권장하는 다음 단계:

1. **[create-architecture]** - 아키텍처 결정사항 문서화
2. **[create-epics-and-stories]** - 에픽 및 스토리 생성
3. **[check-implementation-readiness]** - 구현 준비 상태 검증

### 기술 부채 해결

1. Docker 설정 파일 생성 (`apps/api/Dockerfile`, `docker-compose.yml`)
2. shadcn/ui 컴포넌트 도입
3. UI 렌더링 문제 디버깅

---

## 문서 메타데이터

```json
{
  "generated_by": "BMAD Document Project Workflow",
  "scan_level": "quick",
  "workflow_mode": "initial_scan",
  "parts_documented": ["api", "web"],
  "files_generated": 7
}
```
