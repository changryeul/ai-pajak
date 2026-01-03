---
stepsCompleted: [1, 2, 3, 4]
workflowType: 'epics-and-stories'
lastStep: 4
status: complete
completedAt: '2026-01-03'
totalEpics: 10
totalStories: 45
frCoverage: '14/14 (100%)'
nfrCoverage: 'Epic 10에서 처리'
notes: |
  - Deploy/Terraform은 Epic 10 (마지막)으로 이동
  - 각 Epic 완료 후 UI 테스트 가능하도록 UI Story 포함
  - 로컬 개발 우선, 배포는 마지막
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# AI Pajak Phase 2 - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for AI Pajak Phase 2, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

**FR-1: DJP API 통합 (P0)**
- FR-1.1: DJP e-Filing API를 통한 SPT 직접 제출 (PPh 21, PPh 23, PPh Final, PPN)
- FR-1.2: e-Billing API 연동 - ID Billing 자동 생성, 납부 코드 실시간 조회, NTPN 검증
- FR-1.3: BPE 자동 처리 - 제출 후 BPE 자동 다운로드, PDF 저장, 이메일/WhatsApp 자동 발송
- FR-1.4: 일괄 제출 - 35+ 고객 동시 제출, 병렬 처리, 실패 건 자동 재시도 (최대 3회)

**FR-2: PaddleOCR 통합 (P0)**
- FR-2.1: 문서 인식 - 1721-A1 양식 OCR, e-Faktur PDF 파싱, 영수증/송장 텍스트 추출
- FR-2.2: 테이블 추출 - PP-StructureV3 기반 테이블 인식, 급여 명세서/세금 계산서 파싱
- FR-2.3: 하이브리드 Fallback - 신뢰도 < 85%시 Gemini Flash API 호출, 처리 불가 문서는 수동 검토 큐 이동

**FR-3: e-Faktur PPN 지원 (P0)**
- FR-3.1: e-Faktur 생성 - PPN 거래 데이터 기반 자동 생성, NPWP 자동 검증, QR 코드 생성
- FR-3.2: e-Faktur 업로드 - DJP e-Faktur 시스템 연동, 승인 상태 자동 확인, 거부 시 오류 메시지 파싱

**FR-4: 워크플로우 자동화 (P1)**
- FR-4.1: 자동 상태 전이 - AI_ANALYZED → HUMAN_REVIEW 자동 알림, APPROVED → FILED 자동 DJP 제출
- FR-4.2: 스케줄 기반 처리 - 마감일 D-3 미승인 건 알림, D-1 긴급 처리 큐, 당일 최종 일괄 제출
- FR-4.3: 알림 자동화 - 제출 완료/실패 알림, BPE 수신 시 고객 이메일/WhatsApp

**FR-5: Audit & Compliance (P0)**
- FR-5.1: 제출 귀속 로깅 - 모든 DJP 제출은 Jakarta Tax Consulting 귀속, 컨설턴트 ID/POA ID 기록
- FR-5.2: POA 자동 검증 - 제출 전 POA 유효성 확인, 만료 예정 POA 사전 알림 (30일 전), 만료된 POA 제출 차단

### Non-Functional Requirements

**NFR-1: 성능**
- DJP API 응답 시간: 5초 이내 (p95)
- OCR 처리 시간: 3초/페이지 이내
- 일괄 제출 처리량: 100건/분
- 시스템 가동률: 99.9%

**NFR-2: 보안**
- DJP 자격증명 저장: AES-256 암호화, HSM 권장
- API 통신: TLS 1.3 필수
- 접근 제어: 기존 5-role RBAC 유지
- Audit Log: 불변성 보장 (Append-only)

**NFR-3: 확장성**
- 동시 사용자: 500+
- 월간 제출 건수: 10,000+
- 저장 용량: BPE/e-Faktur 무제한

**NFR-4: 가용성**
- DJP API 장애 시: 큐잉 후 자동 재시도
- 데이터 백업: 일일 증분, 주간 전체
- 복구 시간 목표 (RTO): 4시간
- 복구 지점 목표 (RPO): 1시간

### Additional Requirements

**Architecture 요구사항:**
- Brownfield 프로젝트 - 기존 NestJS/React 스택 확장 (Module Extension 방식)
- Bull Queue + Redis 통합 (비동기 작업 처리)
- PaddleOCR Python 서비스 Docker 컨테이너 (Port 8080)
- AWS 인프라: ECS Fargate, RDS PostgreSQL, ElastiCache Redis
- Terraform IaC 구성
- OAuth 2.0 기반 DJP 인증 (Jakarta Tax Consulting 자격증명)
- 신규 DB 테이블: djp_submission, bpe_documents, poa_validation_cache
- ocr_results 테이블 확장: ocr_engine, confidence_score, processing_time_ms, fallback_used

**UX 요구사항:**
- shadcn/ui 전면 도입 (기존 TailwindCSS 컴포넌트 교체)
- Modern DJP 디자인 테마 (정부 스타일 + 현대적 SaaS)
- Desktop First, Mobile Responsive 플랫폼 전략
- Sidebar Navigation 패턴
- 5-Stage Workflow Visualization (UPLOADED → AI_ANALYZED → HUMAN_REVIEW → APPROVED → FILED)
- OCR Confidence Indicator (90%+ 녹색, 70-89% 주황색, <70% 빨간색)
- Bulk Submit UI 패턴 (체크박스 선택, 진행률 표시, 결과 요약)
- BPE Download Card 컴포넌트
- 역할별 Dashboard (Customer, Consultant, Tax Advisor, Platform Admin)

### FR Coverage Map

| FR | Epic | 설명 |
|----|------|------|
| FR-1.1 | E3 | e-Filing API 연동 (SPT 직접 제출) |
| FR-1.2 | E5 | e-Billing API 연동 (ID Billing 생성) |
| FR-1.3 | E3 | BPE 자동 처리 (다운로드 및 저장) |
| FR-1.4 | E4 | 일괄 제출 (35+ 고객 동시) |
| FR-2.1 | E2 | 문서 인식 (1721-A1, e-Faktur) |
| FR-2.2 | E2 | 테이블 추출 (PP-StructureV3) |
| FR-2.3 | E2 | 하이브리드 Fallback (Gemini) |
| FR-3.1 | E6 | e-Faktur 생성 (QR 코드 포함) |
| FR-3.2 | E6 | e-Faktur 업로드 (DJP 연동) |
| FR-4.1 | E4 | 자동 상태 전이 |
| FR-4.2 | E7 | 스케줄 기반 처리 |
| FR-4.3 | E7, E9 | 알림 자동화 |
| FR-5.1 | E8 | 제출 귀속 로깅 (Jakarta Tax Consulting) |
| FR-5.2 | E8 | POA 자동 검증 |

## Epic List

### Epic 1: Development Foundation & Infrastructure
개발 팀이 Phase 2 기능을 구현할 수 있는 기반 환경을 구축합니다. shadcn/ui Design System 설정, AWS 인프라 Terraform 구성, Bull Queue + Redis 통합, PaddleOCR Docker 서비스 설정, 신규 DB 스키마 마이그레이션을 포함합니다.

**FRs covered:** Architecture 요구사항 (기반 인프라)

### Epic 2: 문서 업로드 및 OCR 자동 처리
Tax Consultant가 고객 세금 문서를 업로드하면 PaddleOCR이 자동으로 데이터를 추출합니다. 1721-A1 양식, e-Faktur PDF, 영수증 등 다양한 문서 형식을 지원하며, 신뢰도가 낮은 경우 Gemini Flash로 자동 Fallback합니다.

**FRs covered:** FR-2.1, FR-2.2, FR-2.3

### Epic 3: DJP 단일 케이스 제출
Tax Advisor가 승인된 세금 케이스를 DJP e-Filing API를 통해 직접 제출하고, BPE(전자 접수증)를 자동으로 수신합니다. PPh 21, PPh 23, PPh Final, PPN 세금 유형을 지원합니다.

**FRs covered:** FR-1.1, FR-1.3

### Epic 4: 일괄 제출 및 실시간 모니터링
Tax Advisor가 35개 이상의 고객 케이스를 일괄 선택하여 DJP에 제출하고, 실시간으로 진행 상황을 모니터링합니다. 병렬 처리와 자동 재시도 기능을 포함합니다.

**FRs covered:** FR-1.4, FR-4.1

### Epic 5: e-Billing 생성 및 납부 관리
Tax Consultant가 고객의 e-Billing을 일괄 생성하고 납부 상태를 추적합니다. ID Billing 자동 생성, NTPN 검증 기능을 포함합니다.

**FRs covered:** FR-1.2

### Epic 6: e-Faktur PPN 자동 처리
Tax Consultant가 PPN 거래 데이터를 기반으로 e-Faktur를 자동 생성하고 DJP e-Faktur 시스템에 업로드합니다. NPWP 자동 검증, QR 코드 생성, 승인/거부 상태 확인을 포함합니다.

**FRs covered:** FR-3.1, FR-3.2

### Epic 7: 스케줄 기반 워크플로우 자동화
시스템이 마감일 기반으로 자동 알림을 발송하고 긴급 처리 큐를 관리합니다. D-3 미승인 건 알림, D-1 긴급 처리, 당일 최종 일괄 제출을 포함합니다.

**FRs covered:** FR-4.2, FR-4.3

### Epic 8: POA 검증 및 Audit 추적
모든 DJP 제출에 대한 POA 유효성을 자동 검증하고, Jakarta Tax Consulting 귀속으로 완전한 감사 추적을 수행합니다. 만료 예정 POA 사전 알림, 만료된 POA 제출 차단을 포함합니다.

**FRs covered:** FR-5.1, FR-5.2

### Epic 9: Customer BPE 확인 및 알림
고객이 세금 신고 완료 알림과 BPE를 이메일/WhatsApp으로 자동 수신합니다. Customer Dashboard에서 BPE 다운로드 및 진행 상황 확인이 가능합니다.

**FRs covered:** FR-4.3 (고객 측면)

### Epic 10: Production Deployment & Infrastructure
로컬 개발이 완료된 후 AWS 인프라를 구성하고 프로덕션 환경에 배포합니다. Terraform IaC, CI/CD 파이프라인, 모니터링 설정을 포함합니다.

**FRs covered:** NFR-1 (성능), NFR-3 (확장성), NFR-4 (가용성)

---

## Epic 1: Development Foundation & Infrastructure

개발 팀이 Phase 2 기능을 구현할 수 있는 기반 환경을 구축합니다.

### Story 1.1: shadcn/ui 초기화 및 Design System 설정

As a **Developer**,
I want shadcn/ui가 프로젝트에 초기화되고 Design System이 설정되도록,
So that 일관된 UI 컴포넌트를 사용하여 개발할 수 있습니다.

**Acceptance Criteria:**

**Given** apps/web 프로젝트가 존재할 때
**When** shadcn/ui 초기화 명령을 실행하면
**Then** components.json 설정 파일이 생성됩니다
**And** globals.css에 DJP 테마 CSS 변수가 설정됩니다
**And** tailwind.config.cjs에 shadcn 확장 설정이 추가됩니다
**And** Button, Card, Input, Badge, Dialog 등 P0 컴포넌트가 설치됩니다

### Story 1.2: Bull Queue + Redis 통합

As a **Developer**,
I want Bull Queue와 Redis가 NestJS에 통합되도록,
So that 비동기 작업(DJP 제출, OCR 처리)을 큐로 처리할 수 있습니다.

**Acceptance Criteria:**

**Given** apps/api 프로젝트가 존재할 때
**When** QueueModule이 생성되면
**Then** @nestjs/bull과 bull 패키지가 설치됩니다
**And** Redis 연결 설정이 환경변수로 구성됩니다
**And** 테스트용 큐(test-queue)가 정상 동작합니다
**And** 큐 작업 추가/처리 로그가 기록됩니다

### Story 1.3: PaddleOCR Docker 서비스 설정

As a **Developer**,
I want PaddleOCR Python 서비스가 Docker로 실행되도록,
So that OCR 처리를 위한 독립 서비스를 사용할 수 있습니다.

**Acceptance Criteria:**

**Given** services/paddleocr 디렉토리가 생성될 때
**When** Docker 이미지를 빌드하면
**Then** Dockerfile이 PP-OCRv5 모델을 포함합니다
**And** FastAPI 엔드포인트 /ocr/process가 동작합니다
**And** 포트 8080에서 서비스가 실행됩니다
**And** 테스트 이미지 OCR 처리가 성공합니다

### Story 1.4: 신규 DB 스키마 마이그레이션

As a **Developer**,
I want Phase 2에 필요한 신규 테이블이 생성되도록,
So that DJP 제출, BPE, POA 데이터를 저장할 수 있습니다.

**Acceptance Criteria:**

**Given** prisma/schema.prisma가 존재할 때
**When** 마이그레이션을 실행하면
**Then** djp_submission 테이블이 생성됩니다
**And** bpe_documents 테이블이 생성됩니다
**And** poa_validation_cache 테이블이 생성됩니다
**And** ocr_results 테이블에 ocr_engine, confidence_score, processing_time_ms, fallback_used 컬럼이 추가됩니다
**And** 필요한 인덱스가 생성됩니다

### Story 1.5: 공통 레이아웃 및 네비게이션 UI

As a **Developer**,
I want 공통 레이아웃과 역할별 네비게이션이 구현되도록,
So that 모든 페이지에서 일관된 UI 경험을 제공할 수 있습니다.

**Acceptance Criteria:**

**Given** shadcn/ui가 설정되었을 때
**When** MainLayout과 Sidebar 컴포넌트를 구현하면
**Then** DashboardLayout이 Sidebar + Main Content 구조로 렌더링됩니다
**And** 역할별(Customer, Consultant, Tax Advisor) 메뉴가 다르게 표시됩니다
**And** Header에 사용자 정보와 알림 아이콘이 표시됩니다
**And** 로컬 개발 환경에서 테스트 가능합니다

### Story 1.6: Consultant/Advisor 대시보드 기본 UI

As a **Tax Consultant**,
I want 대시보드에서 고객 현황을 한눈에 확인하도록,
So that 작업 우선순위를 파악할 수 있습니다.

**Acceptance Criteria:**

**Given** 로그인한 Consultant/Advisor가 대시보드에 접속할 때
**When** 대시보드 페이지가 로드되면
**Then** 담당 고객 수, 진행 상태 분포가 카드로 표시됩니다
**And** 긴급 처리 필요 건수가 강조 표시됩니다
**And** 최근 활동 목록이 표시됩니다
**And** 로컬에서 Mock 데이터로 테스트 가능합니다

---

## Epic 2: 문서 업로드 및 OCR 자동 처리

Tax Consultant가 고객 세금 문서를 업로드하면 PaddleOCR이 자동으로 데이터를 추출합니다.

### Story 2.1: PaddleOCR 서비스 API 연동

As a **Developer**,
I want NestJS가 PaddleOCR 서비스와 통신하도록,
So that 문서 OCR 처리 요청을 전달할 수 있습니다.

**Acceptance Criteria:**

**Given** PaddleOCR Docker 서비스가 실행 중일 때
**When** OcrModule의 paddleocr.client.ts를 통해 요청하면
**Then** 이미지/PDF 파일을 PaddleOCR 서비스로 전송합니다
**And** OCR 결과(텍스트, 좌표, 신뢰도)를 JSON으로 수신합니다
**And** 타임아웃(30초) 및 재시도(3회) 로직이 적용됩니다
**And** 연결 실패 시 적절한 에러가 반환됩니다

### Story 2.2: 문서 업로드 UI 및 API

As a **Tax Consultant**,
I want 드래그 앤 드롭으로 세금 문서를 업로드하도록,
So that 편리하게 문서를 제출할 수 있습니다.

**Acceptance Criteria:**

**Given** 로그인한 Tax Consultant가 문서 업로드 페이지에 있을 때
**When** 파일을 드래그 앤 드롭하거나 파일 선택하면
**Then** 업로드 진행률이 표시됩니다
**And** 지원 형식(PDF, JPG, PNG) 검증이 수행됩니다
**And** 업로드 완료 시 OCR 처리가 자동 시작됩니다
**And** "OCR 처리 중..." 스피너가 표시됩니다

### Story 2.3: OCR 처리 백엔드

As a **System**,
I want 업로드된 문서가 OCR 큐로 처리되도록,
So that 비동기로 안정적인 처리가 가능합니다.

**Acceptance Criteria:**

**Given** 문서가 업로드되었을 때
**When** OCR 처리 작업이 큐에 추가되면
**Then** PaddleOCR 서비스로 파일이 전송됩니다
**And** 처리 완료 시 결과가 DB에 저장됩니다
**And** 3초/페이지 이내에 처리가 완료됩니다
**And** 처리 상태가 실시간 업데이트됩니다

### Story 2.4: Gemini Flash Fallback 처리

As a **System**,
I want OCR 신뢰도가 낮을 때 Gemini Flash로 재처리되도록,
So that 정확도가 높은 결과를 얻을 수 있습니다.

**Acceptance Criteria:**

**Given** PaddleOCR 결과의 신뢰도가 85% 미만일 때
**When** Fallback 처리가 트리거되면
**Then** Gemini Flash API로 동일 문서를 전송합니다
**And** Gemini 결과가 ocr_engine(GEMINI)으로 저장됩니다
**And** fallback_used가 true로 설정됩니다
**And** 원본 PaddleOCR 신뢰도가 로그에 기록됩니다

### Story 2.5: OCR 결과 검토 UI

As a **Tax Consultant**,
I want OCR 결과를 원본 문서와 나란히 검토하도록,
So that 추출된 데이터의 정확성을 확인할 수 있습니다.

**Acceptance Criteria:**

**Given** OCR 처리가 완료된 문서가 있을 때
**When** OCR 검토 페이지를 열면
**Then** 왼쪽에 원본 문서 이미지가 표시됩니다
**And** 오른쪽에 추출된 데이터 필드가 표시됩니다
**And** 각 필드 옆에 신뢰도 표시기가 있습니다 (녹색/주황색/빨간색)
**And** 저신뢰도 필드는 수정 가능하도록 강조됩니다
**And** "확인" 버튼으로 검토를 완료할 수 있습니다

---

## Epic 3: DJP 단일 케이스 제출

Tax Advisor가 승인된 세금 케이스를 DJP e-Filing API를 통해 직접 제출하고 BPE를 자동 수신합니다.

### Story 3.1: DJP OAuth 2.0 인증 연동

As a **Developer**,
I want DJP OAuth 2.0 인증이 구현되도록,
So that Jakarta Tax Consulting 자격증명으로 DJP API에 접근할 수 있습니다.

**Acceptance Criteria:**

**Given** DJP API 자격증명이 환경변수에 설정될 때
**When** DjpService.authenticate()를 호출하면
**Then** OAuth 2.0 access token을 획득합니다
**And** token이 AES-256으로 암호화되어 저장됩니다
**And** token 만료 시 자동으로 refresh됩니다
**And** 인증 실패 시 명확한 에러 메시지가 반환됩니다

### Story 3.2: DJP e-Filing API 클라이언트

As a **Developer**,
I want DJP e-Filing API 클라이언트가 구현되도록,
So that SPT 제출 요청을 DJP에 전송할 수 있습니다.

**Acceptance Criteria:**

**Given** DJP OAuth 인증이 완료되었을 때
**When** EfilingService.submit()을 호출하면
**Then** PPh 21, PPh 23, PPh Final, PPN 제출 요청을 생성합니다
**And** 요청/응답 payload가 djp_submission 테이블에 기록됩니다
**And** rate limit(100 req/min)을 준수합니다
**And** 타임아웃(30초) 및 재시도 로직이 적용됩니다

### Story 3.3: 단일 SPT 제출 기능

As a **Tax Advisor**,
I want 승인된 세금 케이스를 DJP에 제출하도록,
So that 수동으로 DJP 웹사이트에 접속하지 않아도 됩니다.

**Acceptance Criteria:**

**Given** APPROVED 상태의 세금 케이스가 있을 때
**When** "DJP 제출" 버튼을 클릭하면
**Then** POA 유효성이 먼저 확인됩니다
**And** DJP e-Filing API로 SPT가 제출됩니다
**And** 제출 성공 시 케이스 상태가 FILED로 변경됩니다
**And** djp_submission에 Jakarta Tax Consulting 귀속으로 기록됩니다
**And** 성공/실패 Toast 알림이 표시됩니다

### Story 3.4: BPE 자동 다운로드 및 저장

As a **Tax Advisor**,
I want DJP 제출 후 BPE가 자동으로 다운로드되도록,
So that 수동으로 BPE를 확인하지 않아도 됩니다.

**Acceptance Criteria:**

**Given** DJP 제출이 성공했을 때
**When** BPE 폴링 작업이 실행되면
**Then** 5분 이내에 BPE PDF를 다운로드합니다
**And** bpe_documents 테이블에 BPE 정보가 저장됩니다
**And** PDF가 Cloud Storage에 저장됩니다
**And** Tax Case와 BPE가 연결됩니다

### Story 3.5: 제출 상태 조회 UI

As a **Tax Advisor**,
I want 제출 상태를 실시간으로 확인하도록,
So that 제출 진행 상황을 파악할 수 있습니다.

**Acceptance Criteria:**

**Given** DJP 제출이 진행 중일 때
**When** Tax Case 상세 페이지를 열면
**Then** 현재 제출 상태(PENDING/SUBMITTED/ACCEPTED/REJECTED)가 표시됩니다
**And** DJP 참조 번호가 표시됩니다
**And** 제출 시간과 담당 컨설턴트가 표시됩니다
**And** BPE 다운로드 링크가 표시됩니다 (수신된 경우)

---

## Epic 4: 일괄 제출 및 실시간 모니터링

Tax Advisor가 35개 이상의 고객 케이스를 일괄 제출하고 실시간 진행 상황을 모니터링합니다.

### Story 4.1: 일괄 선택 UI (BulkSubmitPanel)

As a **Tax Advisor**,
I want 여러 케이스를 체크박스로 선택하도록,
So that 일괄 제출할 케이스를 쉽게 선택할 수 있습니다.

**Acceptance Criteria:**

**Given** APPROVED 상태의 케이스 목록이 있을 때
**When** 일괄 제출 페이지를 열면
**Then** 각 케이스 옆에 체크박스가 표시됩니다
**And** "전체 선택" 체크박스가 있습니다
**And** 선택된 케이스 수가 표시됩니다
**And** "일괄 제출" 버튼이 활성화됩니다
**And** 선택 전 POA 유효성 미리보기가 표시됩니다

### Story 4.2: 일괄 제출 큐 처리

As a **System**,
I want 일괄 제출이 Bull Queue로 처리되도록,
So that 안정적으로 대량 제출을 처리할 수 있습니다.

**Acceptance Criteria:**

**Given** 35개 케이스가 일괄 제출 요청될 때
**When** bulk-submit 큐에 작업이 추가되면
**Then** 각 케이스가 개별 작업으로 큐에 추가됩니다
**And** DJP rate limit(100 req/min)을 준수합니다
**And** 병렬 처리(동시 5건)가 적용됩니다
**And** 각 작업 완료 시 상태가 업데이트됩니다

### Story 4.3: 실시간 진행률 표시

As a **Tax Advisor**,
I want 일괄 제출 진행률을 실시간으로 확인하도록,
So that 전체 진행 상황을 파악할 수 있습니다.

**Acceptance Criteria:**

**Given** 일괄 제출이 진행 중일 때
**When** 진행률 모달이 표시되면
**Then** 전체 진행률 바가 표시됩니다 (예: 60%)
**And** 성공/실패 건수가 실시간 업데이트됩니다
**And** 각 케이스의 상태 아이콘이 표시됩니다 (✅/❌/🔄/⏳)
**And** 현재 처리 중인 케이스 이름이 표시됩니다
**And** 완료 시 요약 통계가 표시됩니다

### Story 4.4: 실패 건 자동 재시도

As a **System**,
I want 제출 실패 건이 자동으로 재시도되도록,
So that 일시적 오류로 인한 실패를 복구할 수 있습니다.

**Acceptance Criteria:**

**Given** DJP 제출이 실패했을 때
**When** 재시도 로직이 트리거되면
**Then** 지수 백오프(5초, 10초, 20초)로 최대 3회 재시도합니다
**And** 재시도 횟수가 djp_submission.retry_count에 기록됩니다
**And** 3회 실패 시 FAILED 상태로 확정됩니다
**And** 실패 사유가 error_message에 기록됩니다

---

## Epic 5: e-Billing 생성 및 납부 관리

Tax Consultant가 고객의 e-Billing을 일괄 생성하고 납부 상태를 추적합니다.

### Story 5.1: DJP e-Billing API 연동

As a **Developer**,
I want DJP e-Billing API 클라이언트가 구현되도록,
So that ID Billing 생성 요청을 DJP에 전송할 수 있습니다.

**Acceptance Criteria:**

**Given** DJP OAuth 인증이 완료되었을 때
**When** EbillingService.createBilling()을 호출하면
**Then** 세금 유형별 e-Billing 생성 요청을 전송합니다
**And** ID Billing 코드를 수신합니다
**And** 요청/응답이 로깅됩니다
**And** 실패 시 에러 메시지가 반환됩니다

### Story 5.2: ID Billing 자동 생성

As a **Tax Consultant**,
I want 고객 세금 케이스에서 ID Billing을 자동 생성하도록,
So that 수동으로 DJP에서 생성하지 않아도 됩니다.

**Acceptance Criteria:**

**Given** AI_ANALYZED 또는 APPROVED 상태의 케이스가 있을 때
**When** "e-Billing 생성" 버튼을 클릭하면
**Then** DJP e-Billing API로 요청이 전송됩니다
**And** ID Billing 코드가 케이스에 저장됩니다
**And** 고객에게 납부 코드 알림이 발송됩니다
**And** 성공/실패 Toast 알림이 표시됩니다

### Story 5.3: NTPN 검증

As a **Tax Consultant**,
I want 납부 완료 여부를 NTPN으로 검증하도록,
So that 납부 상태를 정확히 확인할 수 있습니다.

**Acceptance Criteria:**

**Given** ID Billing이 생성된 케이스가 있을 때
**When** NTPN 검증을 요청하면
**Then** DJP API로 NTPN 유효성을 확인합니다
**And** 납부 완료 시 케이스에 NTPN이 저장됩니다
**And** 납부 일시가 기록됩니다
**And** 미납 시 "납부 대기" 상태가 표시됩니다

### Story 5.4: 납부 상태 추적 UI

As a **Tax Consultant**,
I want 모든 고객의 납부 상태를 한눈에 확인하도록,
So that 미납 고객을 쉽게 파악할 수 있습니다.

**Acceptance Criteria:**

**Given** Tax Consultant가 납부 관리 페이지에 있을 때
**When** 페이지가 로드되면
**Then** 고객별 ID Billing 코드가 표시됩니다
**And** 납부 상태(대기/완료)가 색상으로 구분됩니다
**And** 마감일까지 남은 일수가 표시됩니다
**And** 미납 건 필터링이 가능합니다

---

## Epic 6: e-Faktur PPN 자동 처리

Tax Consultant가 PPN 거래 데이터 기반 e-Faktur를 자동 생성하고 DJP에 업로드합니다.

### Story 6.1: e-Faktur 데이터 모델 및 생성 로직

As a **Developer**,
I want e-Faktur 생성 로직이 구현되도록,
So that PPN 거래 데이터에서 e-Faktur를 자동 생성할 수 있습니다.

**Acceptance Criteria:**

**Given** PPN 거래 데이터가 있을 때
**When** EfakturService.generate()를 호출하면
**Then** 규정에 맞는 e-Faktur 데이터가 생성됩니다
**And** QR 코드가 포함됩니다
**And** 거래 항목별 세부 내역이 포함됩니다
**And** 생성된 e-Faktur가 DB에 저장됩니다

### Story 6.2: NPWP 자동 검증

As a **System**,
I want 거래처 NPWP가 자동으로 검증되도록,
So that 유효하지 않은 NPWP로 e-Faktur가 생성되지 않습니다.

**Acceptance Criteria:**

**Given** e-Faktur 생성 요청이 있을 때
**When** 거래처 NPWP 검증이 실행되면
**Then** DJP API로 NPWP 유효성을 확인합니다
**And** 유효하지 않은 NPWP는 오류로 표시됩니다
**And** 검증 결과가 캐시됩니다 (24시간)
**And** 검증 실패 사유가 표시됩니다

### Story 6.3: DJP e-Faktur API 업로드

As a **Tax Consultant**,
I want 생성된 e-Faktur를 DJP에 업로드하도록,
So that 공식적으로 e-Faktur가 등록됩니다.

**Acceptance Criteria:**

**Given** e-Faktur가 생성되었을 때
**When** "DJP 업로드" 버튼을 클릭하면
**Then** DJP e-Faktur 시스템에 업로드됩니다
**And** 업로드 상태(PENDING/APPROVED/REJECTED)가 표시됩니다
**And** DJP 참조 번호가 저장됩니다
**And** 성공/실패 알림이 표시됩니다

### Story 6.4: e-Faktur 승인 상태 확인 UI

As a **Tax Consultant**,
I want e-Faktur 승인 상태를 확인하도록,
So that 거부된 e-Faktur를 수정할 수 있습니다.

**Acceptance Criteria:**

**Given** e-Faktur가 DJP에 업로드되었을 때
**When** e-Faktur 목록 페이지를 열면
**Then** 각 e-Faktur의 승인 상태가 표시됩니다
**And** 거부된 경우 DJP 오류 메시지가 표시됩니다
**And** 거부된 e-Faktur 수정 기능이 있습니다
**And** 상태별 필터링이 가능합니다

---

## Epic 7: 스케줄 기반 워크플로우 자동화

시스템이 마감일 기반으로 자동 알림을 발송하고 긴급 처리 큐를 관리합니다.

### Story 7.1: 마감일 알림 스케줄러 (D-3)

As a **System**,
I want 마감일 3일 전에 미승인 건 알림이 발송되도록,
So that Tax Advisor가 마감일 전에 처리할 수 있습니다.

**Acceptance Criteria:**

**Given** 마감일 3일 전인 미승인 케이스가 있을 때
**When** 스케줄러가 매일 오전 9시에 실행되면
**Then** Tax Advisor에게 이메일 알림이 발송됩니다
**And** 알림에 미승인 건수와 마감일이 포함됩니다
**And** 대시보드에 긴급 배지가 표시됩니다
**And** 알림 발송 이력이 기록됩니다

### Story 7.2: 긴급 처리 큐 (D-1)

As a **Tax Advisor**,
I want 마감일 1일 전 케이스가 긴급 큐에 표시되도록,
So that 우선적으로 처리할 수 있습니다.

**Acceptance Criteria:**

**Given** 마감일 1일 전인 미제출 케이스가 있을 때
**When** 대시보드에 접속하면
**Then** "긴급 처리 필요" 섹션이 상단에 표시됩니다
**And** 빨간색 배경으로 강조됩니다
**And** 케이스 수가 배지로 표시됩니다
**And** 한 클릭으로 일괄 승인 페이지로 이동할 수 있습니다

### Story 7.3: 자동 일괄 제출 (당일)

As a **System**,
I want 마감일 당일 승인된 케이스가 자동 제출되도록,
So that 마감일 놓침을 방지할 수 있습니다.

**Acceptance Criteria:**

**Given** 마감일 당일인 APPROVED 케이스가 있을 때
**When** 스케줄러가 오전 10시에 실행되면
**Then** APPROVED 케이스가 자동으로 DJP에 제출됩니다
**And** 제출 결과가 Tax Advisor에게 알림됩니다
**And** 실패 건은 수동 처리 목록에 추가됩니다
**And** 자동 제출 로그가 기록됩니다

### Story 7.4: 자동 상태 전이 (APPROVED → FILED)

As a **System**,
I want DJP 제출 성공 시 상태가 자동으로 FILED로 변경되도록,
So that 수동으로 상태를 변경하지 않아도 됩니다.

**Acceptance Criteria:**

**Given** DJP 제출이 성공했을 때
**When** djp_submission 상태가 ACCEPTED로 변경되면
**Then** Tax Case 상태가 FILED로 자동 변경됩니다
**And** WorkflowState에 전이 이력이 기록됩니다
**And** 고객에게 완료 알림이 발송됩니다
**And** Audit Log에 상태 변경이 기록됩니다

---

## Epic 8: POA 검증 및 Audit 추적

모든 DJP 제출에 대한 POA 유효성을 자동 검증하고 완전한 감사 추적을 수행합니다.

### Story 8.1: POA 유효성 검증 서비스

As a **System**,
I want DJP 제출 전 POA 유효성이 자동 검증되도록,
So that 만료된 POA로 제출되지 않습니다.

**Acceptance Criteria:**

**Given** DJP 제출 요청이 있을 때
**When** PoaValidationService.validate()가 호출되면
**Then** 고객의 POA 유효 기간이 확인됩니다
**And** 유효한 경우 true가 반환됩니다
**And** 만료된 경우 에러와 함께 제출이 차단됩니다
**And** 검증 결과가 poa_validation_cache에 캐시됩니다

### Story 8.2: POA 만료 사전 알림

As a **Tax Advisor**,
I want POA 만료 30일 전에 알림을 받도록,
So that 고객에게 갱신을 요청할 수 있습니다.

**Acceptance Criteria:**

**Given** POA 만료가 30일 이내인 고객이 있을 때
**When** 스케줄러가 매일 실행되면
**Then** Tax Advisor에게 이메일 알림이 발송됩니다
**And** 대시보드에 "POA 만료 임박" 섹션이 표시됩니다
**And** 고객명과 만료일이 표시됩니다
**And** expiry_warning_sent가 true로 설정됩니다

### Story 8.3: 만료 POA 제출 차단

As a **System**,
I want 만료된 POA로 DJP 제출이 차단되도록,
So that 법적 문제를 방지할 수 있습니다.

**Acceptance Criteria:**

**Given** 만료된 POA를 가진 케이스의 제출 시도가 있을 때
**When** 제출이 요청되면
**Then** 명확한 에러 메시지와 함께 제출이 차단됩니다
**And** "POA가 만료되었습니다. 갱신 후 다시 시도하세요." 메시지가 표시됩니다
**And** 만료 일자가 표시됩니다
**And** POA 갱신 페이지로 이동 링크가 제공됩니다

### Story 8.4: Jakarta Tax Consulting 귀속 Audit Log

As a **Compliance Officer**,
I want 모든 DJP 제출이 Jakarta Tax Consulting 귀속으로 기록되도록,
So that 법적 책임 추적이 가능합니다.

**Acceptance Criteria:**

**Given** DJP 제출이 완료되었을 때
**When** Audit Log가 기록되면
**Then** submitted_by_entity가 "JAKARTA_TAX_CONSULTING"으로 설정됩니다
**And** 실제 처리한 컨설턴트 ID가 기록됩니다
**And** POA ID가 기록됩니다
**And** 제출 시간, IP 주소가 기록됩니다
**And** Audit Log는 불변(append-only)입니다

### Story 8.5: POA 관리 대시보드 UI

As a **Tax Advisor**,
I want POA 현황을 대시보드에서 관리하도록,
So that 만료 임박 POA를 쉽게 파악하고 조치할 수 있습니다.

**Acceptance Criteria:**

**Given** Tax Advisor가 POA 관리 페이지에 접속할 때
**When** 페이지가 로드되면
**Then** 고객별 POA 목록이 표시됩니다
**And** 만료일 기준 정렬이 가능합니다
**And** "만료 임박" (30일 이내) 필터가 있습니다
**And** "만료됨" 상태가 빨간색으로 강조됩니다
**And** 고객에게 갱신 요청 메시지 발송 버튼이 있습니다

---

## Epic 9: Customer BPE 확인 및 알림

고객이 세금 신고 완료 알림과 BPE를 이메일/WhatsApp으로 자동 수신합니다.

### Story 9.1: 이메일 알림 서비스

As a **Developer**,
I want 이메일 알림 서비스가 구현되도록,
So that 고객에게 이메일 알림을 발송할 수 있습니다.

**Acceptance Criteria:**

**Given** 알림 발송 요청이 있을 때
**When** EmailService.send()가 호출되면
**Then** 템플릿 기반 이메일이 생성됩니다
**And** 고객 이메일 주소로 발송됩니다
**And** 발송 성공/실패가 로깅됩니다
**And** 발송 이력이 DB에 저장됩니다

### Story 9.2: WhatsApp 알림 서비스

As a **Developer**,
I want WhatsApp 알림 서비스가 구현되도록,
So that 고객에게 WhatsApp 알림을 발송할 수 있습니다.

**Acceptance Criteria:**

**Given** WhatsApp 알림 발송 요청이 있을 때
**When** WhatsappService.send()가 호출되면
**Then** WhatsApp Business API로 메시지가 발송됩니다
**And** 고객 전화번호로 발송됩니다
**And** 발송 성공/실패가 로깅됩니다
**And** 발송 이력이 DB에 저장됩니다

### Story 9.3: BPE 자동 발송

As a **Customer**,
I want 세금 신고 완료 시 BPE가 자동으로 전송되도록,
So that 별도로 요청하지 않아도 증빙을 받을 수 있습니다.

**Acceptance Criteria:**

**Given** BPE가 수신되었을 때
**When** BPE 발송 작업이 트리거되면
**Then** 고객에게 이메일로 BPE PDF가 첨부 발송됩니다
**And** 고객에게 WhatsApp으로 BPE 다운로드 링크가 발송됩니다
**And** bpe_documents.sent_to_customer_at이 기록됩니다
**And** 발송 실패 시 재시도됩니다

### Story 9.4: Customer Dashboard BPE 다운로드

As a **Customer**,
I want 대시보드에서 BPE를 다운로드하도록,
So that 언제든지 증빙을 확인할 수 있습니다.

**Acceptance Criteria:**

**Given** Customer가 대시보드에 로그인했을 때
**When** "신고 내역" 페이지를 열면
**Then** 완료된 세금 신고 목록이 표시됩니다
**And** 각 항목에 "BPE 다운로드" 버튼이 있습니다
**And** 클릭 시 BPE PDF가 다운로드됩니다
**And** BPE 번호, 제출 일시, 담당 컨설턴트가 표시됩니다

---

## Epic 10: Production Deployment & Infrastructure

로컬 개발이 완료된 후, AWS 인프라를 구성하고 프로덕션 환경에 배포합니다.

### Story 10.1: AWS 인프라 Terraform 구성

As a **DevOps Engineer**,
I want AWS 인프라가 Terraform으로 정의되도록,
So that 인프라를 코드로 관리하고 재현 가능하게 배포할 수 있습니다.

**Acceptance Criteria:**

**Given** 로컬 개발이 완료되었을 때
**When** infra/terraform 디렉토리를 구성하면
**Then** ECS Fargate 서비스 리소스가 정의됩니다 (api, web, paddleocr)
**And** RDS PostgreSQL 인스턴스가 정의됩니다
**And** ElastiCache Redis 인스턴스가 정의됩니다
**And** 환경별(dev, staging, prod) 설정이 분리됩니다

### Story 10.2: CI/CD 파이프라인 구성

As a **DevOps Engineer**,
I want GitHub Actions CI/CD 파이프라인이 구성되도록,
So that 코드 변경 시 자동으로 빌드/배포됩니다.

**Acceptance Criteria:**

**Given** Terraform 인프라가 준비되었을 때
**When** .github/workflows를 구성하면
**Then** main 브랜치 push 시 자동 빌드가 실행됩니다
**And** Docker 이미지가 ECR에 푸시됩니다
**And** ECS Fargate에 자동 배포됩니다
**And** 배포 성공/실패 알림이 발송됩니다

### Story 10.3: 모니터링 및 알림 설정

As a **DevOps Engineer**,
I want 프로덕션 모니터링과 알림이 설정되도록,
So that 장애를 빠르게 감지하고 대응할 수 있습니다.

**Acceptance Criteria:**

**Given** 프로덕션 배포가 완료되었을 때
**When** 모니터링을 설정하면
**Then** CloudWatch 대시보드가 구성됩니다
**And** API 응답 시간 > 5초 시 알림이 발송됩니다
**And** 에러율 > 1% 시 알림이 발송됩니다
**And** DJP API 장애 감지 알림이 설정됩니다

### Story 10.4: 프로덕션 환경 검증

As a **QA Engineer**,
I want 프로덕션 환경에서 전체 기능이 검증되도록,
So that 실제 사용자에게 안정적인 서비스를 제공할 수 있습니다.

**Acceptance Criteria:**

**Given** 프로덕션 배포가 완료되었을 때
**When** E2E 테스트를 실행하면
**Then** 모든 Critical Path가 통과합니다
**And** DJP API 연동이 정상 동작합니다
**And** OCR 처리가 정상 동작합니다
**And** 성능 기준(API 5초, OCR 3초)을 충족합니다
