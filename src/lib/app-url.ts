/**
 * 앱의 공개 기준 URL (single source of truth).
 *
 * 도메인 변경 시 각 환경의 `NEXT_PUBLIC_APP_URL` 환경변수 하나만 바꾸면
 * 이메일·알림·OAuth 콜백·초대 링크 등 모든 절대 URL 이 따라옵니다.
 * env 가 없을 때만 아래 DEFAULT 로 폴백합니다(마지막 안전망 — 실환경엔 항상 env 설정).
 *
 * ⚠️ 프로덕션 도메인 확정 시 DEFAULT_APP_URL 한 줄만 갱신하세요.
 */
export const DEFAULT_APP_URL = 'https://ai-pajak.vercel.app';

export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL;
  return url.replace(/\/+$/, ''); // 끝 슬래시 제거 (링크 조합 시 이중 슬래시 방지)
}
