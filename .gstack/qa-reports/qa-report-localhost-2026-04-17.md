# QA Report — AI Pajak (localhost:3000)

**Date:** 2026-04-17
**Branch:** main
**Scenario:** 법인 고객 온보딩 + 내비 (Standard tier)
**Account:** company.test@example.com (COMPANY customer)
**Tester:** /qa (Playwright fallback, Chromium 1208)
**URL:** http://localhost:3000
**Commit before QA:** a34a6c2
**Fix commit:** 9ee0def

---

## Summary

| Metric | Value |
|---|---|
| Pages visited | 8 (homepage, login, dashboard, filings, documents, billing, reports, settings) + mobile variants |
| Console errors (authenticated) | 0 unique app errors (5 x 401 pre-login noise) |
| Network errors | 3 (billing API, pre-login; expected) |
| Findings | 5 (1 Critical, 2 Medium, 1 Low, 1 Info) |
| Fixes applied | 1 verified commit (Critical i18n) |
| Deferred | 3 |
| Health score (est) | 72 → 80 after fix |

### PR summary
> QA found 5 issues (1 critical i18n leak on login page + 4 other), fixed 1 critical, deferred 3 med/low for follow-up. Health 72 → 80.

### Top 3 things to fix
1. **ISSUE-001 (fixed, 9ee0def):** Korean strings leaked onto Indonesian login page — hardcoded labels/placeholders/helper/error.
2. **ISSUE-004 (deferred):** Every page has the same `<title>` — users can't identify tabs by title.
3. **ISSUE-005 (deferred):** `/tax` and other index-less dashboard routes fall through to bare Next.js 404.

---

## Findings

### ISSUE-001 — Korean hardcoded strings on login page [FIXED]

- **Severity:** Critical
- **Category:** Content / i18n
- **Status:** Verified fix in commit `9ee0def`
- **Evidence:** `screenshots/02-login-page.png` (before), `screenshots/13-login-fixed-id.png` (after), `screenshots/14-login-en.png` (english)
- **Source:** `src/app/[locale]/(auth)/login/page.tsx:133,137,140` and error handler `setError('해당 NPWP로 등록된 계정이 없습니다')`
- **Detail:** The login page — the very first page an Indonesian customer sees — hardcoded 3 Korean strings:
  - Label: `이메일 또는 NPWP`
  - Placeholder: `email@example.com 또는 00.000.000.0-000.000`
  - Helper: `법인 고객은 NPWP로도 로그인 가능`
  - Plus the NPWP-resolve error: `해당 NPWP로 등록된 계정이 없습니다`

  Commit 78c6d7f translated 583 strings but missed these 4. This is the primary conversion surface for the Indonesian market; Korean text here confuses real customers.
- **Fix:** Added `auth.emailOrNpwp`, `auth.emailOrNpwpPlaceholder`, `auth.companyNpwpHint`, `auth.npwpNotFound` to all 5 locales (id/en/ko/ja/zh) and wired via `t()` calls.
- **Verification:** Playwright confirms on `/id/login` no Korean characters present; on `/en/login` placeholder reads `email@example.com or 00.000.000.0-000.000`.

### ISSUE-002 — NPWP not-found error hardcoded in Korean [FIXED]

Same commit as ISSUE-001. Fixed as part of `setError(t('auth.npwpNotFound'))`.

### ISSUE-003 — Sidebar has 12+ top-level items for COMPANY customer [INFO — evidence, not a bug]

- **Severity:** Medium (design judgment, not defect)
- **Category:** UX / information architecture
- **Evidence:** `screenshots/03-post-login.png`
- **Detail:** Post-login sidebar for `company.test@example.com` shows **12+ items** grouped in 3 sections:
  - **PELAPORAN BULANAN (7):** Dasbor, Status Pelaporan, PPh 21 (Karyawan), Pajak Pemotongan (PPh 4(2), 15, 22, 23, 26), Pajak Penghasilan Dimuka (PPh Final, 25), PPN, Penerbitan ID Billing
  - **PELAPORAN TAHUNAN SPT (4):** Tutup Buku Tahunan, Jurnal Umum, Laporan Keuangan, Penerbitan Ebupot/A1
  - **MANAJEMEN PELAPORAN (1+):** Riwayat Pelaporan (more below fold)
- **Why it matters (directly relevant to founder's "복잡해 보임" concern from office-hours):**
  - A first-time COMPANY customer who just wants to "이번 달 PPh21 신고"한다" has to scan 12 items to find the one they need.
  - Indonesian tax concept clusters (Pemotongan vs Penghasilan Dimuka vs Final) require domain knowledge users may not have.
  - Empty dashboard shows 3 zero-value charts + zero-data cards = cognitive load with no payoff.
- **Not fixed in this pass** because this is a design/IA judgment that needs stakeholder input, not a code bug. But this is **the objective evidence** that justifies (or de-justifies) the founder's worry. The worry is real. The question is whether the fix is "reduce sidebar items" or "progressive disclosure (show next action, hide menu until needed)".
- **Recommended follow-up:** Add a "이번 달 할 일" empty-state widget on the dashboard that picks ONE next action based on customer profile (e.g., "PPh21 마감까지 D-N"). Hide the full sidebar behind a hamburger until user is past first-session.

### ISSUE-004 — All pages share identical `<title>` [DEFERRED]

- **Severity:** Medium
- **Category:** SEO / UX
- **Evidence:** Every page tested returned `title: "AI PAJAK - Platform Pajak Cerdas Indonesia"`.
- **Detail:** When a user has 5 tabs open (common for consultants), the browser chrome can't distinguish them. Also hurts SEO and screen-reader navigation.
- **Likely source:** single `metadata` export in `src/app/[locale]/layout.tsx` without per-page overrides. Unverified.
- **Effort estimate (CC):** ~15 min to add `generateMetadata` on the ~8 top-level dashboard pages.

### ISSUE-005 — `/tax` returns bare Next.js 404 [DEFERRED]

- **Severity:** Low
- **Category:** UX / 404 handling
- **Evidence:** `screenshots/04-tax.png`
- **Detail:** `src/app/[locale]/(dashboard)/tax/` has only subdirectories (`[type]`, `annual`, `pph21`, etc.) and no `page.tsx`, so direct navigation to `/tax` falls through to Next.js's default "404 — This page could not be found." (English text, no branding, no navigation). Same situation likely applies to any dashboard section without an index page.
- **Not urgent** because sidebar links go to subpaths, so users who don't bookmark the bare URL won't hit it. Worth adding a branded 404 at the app level when time allows.

---

## Authenticated Navigation Snapshot

Post-login (`/id/dashboard`) captured in `screenshots/03-post-login.png`:
- Header: dark-mode toggle, notifications bell (red dot), locale switcher, user menu (`PT Example Indonesia` / `company.test@example.com`)
- 3 stat cards: Total Pajak Rp 0 / Pajak Belum Dibayar Rp 0 / Pelaporan Mendatang 0 pelaporan
- "Tren Pajak Bulanan" — 3 empty line charts (Nov → Apr, all 0K)
- "Info Perusahaan" card — NPWP and KBLI both `—` (empty profile)

**Onboarding signal:** dashboard does not have a visible "시작하기" or empty-state CTA for a fresh COMPANY customer. First impression = charts full of zeros. This is an onboarding gap worth its own design pass (separate from the sidebar complexity issue).

---

## Fix Verification

| Issue | Before | After | Screenshot |
|---|---|---|---|
| ISSUE-001 | `이메일 또는 NPWP` label, Korean placeholder + helper | `Email atau NPWP` / `email@example.com atau 00.000.000.0-000.000` / `Pelanggan badan dapat login dengan NPWP` | `13-login-fixed-id.png` |
| ISSUE-001 (en) | — | `email@example.com or 00.000.000.0-000.000` | `14-login-en.png` |

Automated check: no Korean characters (`\uac00-\ud7af`) found in `/id/login` body after fix.

---

## Tooling Notes

- `gstack $B` browse binary failed in this sandbox (unsigned bun-compiled ARM64 binary killed by AMFI → exit 137).
- Fallback: project's installed Playwright 1.57.0 + Chromium 1208 via `chrome-headless-shell-mac-arm64`.
- QA script kept at `.gstack/qa-reports/qa-script.mjs` for rerun.
