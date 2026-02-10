# Persona: Corporate (PT) HRD/Finance Manager

**Navigation**: [Personas Home](README.md) | [Individual](tax-consultant.md) | [UMKM](accountant.md) | [Tax Consultant](cfo.md)

---

## Profile: Pak Hendro (HRD Manager)

**Demographics**:
- **Name**: Pak Hendro
- **Age**: 45 years old
- **Position**: HRD Manager, Manufacturing Company
- **Company Size**: 80 employees
- **Accounting Software**: Accurate
- **Current Tax Support**: Tax consultant (Rp 3M/month)
- **Monthly Filings**: PPh 21, PPh 25, PPN

---

## Current Situation (AS-IS)

### Monthly Cycle (Day 1-30)

**Days 1-10: Payroll Processing**
```
Day 1: Calculate payroll in Accurate
Day 5: Manual PPh 21 calculation (80 employees in Excel)
       → Check PTKP one by one (single/married/children)
       → Calculate progressive tax (5%-35%)
       → Work overtime for 2 days
```

**Days 11-15: Submit to Tax Consultant**
```
Day 11: Excel → PDF → Email to consultant
Day 12: Consultant: "3 employees missing NPWP" → Fix
Day 13: Consultant: "Totals don't match" → Recalculate
Day 14: Final approval
Day 15: Consultant files PPh 25 (corporate advance tax)
```

**Days 16-20: PPh 21 Filing**
```
Consultant handles:
→ Generate e-Bupot (withholding certificates)
→ Submit SPT Masa PPh 21
→ Distribute Bukti Potong to employees (email)
```

**Days 21-30: PPN Filing**
```
Day 25: Collect sales/purchase invoices (300 items)
Day 27: Excel reconciliation (3 days work)
        → "Invoice A is missing?" → Request from sales team
Day 28: Send to consultant
Day 30: Consultant submits e-Faktur + SPT PPN
```

**Quarterly: Financial Statements**
```
End of quarter: CFO prepares financial statements
                → Send to consultant (for review)
```

**Annual: April SPT Tahunan Badan**
```
March: Year-end financial statements (accounting team all-hands)
April 1-15: Consultant prepares SPT Badan
            → Separate fee: Rp 15,000,000
April 20: Review (don't understand but sign anyway)
April 28: e-Filing submission

Annual Total Cost:
- Monthly consultant: Rp 3M x 12 = Rp 36M
- SPT Badan: Rp 15M
- Total: Rp 51,000,000/year

Annual Total Work Hours:
- HRD (Pak Hendro): 20 hours/month x 12 = 240 hours/year
- Accounting team: 30 hours/month x 12 = 360 hours/year
- Total: 600 hours/year (25 full days)
```

---

## Pain Points

### 1. Monthly Repetitive Hell
- 💢 PPh 21 calculation (80 employees) - overtime required
- 💢 PTKP mistakes (single entered as married)
- 💢 Sales/purchase reconciliation (300 items) - eye strain

### 2. Inefficient Consultant Communication
- 💢 Email back-and-forth (version control chaos)
- 💢 "There's an error" → Fix → Resend (3-4 iterations)
- 💢 No real-time progress visibility

### 3. Duplicate Data Entry from Accurate
- 💢 Payroll already in Accurate, why enter into Excel again?
- 💢 Invoices already in e-Faktur, why Excel reconciliation?
- 💢 "Can't we integrate via API?" (Consultant only accepts Excel)

### 4. High Consultant Fees
- 💢 Annual Rp 51M → burdensome
- 💢 But too complex to do it ourselves
- 💢 "Can't we automate this with a system?"

---

## Goals & Desired Outcomes

### Primary Goals
- ✅ Accurate integration → eliminate duplicate entry
- ✅ Auto-calculate PPh 21 (80 employees)
- ✅ Auto-reconcile PPN
- ✅ Real-time collaboration with consultant
- ✅ 90% time savings

### Success Metrics
- **Time Savings**: 600 hours → 84 hours/year (87% reduction)
  - HRD: 20 hours → 2 hours/month
  - Accounting: 30 hours → 5 hours/month
- **Cost Savings**: Rp 51M → Rp 30M (consultant only reviews, not processes)
- **Error Reduction**: 95% fewer errors (auto-validation)
- **Consultant Efficiency**: Real-time collaboration (no email ping-pong)

---

## Ideal Experience (TO-BE with AI PAJAK)

### Monthly Day 1: Auto-Sync
```
Accurate → AI PAJAK automatic sync
→ 80 employees' payroll data imported
→ PPh 21 auto-calculated (3 minutes complete)
→ PTKP auto-applied (pulled from database)
```

### Monthly Day 5: Verification
```
AI PAJAK Dashboard:
┌────────────────────────────────────┐
│ ✅ 80 employees calculated         │
│ ✅ Totals verified                 │
│ ❌ 2 errors: Employee A, B         │
│    → NPWP expired                  │
└────────────────────────────────────┘

Auto-email to Employee A, B:
"Please upload renewed NPWP photo"
→ Employees upload via app → Auto-verified
```

### Monthly Day 10: Submit to Consultant
```
"Submit to Consultant" button
→ AI PAJAK auto-shares with consultant account
→ Consultant: Real-time access (no email)
```

### Monthly Day 15: PPh 25
```
AI PAJAK auto-calculates:
→ Previous year corporate tax ÷ 12
→ e-Billing generated
→ Consultant approves → Submit
```

### Monthly Day 20: PPh 21
```
Consultant in AI PAJAK:
→ Bulk generate e-Bupot (80 employees at once)
→ Submit SPT Masa
→ Auto-email Bukti Potong to employees
```

### Monthly Day 30: PPN
```
e-Faktur → AI PAJAK auto-integration
→ Sales PPN: Rp 110M
→ Purchase PPN: Rp 80M
→ Auto-matching: 95% complete
→ 15 unmatched items: Manual review (30 minutes)
→ Consultant approves → Submit SPT PPN
```

### April: SPT Tahunan Badan
```
Accurate financial statements → AI PAJAK integration
→ Auto-calculate corporate tax (22%)
→ Auto-aggregate PPh 25 credits
→ Auto-generate SPT Badan
→ Consultant reviews → Submit
```

### Results

**Time Saved**:
- HRD: 20 hours → 2 hours/month (90% reduction)
- Accounting: 30 hours → 5 hours/month (83% reduction)
- Total: 600 hours → 84 hours/year

**Cost**:
- Previous: Rp 51M (consultant does everything)
- New: Rp 30M (consultant only reviews)
- Savings: Rp 21M/year 🎉

---

## Must-Have Features (P0)

| Feature | Priority | Why Critical |
|---------|----------|--------------|
| Accurate API integration | P0 | Eliminate duplicate entry (80% time savings) |
| PPh 21 bulk calculation | P0 | Core monthly workload |
| e-Faktur integration | P0 | PPN reconciliation automation |
| Consultant collaboration portal | P0 | Replace email chaos |
| Real-time error validation | P0 | Prevent submission errors |

## Nice-to-Have Features (P1)

| Feature | Priority | Why Important |
|---------|----------|---------------|
| Bulk e-Bupot generation | P1 | Further automate PPh 21 |
| Employee self-service | P1 | NPWP upload by employees |
| SPT Badan auto-generation | P1 | Annual filing automation |
| Multi-entity dashboard | P1 | For companies with multiple PTs |

---

## User Stories

See detailed user stories: [Corporate User Stories](../user-stories/executive-stories.md)

**Key Stories**:
1. As Pak Hendro, I want Accurate integration so that I don't have to manually re-enter 80 employees' payroll data
2. As Pak Hendro, I want bulk PPh 21 calculation so that I don't have to work overtime on Excel
3. As Pak Hendro, I want real-time consultant collaboration so that I don't have to email back-and-forth
4. As Pak Hendro, I want auto-validation alerts so that I can fix errors before submission
5. As Pak Hendro, I want e-Faktur integration so that PPN reconciliation takes 30 minutes instead of 3 days

---

## Feature Mapping

### Journey Stage → Features

| Stage | Current Pain | AI PAJAK Feature |
|-------|-------------|------------------|
| **Day 1-5** | Manual payroll entry (2 days) | Accurate auto-sync (3 minutes) |
| **Day 5-10** | PTKP errors | Auto-validation + employee alerts |
| **Day 11-14** | Email back-and-forth | Real-time consultant portal |
| **Day 15** | PPh 25 manual calc | Auto-calculation engine |
| **Day 16-20** | Manual e-Bupot (80x) | Bulk generation |
| **Day 21-27** | PPN reconciliation (3 days) | e-Faktur auto-matching (30 min) |
| **Day 28-30** | Manual SPT submission | One-click bulk submit |
| **April** | SPT Badan (15 days) | Auto-generation (2 days) |

---

## Market Insights

### Segment Size
- **Target**: 1.5 million PT companies
- **Annual Revenue Potential**: Rp 18T (Rp 12M average/company)
- **Acquisition**: Tax consultant partnerships, accounting software integrations

### Willingness to Pay
- **Current**: Rp 36-60M/year (full-service consultant)
- **AI PAJAK**: Rp 12M/year (Rp 1M/month) + reduced consultant fees
- **Value Proposition**: Save Rp 21M/year + 87% time savings

### Competitive Landscape
- **OnlinePajak**: Rp 15M/year - no Accurate integration
- **Mekari**: Rp 20M/year - good features but expensive
- **Full consultant**: Rp 51M/year - traditional approach

**AI PAJAK Differentiation**:
- Best integration: Native Accurate + e-Faktur sync
- Consultant-friendly: Real-time collaboration (not replacement)
- Best ROI: Rp 21M savings + 516 hours saved

---

## Revenue Model

### Pricing Tier
**Corporate Plan**: Rp 1,000,000/month (Rp 12,000,000/year)

**What's Included**:
- ✅ Accurate integration (unlimited employees)
- ✅ e-Faktur integration (unlimited invoices)
- ✅ PPh 21 bulk calculation
- ✅ PPh 25 auto-calculation
- ✅ PPN auto-reconciliation
- ✅ Consultant collaboration portal (up to 3 consultants)
- ✅ Real-time error validation
- ✅ SPT Masa unlimited filing
- ✅ SPT Tahunan Badan (annual)
- ✅ Priority support

### Upsell Opportunities
- **Enterprise**: Rp 2M/month → Multi-entity (holding companies)
- **Add-ons**:
  - Additional consultant seats: +Rp 100K/month each
  - Custom integrations: Custom pricing

---

## Integration Strategy

### Phase 1: Accurate Integration (P0)
**Why Accurate?**
- Market leader in Indonesia (60% market share)
- Used by 90% of our PT target segment
- Has API available

**Integration Points**:
1. Payroll data (employees + salaries)
2. PTKP database (marital status, dependents)
3. Financial statements (for SPT Badan)

### Phase 2: e-Faktur Integration (P0)
**Why e-Faktur?**
- Mandatory government system for PPN
- 100% of PKP companies use it
- Has API (DJP provides it)

**Integration Points**:
1. Sales invoices (output PPN)
2. Purchase invoices (input PPN)
3. Auto-matching algorithm

### Phase 3: Other Accounting Software (P1)
- Jurnal
- Zahir
- MYOB

---

## Related Documents

- [Corporate User Stories](../user-stories/executive-stories.md)
- [Features: Corporate](../features/executive-features.md)
- [Business Model](../03-business-model.md)
- [Go-to-Market Strategy](../03-business-model.md#phase-3-corporate)
- [Technical Architecture](../06-user-flows.md#integrations)

---

**Last Updated**: 2025-12-23
**Source**: Extracted from PRD.md section 3.3 (Persona 3)
