# Dashboard Screen - Detailed Specification

## Overview
The Dashboard is the main interface for all user personas, providing role-specific overviews of key metrics, tasks, and system status. This document details the comprehensive specifications for each persona's dashboard.

---

## Dashboard Types

### 1. Tax Consultant Dashboard
**Purpose:** Manage clients, monitor filings, coordinate team
**Reference Wireframe:** [Tax Consultant Dashboard Wireframe](/Users/tommy/git/ai-pajak/docs/02-design/ui-ux/wireframes/tax-consultant-dashboard.md)

### 2. Accountant Dashboard
**Purpose:** View assigned tasks, complete filings, track progress

### 3. Executive Dashboard
**Purpose:** Approve filings, monitor compliance, view business metrics

### 4. Admin Dashboard
**Purpose:** System management, user administration, configuration

---

## Layout Grid System

### Desktop Layout (1920px)
```
┌─────────────────────────────────────────────────────┐
│ Header (Fixed, 64px height)                         │
├─────────────────────────────────────────────────────┤
│ │                                                 │ │
│ │                Main Content                     │ │
│S│                (12-column grid)                 │R│
│i│                                                 │i│
│d│                Padding: 24px                    │g│
│e│                Gap: 24px between cards          │h│
│b│                                                 │t│
│a│                                                 │ │
│r│                                                 │S│
│ │                                                 │i│
│2│                                                 │d│
│4│                                                 │e│
│0│                                                 │b│
│p│                                                 │a│
│x│                                                 │r│
│ │                                                 │ │
│ │                                                 │3│
│ │                                                 │2│
│ │                                                 │0│
│ │                                                 │p│
│ │                                                 │x│
└─────────────────────────────────────────────────────┘
```

### Responsive Breakpoints
- **Mobile:** < 768px (single column, no sidebars)
- **Tablet:** 768px - 1199px (single column, collapsible sidebars)
- **Desktop:** 1200px - 1919px (standard layout)
- **Large:** ≥ 1920px (max content width 1920px, centered)

---

## Component Library

### Card Component
**Base Specifications:**
```css
.card {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: #1F2937;
}

.card-action {
  font-size: 14px;
  color: #3B82F6;
  cursor: pointer;
}
```

**Variants:**
- Default card
- Interactive card (hover effects)
- Alert card (colored border)
- Stat card (centered content)
- List card (contains table/list)

---

### KPI Card Component
**Visual Design:**
```
┌────────────────────┐
│   📊               │ Icon (top-left, 40x40)
│   Total Clients    │ Label (14px, Medium, Neutral 600)
│   142              │ Value (32px, Bold, Neutral 900)
│   ↗ +12 this month │ Change indicator (12px, Success/Error)
└────────────────────┘
```

**Specifications:**
```css
.kpi-card {
  min-height: 140px;
  position: relative;
  overflow: hidden;
}

.kpi-icon {
  width: 40px;
  height: 40px;
  margin-bottom: 12px;
  color: var(--primary-500);
}

.kpi-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--neutral-600);
  margin-bottom: 8px;
}

.kpi-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--neutral-900);
  line-height: 1.2;
}

.kpi-change {
  font-size: 12px;
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.kpi-change.positive {
  color: var(--success-600);
}

.kpi-change.negative {
  color: var(--error-600);
}
```

**States:**
- Default: Static display
- Loading: Skeleton animation
- Error: Show "--" with error icon
- Interactive: Clickable, shows drill-down

**Data Attributes:**
```html
<div class="kpi-card"
     data-metric="total-clients"
     data-value="142"
     data-change="+12"
     data-trend="positive">
  <!-- content -->
</div>
```

---

### Data Table Component
**Specifications:**
```css
.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.data-table thead {
  background: #F9FAFB;
}

.data-table th {
  padding: 12px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: #6B7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #E5E7EB;
}

.data-table td {
  padding: 16px;
  font-size: 14px;
  color: #1F2937;
  border-bottom: 1px solid #F3F4F6;
}

.data-table tr:hover {
  background: #F9FAFB;
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}
```

**Features:**
- Sortable columns (click header)
- Row selection (checkbox)
- Row actions (dropdown menu)
- Inline editing (double-click cell)
- Pagination
- Filtering
- Search
- Empty state
- Loading state (skeleton rows)

**Responsive:**
- Desktop: Full table
- Tablet: Horizontal scroll
- Mobile: Card-based view (stack rows)

---

### Status Badge Component
**Visual Design:**
```
┌──────────────┐
│ 🟢 On Track  │ Status indicator + text
└──────────────┘
```

**Specifications:**
```css
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
}

.status-badge.success {
  background: #D1FAE5;
  color: #065F46;
}

.status-badge.warning {
  background: #FEF3C7;
  color: #92400E;
}

.status-badge.error {
  background: #FEE2E2;
  color: #991B1B;
}

.status-badge.info {
  background: #DBEAFE;
  color: #1E40AF;
}

.status-badge.neutral {
  background: #F3F4F6;
  color: #4B5563;
}
```

**Status Types:**
- 🟢 On Track / Completed / Approved (Success)
- 🟡 In Review / Pending (Warning)
- 🟠 Draft / In Progress (Info)
- 🔴 Blocked / Overdue / Rejected (Error)
- ⚪ Not Started / Inactive (Neutral)

---

### Chart Components

#### Line Chart (Trend)
**Use Cases:** Tax amounts over time, performance trends, compliance rates

**Specifications:**
- Library: Chart.js or Recharts
- Height: 240px - 400px
- Responsive: Yes
- Grid: Light gray (#F3F4F6)
- Line: Primary color (#3B82F6), 2px width
- Points: Visible on hover, 6px radius
- Tooltip: Show on hover with formatted data
- Legend: Bottom or right
- Animation: Fade in on load, smooth transitions

**Accessibility:**
- Keyboard navigable points
- Screen reader data table alternative
- High contrast mode support

#### Bar Chart (Comparison)
**Use Cases:** Client counts by type, filing volumes, team performance

**Specifications:**
- Bar spacing: 8px
- Bar radius: 4px (top corners)
- Colors: Sequential from color palette
- Hover: Darken bar, show tooltip
- Labels: Below bars, rotated if needed
- Max bars: 12 visible (scroll for more)

#### Donut Chart (Proportion)
**Use Cases:** Filing status breakdown, task distribution, category splits

**Specifications:**
- Donut thickness: 20-30% of radius
- Center: Display total or key metric
- Segments: Different colors from palette
- Hover: Expand segment, show percentage
- Legend: Right side or bottom
- Min segment: 3% (merge smaller into "Other")

---

## Tax Consultant Dashboard - Detailed Specs

### Layout Structure
**Grid:** 12 columns, 24px gap
**Sections:**
1. Header (full width)
2. KPI Cards (4 columns each, 3 cards = 12 columns)
3. Urgent Actions (8 columns) + Upcoming Deadlines (4 columns)
4. Active Filings Table (full width)
5. Team Performance (6 columns) + Recent Messages (6 columns)

### Section 1: Header
**Components:**
- Greeting: "Welcome back, {Name} 👋"
- Date display: "📅 {Full Date}"
- Quick actions: "+ New Filing", "Settings"

### Section 2: KPI Cards Row
**Card 1: Total Clients**
- Icon: 👥 (users)
- Metric: Count of active clients
- Change: Month-over-month growth
- Click: Navigate to clients list

**Card 2: Pending Filings**
- Icon: ⏰ (clock)
- Metric: Count of pending filings
- Change: Compared to last period
- Click: Filter filings to pending status

**Card 3: Completed This Month**
- Icon: ✓ (checkmark)
- Metric: Count of completed filings
- Change: vs target or last month
- Click: View completed filings

**Card 4: Overdue Actions**
- Icon: ⚠ (alert)
- Metric: Count of overdue items
- Change: vs yesterday (should decrease!)
- Click: View urgent actions panel
- Alert: Red border if count > 0

### Section 3: Urgent Actions Panel
**Layout:**
```
┌─────────────────────────────────────────┐
│ 🚨 URGENT ACTIONS REQUIRED        [×]   │
├─────────────────────────────────────────┤
│ [List of urgent items, max 5 visible]   │
│                                         │
│ [View All Urgent Items (12)]            │
└─────────────────────────────────────────┘
```

**Each Urgent Item:**
- Client name (bold, 16px)
- Tax type + period
- Due date with countdown badge
- Status indicator
- Action buttons: [View Details] [Quick Action]
- Color-coded urgency:
  - Red: < 24 hours or overdue
  - Orange: 1-2 days
  - Yellow: 3-5 days

**Sort:** By due date (ascending)
**Refresh:** Every 30 seconds (WebSocket or polling)

### Section 4: Upcoming Deadlines Sidebar
**Compact List:**
- Date badge (large, bold)
- Client name (truncated to 15 chars)
- Tax type (small, gray)
- Click: Navigate to filing details
- Max 5 visible: [View All] for calendar view

### Section 5: Active Filings Table
**Columns:**
1. Client Name + Assigned Accountant (name below, smaller font)
2. Tax Type
3. Period / Deadline
4. Status (badge component)
5. Actions (dropdown menu)

**Row Actions:**
- View Details
- Edit Filing
- Message Accountant
- Reassign
- Mark Complete
- Delete (with confirmation)

**Table Features:**
- Sort by any column
- Filter by status, tax type, accountant, date range
- Search by client name
- Pagination: 10 rows default, 10/25/50/100 options
- Bulk actions: Multi-select with checkboxes

**Empty State:**
```
┌─────────────────────────────────────────┐
│                                         │
│            📄                           │
│    No Active Filings                    │
│    Create your first filing to get      │
│    started.                             │
│                                         │
│    [+ Create New Filing]                │
│                                         │
└─────────────────────────────────────────┘
```

### Section 6: Team Performance Widget
**Components:**
- Summary metrics:
  - Total accountants count
  - Active tasks count
  - Average completion time
- Individual accountant bars:
  - Name
  - Progress bar (tasks completed / total assigned)
  - Percentage
  - Hover: Show task breakdown tooltip
- [View Details] link → Team performance page

### Section 7: Recent Messages Widget
**Message List:**
- Sender name + role
- Message preview (truncated to 60 chars)
- Timestamp (relative: "5 mins ago")
- [Reply] button
- Unread indicator (blue dot)
- Click message: Open full conversation

**Features:**
- Auto-refresh new messages (real-time)
- Max 3 messages shown
- [View All Messages (12)] link

---

## Accountant Dashboard - Key Differences

**Focus:** Task-centric rather than client-centric

**Layout Sections:**
1. Header with task summary
2. KPI Cards: Assigned Tasks, Completed Today, Avg Time, Accuracy Rate
3. Task List (priority view)
   - High priority tasks at top
   - Due date sorting
   - Status indicators
   - Start/Continue buttons
4. Recent Documents Processed
5. AI Assistance Summary
6. Time tracking widget

**Task List:**
- Card-based view (not table)
- Each task card shows:
  - Client name + Tax type
  - Due date countdown
  - Progress percentage
  - [Start Task] or [Continue] button
  - Document count
  - Notes count

---

## Executive Dashboard - Key Differences

**Focus:** High-level metrics and approvals

**Layout Sections:**
1. Executive summary cards
   - Compliance score
   - Tax liability (current period)
   - Pending approvals
   - Cost savings (vs manual)
2. Pending approvals (prominent)
   - Quick approve workflow
   - Biometric ready
3. Compliance calendar
4. Financial charts
   - Tax over time
   - Category breakdown
5. Alerts and notifications

**Style:**
- Larger fonts, more whitespace
- Simplified visuals
- Mobile-first (responsive)
- One-click actions

---

## Admin Dashboard - Key Differences

**Focus:** System health and user management

**Layout Sections:**
1. System status indicators
   - Server health
   - API response time
   - Database status
   - Background jobs
2. User activity metrics
   - Active users (now)
   - New signups
   - Session duration
   - Feature usage
3. Recent admin actions log
4. System alerts
5. Quick actions panel
   - Create user
   - View logs
   - System settings
   - Backup database

---

## Real-Time Updates

### WebSocket Integration
**Events to Listen:**
- `filing:status-updated` → Update filing rows
- `message:received` → Add to messages widget
- `task:assigned` → Update task count
- `deadline:approaching` → Add to urgent panel
- `user:activity` → Update online status

**Connection:**
```javascript
const ws = new WebSocket('wss://api.ai-pajak.com/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch(data.type) {
    case 'filing:status-updated':
      updateFilingRow(data.payload);
      break;
    // ... handle other events
  }
};
```

**Fallback:** Polling every 60 seconds if WebSocket unavailable

---

## Loading States

### Initial Page Load
1. Show header immediately
2. KPI cards: Skeleton animation (shimmer effect)
3. Tables: Show 5 skeleton rows
4. Charts: Show gray placeholder
5. Progressive enhancement: Load critical data first

### Skeleton Component
```css
.skeleton {
  background: linear-gradient(
    90deg,
    #F3F4F6 25%,
    #E5E7EB 50%,
    #F3F4F6 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## Error States

### API Error
```
┌─────────────────────────────────────────┐
│ ⚠ Unable to load dashboard data         │
│ Please check your connection and retry. │
│ [Retry]  [Contact Support]              │
└─────────────────────────────────────────┘
```

### Partial Data Error
- Show available data
- Display warning banner at top
- Specific sections show retry button

### Session Expired
- Full-page overlay
- "Your session has expired"
- [Sign In Again] button

---

## Performance Metrics

### Target Metrics
- **First Contentful Paint:** < 1.5s
- **Time to Interactive:** < 3s
- **Largest Contentful Paint:** < 2.5s
- **Cumulative Layout Shift:** < 0.1
- **First Input Delay:** < 100ms

### Optimization Strategies
- Code splitting by route
- Lazy load below-the-fold content
- Image optimization (WebP, lazy load)
- Prefetch likely next actions
- Cache dashboard data (5 min TTL)
- Virtual scrolling for long tables
- Debounce search inputs
- Throttle scroll events

---

## Accessibility

### Keyboard Navigation
- Skip to main content link
- Tab order: Header → KPIs → Primary actions → Tables
- Arrow keys in tables
- Enter/Space to activate
- Escape to close modals

### Screen Reader
- Landmark regions: header, main, aside
- Dynamic content announcements
- Table headers properly associated
- Status updates announced
- Loading states announced

### Visual
- 4.5:1 contrast minimum
- Focus indicators visible
- Color not sole indicator
- Text resizable to 200%
- Reduced motion support

---

## Related Documentation
- [Tax Consultant Dashboard Wireframe](/Users/tommy/git/ai-pajak/docs/02-design/ui-ux/wireframes/tax-consultant-dashboard.md)
- [User Flows](/Users/tommy/git/ai-pajak/docs/02-design/ui-ux/user-flows.md)
- [Design System](/Users/tommy/git/ai-pajak/docs/02-design/ui-ux/design-system.md)
- [Dashboard API](/Users/tommy/git/ai-pajak/docs/02-design/api/endpoints/dashboard-api.md)

---

**Document Version:** 1.0
**Last Updated:** 2025-12-23
**Owner:** Product Design Team
**Status:** Ready for Development
