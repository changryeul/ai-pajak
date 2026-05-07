/**
 * DJP Coretax 외부 API DTO.
 *
 * 실제 spec은 미공개 → 합리적 추정값으로 잡고, 실제 spec 공개 시 본 파일만 수정.
 */

export interface IssueIdBillingRequest {
  /** 납세자 NPWP (15자리 숫자) */
  npwp: string;
  /** KAP 코드 (예: 411124 — PPh23) */
  kap: string;
  /** JENIS_SETORAN 코드 (예: 100 — Monthly) */
  kjs: string;
  /** 신고 기간 'YYYY-MM' */
  taxPeriod: string;
  /** 납부세액 (정수, Rupiah) */
  amount: number;
  /** 메모 (선택) */
  description?: string;
}

export interface IssueIdBillingResponse {
  billingCode: string;
  amount: number;
  expiresAt: string; // ISO timestamp
  status: 'PENDING' | 'PAID';
}

export interface SubmitSptRequest {
  npwp: string;
  /** 신고서 종류 (예: 'SPT_MASA_PPH23', 'SPT_TAHUNAN_BADAN') */
  sptType: string;
  taxPeriod: string;
  /** 발행받은 Billing ID (선택 — 일부 SPT는 납부 전 제출 가능) */
  billingCode?: string;
  /** 신고서 페이로드 — SPT 종류별 형식 */
  payload: Record<string, unknown>;
}

export interface SubmitSptResponse {
  /** Bukti Penerimaan Elektronik */
  bpeNumber: string;
  bpeDate: string; // 'YYYY-MM-DD'
  ntpn?: string;
  acceptedAt: string; // ISO timestamp
}

export interface GetNtpnResponse {
  billingCode: string;
  ntpn: string;
  paidAt: string; // ISO timestamp
  amount: number;
}

/** Coretax 클라이언트가 던지는 가장 일반적인 에러. */
export class CoretaxError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_CONFIGURED' | 'NETWORK' | 'HTTP' | 'UNKNOWN',
    public readonly httpStatus?: number,
    public readonly responseBody?: string,
  ) {
    super(message);
    this.name = 'CoretaxError';
  }
}
