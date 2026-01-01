# Product Requirements Document (PRD)

**AI PAJAK** - Indonesian Tax Filing SaaS Platform

**Last Updated**: 2025-12-24
**Version**: 3.0

---

## 📖 Overview

AI PAJAK은 인도네시아 중소기업을 위한 **AI 기반 세금 신고 자동화 플랫폼**입니다.

### 핵심 가치 제안
- 🤖 **AI 자동 계산**: PPh 21/22/23, PPN 등 복잡한 세금 자동 계산
- ⚡ **DJP 자동 제출**: 인도네시아 국세청(DJP) 자동 연동 (Phase 2)
- 📸 **OCR 자동 인식**: 영수증/송장 사진 → 자동 데이터 입력 (90%+ 정확도)
- 👥 **세무사 협업**: 세무사와 고객 간 실시간 협업

### 타겟 사용자
1. **중소기업 경영진** (CEO, CFO) - 세금 현황 대시보드
2. **회계 담당자** - 월간 세금 신고 업무
3. **세무사** - 다수 고객사 관리
4. **Tax Operator** (Phase 1) - DJP 수작업 제출 지원

---

## 📂 문서 구조

### 📋 Core (핵심 개념)
제품의 비전, 시장 분석, 비즈니스 모델

| 문서 | 내용 | 우선순위 |
|------|------|---------|
| [01-executive-summary.md](core/01-executive-summary.md) | 프로젝트 개요, 비전, 문제 정의 | 🔴 P0 |
| [02-market-analysis.md](core/02-market-analysis.md) | 인도네시아 시장 분석, 경쟁사 | 🔴 P0 |
| [03-business-model.md](core/03-business-model.md) | 수익 모델, GTM 전략 | 🔴 P0 |
| [04-legal-structure.md](core/04-legal-structure.md) | 법인 구조, 규제 준수 | 🔴 P0 |

### 💰 Tax Types (세금 종류)
인도네시아 세금 시스템 상세 설명

| 세금 유형 | 문서 | 내용 |
|----------|------|------|
| **PPh 21** | `tax-types/pph21-*.md` | 근로소득세 (7가지 직업 유형, TER 테이블) |
| **PPh 22** | `tax-types/pph22-*.md` | 수입/조달 원천세 (업종별, 라이선스별) |
| **PPh 23** | `tax-types/pph23-*.md` | 서비스 원천세 (KBLI 1,560개 매핑) |
| **PPN** | `tax-types/ppn-*.md` | 부가가치세 11% (면세 품목) |
| **PPnBM** | `tax-types/ppnbm-*.md` | 사치품 소비세 |

### 🔄 Workflows (업무 프로세스)
상담원 및 세무사 워크플로우

| 문서 | 내용 | 우선순위 |
|------|------|---------|
| [phase-1-operator-workflow.md](workflows/phase-1-operator-workflow.md) | Phase 1 상담원 수작업 DJP 제출 | 🔴 P0 |
| [withholding-tax-review-workflow.md](workflows/withholding-tax-review-workflow.md) | 원천세 AI→상담원→슈퍼바이저 검토 | 🔴 P0 |
| [consultant-manual.md](workflows/consultant-manual.md) | 세무사 업무 매뉴얼 | 🟡 P1 |
| [operations-manual.md](workflows/operations-manual.md) | 운영 매뉴얼 | 🟡 P1 |

### 👥 Personas (사용자 유형)
4가지 사용자 페르소나

| 페르소나 | 문서 | 주요 니즈 |
|---------|------|----------|
| **CEO** | [personas/ceo.md](personas/ceo.md) | 세금 현황 실시간 대시보드 |
| **CFO** | [personas/cfo.md](personas/cfo.md) | 정확한 세금 예측, 리스크 관리 |
| **Accountant** | [personas/accountant.md](personas/accountant.md) | 빠른 세금 신고, OCR 자동화 |
| **Tax Consultant** | [personas/tax-consultant.md](personas/tax-consultant.md) | 다수 고객사 효율 관리 |

### ⚙️ Features (기능 명세)
역할별 기능 상세

| 문서 | 내용 |
|------|------|
| [features/mvp-scope.md](features/mvp-scope.md) | MVP 범위 정의 |
| [features/executive-features.md](features/executive-features.md) | 경영진 기능 |
| [features/accountant-features.md](features/accountant-features.md) | 회계사 기능 |
| [features/tax-consultant-features.md](features/tax-consultant-features.md) | 세무사 기능 |

---

## 🎯 MVP Scope (Phase 1)

### 핵심 기능
1. ✅ **세금 계산 자동화**
   - PPh 21 (근로소득세)
   - PPh 23 (서비스 원천세)
   - PPN (부가가치세 11%)

2. ✅ **OCR 자동 입력**
   - 영수증/송장 사진 업로드
   - AI 자동 데이터 추출 (90%+ 정확도)

3. ✅ **상담원 워크플로우**
   - AI 판단 → 상담원 검토 → 슈퍼바이저 승인
   - DJP 수작업 제출 지원 (복사-붙여넣기 도구)

4. ✅ **e-Billing 자동 생성**
   - DJP 납부 코드 자동 생성
   - 이메일/WhatsApp 자동 발송

### 제외 기능 (Phase 2)
- ❌ DJP API 자동 제출 (계약 대기 중)
- ❌ SPT Tahunan (연간 신고)
- ❌ 모바일 앱

---

## 📊 Key Metrics (주요 지표)

### 비즈니스 KPI
- **월 활성 사용자 (MAU)**: 목표 500+ (6개월)
- **유료 전환율**: 목표 10%+
- **고객 이탈률 (Churn)**: 목표 5% 이하

### 제품 KPI
- **세금 계산 정확도**: 99%+
- **OCR 정확도**: 90%+
- **DJP 제출 성공률**: 98%+
- **상담원 1인당 고객 수**: 35개

### 운영 KPI
- **월간 제출 건수**: 1,000+ (Phase 1)
- **상담원 처리 시간**: 고객당 15분 이하
- **고객 만족도 (CSAT)**: 4.5/5.0

---

## 🗺️ Roadmap

### Phase 1 (현재) - Manual DJP Submission
**기간**: 2-3개월
**상태**: 🟡 진행 중

- ✅ 세금 계산 엔진 (PPh 21/23, PPN)
- ✅ OCR 자동 입력
- ✅ 상담원 워크플로우
- 🟡 e-Billing 자동 생성
- 🟡 DJP 제출 도우미 도구

### Phase 2 - DJP API Automation
**기간**: 2-3개월
**상태**: ⚪ 대기

- DJP API 연동 계약 완료
- 자동 세금 신고 제출
- BPE 자동 다운로드
- 상담원 역할 전환 (모니터링)

### Phase 3 - Advanced Features
**기간**: 3-4개월
**상태**: ⚪ 계획

- SPT Tahunan (연간 신고)
- 모바일 앱 (React Native)
- 회계 프로그램 연동 (Accurate)
- Tax Treaty 자동 적용

---

## 📚 Related Documents

### 데이터베이스 설계
→ [ERD/README.md](../ERD/README.md)

### API 설계
→ [API/README.md](../API/README.md)

### UI/UX 설계
→ [UI/README.md](../UI/README.md)

### 구현 가이드
→ [IMPLEMENTATION/README.md](../IMPLEMENTATION/README.md)

---

## 🔄 Document Status

| 섹션 | 완성도 | 최종 업데이트 |
|------|--------|--------------|
| Core | ✅ 95% | 2025-12-23 |
| Tax Types | 🟡 70% | 2025-12-24 (작성 중) |
| Workflows | ✅ 90% | 2025-12-24 |
| Personas | ✅ 100% | 2025-12-23 |
| Features | ✅ 85% | 2025-12-23 |

---

**Need Help?** 각 폴더의 README.md를 먼저 확인하세요!
