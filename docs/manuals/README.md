# AI Pajak 사용자 매뉴얼 — 역할별 가이드

> **AI Pajak** 은 **MonoFlip 이 운영하는 인도네시아 세무 자동화 플랫폼** 입니다. 실제 세무신고 대행은 **Jakarta Tax Consulting (JTC)** 소속 상담원·세무사가 담당합니다. (모노플립 = 플랫폼 운영사, JTC = 신고 대행 실무자)
> 본 문서 세트는 **역할별로 분리된 한국어 매뉴얼**입니다. 본인의 역할에 해당하는 문서를 여세요.

## 내 역할 찾기

| 나는 누구인가 | 읽을 매뉴얼 |
|---|---|
| 인도네시아에 법인(PT)을 운영 중이고, 매월 세금 신고가 필요하다 (JTC 대행) | [법인 납세자](./01-corporate-customer.md) |
| 인도네시아에서 근로·사업 활동 중이고, 매년 SPT Pribadi를 내야 한다 (JTC 대행) | [개인 납세자](./03-individual-customer.md) |
| **세무 컨설팅 법인** 이며, AI Pajak 을 도구로 자기 회사 직원 + 자기 클라이언트의 세무를 **self-service** 로 처리한다 (JTC 개입 없음) | [세무 컨설팅 법인](./02-external-consultant.md) |
| **JTC 내부 소속** 세무사·컨설턴트다 | [JTC 세무사](./05-jtc-consultant.md) |
| JTC 운영팀에서 제출 큐를 처리한다 (Operator / Supervisor / Master) | [운영팀](./04-tax-operator.md) |
| 플랫폼·인프라·사용자·청구를 관리한다 (세무 데이터는 보지 않는다) | [플랫폼 관리자](./06-platform-admin.md) |

> 🗺️ 역할·조직 전체 구조는 [`docs/guides/roles.md`](../guides/roles.md) 에서 한눈에 볼 수 있습니다.

---

## 매뉴얼 목록

1. **[01 — 법인 납세자](./01-corporate-customer.md)**
   가입, 회사 프로필 설정, 월 PPh21/PPh23/PPN/Final 신고, 회계 연동(Accurate/Jurnal), 요금제(UMKM/Basic/Pro), POA 관리

2. **[02 — 세무 컨설팅 법인 (Self-Service Tenant)](./02-external-consultant.md)**
   회사 가입 (`/register/firm`), 자기 회사 직원 + 자기 클라이언트 관리, 자기 이름으로 SPT 제출 (JTC 개입 없음), 월 구독(Starter/Growth/Enterprise), 일괄 PPh21, 팀 관리, Tier 업그레이드

3. **[03 — 개인 납세자](./03-individual-customer.md)**
   SPT Pribadi 양식 선택(1770SS/1770S/1770), A1 OCR 업로드, PTKP 자동 계산, 환급 신청, 건당 결제

4. **[04 — 운영팀 (JTC only)](./04-tax-operator.md)**
   djp_submission_queue 11단계 워크플로우, Operator/Supervisor/Master 권한, 업무 분배, 마스터 대시보드, 맞춤 가격, **미배정 고객 배정** (2026-07-03 P1)

5. **[05 — JTC 세무사](./05-jtc-consultant.md)**
   고객 배정, 월·연 신고 작성, 일괄 PPh21, 이상 탐지, 이전가격, 팀 관리(ADVISOR 전용)

6. **[06 — 플랫폼 관리자 (MonoFlip 기술)](./06-platform-admin.md)**
   사용자·역할 관리, 시스템 모니터링, 감사 로그, 크론 관리. **세무 데이터 접근 불가.**

7. **[07 — 세무 컨설팅 법인 관리자 (FIRM_ADMIN)](./07-firm-admin.md)** (2026-07-07 신설)
   자기 tenant 안의 직원·자격증·클라이언트 배정·청구·구독 관리. RLS 로 자기 회사만.

8. **[08 — 모노플립 마스터 (PLATFORM_MASTER)](./08-platform-master.md)** (2026-07-07 신설)
   MonoFlip 사업 운영 최고권한: 요금·상품·통계·EXTERNAL 입점·커스텀 견적. **세무 실무 절대 불가.**

---

## 공통 기본 정보

### 플랫폼 접속
- **프로덕션 URL**: `https://ai-pajak.vercel.app`
- **지원 브라우저**: Chrome, Edge, Safari 최신 버전
- **언어 (i18n)**: 기본 인도네시아어(id), 한국어(ko), 영어(en), 일본어(ja), 중국어(zh) 지원

### 가입과 로그인
- 회원가입: `/register`
- 로그인: `/login`
- 비밀번호 정책: **8자 이상 + 대문자 + 소문자 + 숫자 + 특수문자**
- **2단계 인증(2FA/TOTP)**: 설정 → 보안에서 활성화. 운영팀·JTC 세무사·관리자는 필수 권장.

### 요금제 한눈에 보기

| 대상 | 플랜 | 월 요금 (VAT 별도) |
|---|---|---|
| 법인 | UMKM (최대 직원 10, 매출 소기업) | Rp 500,000 |
| 법인 | Basic (직원 50, 원천세 100, PPN 200) | Rp 1,500,000 |
| 법인 | Pro (직원 1000, 원천세 200, PPN 500) | Rp 3,000,000 |
| 세무 컨설팅 법인 | Starter (고객 10) | Rp 1,000,000 |
| 세무 컨설팅 법인 | Growth (고객 50, 일괄 처리) | Rp 3,000,000 |
| 세무 컨설팅 법인 | Enterprise (무제한) | Rp 8,000,000 |
| 개인 | SPT 1770SS (건당) | Rp 100,000 |
| 개인 | SPT 1770S (건당) | Rp 200,000 |
| 개인 | SPT 1770 (건당) | Rp 300,000 |

VAT 11% 별도. 결제는 Midtrans 연동 — BCA/Mandiri/BNI/BRI VA, GoPay, OVO, DANA, ShopeePay, 신용카드 지원.

Pro·Enterprise 한도를 넘는 규모는 **맞춤 견적(Custom Pricing Quote)** 으로 별도 산정합니다. JTC Master 담당자에게 문의하세요.

### 보안 5대 Hard Rule

CLAUDE.md에 정의된 **협상 불가능한 보안 원칙**입니다. 모든 코드와 권한이 이 규칙을 따릅니다.

1. **PLATFORM_ADMIN은 고객 세무 데이터에 접근할 수 없다** — 미들웨어와 RLS 이중 차단
2. **컨설턴트는 등록된 `tax_partner` (JTC 또는 세무 컨설팅 법인) 에 반드시 소속** — FK 제약 + `get_consultant_tax_partner_id()` RLS. 두 tenant 간 데이터는 완전 격리
3. **세무 신고 제출 권한은 `TAX_ADVISOR` 에게만 있다** — Tax Filing Actor ≠ Platform. 세무 컨설팅 법인이 자기 이름으로 신고하려면 tenant 안에 자격증 소지자 최소 1명 필요 (2026-07-03 P4)
4. **청구 수집자와 서비스 제공자는 분리된다** — 결제는 SYSTEM/MASTER, 서비스는 세무사
5. **모든 쓰기 조치는 감사 로그에 기록된다** — `withAudit` 미들웨어 자동 적용

---

## 공통 용어 사전

### 세무 용어 (인도네시아어)

| 용어 | 뜻 |
|---|---|
| **NPWP** | Nomor Pokok Wajib Pajak — 납세자번호 (법인 15자리, 개인 16자리 KTP 연동) |
| **SPT** | Surat Pemberitahuan — 세무 신고서 |
| **SPT Masa** | 월간 신고서 |
| **SPT Tahunan** | 연간 신고서 |
| **SPT Pribadi** | 개인 연간 신고서 (1770SS/1770S/1770) |
| **SPT 1771** | 법인 연간 신고서 |
| **PPh** | Pajak Penghasilan — 소득세 |
| **PPh21** | 근로소득 원천세 |
| **PPh22** | 수입 시 원천세 |
| **PPh23** | 서비스·이자·배당 원천세 (일반적으로 2%) |
| **PPh25** | 분납 소득세 |
| **PPh26** | 비거주자 대상 원천세 |
| **PPh 4(2)** | 최종세 (이자, 배당, 임대, UMKM 등) |
| **PPN** | Pajak Pertambahan Nilai — 부가가치세(VAT), 현재 11% |
| **Faktur Pajak** | 세금계산서 (매출·매입 모두) |
| **e-Faktur** | DJP의 세금계산서 전자 시스템 |
| **Bukti Potong** | 원천징수 증명서 |
| **1721-A1 / A1** | 법인이 직원에게 발급하는 원천징수영수증 |
| **PTKP** | Penghasilan Tidak Kena Pajak — 기본 공제액 |
| **UMKM** | Usaha Mikro Kecil Menengah — 소상공인 (Final 0.5% 세율 대상) |
| **DJP** | Direktorat Jenderal Pajak — 인도네시아 국세청 |
| **Coretax** | 2025년부터 DJP가 운영하는 통합 세무 시스템 |
| **e-Billing** | 전자 납부 VA 번호 체계 |
| **BPE** | Bukti Penerimaan Elektronik — 전자접수증 |
| **Bupot** | Bukti Potong — 원천징수 증명서 |
| **POA** | Power of Attorney — 위임장 |
| **BPJS** | 인도네시아 4대 보험 (Kesehatan 건강 + Ketenagakerjaan 고용) |
| **Masa Pajak** | 과세 기간 (월) |
| **Tahun Pajak** | 과세 연도 |

### 플랫폼 용어

| 용어 | 뜻 |
|---|---|
| **tax_partner** | 세무 법인 엔티티. `JTC` 또는 `EXTERNAL` |
| **customer** | 고객 엔티티. `COMPANY` 또는 `INDIVIDUAL` |
| **consultant** | 세무사 (JTC 또는 외부 사무소 소속) |
| **customer_consultant** | 고객-컨설턴트 배정 조인 테이블 |
| **customer_subscription** | 법인 플랜 구독 |
| **tax_partner_subscription** | 외부 사무소 Tier 구독 |
| **djp_submission_queue** | 운영팀 처리 큐 |
| **CORP-** | 법인 구독 Midtrans 주문 ID 접두사 |
| **CONS-** | 외부 사무소 구독 Midtrans 주문 ID 접두사 |
| **PAY-** | 개인 SPT 건당 결제 주문 ID 접두사 |
| **withAudit** | 감사 로그 자동 기록 미들웨어 |
| **blockPlatformAdmin** | 플랫폼 관리자 차단 미들웨어 |
| **composeMiddleware** | 미들웨어 체인 조합 함수 |
| **Circuit Breaker** | 외부 API 장애 자동 차단 로직 |
| **Row Level Security (RLS)** | PostgreSQL 행 단위 접근 제어 |
| **Hard Rule** | 협상 불가능한 5대 보안 규칙 |

### 역할 코드 요약

> 📌 **네이밍**: `CONSULTANT` 와 `TAX_ADVISOR` 는 **JTC 뿐 아니라 세무 컨설팅 법인 (EXTERNAL tax_partner) 직원도 함께 사용**합니다. 소속은 `consultant.tax_partner_id` 로만 결정. (P3 로 `_JTC` 접미사 제거 완료, 2026-07-05.)

| 코드 | 이름 | 주요 권한 |
|---|---|---|
| `CUSTOMER` (INDIVIDUAL) | 개인 고객 | 자기 SPT 개인 신고 |
| `CUSTOMER` (COMPANY, 일반) | 일반 법인 고객 | 자기 월 신고 + 결산 (JTC 대행) |
| `CUSTOMER` (COMPANY, 세무 컨설팅) | 세무 컨설팅 법인 고객 | 위 + 자기 클라이언트 관리 (self-service) |
| `CONSULTANT` | 컨설턴트 (JTC 또는 세무 컨설팅 법인 소속) | 배정 고객 신고 작성 |
| `TAX_ADVISOR` | 세무사 자격증 소지자 (JTC 또는 세무 컨설팅 법인 소속) | 최종 제출 권한, 팀 관리 |
| `TAX_OPERATOR` | 운영자 | 큐 검토·처리 |
| `TAX_OPERATOR_LEAD` | 운영 리드 | 운영자 + 추가 책임 |
| `TAX_OPERATOR_SUPERVISOR` | 운영 수퍼바이저 | 승인, 분배, 통계 |
| `TAX_OPERATOR_MASTER` | 운영 마스터 | 플랫폼 통계, 맞춤 가격 |
| `PLATFORM_ADMIN` | 플랫폼 관리자 | 사용자·인프라·감사 (세무 데이터 불가) |
| `SYSTEM` | 시스템 | 청구 자동화 전용 |

### 조직 유형

| 코드 | 뜻 |
|---|---|
| `PLATFORM_OWNER` | AI Pajak 소유사 |
| `PLATFORM` | 플랫폼 운영 조직 |
| `TAX_PARTNER` | 세무 법인 — JTC (내부, `is_default_filing_partner=true`) 또는 EXTERNAL (세무 컨설팅 법인, self-service tenant) |

---

## 변경 이력 (Changelog)

| 날짜 | 버전 | 변경 내용 |
|---|---|---|
| 2026-04-11 | v1.0 | 6개 역할 매뉴얼 초안 작성 (시나리오형). 법인·외부·개인·운영·JTC·플랫폼 관리자 |
| 2026-07-03 | v2.0 | **P0 도메인 모델 교정**. "외부 세무 사무소" → "세무 컨설팅 법인 (Self-Service Tenant)" 리네이밍. 세무 컨설팅 법인의 관리 대상 = 자기 직원 + 자기 클라이언트 둘 다 명시. JTC 개입 없이 자체 세무사가 자기 이름으로 신고. 미배정 큐 워크플로우 (P1), 자격증 소지자 검증 게이트 (P4) 추가. 상세 개요: [`docs/guides/roles.md`](../guides/roles.md) |

---

## 지원

- **일반 문의**: 앱 내 **도움말** → 문의 남기기
- **긴급 기한**: 담당 JTC 세무사에게 직접 WhatsApp/이메일
- **기술 장애**: 플랫폼 관리자가 Vercel/Supabase 대시보드 확인 후 공지
- **파트너십·커스텀 견적**: JTC Master 담당자 또는 `partners@ai-pajak.com`

---

**AI Pajak** — Automating Indonesian Tax, One Filing at a Time.
