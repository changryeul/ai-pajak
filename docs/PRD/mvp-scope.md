# MVP Scope & Roadmap

**Navigation**: [Features Home](README.md) | [Roadmap](../roadmap/phase-overview.md)

---

## Phase 1: MVP (Months 1-3)

### Target Launch: March 2026 (Tax Season)

---

## P0 Features (Must-Have)

### Individual Taxpayers
- [x] Form 1721-A1 OCR (photo/PDF upload)
- [x] SPT 1770 SS auto-generation
- [x] PTKP auto-calculation
- [x] March deadline reminders (D-30, D-14, D-7)
- [x] One-click DJP e-Filing submission
- [x] BPE storage and retrieval

### UMKM Business Owners
- [x] Bank account integration (revenue tracking)
- [x] PPh Final 0.5% auto-calculation
- [x] Monthly reminders (D-5, D-1 before 15th)
- [x] e-Billing generation
- [x] SPT Masa PPh Final submission
- [x] Year 3→4 transition alert system

### Tax Consultants
- [x] Multi-client dashboard (up to 50 clients)
- [x] Auto-reminder broadcast system
- [x] Client submission portal (standardized templates)
- [x] Auto-validation engine
- [x] Bulk DJP submission (35+ clients at once)
- [x] Real-time progress tracking

### Core Infrastructure
- [x] Supabase Auth + RBAC (5 roles)
- [x] PostgreSQL database
- [x] DJP e-Filing integration
- [x] DJP e-Billing integration
- [x] OCR engine (OpenAI Vision)
- [x] Email notifications
- [x] Payment gateway (Midtrans)

---

## Out of Scope (Phase 2+)

### Deferred to Phase 2 (Months 4-6)
- Receipt OCR for expense tracking
- Accurate accounting integration
- e-Faktur PPN integration
- SPT Badan (corporate annual) automation
- White-label branding for consultants
- Mobile app

### Deferred to Phase 3 (Months 7-12)
- AI tax optimization recommendations
- Multi-year tax comparison
- Client profitability analysis for consultants
- Employee self-service portal
- API access for enterprises

---

## Success Criteria (Month 3)

### User Acquisition
- 200 tax consultants signed up
- 2,000 UMKM businesses active
- 1,000 individual taxpayers
- 200 corporate clients

### Usage Metrics
- 80% of users complete first SPT filing
- Average time to file: <5 minutes (vs 2 hours manual)
- NPS score: ≥50

### Technical Performance
- OCR accuracy: ≥95%
- DJP submission success rate: ≥98%
- System uptime: ≥99.5%
- API response time: <500ms (p95)

### Revenue
- ARR: Rp 5B+ (Year 1 Q1)
- Churn rate: <5%
- Consultant ARPU: Rp 2.5M/month
- UMKM ARPU: Rp 200K/month

---

## Launch Strategy

### Pre-Launch (Month -1)
- Beta testing with 10 tax consultants (free 6 months)
- Bug fixes and UX improvements
- Content creation (tutorials, FAQs)

### Launch (Month 0 - March 2026)
- Tax consultant onboarding campaign
- TikTok/Instagram ads for UMKM
- SEO optimization for "SPT filing Indonesia"
- PR: Tech media coverage

### Post-Launch (Months 1-3)
- Daily user feedback collection
- Weekly feature improvements
- Monthly webinars for tax consultants
- Referral program activation

---

## Risk Mitigation

| Risk | Mitigation | Status |
|------|-----------|--------|
| DJP API instability | Implement retry logic, queue system | ✅ Done |
| OCR accuracy <95% | Fallback to manual correction UI | ✅ Done |
| Low consultant adoption | Free 6-month pilot program | In progress |
| Tax law changes | Quarterly regulatory review | Ongoing |

---

## Related Documents

- [Roadmap Overview](../roadmap/phase-overview.md)
- [Success Metrics](../05-success-metrics.md)
- [Risks & Mitigation](../07-risks-mitigation.md)

---

**Last Updated**: 2025-12-23
**Implementation Status**: Phase 2 - 80% Complete
