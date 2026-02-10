# Tax Filing Form Screen - Detailed Specification

## Overview
The Tax Filing Form is a multi-step wizard interface for accountants to input tax data, validate calculations, and prepare submissions. It features AI-powered assistance, real-time validation, and comprehensive document management.

**Reference:** See [Accountant Submission Form Wireframe](/Users/tommy/git/ai-pajak/docs/02-design/ui-ux/wireframes/accountant-submission-form.md) for detailed visual layout.

---

## Form Architecture

### Multi-Step Wizard Structure
```
Step 1: Company Information & Tax Period Selection
Step 2: Income Data Entry
Step 3: Deductions & Credits
Step 4: Supporting Documents
Step 5: Review & Submit
```

### Navigation Pattern
- Linear progression (must complete each step)
- Can navigate backwards freely
- Cannot skip forward without validation
- Auto-save on each step
- Exit confirmation if unsaved changes

---

## Step-by-Step Specifications

### Step 1: Company Information

**Fields:**
```
Company Details (Read-Only, Pre-filled)
├── Company Name
├── NPWP (Tax ID)
├── Company Address
└── Business Type

Tax Period Selection
├── Tax Type (Dropdown)
│   Options: PPh 21, PPh 23, PPh 25, PPh 29, PPN, PPh Final
├── Filing Period (Month + Year Picker)
│   Format: "December 2025"
├── Due Date (Auto-calculated, Display Only)
│   Example: "January 20, 2026"
└── Previous Filing Reference (Auto-loaded)
```

**Validation:**
- Tax type required
- Period must be valid (not future, not too far past)
- Due date automatically calculated based on tax type
- Check for duplicate filing (tax type + period)

**AI Features:**
- Suggest most common tax type for client
- Auto-fill period based on calendar
- Show filing history timeline

---

### Step 2: Income Data Entry

**Layout:** See detailed wireframe for visual layout

**Dynamic Sections Based on Tax Type:**

#### For PPh 21 (Employee Income Tax):
```
Employee Information
├── Total Employees (Integer)
├── Gross Salary Paid (Currency)
├── Tax Withheld (Auto-calculated or Manual)
└── Allowances & Benefits
    ├── Transport Allowance
    ├── Meal Allowance
    ├── Health Benefits
    ├── Housing Allowance
    └── [+ Add Custom Allowance]

AI Assistance:
- Extract from payroll documents
- Validate employee count vs previous periods
- Suggest allowance categories
- Flag unusual variances
```

#### For PPN (Value Added Tax):
```
Sales Information
├── Taxable Sales (Currency)
├── Export Sales (Currency)
├── Exempt Sales (Currency)
└── Total Sales (Auto-sum)

Purchase Information
├── Taxable Purchases (Currency)
├── Import Purchases (Currency)
├── Exempt Purchases (Currency)
└── Total Purchases (Auto-sum)

Tax Calculation
├── Output Tax (Sales × 11%)
├── Input Tax (Purchases × 11%)
└── PPN Payable (Output - Input)
```

#### For PPh Badan (Corporate Income Tax):
```
Revenue
├── Operating Revenue
├── Other Income
└── Total Revenue

Expenses
├── Cost of Goods Sold
├── Operating Expenses
├── Depreciation
├── Interest Expense
└── Other Expenses

Taxable Income Calculation
├── Net Income Before Tax
├── Tax Adjustments (Add back)
├── Taxable Income
└── Tax Payable (Rate-based)
```

**Common Features Across All Types:**
- Currency formatting (Rupiah)
- Thousand separators
- Decimal support (2 places)
- Auto-calculation fields (gray background)
- Formula tooltips
- Copy from previous period option

---

### Step 3: Deductions & Credits

**Standard Deductions:**
```
Allowed Deductions
├── Business Expenses
│   ├── Category Dropdown
│   ├── Amount
│   ├── Description
│   └── [+ Add Expense]
├── Depreciation Schedule
│   ├── Asset Type
│   ├── Depreciation Method
│   ├── Annual Amount
│   └── [Import from Asset Register]
└── Other Deductions
    └── [+ Add Deduction]

Tax Credits
├── Prepaid Tax (PPh 22, 23, 24)
├── Foreign Tax Credit
└── Investment Tax Credit

Summary
├── Total Deductions
├── Total Credits
└── Net Tax Payable/Refundable
```

**Validation:**
- Deductions must have supporting documents
- Credits require proof (withholding slips)
- Depreciation must match asset register
- Flag if deductions > industry average

**AI Features:**
- Categorize expenses automatically
- Suggest missed deductions
- Validate against tax regulations
- Calculate optimal depreciation method

---

### Step 4: Supporting Documents

**Document Upload Interface:**
```
Required Documents Checklist
├── ✓ Company Registration (Uploaded)
├── ✓ Tax ID Card (NPWP) (Uploaded)
├── ✓ Financial Statements (Uploaded)
├── ⚠ Payroll Records (Needs Review)
├── ⏳ Bank Statements (Processing)
├── ✗ Receipts (Missing)
└── [+ Upload More Documents]

Upload Methods:
├── Drag & Drop Area
├── File Browser
├── Scan from Camera/Scanner
└── Import from Cloud Storage
```

**Document Processing:**
1. Upload → Virus scan
2. OCR extraction (if applicable)
3. AI data extraction
4. Validation
5. Link to relevant form fields
6. Store in document repository

**Document Viewer:**
- Preview in modal
- Zoom, rotate, download
- Annotate (highlight, comment)
- Compare versions
- Share with team

**File Specifications:**
- Formats: PDF, JPEG, PNG, XLSX, DOCX
- Max size: 10MB per file
- Max total: 100MB per filing
- Retention: 10 years (compliance)

---

### Step 5: Review & Submit

**Review Screen Layout:**
```
┌─────────────────────────────────────────┐
│ Final Review Checklist                  │
├─────────────────────────────────────────┤
│ ✓ All required fields completed         │
│ ✓ Calculations verified                 │
│ ✓ Documents uploaded                    │
│ ✓ AI validation passed                  │
│ ⚠ 2 warnings (View Details)             │
│ ○ 0 errors                              │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Tax Filing Summary                      │
├─────────────────────────────────────────┤
│ Client: PT Maju Jaya                    │
│ Tax Type: PPh 21                        │
│ Period: December 2025                   │
│ Due Date: January 20, 2026              │
│                                         │
│ Total Tax Payable: Rp 62,500,000        │
│                                         │
│ [View Full Details ▼]                   │
└─────────────────────────────────────────┘

Internal Review Checklist
☐ Data accuracy verified
☐ Supporting documents complete
☐ Calculations cross-checked
☐ Client information updated
☐ Notes added for reviewer

[← Previous Step]  [Submit for Review →]
```

**Submission Actions:**
1. **Save as Draft:** Save progress, exit
2. **Submit for Internal Review:** Send to tax consultant
3. **Request Revision:** Send back to previous reviewer with notes

**Pre-Submit Validation:**
- All required fields complete
- All calculations correct
- All documents uploaded
- All checks passed
- Internal review checklist completed

**Post-Submit:**
- Confirmation message
- Email notification to tax consultant
- Update task status
- Lock form (read-only until revision requested)

---

## AI Assistant Integration

### Sidebar Features

**Suggestions Panel:**
```
💡 AI Suggestions
├── "Employee count matches payroll records"
├── "Consider health insurance deduction"
├── "Attach invoice #1234 to this expense"
└── [Ask AI a Question]
```

**Validation Panel:**
```
✓ Validations Passed (15)
├── NPWP format valid
├── Tax rates correct for 2025
├── Calculations accurate
└── [View All]

⚠ Warnings (2)
├── Gross salary +12% vs last month
│   → Add explanation in notes
├── Missing receipt for allowance
│   → Upload supporting document
```

**Chat Interface:**
- Natural language questions
- Contextual to current step
- Regulation references
- Example: "How is transport allowance taxed?"

---

## Form Validation

### Client-Side Validation
- Real-time field validation
- Format checks (email, phone, currency)
- Range validation (min/max values)
- Cross-field validation
- Pattern matching (NPWP format)

### Server-Side Validation
- Business rule validation
- Duplicate detection
- Compliance checks
- Database constraints
- Security validation

### Validation Display
- Inline errors (red text below field)
- Field highlighting (red border)
- Summary at top (if multiple errors)
- Prevent submission until resolved

---

## Auto-Save & Recovery

### Auto-Save Behavior
**Triggers:**
- Every 30 seconds (idle)
- On field blur (500ms debounce)
- On step navigation
- On window focus loss

**Save Indicators:**
```
Saving...  ⏳
Saved at 14:32  ✓
Error saving  ⚠ [Retry]
```

### Session Recovery
- Local storage backup every save
- Resume from last saved state
- Conflict resolution (if multiple tabs)
- Recovery prompt on page reload

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + S` | Save draft |
| `Ctrl + Enter` | Next step |
| `Ctrl + ←` | Previous step |
| `Ctrl + K` | Open AI assistant |
| `Tab` | Next field |
| `Shift + Tab` | Previous field |
| `Esc` | Cancel/close |

---

## Responsive Design

### Desktop (> 1200px)
- 3-column layout (form, documents, AI assistant)
- All features visible
- Side-by-side document preview

### Tablet (768px - 1200px)
- 2-column layout
- Collapsible sidebars
- Stacked document list

### Mobile (< 768px)
- Single column
- One section at a time
- Bottom sheets for sidebars
- Floating action buttons

---

## Performance Optimization

### Initial Load
- Progressive form rendering
- Lazy load document previews
- Defer non-critical validations
- Cache client data
- < 2s Time to Interactive

### Runtime
- Debounce calculations (500ms)
- Throttle AI suggestions (1s)
- Virtual scrolling for long lists
- Memoize computed values
- Optimize re-renders

### Network
- Batch API calls
- Compress uploads
- Incremental document upload
- Resume failed uploads
- Offline support (read-only)

---

## Accessibility

### ARIA Labels
- All form fields labeled
- Dynamic content announced
- Error messages associated
- Progress indicators

### Keyboard Navigation
- Logical tab order
- Skip links
- Focus management in modals
- Trapped focus where needed

### Screen Readers
- Field labels and hints
- Validation feedback
- Calculation results
- Step progress

---

## Security

### Data Protection
- HTTPS only
- CSRF tokens
- XSS prevention
- Input sanitization
- File upload validation

### Session Security
- Auto-lock after 15 min inactive
- Re-auth for sensitive fields
- Audit trail (all changes logged)
- IP address tracking

### Document Security
- Encrypted storage
- Access control (RBAC)
- Virus scanning
- Watermarking (optional)

---

## Integration Points

### API Endpoints
```
GET    /api/v1/tax-filings/{id}
PATCH  /api/v1/tax-filings/{id}
POST   /api/v1/tax-filings/{id}/validate
POST   /api/v1/tax-filings/{id}/calculate
POST   /api/v1/tax-filings/{id}/submit
GET    /api/v1/tax-filings/{id}/documents
POST   /api/v1/documents/upload
POST   /api/v1/ai/suggest
POST   /api/v1/ai/extract
```

### WebSocket Events
```
filing:auto-saved
validation:completed
calculation:updated
ai:suggestion-ready
document:processed
```

---

## Related Documentation
- [Accountant Submission Form Wireframe](/Users/tommy/git/ai-pajak/docs/02-design/ui-ux/wireframes/accountant-submission-form.md)
- [User Flows - Accountant](/Users/tommy/git/ai-pajak/docs/02-design/ui-ux/user-flows.md)
- [Tax Filing API](/Users/tommy/git/ai-pajak/docs/02-design/api/endpoints/tax-filing-api.md)
- [Design System](/Users/tommy/git/ai-pajak/docs/02-design/ui-ux/design-system.md)
- [AI Validation Engine](/Users/tommy/git/ai-pajak/docs/03-technical/ai-validation.md)

---

**Document Version:** 1.0
**Last Updated:** 2025-12-23
**Owner:** Product Design Team
**Status:** Ready for Development
