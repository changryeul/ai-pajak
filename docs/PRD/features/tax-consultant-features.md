# Individual Taxpayer Features

**Navigation**: [Features Home](README.md) | [UMKM Features](accountant-features.md) | [Corporate Features](executive-features.md)

---

**For**: Individual taxpayers (Budi - 근로소득자)
**See**: [Individual Persona](../personas/tax-consultant.md)

---

## P0 Features (MVP)

### 1. Form 1721-A1 OCR
**Upload tax form via photo/PDF → Auto-extract salary, withheld tax**

**Input**: Form 1721-A1 (PDF or photo)
**Output**: Structured data (total salary, withheld tax, employer)
**Accuracy Target**: ≥95%
**Time**: <30 seconds

---

### 2. SPT 1770 SS Auto-Generation
**Auto-fill annual tax return form**

**Input**: Form 1721-A1 data + PTKP
**Output**: Complete SPT 1770 SS
**Validation**: DJP format compliance

---

### 3. PTKP Auto-Calculation
**Auto-calculate tax-free income based on marital status**

**Questions**: Marital status, number of dependents
**Output**: PTKP amount (Rp 54M - 67.5M+)
**Smart**: Remembers for next year, updates if changed

---

### 4. March Deadline Reminders
**D-30, D-14, D-7 notifications**

**Channels**: Email + Push notification
**Timing**: March 1, March 17, March 24
**CTA**: Links directly to SPT filing flow

---

### 5. One-Click DJP Submission
**Submit SPT to DJP with one click**

**Auth**: One-time authorization (stores EFIN securely)
**Process**: Generate SPT → Submit to DJP → Retrieve BPE
**Time**: <1 minute
**Storage**: BPE saved for future reference

---

## P1 Features (Phase 2)

### 6. Tax Refund Tracking
**Track refund status and notify when deposited**

**Integration**: DJP API
**Notification**: Push when refund deposited
**Display**: "Rp 900,000 refunded on April 15"

---

### 7. Multi-Year Comparison
**Compare this year's tax vs previous years**

**Display**: 2024 vs 2023 side-by-side
**Insights**: Salary change, tax change, refund difference

---

### 8. Tax Optimization Tips
**Personalized tips to reduce tax next year**

**Examples**:
- "Get married → PTKP increases Rp 4.5M"
- "Have a child → PTKP increases Rp 4.5M"
- "Pension fund contributions → deductible"

---

**See**: [Individual Persona](../personas/tax-consultant.md) for detailed user goals

---

**Last Updated**: 2025-12-23
