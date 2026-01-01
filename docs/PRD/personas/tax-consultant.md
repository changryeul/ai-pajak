# Persona: Individual Taxpayer (Wajib Pajak Orang Pribadi)

**Navigation**: [Personas Home](README.md) | [UMKM](accountant.md) | [Corporate](ceo.md) | [Tax Consultant](cfo.md)

---

## Profile: Budi (근로소득자 - Karyawan)

**Demographics**:
- **Name**: Budi
- **Age**: 28 years old
- **Occupation**: IT Startup Employee
- **Monthly Salary**: Rp 12,000,000
- **Marital Status**: Single (TK/0)
- **NPWP Status**: Active

---

## Current Situation (AS-IS)

### Monthly Tax Obligations
```
❌ No monthly filing required
✅ Company handles PPh 21 withholding automatically
```

### Annual Tax Filing (March Deadline)

**Timeline**:
```
January → "I should file SPT..." (procrastinates)
March 25 → "Only 6 days left!" (panic mode)
March 28 → Start DJP e-Filing process
          ↓
          Find EFIN password (forgot again)
          ↓
          Select Form 1770 SS
          ↓
          "What is Form 1721-A1?" (calls HR)
          ↓
          HR: "We emailed it in January" (searches inbox)
          ↓
          Found! Manual data entry... (2 hours)
          ↓
          Submission complete

Result: Rp 900,000 refund → received in April
        "I'll do this earlier next year..." (repeats every year)
```

---

## Pain Points

### 1. Annual Amnesia
- 💢 Only once a year → forgets every time
- 💢 Can't remember how it was done last year
- 💢 EFIN password reset every year

### 2. Finding Form 1721-A1
- 💢 Company sent it in January, but where did it go?
- 💢 Digging through emails (Ctrl+F "1721")
- 💢 Opening PDF and manually typing numbers one by one

### 3. PTKP Confusion
- 💢 "What does TK/0 mean? What about K/1?"
- 💢 "I got married last year, do I need to change it?"

---

## Goals & Desired Outcomes

### Primary Goals
- ✅ Auto-recognize Form 1721-A1 (PDF/photo OCR)
- ✅ Auto-populate data from previous year
- ✅ Auto-calculate PTKP (marital status, dependents)
- ✅ Preview tax refund amount
- ✅ One-click e-Filing submission

### Success Metrics
- **Time**: 3 minutes (vs 2 hours currently)
- **Accuracy**: 100% (no manual typing errors)
- **Refund**: Full Rp 900K claimed (no missed deductions)
- **Stress**: Zero (automated process)

---

## Ideal Experience (TO-BE with AI PAJAK)

### February - Preparation Phase
```
AI PAJAK Alert:
"SPT season is coming. Request Form 1721-A1 from your employer."
```

### March 1 - Auto-Import
```
Email arrives: "Form 1721-A1 from Company"
↓
AI PAJAK auto-saves attachment (email integration)
```

### March 5 - Filing
```
App Notification:
"Your SPT is ready! Complete in 5 minutes"
↓
User clicks

Screen shows:
"Hello Budi! We auto-loaded your data"

✅ 2024 Total Salary: Rp 144,000,000
✅ Withheld Tax: Rp 5,400,000
✅ PTKP: TK/0 (Single, no dependents)

Calculation:
- Tax Due: Rp 4,500,000
- Already Paid: Rp 5,400,000
- Refund: Rp 900,000 🎉

[Submit to DJP] button

"Submitted! Rp 900K refund in April"

Time: 3 minutes
```

---

## Must-Have Features (P0)

| Feature | Priority | Why Critical |
|---------|----------|--------------|
| Form 1721-A1 OCR | P0 | Eliminates 90% of manual work |
| SPT 1770 SS auto-fill | P0 | Core value proposition |
| e-Filing auto-submit | P0 | Completes the workflow |
| March reminders | P0 | Prevents missed deadlines (D-30, D-14, D-7) |

## Nice-to-Have Features (P1)

| Feature | Priority | Why Important |
|---------|----------|---------------|
| Refund tracking | P1 | Confirms refund receipt |
| Multi-year comparison | P1 | "Am I paying more this year?" |
| Tax optimization tips | P1 | "How to reduce tax next year" |

---

## User Stories

See detailed user stories: [Individual Taxpayer Stories](../user-stories/tax-consultant-stories.md)

**Key Stories**:
1. As Budi, I want to upload Form 1721-A1 via photo/PDF so that I don't have to type numbers manually
2. As Budi, I want AI PAJAK to remind me in March so that I don't miss the deadline
3. As Budi, I want to see my refund amount before submitting so that I know what to expect
4. As Budi, I want one-click DJP submission so that I don't need to remember EFIN

---

## Feature Mapping

### Journey Stage → Features

| Stage | Current Pain | AI PAJAK Feature |
|-------|-------------|------------------|
| **January-February** | Procrastination | Email reminder: "Request Form 1721-A1" |
| **March 1-5** | Can't find Form 1721-A1 | Auto-import from email |
| **March 5-15** | Manual data entry (2 hours) | OCR auto-recognition (30 seconds) |
| **March 15-25** | PTKP confusion | Auto-calculate based on marital status |
| **March 25-31** | EFIN password forgotten | Stored credentials (secure) |
| **March 31** | Submission | One-click submit |
| **April** | Uncertainty | Refund tracking notification |

---

## Market Insights

### Segment Size
- **Target**: 40 million individual taxpayers
- **Annual Revenue Potential**: Rp 2T (Rp 50K/person)
- **Acquisition**: SEO, tax season campaigns

### Willingness to Pay
- **Current**: Rp 0 (DIY) or Rp 500K-1M (consultant for complex cases)
- **AI PAJAK**: Rp 50K/year (one-time filing)
- **Value Proposition**: Save 2 hours + eliminate stress

### Competitive Landscape
- **OnlinePajak**: Rp 100K/year (overkill for simple employees)
- **Mekari**: Enterprise focus (not targeting individuals)
- **DJP e-Filing**: Free but painful UX

**AI PAJAK Differentiation**:
- Lowest price (Rp 50K)
- Fastest filing (3 minutes)
- Best UX (OCR automation)

---

## Revenue Model

### Pricing Tier
**Individual Plan**: Rp 50,000/year

**What's Included**:
- ✅ Form 1721-A1 OCR (unlimited)
- ✅ SPT 1770 SS auto-generation
- ✅ e-Filing submission
- ✅ 3x March reminders
- ✅ Refund tracking

### Upsell Opportunities
- Premium: Rp 99K → Tax optimization consultation
- Referral: Refer 3 friends → Free next year

---

## Related Documents

- [Individual User Stories](../user-stories/tax-consultant-stories.md)
- [Features: Individual Taxpayer](../features/tax-consultant-features.md)
- [Business Model](../03-business-model.md)

---

**Last Updated**: 2025-12-23
**Source**: Extracted from PRD.md section 3.1 (Persona 1-1)
