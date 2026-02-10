# Reports Screen - Detailed Specification

## Overview
The Reports screen provides comprehensive analytics, compliance reports, and business intelligence for all user personas. It features interactive dashboards, exportable reports, and customizable views.

---

## Report Categories

### 1. Tax Compliance Reports
- Filing status summary
- Compliance rate by period
- Upcoming deadlines
- Historical compliance trends
- DJP submission confirmations

### 2. Financial Reports
- Tax liability by period
- Tax breakdown by type
- Year-over-year comparison
- Cost analysis (tax costs vs revenue)
- Payment history

### 3. Operational Reports
- Team performance metrics
- Task completion rates
- Average processing time
- Accountant workload distribution
- Client onboarding statistics

### 4. Client Reports
- Client portfolio summary
- Tax summary per client
- Document completion status
- Communication history
- Billable hours (for consultants)

### 5. Audit & Compliance Reports
- Audit trail logs
- User activity reports
- Document access logs
- Security reports
- Regulatory compliance checklist

---

## Reports Screen Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Header: Reports                          [Export] [Schedule]│
├───────────────────────────────────────────────────────┬─────┤
│                                                       │     │
│  Sidebar:                    Main Area:              │ F   │
│  Report Categories           Selected Report         │ i   │
│                                                       │ l   │
│  📊 Overview                 ┌─────────────────────┐ │ t   │
│  📈 Tax Compliance           │ Report Title         │ │ e   │
│  💰 Financial                │ Date Range Selector  │ │ r   │
│  👥 Operational              │                      │ │ s   │
│  📁 Client Reports           │ [Report Content]     │ │     │
│  🔍 Audit & Compliance       │  - Charts           │ │ [×] │
│                              │  - Tables            │ │     │
│  Saved Reports               │  - KPIs              │ │     │
│  ⭐ Monthly Tax Summary      │                      │ │     │
│  ⭐ Team Performance         │ [Export Options]     │ │     │
│                              └─────────────────────┘ │     │
│                                                       │     │
└───────────────────────────────────────────────────────┴─────┘
```

---

## Component Specifications

### Date Range Selector

**Presets:**
```
[Today] [This Week] [This Month] [This Quarter] [This Year]
[Last Month] [Last Quarter] [Last Year] [Custom Range ▾]
```

**Custom Range Picker:**
```
From: [📅 Dec 1, 2025]  To: [📅 Dec 23, 2025]  [Apply]
```

**Features:**
- Calendar popup
- Quick presets
- Fiscal year option
- Compare to previous period toggle
- Max range: 3 years

---

### Report Filters Sidebar

**Common Filters:**
```
┌─────────────────────┐
│ FILTERS             │
├─────────────────────┤
│ Tax Type            │
│ ☐ PPh 21           │
│ ☐ PPh 23           │
│ ☐ PPN              │
│ ☐ PPh Badan        │
│                     │
│ Status              │
│ ☐ Completed        │
│ ☐ In Progress      │
│ ☐ Pending          │
│ ☐ Overdue          │
│                     │
│ Client              │
│ [Search clients...] │
│                     │
│ Accountant          │
│ [Select...]         │
│                     │
│ [Apply] [Reset]     │
└─────────────────────┘
```

**Behavior:**
- Multi-select checkboxes
- Real-time preview of result count
- Save filter presets
- Clear all button
- Collapse/expand sections

---

## Report Types - Detailed Specs

### 1. Tax Compliance Dashboard

**Layout:**
```
┌───────────────────────────────────────────────┐
│ Tax Compliance Overview                       │
│ Period: January - December 2025               │
├───────────────────────────────────────────────┤
│                                               │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│ │ 95%  │ │ 142  │ │  5   │ │  3   │         │
│ │Compli│ │Total │ │Over- │ │Pendi││         │
│ │ance  │ │Filed │ │due   │ │ng   │         │
│ └──────┘ └──────┘ └──────┘ └──────┘         │
│                                               │
│ Compliance Rate Trend                         │
│ ┌───────────────────────────────────────────┐│
│ │ Line chart showing monthly compliance %   ││
│ │ 100% ┤                                    ││
│ │      │         ╭────╮                     ││
│ │  90% ┤    ╭────╯    ╰──╮                 ││
│ │      │╭───╯             ╰───             ││
│ │  80% ┼─────────────────────────────────  ││
│ │      Jan Feb Mar Apr May Jun Jul Aug Sep ││
│ └───────────────────────────────────────────┘│
│                                               │
│ Filing Status Breakdown                       │
│ ┌─────────────────┬───────────────────────┐  │
│ │ Tax Type        │ Filed │ Pending │ %   │  │
│ ├─────────────────┼───────────────────────┤  │
│ │ PPh 21          │   48  │    2    │ 96% │  │
│ │ PPh 23          │   24  │    1    │ 96% │  │
│ │ PPN             │   52  │    0    │100% │  │
│ │ PPh Badan       │   18  │    2    │ 90% │  │
│ └─────────────────┴───────────────────────┘  │
│                                               │
│ Upcoming Deadlines (Next 30 Days)             │
│ ┌───────────────────────────────────────────┐│
│ │ Dec 25 │ PT Maju Jaya  │ PPh 21 │ Ready  ││
│ │ Dec 28 │ CV Sukses     │ PPN    │ Draft  ││
│ │ Jan 05 │ UD Berkah     │ PPh 23 │ Pending││
│ └───────────────────────────────────────────┘│
│                                               │
│ [Export PDF] [Export Excel] [Schedule Email] │
└───────────────────────────────────────────────┘
```

**Export Options:**
- PDF (formatted, printable)
- Excel (data + charts)
- CSV (raw data)
- PNG (chart images)

---

### 2. Financial Summary Report

**Components:**
- Total tax paid (YTD)
- Tax by category (donut chart)
- Monthly tax liability (bar chart)
- Year-over-year comparison
- Effective tax rate
- Tax savings (deductions & credits)
- Payment status table
- Forecast (next quarter)

**Visualizations:**
```
Tax Liability by Month (2025)

100M ┤        ╭──●
     │     ╭──╯
 80M ┤  ╭──╯
     │╭─●
 60M ┼─────────────────
     Jan Feb Mar Apr May

Tax Breakdown (Donut Chart)
┌─────────────────┐
│      Total      │
│   Rp 1.2B       │
│                 │
│  ██ PPh 21 40%  │
│  ██ PPN 35%     │
│  ██ PPh Badan25%│
└─────────────────┘
```

---

### 3. Team Performance Report

**Metrics:**
```
Team Performance - December 2025

Individual Accountant Stats:
┌───────────────┬──────┬─────────┬─────────┬─────────┐
│ Name          │Tasks │Completed│Avg Time │Accuracy │
├───────────────┼──────┼─────────┼─────────┼─────────┤
│ Siti Wijaya   │  28  │   28    │ 2.1 hrs │  98.5%  │
│ Ahmad Rahman  │  24  │   22    │ 2.8 hrs │  96.2%  │
│ Dewi Susanti  │  31  │   29    │ 1.9 hrs │  99.1%  │
│ Budi Hartono  │  19  │   18    │ 3.2 hrs │  94.8%  │
└───────────────┴──────┴─────────┴─────────┴─────────┘

Task Distribution (Bar Chart)
Siti    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 28
Ahmad   ▓▓▓▓▓▓▓▓▓▓▓▓ 24
Dewi    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 31
Budi    ▓▓▓▓▓▓▓▓▓▓ 19

Completion Rate Over Time
100% ┤  ●──●──●──●──●
     │
 90% ┤
     │
 80% ┼──────────────────
     Week1 Week2 Week3 Week4
```

**Insights:**
- Top performers
- Bottlenecks identification
- Workload balance
- Training recommendations

---

### 4. Client Portfolio Report

**Structure:**
```
Client Portfolio Analysis

Total Clients: 142
Active: 135 | Inactive: 7

By Business Type:
┌─────────────────┬──────┬────────┐
│ Type            │Count │Revenue │
├─────────────────┼──────┼────────┤
│ PT (Limited)    │  48  │  60%   │
│ CV (Partnership)│  56  │  30%   │
│ UD (Sole)       │  38  │  10%   │
└─────────────────┴──────┴────────┘

Client Health Score:
● Excellent (90-100): 95 clients
● Good (70-89): 38 clients
● At Risk (<70): 9 clients

Top 10 Clients by Tax Liability
[Table with client names, tax amounts, filing count]

Client Retention Rate: 96.2%
New Clients This Year: 24
Churned Clients: 3
```

---

### 5. Audit Trail Report

**Log Table:**
```
┌──────────┬──────────┬────────┬──────────┬──────────┐
│Timestamp │User      │Action  │Entity    │Details   │
├──────────┼──────────┼────────┼──────────┼──────────┤
│14:32:05  │Siti W.   │Updated │Filing123 │Changed   │
│          │          │        │          │status    │
├──────────┼──────────┼────────┼──────────┼──────────┤
│14:28:13  │Ahmad R.  │Uploaded│Doc456    │Financial │
│          │          │        │          │statement │
├──────────┼──────────┼────────┼──────────┼──────────┤
│14:15:22  │Budi S.   │Approved│Filing789 │PPh 21    │
└──────────┴──────────┴────────┴──────────┴──────────┘
```

**Filters:**
- Date range
- User
- Action type (Created, Updated, Deleted, etc.)
- Entity type (Filing, Client, Document, etc.)
- Search by keywords

**Features:**
- Exportable for compliance
- Immutable (cannot be edited)
- Detailed change diff view
- Compliance flagging

---

## Interactive Features

### Drill-Down Capability
- Click chart segment → Filter table
- Click table row → Detail view
- Click metric card → Related report
- Breadcrumb navigation

### Comparison Mode
```
[Compare to: Previous Period ▾]
Options:
- Previous period (same length)
- Same period last year
- Custom date range
```

**Display:**
- Side-by-side charts
- Percentage change indicators
- Variance highlights (green/red)

---

## Report Scheduling

**Schedule Modal:**
```
┌─────────────────────────────────────┐
│ Schedule Report Email               │
├─────────────────────────────────────┤
│ Report: Tax Compliance Dashboard    │
│                                     │
│ Frequency:                          │
│ ○ Daily    ● Weekly   ○ Monthly     │
│                                     │
│ Day: [Every Monday ▾]               │
│ Time: [09:00 ▾]                     │
│                                     │
│ Recipients:                         │
│ ┌─────────────────────────────────┐│
│ │ you@company.com             [×] ││
│ │ manager@company.com         [×] ││
│ └─────────────────────────────────┘│
│ [+ Add Recipient]                   │
│                                     │
│ Format: ☑ PDF  ☐ Excel  ☐ CSV      │
│                                     │
│ [Cancel]  [Save Schedule]           │
└─────────────────────────────────────┘
```

**Scheduled Reports List:**
- View all scheduled reports
- Pause/resume schedules
- Edit schedule
- Delete schedule
- View delivery history

---

## Report Builder (Advanced)

**Custom Report Creation:**
```
Step 1: Select Data Sources
☐ Tax Filings
☐ Clients
☐ Documents
☐ Tasks
☐ Users

Step 2: Choose Metrics
☐ Filing count
☐ Tax amount
☐ Completion rate
☐ Average time
☐ [Custom calculation...]

Step 3: Add Visualizations
[+ Chart] [+ Table] [+ KPI Card]

Step 4: Apply Filters
[Filter Builder Interface]

Step 5: Layout & Style
[Drag-and-drop layout editor]

Step 6: Save & Name
Report Name: [____________]
☐ Save to My Reports
☐ Share with team
```

---

## Export Specifications

### PDF Export
- Header: Logo, report title, date range, generated timestamp
- Footer: Page numbers, confidentiality notice
- Styling: Company branding, professional layout
- Charts: High resolution images
- Tables: Paginated, headers repeat
- Options: Portrait/Landscape

### Excel Export
- Multiple sheets for complex reports
- Formatted data tables
- Chart sheets
- Raw data sheet
- Formulas included
- Conditional formatting

### CSV Export
- UTF-8 encoding
- Comma-separated
- Headers row
- Quoted strings
- ISO date format

---

## Performance Optimization

### Data Loading
- Lazy load chart libraries
- Virtual scrolling for large tables
- Pagination (50 rows per page)
- Server-side filtering
- Cached queries (5 min TTL)

### Rendering
- Progressive chart rendering
- Debounce filter updates
- Memoize calculations
- Web workers for heavy computations

---

## Accessibility

### Screen Readers
- Chart data tables (accessible alternative)
- Descriptive chart titles
- Data point announcements
- Filter status announcements

### Keyboard Navigation
- Tab through filters and controls
- Arrow keys in charts (data points)
- Enter to drill down
- Escape to close modals

### Visual
- High contrast charts
- Color blind safe palettes
- Pattern fills in addition to colors
- Resizable text

---

## Security & Permissions

### Access Control
- Reports visibility by role
- Row-level security (see own clients only)
- Audit trail for report access
- Export permissions separate from view

### Data Privacy
- Anonymization option (for demos)
- Redact sensitive fields
- Watermark exports
- Track export recipients

---

## Related Documentation
- [Dashboard Screen](/Users/tommy/git/ai-pajak/docs/02-design/ui-ux/screens/dashboard.md)
- [User Flows](/Users/tommy/git/ai-pajak/docs/02-design/ui-ux/user-flows.md)
- [Design System](/Users/tommy/git/ai-pajak/docs/02-design/ui-ux/design-system.md)
- [Reporting API](/Users/tommy/git/ai-pajak/docs/02-design/api/endpoints/reporting-api.md)

---

**Document Version:** 1.0
**Last Updated:** 2025-12-23
**Owner:** Product Design Team
**Status:** Ready for Development
