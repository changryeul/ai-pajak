# Google AI Studio - Comprehensive UI/UX Design Prompt for AI PAJAK

**Version**: 2.0
**Date**: 2025-12-24
**Purpose**: Generate complete UI/UX designs for AI PAJAK Indonesian tax platform

---

## Your Role

You are an expert UI/UX designer specializing in **FinTech and SaaS applications** for Southeast Asian markets. Your task is to design the complete user interface for **AI PAJAK**, an Indonesian tax filing automation platform that operates through a unique three-entity legal structure.

---

## Platform Overview

### Product: AI PAJAK
- **Type**: Web-based SaaS platform (Next.js 16 + React 19)
- **Target Market**: Indonesian taxpayers (Individuals, SMEs, Corporations)
- **Languages**: Indonesian (primary), English

### Three-Entity Legal Structure (Critical Understanding)

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI PAJAK Ecosystem                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐  │
│  │ Mono Flip       │    │ AI Pajak        │    │ Jakarta Tax │  │
│  │ Global          │    │ Platform        │    │ Consulting  │  │
│  │                 │    │                 │    │ (JTC)       │  │
│  │ Platform Owner  │    │ Software Tool   │    │ Tax Service │  │
│  │ Subscription $  │    │ No Tax Filing   │    │ All Filings │  │
│  └────────┬────────┘    └────────┬────────┘    └──────┬──────┘  │
│           │                      │                     │         │
│           └──────────────────────┼─────────────────────┘         │
│                                  │                               │
│                    Customer pays two fees:                       │
│                    1. Platform subscription → Mono Flip Global   │
│                    2. Tax service fee → Jakarta Tax Consulting   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Rules**:
- AI Pajak is **ONLY** a software platform - never says "we file taxes"
- Jakarta Tax Consulting (JTC) provides all tax services
- All tax filings are done by licensed JTC Tax Advisors
- Customers must sign POA (Power of Attorney) with JTC

---

## User Personas (4 Types)

### Persona 1: Individual Taxpayer (Wajib Pajak Orang Pribadi)
**Example**: Budi, 28, IT employee
- **Monthly**: No filing required (company handles PPh 21)
- **Annual**: SPT Tahunan 1770 SS filing (March deadline)
- **Pain Points**: Forgets EFIN password, manual form filling takes 2 hours
- **Goal**: 3-minute filing with Form 1721-A1 OCR

### Persona 2: UMKM Business Owner (Small Business)
**Example**: Ibu Siti, 35, Online clothing seller (TikTok Shop, Shopee)
- **Monthly**: PPh Final 0.5% (before 15th)
- **Annual**: SPT Tahunan 1770
- **Pain Points**: Misses deadlines, Rp 1.2M/year penalties, Rp 8M consultant fees
- **Goal**: Monthly reminders + one-click filing

### Persona 3: Corporate PT (Company)
**Example**: Pak Hendro, 45, HRD Manager, 80 employees
- **Monthly**: PPh 21 (employee tax), PPh 23 (withholding), PPh 25 (advance), PPN
- **Quarterly**: PPh Badan estimates
- **Annual**: SPT Tahunan Badan (April deadline), Local taxes (certain industries)
- **Pain Points**: 600 hours/year manual work, Rp 51M consultant fees
- **Goal**: Accurate integration + bulk processing (90% time saved)

### Persona 4: Tax Consultant (JTC Staff)
**Example**: Ibu Rina, 38, manages 35 clients
- **Daily**: Review client data, calculate taxes, generate ID Billing
- **Monthly**: Bulk submission for all clients
- **Role Types**:
  - CONSULTANT_JTC: Review, calculate, prepare (cannot submit)
  - TAX_ADVISOR_JTC: Final approval, submit to DJP (licensed only)
- **Pain Points**: 70% time on data collection, can't scale beyond 35 clients
- **Goal**: Multi-client dashboard, bulk submission, 50% revenue increase

---

## Tax Types to Design

### Monthly Taxes (SPT Masa)

| Tax Type | Rate | Who Pays | Deadline |
|----------|------|----------|----------|
| **PPh 21** | Progressive 5-35% | Employers (for employees) | 10th |
| **PPh 23** | 2-15% | Companies (for services) | 10th |
| **PPh 25** | 1/12 of annual | Companies (advance payment) | 15th |
| **PPh Final** | 0.5% | UMKM (<Rp 4.8B revenue) | 15th |
| **PPN** | 11% | PKP companies | End of month |

### Annual Taxes (SPT Tahunan)

| Tax Type | Rate | Who Files | Deadline |
|----------|------|-----------|----------|
| **SPT OP 1770 SS** | Progressive | Employees (simple) | March 31 |
| **SPT OP 1770 S** | Progressive | Employees (complex) | March 31 |
| **SPT OP 1770** | Progressive | Business owners | March 31 |
| **SPT Badan** | 22% | PT Companies | April 30 |

### Local/Regional Taxes (Pajak Daerah) - NEW

| Tax Type | Rate | Industries | Deadline |
|----------|------|------------|----------|
| **BPHTB** | 5% | Property transactions | At transaction |
| **PBB** | 0.1-0.3% | All property owners | Varies by region |
| **Pajak Hotel** | 10% | Hotels, hospitality | Monthly |
| **Pajak Restoran** | 10% | Restaurants, F&B | Monthly |
| **Pajak Parkir** | 20-30% | Parking services | Monthly |
| **Pajak Reklame** | Varies | Advertising, signage | Varies |
| **Pajak Hiburan** | 10-35% | Entertainment venues | Monthly |

---

## Design System

### Colors (Tailwind CSS)
```
Primary:    #2563eb (Blue 600)    - Trust, professionalism
Secondary:  #10b981 (Emerald 500) - Success, approval
Accent:     #f59e0b (Amber 500)   - Warnings, deadlines
Danger:     #ef4444 (Red 500)     - Errors, rejections
Neutral:    Tailwind Gray (50-950)
```

### Typography
- Headings: `Inter` (600, 700, 800)
- Body: `Inter` (400, 500)
- Numbers/Currency: `JetBrains Mono` (monospace)

### Components (shadcn/ui style)
- Button: default, outline, ghost, destructive
- Card with header, content, footer
- Table with sorting, pagination
- Tabs, Badge, Dialog/Modal
- Form inputs with validation states

### Spacing
- Base: 4px (Tailwind default)
- Border radius: Cards 8px, Buttons/Inputs 6px

---

## Complete Screen Designs (Priority Order)

---

## SECTION A: CUSTOMER SCREENS

### A1. Customer Onboarding Flow
**File**: `customer-onboarding.png`

**Purpose**: New customer signs up and signs POA with JTC

**Flow**:
```
Step 1: Account Creation
┌─────────────────────────────────────────────────────────────┐
│ Welcome to AI PAJAK                                          │
│                                                              │
│ Create Your Account                                          │
│                                                              │
│ [Email Address                                    ]          │
│ [Password                                         ]          │
│ [NPWP Number (15 digits)                          ]          │
│                                                              │
│ Customer Type:                                               │
│ ○ Individual (Orang Pribadi)                                │
│ ○ UMKM (Business < Rp 4.8B)                                 │
│ ○ PT (Corporate)                                            │
│                                                              │
│ [Create Account →]                                           │
│                                                              │
│ Already have an account? [Login]                            │
└─────────────────────────────────────────────────────────────┘

Step 2: Platform Agreement
┌─────────────────────────────────────────────────────────────┐
│ Platform Terms of Service                                    │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ AI Pajak is a software platform operated by             │ │
│ │ Mono Flip Global. This platform helps you prepare       │ │
│ │ tax documents but does NOT file taxes on your behalf.   │ │
│ │                                                          │ │
│ │ Tax filing services are provided by Jakarta Tax         │ │
│ │ Consulting, a licensed tax consulting firm.             │ │
│ │                                                          │ │
│ │ By using this platform, you agree to:                   │ │
│ │ 1. Platform subscription fee: Rp 99,000/month           │ │
│ │ 2. Separate tax service agreement with JTC              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [✓] I agree to the Platform Terms of Service                │
│                                                              │
│ [Continue →]                                                 │
└─────────────────────────────────────────────────────────────┘

Step 3: Power of Attorney (POA/Surat Kuasa)
┌─────────────────────────────────────────────────────────────┐
│ Tax Service Agreement                                        │
│                                                              │
│ ⚠️ IMPORTANT: Tax filing requires a Power of Attorney       │
│                                                              │
│ Tax services are provided by:                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🏢 Jakarta Tax Consulting                                │ │
│ │ Licensed Tax Consultant (Konsultan Pajak)               │ │
│ │ License No: SI-12345/PJ/2020                            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ Service Package: [Standard - Rp 500,000/filing ▼]           │
│                                                              │
│ Tax Types Covered:                                          │
│ [✓] PPh 21 (Employee Income Tax)                            │
│ [✓] PPh 23 (Withholding Tax)                                │
│ [✓] PPh Final (UMKM 0.5%)                                   │
│ [✓] PPN (Value Added Tax)                                   │
│ [✓] SPT Tahunan (Annual Filing)                             │
│ [ ] PPh Badan (Corporate Tax) - Premium Only                │
│ [ ] Local Taxes (Pajak Daerah) - Add-on                     │
│                                                              │
│ 📋 Power of Attorney Document                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                   SURAT KUASA                            │ │
│ │                                                          │ │
│ │ Dengan ini saya memberikan kuasa kepada:                 │ │
│ │ Jakarta Tax Consulting                                   │ │
│ │                                                          │ │
│ │ Untuk melakukan pengurusan perpajakan...                 │ │
│ │ [View Full Document]                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ Digital Signature:                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Draw signature here or upload]                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [✓] I authorize Jakarta Tax Consulting to file taxes       │
│                                                              │
│ [Sign & Complete Registration →]                            │
└─────────────────────────────────────────────────────────────┘
```

---

### A2. Customer Dashboard
**File**: `customer-dashboard.png`

**Purpose**: Customer views their tax status and pending actions

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ AI PAJAK          [🔔 2]  [💬 Messages]  [👤 PT ABC ▼]      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 📊 Tax Overview - December 2024                             │
│                                                              │
│ ┌──────────┬──────────┬──────────┬──────────┐              │
│ │ 4        │ 2        │ 1        │ 1        │              │
│ │ Total    │ Pending  │ Ready    │ Completed│              │
│ │ Filings  │ Data     │ to Pay   │          │              │
│ └──────────┴──────────┴──────────┴──────────┘              │
│                                                              │
│ ⚠️ Action Required (2)                                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📋 PPh 21 - Employee Payroll Data Needed                │ │
│ │    Upload December payroll by Jan 8                     │ │
│ │    [Upload Data →]                                       │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 💳 PPN - Payment Ready                                   │ │
│ │    Amount: Rp 55,000,000                                │ │
│ │    Due: Dec 31, 2024                                    │ │
│ │    [Pay Now →]                                           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ 📅 Monthly Tax Status                                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Tax Type    │ Status      │ Amount      │ Due Date     │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ PPh 21      │ ⏳ Pending   │ Rp 37.5M    │ Jan 10       │ │
│ │ PPh 23      │ ✅ Calculated│ Rp 12.3M    │ Jan 10       │ │
│ │ PPh 25      │ ✅ Paid      │ Rp 8.0M     │ -            │ │
│ │ PPN         │ 💳 Pay Now   │ Rp 55.0M    │ Dec 31       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ 💬 Your Consultant                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 👤 Ibu Rina - Jakarta Tax Consulting                    │ │
│ │ Last message: "Please upload December payroll data"     │ │
│ │ [Reply →]                                                │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### A3. Customer Data Upload
**File**: `customer-data-upload.png`

**Purpose**: Customer uploads required tax documents

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ 📤 Upload Tax Documents - PPh 21 December 2024              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Required Documents:                                          │
│                                                              │
│ 1. Payroll Data                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📎 Drag Excel/CSV or click to upload                    │ │
│ │                                                          │ │
│ │ Accepted: .xlsx, .csv, .pdf                             │ │
│ │ [Download Template]                                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ OR Enter Manually:                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Total Employees: [50                    ]               │ │
│ │ Total Gross Salary: [Rp 750,000,000     ]               │ │
│ │ Total BPJS Paid: [Rp 15,000,000         ]               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ 2. Employee Details (Optional - AI will calculate)          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Employee │ NPWP      │ Gross    │ PTKP  │ Status     │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ John Doe │ 01.234... │ 15,000,000│ TK/0 │ ✅ Valid   │ │
│ │ Jane S.  │ -         │ 8,000,000 │ K/1  │ ⚠️ No NPWP │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ 3. Supporting Documents                                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [✓] Bank statement (Dec 2024)                           │ │
│ │ [ ] BPJS payment receipt                                │ │
│ │ [ ] Bonus/THR documentation                             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📋 Upload Summary                                        │ │
│ │ • Payroll file: payroll_dec_2024.xlsx ✅                │ │
│ │ • Employees: 50 validated                               │ │
│ │ • Missing NPWP: 3 employees (proceed anyway?)           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Save Draft]  [Submit to Consultant →]                      │
│                                                              │
│ ℹ️ After submission, your JTC consultant will review        │
│    and calculate your tax liability.                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### A4. Customer Payment Screen
**File**: `customer-payment.png`

**Purpose**: Customer pays tax using ID Billing generated by consultant

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ 💳 Tax Payment - PPh 21 December 2024                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Payment Summary                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Tax Type: PPh 21 (Employee Income Tax)                  │ │
│ │ Tax Period: December 2024                               │ │
│ │ Company: PT ABC Indonesia                               │ │
│ │ NPWP: 01.234.567.8-901.000                             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 💰 Amount Due                                            │ │
│ │                                                          │ │
│ │     Rp 37,500,000                                       │ │
│ │                                                          │ │
│ │ Due Date: January 10, 2025                              │ │
│ │ Late Penalty: 2% per month                              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ 🧾 ID Billing (e-Billing Code)                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                                                          │ │
│ │     301234567890123                                     │ │
│ │                                                          │ │
│ │     [Copy Code] [QR Code]                               │ │
│ │                                                          │ │
│ │     Valid until: January 17, 2025 (7 days)              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ Payment Methods:                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ○ Internet Banking (BCA, Mandiri, BNI, BRI)             │ │
│ │ ○ Mobile Banking App                                    │ │
│ │ ○ ATM Transfer                                          │ │
│ │ ○ Bank Teller (bring this code)                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ Payment Instructions:                                        │
│ 1. Open your banking app/website                            │
│ 2. Select "Tax Payment" or "Pembayaran Pajak"               │
│ 3. Enter the ID Billing code above                          │
│ 4. Verify amount and confirm payment                        │
│ 5. Save receipt and upload below                            │
│                                                              │
│ 📤 Upload Payment Receipt (BPN)                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Drag payment receipt image or click to upload           │ │
│ │ We'll verify your payment automatically via OCR         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [I've Made Payment - Upload Receipt →]                      │
│                                                              │
│ Need help? Contact your consultant: Ibu Rina                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### A5. Customer Filing Confirmation
**File**: `customer-filing-confirmation.png`

**Purpose**: Customer receives confirmation that tax was filed by JTC

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ ✅ Tax Filing Completed                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                                                          │ │
│ │           ✅                                             │ │
│ │                                                          │ │
│ │    Your PPh 21 has been successfully filed              │ │
│ │                                                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ Filing Details                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Tax Type:        PPh 21 (Employee Income Tax)           │ │
│ │ Tax Period:      December 2024                          │ │
│ │ Amount Paid:     Rp 37,500,000                          │ │
│ │ Filed By:        Jakarta Tax Consulting                 │ │
│ │ Tax Advisor:     Ibu Rina (License: CPA-12345)         │ │
│ │ Filing Date:     January 8, 2025, 14:30 WIB            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ 📋 Electronic Receipt (BPE)                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ BPE Number: BPE-2025-01-08-12345678                     │ │
│ │                                                          │ │
│ │ [Download BPE PDF] [View in DJP Online]                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ⚠️ Important Notice                                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ This tax filing was submitted by Jakarta Tax            │ │
│ │ Consulting on your behalf under the Power of Attorney   │ │
│ │ you signed on December 15, 2024.                        │ │
│ │                                                          │ │
│ │ AI Pajak is the software platform used for tax          │ │
│ │ preparation. All tax filing responsibilities belong     │ │
│ │ to Jakarta Tax Consulting.                              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [View Filing History] [Return to Dashboard]                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## SECTION B: CONSULTANT SCREENS (JTC Staff)

### B1. Consultant Dashboard
**File**: `consultant-dashboard.png`

**Purpose**: JTC consultant views all assigned clients and their status

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ AI PAJAK - Jakarta Tax Consulting                           │
│ [🔔 5]  [💬 12 unread]  [👤 Ibu Rina (Consultant) ▼]        │
├─────────────────────────────────────────────────────────────┤
│ SIDEBAR         │  MAIN CONTENT                             │
│                 │                                            │
│ 📊 Dashboard    │  📊 January 2025 Client Overview          │
│ 👥 My Clients   │                                            │
│ 📋 Tax Queue    │  ┌──────┬──────┬──────┬──────┬──────┐     │
│ 💳 Billing      │  │ 35   │ 8    │ 15   │ 7    │ 5    │     │
│ 📨 Messages     │  │Total │Need  │Ready │Paid  │Filed │     │
│ 📈 Reports      │  │Clients│Data │to Bill│      │      │     │
│ ⚙️ Settings     │  └──────┴──────┴──────┴──────┴──────┘     │
│                 │                                            │
│ ─────────────── │  🔥 Urgent Actions (3)                     │
│                 │  ┌─────────────────────────────────────┐  │
│ QUICK ACTIONS   │  │ ⚠️ PT ABC - Payment overdue 2 days │  │
│                 │  │ ⚠️ CV XYZ - Data incomplete         │  │
│ [📧 Bulk        │  │ ⏰ PT DEF - Deadline tomorrow       │  │
│  Reminder]      │  └─────────────────────────────────────┘  │
│                 │                                            │
│ [📋 Generate    │  📋 Client Task List                       │
│  All Billings]  │  [Search...] [Filter: All ▼] [Sort ▼]     │
│                 │                                            │
│ [📊 Monthly     │  ┌─────────────────────────────────────┐  │
│  Report]        │  │Client    │Taxes│Data│Billing│Status │  │
│                 │  ├─────────────────────────────────────┤  │
│                 │  │PT ABC    │3    │✅  │💳     │Pending│  │
│                 │  │CV XYZ    │2    │⚠️  │-      │Need   │  │
│                 │  │PT DEF    │4    │✅  │✅     │Ready  │  │
│                 │  │Ibu Siti  │1    │✅  │✅     │Filed  │  │
│                 │  └─────────────────────────────────────┘  │
│                 │                                            │
│                 │  [1] [2] [3] ... [7]                       │
└─────────────────────────────────────────────────────────────┘
```

---

### B2. Client Detail & Tax Calculation
**File**: `consultant-client-detail.png`

**Purpose**: Consultant reviews client data and calculates taxes

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ ← Back to Dashboard    PT ABC Indonesia                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 🏢 Company Information                                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Name: PT ABC Indonesia                                  │ │
│ │ NPWP: 01.234.567.8-901.000                             │ │
│ │ KBLI: 62013 (Software Development)                      │ │
│ │ Employees: 50  │  PKP: Yes  │  POA: Valid until Dec 31 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [PPh 21] [PPh 23] [PPh 25] [PPN] [PPh Badan] [Local Tax]    │
│                                                              │
│ ═══════════════════════════════════════════════════════════ │
│ PPh 21 - December 2024                                       │
│ ═══════════════════════════════════════════════════════════ │
│                                                              │
│ 📋 Customer Data (Uploaded Dec 28)                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Total Employees: 50                                     │ │
│ │ Total Gross Salary: Rp 750,000,000                      │ │
│ │ BPJS Contribution: Rp 15,000,000                        │ │
│ │ Attachments: payroll_dec.xlsx, bpjs_receipt.pdf         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ 🤖 AI Calculation                                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Taxable Income: Rp 735,000,000                          │ │
│ │ PPh 21 Due: Rp 37,500,000                               │ │
│ │ Confidence: 94%                                          │ │
│ │                                                          │ │
│ │ Breakdown by tax bracket:                               │ │
│ │ • 5% (0-60M): Rp 3,000,000                              │ │
│ │ • 15% (60-250M): Rp 18,000,000                          │ │
│ │ • 25% (250-500M): Rp 12,500,000                         │ │
│ │ • 30% (500M+): Rp 4,000,000                             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Approve Calculation] [Modify] [Ask Customer for Details]   │
│                                                              │
│ 📝 Consultant Notes                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Add internal note for Tax Advisor review...]           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Save Draft] [Submit to Tax Advisor for Approval →]         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### B3. ID Billing Generation
**File**: `consultant-billing-generation.png`

**Purpose**: Consultant generates e-Billing codes for customers

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ 💳 ID Billing Generation - PT ABC Indonesia                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Approved Tax Calculations                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Tax Type    │ Amount        │ Status      │ Billing    │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ PPh 21      │ Rp 37,500,000 │ ✅ Approved │ [Generate] │ │
│ │ PPh 23      │ Rp 12,300,000 │ ✅ Approved │ [Generate] │ │
│ │ PPN         │ Rp 55,000,000 │ ⏳ Pending  │ -          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Generate All Approved →]                                    │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ Generated Billings                                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ PPh 21 - December 2024                                  │ │
│ │                                                          │ │
│ │ ID Billing: 301234567890123                             │ │
│ │ Amount: Rp 37,500,000                                   │ │
│ │ Generated: Jan 5, 2025 10:30                            │ │
│ │ Valid Until: Jan 12, 2025                               │ │
│ │                                                          │ │
│ │ [Copy Code] [Send to Customer] [Print]                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ 📧 Notification to Customer                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Send via:                                                │ │
│ │ [✓] Platform message (in-app)                           │ │
│ │ [✓] Email (accounting@ptabc.co.id)                      │ │
│ │ [ ] WhatsApp (+62 812-xxx-xxxx)                         │ │
│ │                                                          │ │
│ │ Message preview:                                         │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ Subject: Payment Required - PPh 21 Dec 2024        │ │ │
│ │ │                                                     │ │ │
│ │ │ Dear PT ABC,                                        │ │ │
│ │ │                                                     │ │ │
│ │ │ Your PPh 21 tax has been calculated:               │ │ │
│ │ │ Amount: Rp 37,500,000                              │ │ │
│ │ │ ID Billing: 301234567890123                        │ │ │
│ │ │ Due: January 10, 2025                              │ │ │
│ │ │                                                     │ │ │
│ │ │ Please pay via internet banking and upload...      │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Send Notification to Customer →]                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### B4. Consultant Customer History (CRM)
**File**: `consultant-customer-history.png`

**Purpose**: Track all interactions and filings for a customer

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ 👤 Customer Profile - PT ABC Indonesia                      │
├─────────────────────────────────────────────────────────────┤
│ [Overview] [History] [Documents] [Messages] [Notes]         │
│                                                              │
│ ═══════════════════════════════════════════════════════════ │
│ History Tab                                                  │
│ ═══════════════════════════════════════════════════════════ │
│                                                              │
│ 📊 Customer Summary                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Customer Since: March 2023                              │ │
│ │ Total Filings: 24 (2 years)                             │ │
│ │ Total Tax Paid: Rp 1.2 Billion                          │ │
│ │ On-time Rate: 95%                                       │ │
│ │ Assigned Consultant: Ibu Rina (since Mar 2023)          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ Filter: [All Types ▼] [2024 ▼] [All Status ▼]               │
│                                                              │
│ 📅 Filing Timeline                                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ● Jan 8, 2025 - PPh 21 December 2024                   │ │
│ │   Amount: Rp 37,500,000  │  Status: ✅ Filed           │ │
│ │   Filed by: Ibu Rina  │  BPE: BPE-2025-01-08-12345     │ │
│ │   [View Details]                                        │ │
│ │                                                          │ │
│ │ ● Dec 28, 2024 - Data Received                          │ │
│ │   payroll_dec_2024.xlsx uploaded by customer           │ │
│ │                                                          │ │
│ │ ● Dec 15, 2024 - PPh 21 November 2024                  │ │
│ │   Amount: Rp 35,200,000  │  Status: ✅ Filed           │ │
│ │   [View Details]                                        │ │
│ │                                                          │ │
│ │ ● Dec 10, 2024 - PPh 23 November 2024                  │ │
│ │   Amount: Rp 11,500,000  │  Status: ✅ Filed           │ │
│ │   [View Details]                                        │ │
│ │                                                          │ │
│ │ ● Dec 1, 2024 - Reminder Sent                           │ │
│ │   "Please upload November payroll data"                 │ │
│ │                                                          │ │
│ │ ... [Load More]                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ 📈 Annual Tax Summary                                        │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Year   │ PPh 21    │ PPh 23   │ PPN      │ Total      │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 2024   │ Rp 420M   │ Rp 140M  │ Rp 550M  │ Rp 1.11B  │ │
│ │ 2023   │ Rp 380M   │ Rp 120M  │ Rp 480M  │ Rp 980M   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### B5. Bulk Client Operations
**File**: `consultant-bulk-operations.png`

**Purpose**: Handle multiple clients at once (reminders, billing, status)

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ 📋 Bulk Operations - 35 Clients                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Select Operation:                                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ○ Send Data Collection Reminder                         │ │
│ │ ○ Generate All ID Billings                              │ │
│ │ ● Send Payment Reminders                                │ │
│ │ ○ Export Monthly Report                                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ Select Clients:                                              │
│ [✓] Select All (35)  │  Filter: [Unpaid ▼]                  │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [✓] │ Client       │ Tax Type │ Amount    │ Due Date  │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ [✓] │ PT ABC       │ PPh 21   │ Rp 37.5M  │ Jan 10    │ │
│ │ [✓] │ PT ABC       │ PPh 23   │ Rp 12.3M  │ Jan 10    │ │
│ │ [✓] │ CV XYZ       │ PPh Final│ Rp 2.5M   │ Jan 15    │ │
│ │ [ ] │ PT DEF       │ PPh 21   │ Rp 45.0M  │ Jan 10    │ │
│ │ [✓] │ Ibu Siti     │ PPh Final│ Rp 250K   │ Jan 15    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ Selected: 4 clients (5 tax items) │ Total: Rp 52,550,000    │
│                                                              │
│ Message Template:                                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Subject: Payment Reminder - [TAX_TYPE] [PERIOD]         │ │
│ │                                                          │ │
│ │ Dear [COMPANY_NAME],                                     │ │
│ │                                                          │ │
│ │ This is a reminder that your [TAX_TYPE] payment is      │ │
│ │ due on [DUE_DATE].                                       │ │
│ │                                                          │ │
│ │ Amount: [AMOUNT]                                         │ │
│ │ ID Billing: [BILLING_CODE]                               │ │
│ │                                                          │ │
│ │ Please complete payment to avoid late penalties.        │ │
│ │                                                          │ │
│ │ Best regards,                                            │ │
│ │ Jakarta Tax Consulting                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ Send via: [✓] Email  [✓] Platform  [ ] WhatsApp             │
│                                                              │
│ [Preview Messages] [Send to 4 Clients →]                    │
│                                                              │
│ ⏱️ Estimated time: 2 minutes                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## SECTION C: TAX ADVISOR SCREENS

### C1. Tax Advisor Approval Queue
**File**: `tax-advisor-approval.png`

**Purpose**: Licensed Tax Advisor reviews and approves filings before submission

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ AI PAJAK - Jakarta Tax Consulting                           │
│ [🔔 8]  [👤 Ibu Dewi (Tax Advisor, CPA-12345) ▼]            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 📋 Filing Approval Queue                                     │
│                                                              │
│ ┌──────────┬──────────┬──────────┬──────────┐              │
│ │ 18       │ 5        │ 8        │ 12       │              │
│ │ Pending  │ High     │ Modified │ Approved │              │
│ │ Approval │ Value    │ by Consult│ Today   │              │
│ └──────────┴──────────┴──────────┴──────────┘              │
│                                                              │
│ Filter: [All ▼] [PPh 21 ▼] [This Week ▼]                    │
│                                                              │
│ ⚠️ Requires Your Approval                                   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 💰 HIGH VALUE                                            │ │
│ │ PT ABC - PPh 21 December 2024                           │ │
│ │                                                          │ │
│ │ Amount: Rp 37,500,000                                   │ │
│ │ Calculated by: Ibu Rina (Consultant)                    │ │
│ │ AI Confidence: 94%                                       │ │
│ │                                                          │ │
│ │ ✅ AI Calculation matches consultant approval           │ │
│ │                                                          │ │
│ │ [View Full Details] [✅ Approve] [❌ Reject]            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ⚠️ CONSULTANT MODIFIED                                   │ │
│ │ CV XYZ - PPh 23 December 2024                           │ │
│ │                                                          │ │
│ │ AI Calculation: Rp 1,000,000 (PPh 23 @ 2%)             │ │
│ │ Consultant Modified: Rp 2,000,000 (PPh 4(2) @ 4%)      │ │
│ │ Reason: "Has SBU license - construction category"      │ │
│ │                                                          │ │
│ │ ⚠️ Review consultant's modification carefully           │ │
│ │                                                          │ │
│ │ [View Full Details] [✅ Approve] [❌ Reject]            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Bulk Approve (AI Confidence >95%)]                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### C2. Tax Advisor Filing Submission
**File**: `tax-advisor-submission.png`

**Purpose**: Tax Advisor submits approved filings to DJP (only role that can do this)

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ 📤 DJP Filing Submission                                    │
│ Only TAX_ADVISOR_JTC can perform this action               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Ready to Submit (Paid & Approved)                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Client      │ Tax Type │ Amount      │ Paid    │ Action │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ PT ABC      │ PPh 21   │ Rp 37,500,000│ ✅ Jan 8│ Submit │ │
│ │ PT ABC      │ PPh 23   │ Rp 12,300,000│ ✅ Jan 8│ Submit │ │
│ │ CV XYZ      │ PPh Final│ Rp 2,500,000 │ ✅ Jan 9│ Submit │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Select All] [Submit Selected to DJP →]                     │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ ⚠️ Pre-Submission Checklist                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [✓] Customer has valid POA with JTC                     │ │
│ │ [✓] Tax calculation approved by Tax Advisor             │ │
│ │ [✓] Payment confirmed (BPN uploaded)                    │ │
│ │ [✓] All supporting documents attached                   │ │
│ │ [ ] I confirm this filing under my license CPA-12345   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ 🔐 Digital Signature Required                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ By submitting, I (Ibu Dewi, CPA-12345) confirm that:    │ │
│ │                                                          │ │
│ │ 1. I have reviewed all tax calculations                 │ │
│ │ 2. The filing is accurate to the best of my knowledge   │ │
│ │ 3. I accept legal responsibility for this submission    │ │
│ │ 4. This is filed on behalf of Jakarta Tax Consulting    │ │
│ │                                                          │ │
│ │ [Enter PIN: ••••••]                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Cancel] [Submit to DJP (3 filings) →]                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## SECTION D: CORPORATE TAX SCREENS (PPh Badan)

### D1. Corporate Tax (PPh Badan) Dashboard
**File**: `corporate-tax-dashboard.png`

**Purpose**: Annual corporate income tax overview and filing

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ 🏢 PPh Badan (Corporate Income Tax) - FY 2024               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Client: PT ABC Indonesia │ NPWP: 01.234.567.8-901.000       │
│ Fiscal Year: Jan 1, 2024 - Dec 31, 2024                     │
│ Filing Deadline: April 30, 2025                              │
│                                                              │
│ 📊 Financial Summary                                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Gross Revenue:         Rp 12,500,000,000               │ │
│ │ Cost of Goods Sold:    Rp  7,200,000,000               │ │
│ │ Gross Profit:          Rp  5,300,000,000               │ │
│ │ Operating Expenses:    Rp  2,100,000,000               │ │
│ │ Net Income Before Tax: Rp  3,200,000,000               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ 🧮 Tax Calculation                                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Taxable Income:        Rp 3,200,000,000                │ │
│ │                                                          │ │
│ │ Tax Rate: 22% (standard corporate rate)                │ │
│ │                                                          │ │
│ │ Tax Liability:         Rp 704,000,000                  │ │
│ │ PPh 25 Credits:       -Rp 576,000,000 (12 monthly)     │ │
│ │ PPh 22/23 Credits:    -Rp  48,000,000                  │ │
│ │ ─────────────────────────────────────────               │ │
│ │ Tax Due (Underpayment): Rp  80,000,000                 │ │
│ │                                                          │ │
│ │ ⚠️ Note: SME discount available if revenue <50B        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ 📋 Required Documents                                        │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [✓] Audited Financial Statements                        │ │
│ │ [✓] Trial Balance                                       │ │
│ │ [✓] PPh 25 Monthly Payment Receipts (12)                │ │
│ │ [ ] Fixed Asset Depreciation Schedule                   │ │
│ │ [ ] Inventory Valuation Report                          │ │
│ │ [ ] Related Party Transaction Disclosure                │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Upload Financial Statements] [Calculate Tax]               │
│ [Submit for Advisor Review →]                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### D2. PPh 25 Monthly Tracker
**File**: `pph25-tracker.png`

**Purpose**: Track monthly advance payments that credit against annual PPh Badan

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ 📊 PPh 25 Monthly Tracker - 2024                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Client: PT ABC Indonesia                                     │
│ Annual PPh Badan (Prior Year): Rp 576,000,000               │
│ Monthly PPh 25: Rp 48,000,000 (1/12 of prior year)          │
│                                                              │
│ 📅 Payment Status                                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Month    │ Due Date  │ Amount      │ Status   │ BPN    │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ January  │ Feb 15    │ Rp 48,000,000│ ✅ Paid │ View   │ │
│ │ February │ Mar 15    │ Rp 48,000,000│ ✅ Paid │ View   │ │
│ │ March    │ Apr 15    │ Rp 48,000,000│ ✅ Paid │ View   │ │
│ │ April    │ May 15    │ Rp 48,000,000│ ✅ Paid │ View   │ │
│ │ May      │ Jun 15    │ Rp 48,000,000│ ✅ Paid │ View   │ │
│ │ June     │ Jul 15    │ Rp 48,000,000│ ✅ Paid │ View   │ │
│ │ July     │ Aug 15    │ Rp 48,000,000│ ✅ Paid │ View   │ │
│ │ August   │ Sep 15    │ Rp 48,000,000│ ✅ Paid │ View   │ │
│ │ September│ Oct 15    │ Rp 48,000,000│ ✅ Paid │ View   │ │
│ │ October  │ Nov 15    │ Rp 48,000,000│ ✅ Paid │ View   │ │
│ │ November │ Dec 15    │ Rp 48,000,000│ ✅ Paid │ View   │ │
│ │ December │ Jan 15    │ Rp 48,000,000│ 💳 Pay  │ -      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ Total Paid: Rp 528,000,000 / Rp 576,000,000                 │
│ Remaining: Rp 48,000,000                                     │
│                                                              │
│ [Generate December Billing] [Export All BPNs]               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## SECTION E: LOCAL TAX SCREENS (Pajak Daerah)

### E1. Local Tax Dashboard
**File**: `local-tax-dashboard.png`

**Purpose**: Manage regional/local taxes for applicable industries

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ 🏛️ Pajak Daerah (Local/Regional Taxes)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Client: Hotel Grand Jakarta  │ NPWP: 01.234.567.8-901.000   │
│ Industry: Hospitality (KBLI 55101)                          │
│ Location: DKI Jakarta                                        │
│                                                              │
│ 📋 Applicable Local Taxes                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Tax Type       │ Rate    │ Base         │ Deadline     │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Pajak Hotel    │ 10%     │ Room Revenue │ 15th monthly │ │
│ │ Pajak Restoran │ 10%     │ F&B Revenue  │ 15th monthly │ │
│ │ Pajak Parkir   │ 20%     │ Parking Rev  │ 15th monthly │ │
│ │ PBB            │ 0.2%    │ Property Val │ August       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Pajak Hotel] [Pajak Restoran] [Pajak Parkir] [PBB]         │
│                                                              │
│ ═══════════════════════════════════════════════════════════ │
│ Pajak Hotel - December 2024                                  │
│ ═══════════════════════════════════════════════════════════ │
│                                                              │
│ Revenue Details                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Room Revenue:          Rp 850,000,000                  │ │
│ │ Service Charges:       Rp  85,000,000                  │ │
│ │ Total Taxable:         Rp 935,000,000                  │ │
│ │                                                          │ │
│ │ Pajak Hotel (10%):     Rp  93,500,000                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ 📤 Payment                                                   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Payment to: Badan Pendapatan Daerah DKI Jakarta        │ │
│ │ Bank: Bank DKI                                          │ │
│ │ Account: 1234-567890                                    │ │
│ │ Reference: HOTEL-DEC2024-001                            │ │
│ │                                                          │ │
│ │ [Generate Payment Slip] [Upload Receipt]                │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## SECTION F: OPERATOR SCREENS (Phase 1 Manual Submission)

### F1. Tax Operator Dashboard
**File**: `operator-dashboard.png`

**Purpose**: Internal operator reviews assigned clients for manual DJP submission

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ AI PAJAK - Tax Operator Portal                              │
│ [🔔 5]  [👤 Kim Suryanto (Operator) ▼]                      │
├─────────────────────────────────────────────────────────────┤
│ SIDEBAR         │  MAIN CONTENT                             │
│                 │                                            │
│ 📊 Dashboard    │  📊 December 2024 Filing Status           │
│ 📋 DJP Queue    │                                            │
│ ⏱️ Time Log     │  ┌──────┬──────┬──────┬──────┐            │
│ 📈 My Stats     │  │ 35   │ 30   │ 28   │ 25   │            │
│ ⚙️ Settings     │  │Total │Ready │Paid  │Filed │            │
│                 │  └──────┴──────┴──────┴──────┘            │
│                 │                                            │
│                 │  🔥 Ready for DJP Submission (5)           │
│                 │  ┌─────────────────────────────────────┐  │
│                 │  │ PT ABC - PPh 21 - Rp 37.5M - [Go]  │  │
│                 │  │ PT ABC - PPh 23 - Rp 12.3M - [Go]  │  │
│                 │  │ CV XYZ - PPh Final - Rp 2.5M - [Go]│  │
│                 │  └─────────────────────────────────────┘  │
│                 │                                            │
│                 │  [Start Bulk Submission Session →]         │
│                 │                                            │
│                 │  📊 Today's Progress                       │
│                 │  ┌─────────────────────────────────────┐  │
│                 │  │ Completed: 8/12                      │  │
│                 │  │ Avg Time: 12 min/filing              │  │
│                 │  │ ████████████░░░░ 67%                 │  │
│                 │  └─────────────────────────────────────┘  │
│                 │                                            │
└─────────────────────────────────────────────────────────────┘
```

---

### F2. DJP Manual Submission Helper
**File**: `djp-submission-helper.png`

**Purpose**: Step-by-step guide for manual DJP website submission

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ 📋 DJP Manual Submission - PPh 21 (PT ABC, Dec 2024)        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ⏱️ Timer: 00:05:23        [Pause] [Complete]                │
│                                                              │
│ Step 1 of 5 ────────────────────────────────────────────    │
│                                                              │
│ 🔗 Open DJP Website                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ https://djponline.pajak.go.id                           │ │
│ │ [Open in New Tab →]                                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ Step 2 of 5 ────────────────────────────────────────────    │
│                                                              │
│ Navigate to: e-Filing → SPT Masa → PPh 21                   │
│                                                              │
│ Step 3 of 5 ────────────────────────────────────────────    │
│                                                              │
│ 📋 Copy-Paste Data (click to copy)                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Field: NPWP Pemotong                                    │ │
│ │ ┌────────────────────────────┬────────────┐             │ │
│ │ │ 01.234.567.8-901.000       │ [Copy ✓]   │             │ │
│ │ └────────────────────────────┴────────────┘             │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Field: Masa Pajak                                       │ │
│ │ ┌────────────────────────────┬────────────┐             │ │
│ │ │ 12/2024                    │ [Copy]     │             │ │
│ │ └────────────────────────────┴────────────┘             │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Field: Jumlah Pegawai                                   │ │
│ │ ┌────────────────────────────┬────────────┐             │ │
│ │ │ 50                         │ [Copy]     │             │ │
│ │ └────────────────────────────┴────────────┘             │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Field: Total Bruto                                      │ │
│ │ ┌────────────────────────────┬────────────┐             │ │
│ │ │ 750000000                  │ [Copy]     │             │ │
│ │ └────────────────────────────┴────────────┘             │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Field: PPh 21 Terutang                                  │ │
│ │ ┌────────────────────────────┬────────────┐             │ │
│ │ │ 37500000                   │ [Copy]     │             │ │
│ │ └────────────────────────────┴────────────┘             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ Step 4 of 5 ────────────────────────────────────────────    │
│                                                              │
│ Click "Kirim SPT" in DJP and download BPE                   │
│                                                              │
│ Step 5 of 5 ────────────────────────────────────────────    │
│                                                              │
│ 📤 Upload BPE PDF                                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📎 Drag BPE file here or click to browse                │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [← Previous Client] [Mark Complete →] [Next Client →]       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Design Output Specifications

For each screen, provide:

### 1. High-Fidelity Mockup
- Desktop: 1920x1080 (PNG)
- Mobile (if applicable): 375x812 (PNG)

### 2. Component List
```
Example:
- Card (variant: default)
- Button (variants: default, outline, destructive)
- Table (with pagination)
- Badge (variants: success, warning, danger)
- Input (with validation states)
```

### 3. Color Usage
```
Example:
- Primary (#2563eb): CTA buttons, links, active states
- Success (#10b981): ✅ Completed status, positive numbers
- Warning (#f59e0b): ⚠️ Pending, ⏳ deadlines approaching
- Danger (#ef4444): ❌ Errors, overdue items
```

### 4. Interactive States
- Hover, focus, active for all clickable elements
- Loading states for async operations
- Empty states for no data scenarios

---

## Design Principles

1. **Legal Clarity**: Always show "Jakarta Tax Consulting" for tax services
2. **Trust**: Blue primary color (financial standard)
3. **Speed**: Minimize clicks - operators handle 35+ clients
4. **Accuracy**: Use tables for tax data (not charts)
5. **Localization**: Indonesian Rupiah (Rp), DD/MM/YYYY dates
6. **Confidence**: Show AI confidence scores
7. **Error Prevention**: Confirmation dialogs for destructive actions
8. **Role Separation**: Clear visual distinction between roles

---

## Priority Order

**Phase 1 (Critical)**:
1. A1-A5: Customer flow (onboarding to confirmation)
2. B1-B5: Consultant flow (dashboard to bulk ops)
3. C1-C2: Tax Advisor approval and submission
4. F1-F2: Operator manual submission (Phase 1 only)

**Phase 2 (Important)**:
5. D1-D2: Corporate tax (PPh Badan)
6. E1: Local tax (Pajak Daerah)

---

**Total Screens**: 15 primary screens
**Word Count**: ~6,500 words

Ready to design! Start with Customer Onboarding (A1) for the complete flow.
