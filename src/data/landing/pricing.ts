import type { LandingPlan, PlanStorage } from './types';

// 2026-05-22 PDF: every plan now exposes a "저장공간 및 증빙 보관" panel
// with a per-plan allowance, the core-evidence retention copy, raw-file
// scope copy, overage pricing, and the 80%/100% alert policy. The last
// three sentences are identical across all plans, so we factor them
// here and only vary `allowance` per plan.

const COMMON_RETENTION_KO =
  'ID Billing, NTPN, BPE, 신고 이력, AI 파싱 결과, 세금코드 판단 이력 등 핵심 신고증빙은 기본 보관됩니다.';
const COMMON_RAW_FILE_KO =
  '고객이 업로드한 원본파일은 포함 저장용량 내에서 보관됩니다. 원본파일에는 invoice, Faktur Pajak, 영수증 사진, payroll Excel, 계약서, 은행거래내역, 대량 매입·매출 자료 등이 포함됩니다.';
const COMMON_OVERAGE_KO =
  '초과 시: Active Storage Rp 50,000 / 10GB / 월 · Archive Storage Rp 250,000 / 10GB / 년';
const COMMON_ALERT_KO =
  '80% 도달 시 알림, 100% 도달 시 추가 저장공간 구매·Archive 전환·원본파일 다운로드 후 삭제를 안내합니다. 신고 마감에 필요한 자료는 임시 업로드를 허용할 수 있습니다.';

function storage(allowance: string): PlanStorage {
  return {
    allowance,
    retentionCopy: COMMON_RETENTION_KO,
    rawFileCopy: COMMON_RAW_FILE_KO,
    overage: COMMON_OVERAGE_KO,
    alertPolicy: COMMON_ALERT_KO,
  };
}

const PERSONAL_INFO_KO =
  '개인 세무는 건당 결제 기준입니다. 제출 자료 확인 후 소득 유형, 원천징수 자료 수, 자산·부채 복잡도에 따라 단순/표준/복잡 유형이 달라질 수 있으며, 선택한 유형보다 복잡도가 높으면 신고 진행 전 차액 결제를 안내합니다.';
const MONTHLY_INFO_KO =
  '각 월관리 요금제는 포함 사용량 기준을 가지고 있습니다. 실제 직원 수, 원천세 거래 수, 월 업로드/거래 수가 기준을 초과하면 해당 월은 실제 사용량에 맞는 상위 요금제로 자동 보정될 수 있습니다. 이미 결제한 금액은 차감되며, 차액만 추가 청구됩니다. 기준 초과 전에는 대시보드와 알림을 통해 사전 안내됩니다.';

export const pricingKO: LandingPlan[] = [
  {
    id: 'p-simple',
    group: '개인 세무',
    badge: '건당 결제',
    typeLabel: 'Personal Simple (단순 신고)',
    price: 'Rp 100.000',
    vat: 'PPN 포함 합계: Rp 111.000',
    description: '근로소득 1개 중심 · 자료가 단순한 개인',
    meta: ['PPN 포함 합계: Rp 111.000', '복잡도 기준', '통합 개인 연간 신고'],
    items: [
      'A1/A2 또는 원천징수 자료 자동 정리',
      '기본 인적사항 및 소득자료 확인',
      '납부/환급 가능성 기본 안내',
      '신고 완료 증빙 관리',
    ],
    criteria: ['근로소득 중심', 'A1/A2 또는 원천징수 자료 1개 중심', '추가 사업소득·프리랜스 소득 없음'],
    storage: storage('500MB / 신고연도'),
    info: PERSONAL_INFO_KO,
  },
  {
    id: 'p-standard',
    group: '개인 세무',
    badge: '건당 결제',
    typeLabel: 'Personal Standard (표준 신고)',
    price: 'Rp 200.000',
    vat: 'PPN 포함 합계: Rp 222.000',
    description: '복수 소득·복수 원천징수·자산/부채 입력이 필요한 개인',
    meta: ['PPN 포함 합계: Rp 222.000', '복잡도 기준', '통합 개인 연간 신고'],
    items: [
      '여러 원천징수 자료 병합 정리',
      '기타 소득·공제·자산·부채 정리',
      '가족정보/PTKP 프로필 확인',
      '신고 완료 증빙 관리',
    ],
    criteria: ['복수 고용주 또는 복수 원천징수 자료', '기타 소득 또는 공제 확인 필요', '자산·부채 입력 필요'],
    storage: storage('1GB / 신고연도'),
    info: PERSONAL_INFO_KO,
  },
  {
    id: 'p-complex',
    group: '개인 세무',
    badge: '건당 결제',
    typeLabel: 'Personal Business / Complex',
    price: 'Rp 500.000',
    vat: 'PPN 포함 합계: Rp 555.000',
    description: '프리랜스 · 개인사업 · 투자소득 · 복잡 자산이 있는 개인',
    meta: ['PPN 포함 합계: Rp 555.000', '복잡도 기준', '통합 개인 연간 신고'],
    items: [
      '사업/프리랜스 소득자료 자동 정리',
      '수입·비용·증빙 자료 분류',
      '투자소득·임대소득 반영',
      '자산·부채 변동 및 리스크 체크',
    ],
    criteria: ['프리랜스 또는 개인사업 소득', '사업 관련 수입·비용 자료', '추가 소득 또는 복잡 자산'],
    storage: storage('3GB / 신고연도'),
    info: PERSONAL_INFO_KO,
  },
  {
    id: 'monthly-umkm',
    group: '법인 월관리',
    badge: '월 선납',
    typeLabel: 'UMKM 월관리',
    price: 'Rp 750,000',
    description: '소규모 법인 / Final Tax 중심',
    meta: ['1개월 선납', '12개월 선납 시 10% 할인 가능', '연결산 별도'],
    items: [
      '월 신고 준비상태 대시보드',
      'PPh Final UMKM 월 매출 기준 계산',
      '간단 PPh21 급여 검토',
      '제한적 원천세 코드 판정',
      'ID Billing 준비값 및 납부 리마인더',
      '기본 AI 리스크 코멘트',
    ],
    criteria: [
      '직원 10명 이하',
      '월 원천세 거래 10건 이하',
      '월 업로드/거래 50건 이하',
      'PKP/PPN 정기 신고가 필요한 법인은 Basic 이상 권장',
      '기준 초과 시 해당 월은 Basic 월관리 기준으로 보정될 수 있으며, 이미 결제한 금액을 제외한 차액만 추가 청구',
    ],
    storage: storage('2GB / 월'),
    info: MONTHLY_INFO_KO,
  },
  {
    id: 'monthly-basic',
    group: '법인 월관리',
    badge: '월 선납',
    typeLabel: 'Basic 월관리',
    price: 'Rp 1,500,000',
    description: '일반 법인 기본 세무 운영',
    meta: ['1개월 선납', '12개월 선납 시 10% 할인 가능', '연결산 별도'],
    items: [
      'PPh21 급여 원천세 관리',
      'PPh23/4(2)/26 등 원천세 코드 판정',
      'PPh25 또는 PPh Final 월 납부 관리',
      'PPN 매입·매출 자료 정리',
      'ID Billing · NTPN · BPE 증빙 보관',
      '표준 월별 세금 보고서',
    ],
    criteria: [
      '직원 30명 이하',
      '월 원천세 거래 30건 이하',
      '월 매입/매출 거래 300건 이하',
      '일반 PKP 법인의 기본 월관리 기준',
      '기준 초과 시 해당 월은 Pro 월관리 기준으로 보정될 수 있음',
    ],
    storage: storage('10GB / 월'),
    info: MONTHLY_INFO_KO,
  },
  {
    id: 'monthly-pro',
    group: '법인 월관리',
    badge: '월 선납',
    typeLabel: 'Pro 월관리',
    price: 'Rp 2,500,000',
    description: '월별 세무 운영 강화',
    meta: ['1개월 선납', '12개월 선납 시 10% 할인 가능', '연결산 별도'],
    items: [
      'Basic 포함 내용 전체',
      '대량 급여·원천세 자료 처리',
      '해외거래·PPh26·Tax Treaty 검토 신호',
      '특수관계/TP 조건 모니터링',
      'AI 이상 감지 및 고급 리스크 코멘트',
      '고급 월별 세금 보고서',
      '우선 처리',
    ],
    criteria: [
      '직원 100명 이하',
      '월 원천세 거래 150건 이하',
      '월 매입/매출 거래 1,000건 이하',
      '해외거래·특수관계 모니터링 포함',
      '기준 초과 또는 반복 대량 거래는 Enterprise 기준 적용',
    ],
    storage: storage('30GB / 월'),
    info: MONTHLY_INFO_KO,
  },
  {
    id: 'monthly-enterprise',
    group: '법인 월관리',
    badge: '월 선납',
    typeLabel: 'Enterprise 맞춤 월관리',
    price: 'Rp 3,500,000',
    description: '대량/맞춤 운영',
    meta: ['1개월 선납', '사용량 기반 과금', '연결산 별도'],
    items: [
      'Pro 포함 내용 전체',
      '직원 100명 초과 급여·PPh21 처리',
      '월 150건 초과 원천세 코드 판정',
      '대량 PPN·매입·매출 자료 자동분류',
      '맞춤형 리포트/SLA',
      '초과 사용량 기반 과금 및 우선 지원',
    ],
    criteria: [
      '직원 100명 초과',
      '월 원천세 거래 150건 초과',
      '월 매입/매출 거래 1,000건 초과 또는 대량 문서 자동분류 필요',
      '복수 사업장·복잡 승인흐름·맞춤 리포트가 필요한 법인',
    ],
    storage: storage('100GB / 월부터'),
    info: MONTHLY_INFO_KO,
  },
  {
    id: 'annual-umkm',
    group: '법인 연결산',
    badge: '1회 선납',
    typeLabel: 'UMKM 연결산',
    price: 'Rp 2,500,000',
    description: 'Final Tax 0.5% 대상 법인 연결산',
    meta: ['1회 선납', '월관리와 별도 선택', 'SPT Badan 기준'],
    items: [
      '정상 재무제표 생성',
      'UMKM Final Tax 계산',
      'SPT 초안 생성',
      'e-Bupot 1721 A1 발급',
    ],
    criteria: [
      '연매출 Rp 4.8B 이하',
      'Final Tax 0.5% 적용 가능 법인',
      '일반 UMKM 장부 기준',
      '대량 재고·고정자산·복잡 세무조정 없음',
    ],
    storage: storage('2GB / 회계연도'),
    info: 'UMKM 연결산은 기준이 명확한 1회성 연간 결산·SPT Badan 신고 준비 서비스입니다. 연매출 Rp 4.8B 이하, Final Tax 0.5% 적용 가능 법인, 일반 UMKM 장부 기준에 적용됩니다.',
  },
  {
    id: 'annual-pph25',
    group: '법인 연결산',
    badge: '1회 선납',
    typeLabel: 'PPh25 일반 법인 연결산',
    price: 'Rp 7,500,000',
    description: '일반 법인세 대상 표준 연결산',
    meta: ['1회 선납', '월관리와 별도 선택', 'SPT Badan 기준'],
    items: [
      '재무제표 생성',
      '일반 세무조정',
      '세액공제 확인',
      'PPh29/PPh25 산정',
      'SPT 초안 생성',
    ],
    criteria: [
      '연매출 Rp 25B 이하',
      'UMKM Final Tax 대상이 아니거나 일반 법인세(PPh25) 적용 법인',
      '연 거래 1,000건 이하',
      '직원 100명 이하',
      '단일 법인·단일 사업장 또는 단순 사업구조',
      '회계자료 정리 상태 양호',
      '일반 세무조정 범위',
      'TP 문서화, Tax Treaty, 대규모 재고·고정자산 재구성 등 별도 전문 검토 없음',
    ],
    storage: storage('10GB / 회계연도'),
    info: 'PPh25 일반 법인 연결산은 매출과 업무량 기준의 표준 결산입니다. 연매출 Rp 25B 이하, 연 거래 1,000건 이하, 직원 100명 이하, 회계자료 정리 상태가 양호하고 일반 세무조정 범위인 경우에 적용됩니다. UMKM Final Tax 대상이 아닌 일반 법인 또는 PPh25 적용 법인도 이 기준으로 판단합니다.',
  },
  {
    id: 'annual-complex',
    group: '법인 연결산',
    badge: '1회 선납',
    typeLabel: '복잡 구조 연결산',
    price: 'Rp 15,000,000',
    description: '매출·거래량·자료정리 난이도가 높은 법인',
    meta: ['1회 선납', '월관리와 별도 선택', 'SPT Badan 기준'],
    items: [
      'PPh25 일반 연결산 전체',
      '대량 거래 데이터 정리',
      '복잡 재고·고정자산·외화거래 검토',
      '불완전 회계자료 재구성 지원',
      '필요 시 TP·PPh26·Tax Treaty 별도 검토',
      'AI 리스크 보고서',
      '우선 처리',
    ],
    criteria: [
      '아래 조건 중 하나라도 해당하면 복잡 구조 연결산 적용',
      '연매출 Rp 25B 초과',
      '연 거래 1,000건 초과',
      '직원 100명 초과',
      '복수 사업장·복수 프로젝트·복수 KBLI 운영',
      '재고·원가·고정자산·외화거래 정리가 복잡한 경우',
      '회계자료가 불완전해 재무제표 재구성이 필요한 경우',
      'TP, PPh26, DGT Form, Tax Treaty 등 별도 전문 검토가 필요한 경우',
    ],
    storage: storage('30GB / 회계연도'),
    info: '복잡 구조 연결산은 해외 여부 자체가 아니라 매출·거래량·직원 수·자료정리 난이도 또는 별도 전문 검토 필요성으로 판단합니다. 연매출 Rp 25B 초과, 연 거래 1,000건 초과, 직원 100명 초과, 복수 사업장, 복잡한 재고·고정자산·외화거래, 회계자료 재구성, TP/PPh26/Tax Treaty 별도 검토 필요 중 하나라도 해당하면 적용됩니다.',
  },
];
