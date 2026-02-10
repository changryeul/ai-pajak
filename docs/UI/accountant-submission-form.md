# Accountant Submission Form - Wireframe

## Overview
The Accountant Submission Form is a comprehensive interface for accountants to input tax data, validate calculations, and prepare tax filings for review. It features AI-powered validation, auto-calculation, and document management.

---

## Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ╔═══════════════════════════════════════════════════════════════════════╗   │
│ ║  [← Back to Tasks]  Tax Filing Form - PT MAJU JAYA - PPh 21 Dec 2025 ║   │
│ ╚═══════════════════════════════════════════════════════════════════════╝   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │  📋 Progress: 65% Complete                          [Save Draft] [?]   ││
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░                    ││
│  │                                                                        ││
│  │  ① Company Info ✓ │ ② Tax Period ✓ │ ③ Income Data ⏳ │ ④ Deductions │ ││
│  │                   │                 │                  │ ⑤ Review     │ ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────┐  ┌──────────────────────────────┐ │
│  │  MAIN FORM AREA                     │  │  📎 DOCUMENTS (8)            │ │
│  │                                     │  │                              │ │
│  │  ╔════════════════════════════════╗ │  │  ✓ Company Registration     │ │
│  │  ║ STEP 3: INCOME DATA           ║ │  │  ✓ Tax ID (NPWP)            │ │
│  │  ╚════════════════════════════════╝ │  │  ✓ Financial Statement      │ │
│  │                                     │  │  ✓ Payroll Records (12)     │ │
│  │  Employee Income Section            │  │  ⚠ PPh 21 Calculation       │ │
│  │  ┌────────────────────────────────┐ │  │    (Needs Review)           │ │
│  │  │ Total Employees:               │ │  │  ✓ Bank Statements          │ │
│  │  │ [    45    ] employees         │ │  │  ⏳ Receipts (Processing)   │ │
│  │  │ [Auto-fill from records] 🤖    │ │  │  ✓ Previous Filing          │ │
│  │  └────────────────────────────────┘ │  │                              │ │
│  │                                     │  │  [+ Upload More]             │ │
│  │  Gross Salary Paid:                 │  │  [View All]                  │ │
│  │  ┌────────────────────────────────┐ │  └──────────────────────────────┘ │
│  │  │ Rp [1,250,000,000]             │ │                                  │
│  │  │ 💡 AI detected: Rp 1.25B from  │ │  ┌──────────────────────────────┐ │
│  │  │    uploaded payroll records    │ │  │  ⚡ AI ASSISTANT             │ │
│  │  │    [Accept] [Reject]           │ │  ├──────────────────────────────┤ │
│  │  └────────────────────────────────┘ │  │                              │ │
│  │                                     │  │  💡 Suggestions:             │ │
│  │  Tax Withheld (PPh 21):             │  │                              │ │
│  │  ┌────────────────────────────────┐ │  │  • Employee count matches   │ │
│  │  │ Rp [62,500,000] 🧮             │ │  │    payroll records          │ │
│  │  │ ✓ Auto-calculated (5%)         │ │  │                              │ │
│  │  │ [Recalculate]                  │ │  │  ⚠ Warning:                 │ │
│  │  └────────────────────────────────┘ │  │  • Gross salary increased   │ │
│  │                                     │  │    12% vs last month.       │ │
│  │  Allowances & Benefits:             │  │    Verify accuracy.         │ │
│  │  ┌────────────────────────────────┐ │  │                              │ │
│  │  │ Transport  Rp [15,000,000]     │ │  │  ✓ Validations Passed:      │ │
│  │  │ Meal       Rp [18,000,000]     │ │  │  • NPWP format valid        │ │
│  │  │ Health     Rp [25,000,000]     │ │  │  • Tax rates correct        │ │
│  │  │ Other      Rp [_________]      │ │  │  • Calculations accurate    │ │
│  │  │ [+ Add Allowance]              │ │  │                              │ │
│  │  └────────────────────────────────┘ │  │  [Ask AI a Question]        │ │
│  │                                     │  └──────────────────────────────┘ │
│  │  ┌────────────────────────────────┐ │                                  │
│  │  │ 📊 INCOME SUMMARY              │ │                                  │
│  │  │                                │ │                                  │
│  │  │ Gross Salary:    1,250,000,000 │ │                                  │
│  │  │ Allowances:         58,000,000 │ │                                  │
│  │  │ ──────────────────────────────│ │                                  │
│  │  │ Total Income:    1,308,000,000 │ │                                  │
│  │  │ Tax Withheld:      (62,500,000)│ │                                  │
│  │  │ ══════════════════════════════│ │                                  │
│  │  │ Net Payable:     1,245,500,000 │ │                                  │
│  │  └────────────────────────────────┘ │                                  │
│  │                                     │                                  │
│  │  ┌────────────────────────────────┐ │                                  │
│  │  │ Notes & Comments:              │ │                                  │
│  │  │ ┌────────────────────────────┐ │ │                                  │
│  │  │ │ Salary increase due to year│ │ │                                  │
│  │  │ │ -end bonuses...            │ │ │                                  │
│  │  │ │                            │ │ │                                  │
│  │  │ └────────────────────────────┘ │ │                                  │
│  │  │ 🎤 [Voice Input] 📷 [Scan]    │ │                                  │
│  │  └────────────────────────────────┘ │                                  │
│  │                                     │                                  │
│  │  ┌────────────────────────────────┐ │                                  │
│  │  │ [← Previous Step]              │ │                                  │
│  │  │         [Save Draft]           │ │                                  │
│  │  │              [Next Step →]     │ │                                  │
│  │  └────────────────────────────────┘ │                                  │
│  └─────────────────────────────────────┘                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  VALIDATION SIDEBAR (Collapsible)                                     [×]   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ✓ 15 checks passed                                                         │
│  ⚠ 2 warnings                                                               │
│  ⛔ 0 errors                                                                 │
│                                                                             │
│  ⚠ Gross salary variance > 10% from previous month                         │
│     Recommended action: Add explanation in notes                           │
│     [Add Note] [Ignore]                                                    │
│                                                                             │
│  ⚠ Missing scanned receipt for health allowance                            │
│     Upload supporting document for audit trail                             │
│     [Upload] [Mark as Unavailable]                                         │
│                                                                             │
│  [Show All Checks]                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Header & Navigation
```
┌───────────────────────────────────────────────────────────────┐
│ [← Back to Tasks]  Tax Filing Form - PT MAJU JAYA - PPh 21   │
└───────────────────────────────────────────────────────────────┘
```

**Components:**
- Back navigation button
- Form title with client name and tax type
- Tax period indicator
- Quick action buttons (Save, Help)

**Interactions:**
- [← Back] → Confirm unsaved changes, return to task list
- Form title → Static display
- [Save Draft] → Save current progress, show confirmation
- [?] → Open contextual help sidebar

---

### 2. Progress Tracker
```
┌────────────────────────────────────────────────────────────┐
│  📋 Progress: 65% Complete              [Save Draft] [?]   │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░             │
│                                                            │
│  ① Company Info ✓ │ ② Tax Period ✓ │ ③ Income Data ⏳ │   │
└────────────────────────────────────────────────────────────┘
```

**Components:**
- Progress percentage
- Visual progress bar
- Step indicators with status icons
  - ✓ Completed
  - ⏳ In Progress
  - ○ Not Started
- Save and help buttons

**Interactions:**
- Click step indicator → Navigate to that step (if accessible)
- Progress updates automatically based on form completion
- Hover step → Show validation status tooltip

**Validation Logic:**
- Step marked complete when all required fields filled
- Progress calculated: (completed_fields / total_required_fields) × 100

---

### 3. Main Form Area

#### 3.1 Form Section Header
```
╔════════════════════════════════╗
║ STEP 3: INCOME DATA           ║
╚════════════════════════════════╝
```

**Components:**
- Step number and title
- Section description (optional)

---

#### 3.2 Smart Input Fields
```
┌────────────────────────────────┐
│ Total Employees:               │
│ [    45    ] employees         │
│ [Auto-fill from records] 🤖    │
└────────────────────────────────┘
```

**Components:**
- Field label
- Input field with unit indicator
- AI auto-fill button
- Validation indicator

**Interactions:**
- Type value → Real-time validation
- [Auto-fill] → Populate from historical data or documents
- Blur → Trigger validation and calculations
- Invalid input → Show inline error message

**Validation:**
- Numeric fields: positive integers only
- Currency fields: proper formatting (Rp, thousand separators)
- Required fields: marked with asterisk

---

#### 3.3 AI-Assisted Input
```
┌────────────────────────────────┐
│ Rp [1,250,000,000]             │
│ 💡 AI detected: Rp 1.25B from  │
│    uploaded payroll records    │
│    [Accept] [Accept]           │
└────────────────────────────────┘
```

**Components:**
- Input field
- AI suggestion callout
- Accept/Reject buttons
- Source reference

**Interactions:**
- [Accept] → Populate field with AI value, log acceptance
- [Reject] → Keep manual value, log rejection for AI learning
- Hover source → Highlight related document
- Click source → Open document viewer

**AI Logic:**
- OCR extraction from uploaded documents
- Pattern matching from historical data
- Confidence score threshold (> 85% to show suggestion)
- Learn from user accept/reject patterns

---

#### 3.4 Auto-Calculation Fields
```
┌────────────────────────────────┐
│ Rp [62,500,000] 🧮             │
│ ✓ Auto-calculated (5%)         │
│ [Recalculate]                  │
└────────────────────────────────┘
```

**Components:**
- Read-only calculated field (gray background)
- Calculation indicator icon
- Formula description
- Recalculate button (if manual override needed)

**Interactions:**
- Auto-updates when dependent fields change
- [Recalculate] → Manually trigger recalculation
- Click formula → Show calculation breakdown modal

**Calculation Engine:**
- Real-time updates (debounced 500ms)
- Error handling for invalid inputs
- Round to nearest rupiah
- Apply tax brackets automatically

---

#### 3.5 Dynamic Field Groups
```
┌────────────────────────────────┐
│ Transport  Rp [15,000,000]     │
│ Meal       Rp [18,000,000]     │
│ Health     Rp [25,000,000]     │
│ Other      Rp [_________]      │
│ [+ Add Allowance]              │
└────────────────────────────────┘
```

**Components:**
- List of allowance types with input fields
- Add new item button
- Delete button for custom items (× icon)

**Interactions:**
- [+ Add Allowance] → Add new row with type dropdown and amount field
- [×] → Remove custom allowance row
- All fields contribute to automatic total calculation

---

#### 3.6 Summary Panel
```
┌────────────────────────────────┐
│ 📊 INCOME SUMMARY              │
│                                │
│ Gross Salary:    1,250,000,000 │
│ Allowances:         58,000,000 │
│ ──────────────────────────────│
│ Total Income:    1,308,000,000 │
│ Tax Withheld:      (62,500,000)│
│ ══════════════════════════════│
│ Net Payable:     1,245,500,000 │
└────────────────────────────────┘
```

**Components:**
- Summary title with icon
- Line items with labels and values
- Visual separators
- Emphasized total (bold, larger font)

**Interactions:**
- Click line item → Jump to related field
- Auto-updates when any input changes
- Highlight changed values briefly

**Styling:**
- Currency formatting with thousands separators
- Right-aligned numbers
- Negative values in parentheses
- Final total with double underline

---

#### 3.7 Notes & Comments
```
┌────────────────────────────────┐
│ Notes & Comments:              │
│ ┌────────────────────────────┐ │
│ │ Salary increase due to...  │ │
│ │                            │ │
│ └────────────────────────────┘ │
│ 🎤 [Voice Input] 📷 [Scan]    │
└────────────────────────────────┘
```

**Components:**
- Multi-line text area
- Voice input button
- Scan/OCR button
- Character counter (optional)

**Interactions:**
- Type freely → Auto-save every 30 seconds
- [🎤 Voice Input] → Activate voice-to-text
- [📷 Scan] → Capture and OCR text from document
- @ mention → Tag consultant or client for notification

**Features:**
- Rich text formatting (bold, italic, lists)
- @mentions for collaboration
- Attachment links
- Markdown support

---

#### 3.8 Navigation Buttons
```
┌────────────────────────────────┐
│ [← Previous Step]              │
│         [Save Draft]           │
│              [Next Step →]     │
└────────────────────────────────┘
```

**Components:**
- Previous step button (left)
- Save draft button (center)
- Next step button (right, primary)

**Interactions:**
- [← Previous] → Navigate to previous step, save current data
- [Save Draft] → Save progress, show confirmation toast
- [Next Step →] → Validate current step, navigate if valid

**Validation:**
- Next button disabled if required fields incomplete
- Show field count tooltip on hover: "2 required fields remaining"

---

### 4. Documents Sidebar
```
┌──────────────────────────────┐
│  📎 DOCUMENTS (8)            │
│                              │
│  ✓ Company Registration     │
│  ✓ Tax ID (NPWP)            │
│  ⚠ PPh 21 Calculation       │
│    (Needs Review)           │
│  ⏳ Receipts (Processing)   │
│                              │
│  [+ Upload More]             │
│  [View All]                  │
└──────────────────────────────┘
```

**Components:**
- Document count badge
- Document list with status icons
  - ✓ Verified
  - ⚠ Needs attention
  - ⏳ Processing
  - ⛔ Missing/Error
- Upload button
- View all link

**Interactions:**
- Click document → Open document viewer/editor
- [+ Upload] → Open file picker
- Drag & drop → Upload files
- [View All] → Expand to full document manager

**Document States:**
- Verified: Green checkmark
- Processing: Animated spinner
- Needs Review: Yellow warning
- Missing: Red X with upload prompt

---

### 5. AI Assistant Sidebar
```
┌──────────────────────────────┐
│  ⚡ AI ASSISTANT             │
├──────────────────────────────┤
│  💡 Suggestions:             │
│  • Employee count matches   │
│                              │
│  ⚠ Warning:                 │
│  • Gross salary increased   │
│    12% vs last month        │
│                              │
│  ✓ Validations Passed:      │
│  • NPWP format valid        │
│                              │
│  [Ask AI a Question]        │
└──────────────────────────────┘
```

**Components:**
- Assistant header
- Categorized messages:
  - Suggestions (💡)
  - Warnings (⚠)
  - Validations (✓)
  - Errors (⛔)
- Question input button
- Expandable detail areas

**Interactions:**
- Click suggestion → Auto-apply if applicable
- Click warning → Highlight related field
- [Ask Question] → Open AI chat interface
- Dismiss → Hide individual messages
- Collapse/expand → Toggle sidebar

**AI Features:**
- Contextual suggestions based on current step
- Real-time validation
- Anomaly detection (variance from historical data)
- Tax regulation compliance checks
- Natural language Q&A

---

### 6. Validation Sidebar (Collapsible)
```
┌─────────────────────────────────────────────┐
│  ✓ 15 checks passed                         │
│  ⚠ 2 warnings                               │
│  ⛔ 0 errors                                 │
│                                             │
│  ⚠ Gross salary variance > 10%             │
│     [Add Note] [Ignore]                    │
└─────────────────────────────────────────────┘
```

**Components:**
- Summary counters with status icons
- Detailed validation messages
- Action buttons for each issue
- Show all checks link

**Interactions:**
- Auto-appears when validation runs
- [Add Note] → Focus notes field
- [Ignore] → Suppress this warning
- [Show All] → Expand full validation report
- Click validation → Jump to related field

**Validation Types:**
- Format validation (immediate)
- Business rule validation (on blur)
- Cross-field validation (on change)
- Compliance validation (on next/submit)

---

## Form Steps Overview

### Step 1: Company Information
- Client name (read-only, pre-filled)
- NPWP (validated)
- Company address
- Tax period selection
- Responsible accountant (read-only)

### Step 2: Tax Period Details
- Filing period (month/year)
- Due date display
- Previous filing reference
- Tax type confirmation

### Step 3: Income Data (Current View)
- Employee information
- Gross salary
- Allowances and benefits
- Tax withheld calculations
- Income summary

### Step 4: Deductions & Credits
- Deductible expenses
- Tax credits
- Exemptions
- Net tax calculation

### Step 5: Review & Submit
- Complete summary
- Document checklist
- Validation results
- Internal review checklist
- Submit for consultant review

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + S` | Save draft |
| `Ctrl + Enter` | Next step |
| `Ctrl + ←` | Previous step |
| `Ctrl + /` | Open help |
| `Ctrl + K` | Open AI assistant |
| `Tab` | Next field |
| `Shift + Tab` | Previous field |
| `Esc` | Close modal/sidebar |

---

## Responsive Behavior

### Desktop (> 1200px)
- Full 3-column layout (form + documents + AI)
- All sidebars visible
- Expanded input fields

### Tablet (768px - 1200px)
- 2-column layout (form + collapsible sidebar)
- Sidebars toggle between documents and AI
- Bottom action bar for navigation

### Mobile (< 768px)
- Single column
- Full-screen form
- Bottom sheets for sidebars
- Floating action button for quick access
- One section at a time

---

## Auto-Save Behavior

### Trigger Points
- Every 30 seconds (idle)
- On field blur (500ms debounce)
- On step navigation
- On manual save click

### Save Indicators
- "Saving..." → Spinner icon
- "Saved" → Checkmark with timestamp
- "Error saving" → Retry button

### Recovery
- Local storage backup
- Session recovery on reload
- Conflict resolution if multiple tabs

---

## Accessibility

### ARIA Labels
- All form fields properly labeled
- Status announcements for validations
- Progress updates announced
- Button states clearly indicated

### Keyboard Navigation
- Logical tab order
- Skip links for long forms
- Focus indicators visible
- Trapped focus in modals

### Visual
- High contrast mode
- Error states clearly marked (not just color)
- 4.5:1 contrast ratio minimum
- Resizable text up to 200%

---

## Performance Optimization

### Initial Load
- Progressive form rendering
- Lazy load document previews
- Defer non-critical validations
- Cache client data

### Runtime
- Debounce calculations (500ms)
- Throttle AI suggestions
- Virtual scrolling for long lists
- Memoize computed values

### Offline Support
- Cache form template
- Queue saves when offline
- Sync when connection restored
- Offline indicator

---

## Error Handling

### Field-Level Errors
```
┌────────────────────────────────┐
│ Gross Salary *                 │
│ [1,250,000,000]                │
│ ⛔ Value exceeds reasonable    │
│    threshold. Verify accuracy. │
└────────────────────────────────┘
```

### Form-Level Errors
```
┌────────────────────────────────────┐
│ ⛔ Cannot proceed to next step     │
│                                    │
│ Please fix the following:          │
│ • Total employees required         │
│ • Tax withheld calculation invalid │
│                                    │
│ [Fix Errors]                       │
└────────────────────────────────────┘
```

### System Errors
```
┌────────────────────────────────────┐
│ ⚠ Connection Lost                  │
│ Your changes are saved locally.    │
│ [Retry] [Continue Offline]         │
└────────────────────────────────────┘
```

---

## Integration Points

### API Endpoints
- `GET /api/v1/tax-filings/{id}` - Load filing data
- `PATCH /api/v1/tax-filings/{id}` - Auto-save progress
- `POST /api/v1/tax-filings/{id}/validate` - Run validations
- `POST /api/v1/tax-filings/{id}/calculate` - Trigger calculations
- `GET /api/v1/clients/{id}/documents` - Fetch documents
- `POST /api/v1/ai/suggest` - Get AI suggestions
- `POST /api/v1/ai/extract` - OCR and data extraction

### WebSocket Events
- `filing:auto-saved`
- `validation:completed`
- `calculation:updated`
- `ai:suggestion-ready`
- `document:processed`

---

## Related Documentation
- [User Flows - Accountant](/Users/tommy/git/ai-pajak/docs/02-design/ui-ux/user-flows.md)
- [Tax Filing Form Screen Spec](/Users/tommy/git/ai-pajak/docs/02-design/ui-ux/screens/tax-filing-form.md)
- [Tax Filing API](/Users/tommy/git/ai-pajak/docs/02-design/api/endpoints/tax-filing-api.md)
- [Design System - Forms](/Users/tommy/git/ai-pajak/docs/02-design/ui-ux/design-system.md)
- [AI Validation Engine](/Users/tommy/git/ai-pajak/docs/03-technical/ai-validation.md)

---

**Wireframe Version:** 1.0
**Last Updated:** 2025-12-23
**Designer:** Product Design Team
**Status:** Draft for Review
