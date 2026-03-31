# AI PAJAK - 출시 전 체크리스트

> 최종 업데이트: 2026-03-31

## 환경변수 설정
- [ ] ANTHROPIC_API_KEY (Vercel Production)
- [ ] NEXT_PUBLIC_SUPABASE_URL (Vercel Production)
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY (Vercel Production)
- [ ] SUPABASE_SERVICE_ROLE_KEY (Vercel Production)
- [ ] MIDTRANS_SERVER_KEY (Vercel Production)
- [ ] NEXT_PUBLIC_MIDTRANS_CLIENT_KEY (Vercel Production)
- [ ] NEXT_PUBLIC_APP_URL (set to https://app.aipajak.com)
- [ ] RESEND_API_KEY (트랜잭션 이메일용 - Resend)
- [ ] EMAIL_FROM (기본값: AI Pajak <noreply@aipajak.com>)
- [ ] EMAIL_SUPPORT (기본값: support@aipajak.com)

## 도메인 설정
- [ ] DNS A/CNAME 레코드 설정 (app.aipajak.com → Vercel)
- [ ] Vercel Domains에서 커스텀 도메인 추가
- [ ] SSL 인증서 자동 발급 확인
- [ ] NEXT_PUBLIC_APP_URL 업데이트

## Supabase 설정
- [ ] Auth > URL Configuration > Site URL을 https://app.aipajak.com으로 변경
- [ ] Auth > URL Configuration > Redirect URLs에 https://app.aipajak.com/** 추가
- [ ] Auth > Email Templates 확인 (비밀번호 재설정, 인증)
- [ ] Database > Backups 활성화 확인

## 이메일 설정
- [ ] Resend 계정 생성 및 RESEND_API_KEY 발급
- [ ] Resend에서 aipajak.com 도메인 인증 (DNS SPF/DKIM 레코드)
- [ ] Supabase Auth 이메일 (비밀번호 재설정, 가입 확인) 테스트
- [ ] Resend 트랜잭션 이메일 (결제 확인, 마감 알림) 테스트

## 결제 (Midtrans)
- [ ] Sandbox에서 결제 플로우 테스트
- [ ] Production 키 발급 및 설정
- [ ] Webhook URL 설정: https://app.aipajak.com/api/webhooks/midtrans
- [ ] Snap.js 결제 팝업 테스트
- [ ] 결제 확인/실패 이메일 발송 확인

## 법률/컴플라이언스
- [ ] 이용약관 페이지 검토
- [ ] 개인정보처리방침 페이지 검토
- [ ] DJP ASP 인증 신청 (장기)

## 테스트
- [ ] 단위 테스트 전체 통과 확인
- [ ] 4개 테스트 계정 로그인 확인
- [ ] 결제 Sandbox 테스트
- [ ] 이메일 발송 테스트 (비밀번호 재설정)
- [ ] 모바일 반응형 테스트
- [ ] 비밀번호 재설정 전체 플로우 테스트 (forgot → email → reset)

## 모니터링
- [ ] /api/health 정상 응답 확인
- [ ] Sentry DSN 설정 (에러 수집)
- [ ] Uptime 모니터링 설정
