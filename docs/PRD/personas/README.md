# User Personas

**Navigation**: [Home](../README.md) | [Executive Summary](../01-executive-summary.md) | [User Stories](../user-stories/README.md) | [Features](../features/README.md)

---

## Overview

AI PAJAK targets four distinct user personas across Indonesia's tax ecosystem. Each persona has unique pain points, workflows, and requirements that shape our product features and go-to-market strategy.

## Target Segments

| Persona | Market Size | TAM (Annual) | Priority |
|---------|-------------|--------------|----------|
| [Individual Taxpayers](tax-consultant.md) | 40M taxpayers | Rp 2T | P1 |
| [UMKM Business Owners](accountant.md) | 64M businesses | Rp 15T | P0 |
| [Corporate (PT) Managers](ceo.md) | 1.5M companies | Rp 18T | P1 |
| [Tax Consultants](cfo.md) | 10K consultants | Rp 300B | P0 |

**Total Addressable Market**: Rp 35.3T (USD 2.35B)

---

## Persona Summaries

### 1. Individual Taxpayer (Wajib Pajak Orang Pribadi)
**See**: [Detailed Persona](tax-consultant.md)

**Profile**: Budi, 28-year-old IT employee
- Monthly salary: Rp 12,000,000
- Annual SPT filing only (company handles PPh 21)
- Pain: Forgets EFIN password, manual form filling takes 2 hours

**Key Solution**: Auto-fill SPT from Form 1721-A1 (3 minutes vs 2 hours)

---

### 2. UMKM Business Owner
**See**: [Detailed Persona](accountant.md)

**Profile**: Ibu Siti, 35-year-old online clothing seller
- Monthly revenue: Rp 40-60M (TikTok Shop, Shopee)
- Must file PPh Final (0.5%) monthly but keeps missing deadlines
- Pain: Rp 1.2M annual penalties, Rp 8M/year tax consultant fees

**Key Solution**: Monthly reminders + one-click filing (saves Rp 5.6M/year)

---

### 3. Corporate HRD/Finance Manager (PT)
**See**: [Detailed Persona](ceo.md)

**Profile**: Pak Hendro, 45-year-old HRD Manager
- 80 employees manufacturing company
- Monthly: PPh 21, PPh 25, PPN filings
- Pain: 600 hours/year manual work, Rp 51M tax consultant fees

**Key Solution**: Accurate integration + bulk processing (90% time saved)

---

### 4. Tax Consultant
**See**: [Detailed Persona](cfo.md)

**Profile**: Ibu Rina, 38-year-old tax consultant
- Manages 35 clients (10 individuals, 20 UMKM, 5 PT)
- Monthly revenue: Rp 50M
- Pain: 70% time on data collection, can't scale beyond 35 clients

**Key Solution**: Multi-client dashboard + bulk submission (50% revenue increase)

---

## Pain Point Matrix

| Pain Point | Individual | UMKM | PT | Consultant |
|------------|-----------|------|-----|------------|
| **Forgets deadlines** | High | High | Low | N/A |
| **Manual calculations** | Medium | High | High | Medium |
| **Document management** | Low | Medium | High | High |
| **Can't scale** | N/A | N/A | Medium | High |
| **High consultant fees** | Low | High | High | N/A |
| **Data collection** | N/A | Low | Medium | Very High |

---

## Feature Prioritization by Persona

### Must-Have (P0) Features

| Feature | Individual | UMKM | PT | Consultant |
|---------|-----------|------|-----|------------|
| Form 1721-A1 OCR | ✅ | - | - | - |
| PPh Final automation | - | ✅ | - | ✅ |
| PPh 21 bulk calc | - | - | ✅ | ✅ |
| Multi-client dashboard | - | - | - | ✅ |
| Monthly reminders | ✅ | ✅ | ✅ | - |
| e-Filing integration | ✅ | ✅ | ✅ | ✅ |

### Nice-to-Have (P1) Features

| Feature | Individual | UMKM | PT | Consultant |
|---------|-----------|------|-----|------------|
| Tax refund tracking | ✅ | - | - | - |
| Receipt OCR | - | ✅ | - | - |
| Accurate integration | - | - | ✅ | ✅ |
| White-label branding | - | - | - | ✅ |
| Employee self-service | - | - | ✅ | - |

---

## User Journey Comparison

### Individual: Annual SPT Filing
```
January → Procrastinate
March 25 → Panic! (6 days left)
March 28 → Struggle with e-Filing (2 hours)
April → Receive Rp 900K refund

WITH AI PAJAK:
February → Reminder: Request Form 1721-A1
March 5 → One-click filing (3 minutes)
April → Receive refund
```

### UMKM: Monthly PPh Final
```
Month 1-11 → Forget to file (penalties accumulate)
December → Tax office letter (Rp 1.2M penalties)
→ Hire consultant (Rp 8M/year)

WITH AI PAJAK:
Every month → D-5 reminder
Every month → 1-minute filing
Year-end → Rp 5.6M saved
```

### PT: Monthly Tax Cycle
```
Day 1-10 → Manual PPh 21 calc (80 employees)
Day 11-15 → Send to consultant, errors, resend
Day 16-20 → Consultant submits PPh 21
Day 21-30 → PPN reconciliation (300 invoices)

WITH AI PAJAK:
Day 1 → Auto-sync from Accurate
Day 5 → Verify (2 hours vs 20 hours)
Day 10 → Submit to consultant (real-time)
Day 15-30 → Auto-matching (95% coverage)
```

### Consultant: Monthly Client Management
```
Day 1-5 → Chase 35 clients for data (30% response)
Day 6-15 → Validate data (99% has errors)
Day 16-20 → Manual 35x DJP login/submit
Result → Can't grow beyond 35 clients

WITH AI PAJAK:
Day 1 → Auto-reminder to 35 clients
Day 5 → Dashboard: 25 done, 5 pending, 5 errors
Day 10 → AI validates all submissions
Day 15 → Bulk submit (8 minutes vs 8 hours)
Result → Can scale to 50 clients (+50% revenue)
```

---

## Go-to-Market Prioritization

### Phase 1: Tax Consultants (Month 1-6)
**Why first**:
- Highest willingness to pay (Rp 2.5M/month)
- Direct access to 35 clients each (multiplier effect)
- Can validate all features across all user types

### Phase 2: UMKM (Month 6-12)
**Why second**:
- Largest TAM (Rp 15T)
- Highest pain (missing deadlines, penalties)
- Consultant referrals create trust

### Phase 3: Corporate (PT) (Month 12-24)
**Why third**:
- Complex integrations needed (Accurate, e-Faktur)
- Requires consultant partnerships
- Higher contract value but longer sales cycle

### Phase 4: Individual Mass Market (Month 18-36)
**Why last**:
- Lowest ARPU (Rp 50K/year)
- Once-a-year usage (low engagement)
- Viral/SEO-driven acquisition

---

## Related Documents

- [User Stories](../user-stories/README.md) - Detailed user stories by persona
- [Features](../features/README.md) - Feature specifications
- [Business Model](../03-business-model.md) - Pricing by segment
- [Go-to-Market Strategy](../03-business-model.md#go-to-market) - Launch phases

---

**Last Updated**: 2025-12-23
**Source**: Extracted from PRD.md section 3
