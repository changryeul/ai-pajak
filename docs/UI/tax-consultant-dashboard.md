# Tax Consultant Dashboard - Wireframe

## Overview
The Tax Consultant Dashboard is the primary interface for tax consultants to manage clients, monitor tax filings, and coordinate with accountants. It provides a comprehensive overview of all active clients and pending tasks.

---

## Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ╔═══════════════════════════════════════════════════════════════════════╗   │
│ ║  [AI-PAJAK LOGO]     Dashboard    Clients    Filings    Reports   🔔 👤 ║   │
│ ╚═══════════════════════════════════════════════════════════════════════╝   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Welcome back, Budi Santoso 👋                   📅 Dec 23, 2025    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │   📊     │  │   ⏰     │  │   ✓      │  │   ⚠      │                   │
│  │  Total   │  │ Pending  │  │Complete  │  │ Overdue  │                   │
│  │ Clients  │  │ Filings  │  │  This    │  │ Actions  │                   │
│  │   142    │  │    23    │  │  Month   │  │    5     │                   │
│  │          │  │          │  │   87     │  │          │                   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────────────────────┐  ┌──────────────────┐  │
│  │  🚨 URGENT ACTIONS REQUIRED                    │  │  📅 UPCOMING     │  │
│  ├────────────────────────────────────────────────┤  │   DEADLINES      │  │
│  │                                                │  ├──────────────────┤  │
│  │  ⚠ PT MAJU JAYA - PPh 21 Filing               │  │                  │  │
│  │     Due: Dec 25, 2025 (2 days)                │  │  📍 Dec 25       │  │
│  │     Status: Waiting for Approval               │  │  PT Maju Jaya    │  │
│  │     [View Details] [Send Reminder]            │  │  PPh 21          │  │
│  │                                                │  │                  │  │
│  │  ⚠ CV SUKSES MAKMUR - PPN Filing              │  │  📍 Dec 28       │  │
│  │     Due: Dec 26, 2025 (3 days)                │  │  CV Sukses       │  │
│  │     Status: Missing Documents                  │  │  PPN             │  │
│  │     [View Details] [Request Docs]             │  │                  │  │
│  │                                                │  │  📍 Dec 31       │  │
│  │  ⚠ UD BERKAH - Tax Calculation Error          │  │  UD Berkah       │  │
│  │     Due: Dec 24, 2025 (1 day)                 │  │  PPh Badan       │  │
│  │     Status: Needs Review                       │  │                  │  │
│  │     [View Details] [Reassign]                 │  │  [View All]      │  │
│  │                                                │  │                  │  │
│  │  [View All Urgent Items (5)]                  │  └──────────────────┘  │
│  └────────────────────────────────────────────────┘                        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐│
│  │  📋 ACTIVE FILINGS                          [+ New Filing] [Filter] 🔍 ││
│  ├────────────────────────────────────────────────────────────────────────┤│
│  │                                                                        ││
│  │  ┌──────────────────────────────────────────────────────────────────┐ ││
│  │  │ Client Name        │ Tax Type │ Period  │ Status      │ Actions  │ ││
│  │  ├──────────────────────────────────────────────────────────────────┤ ││
│  │  │ PT MAJU JAYA       │ PPh 21   │ Dec 25  │ 🟡 Review   │ [View]   │ ││
│  │  │ Assigned: Siti W.  │          │         │             │ [Edit]   │ ││
│  │  │                    │          │         │             │ [Msg]    │ ││
│  │  ├──────────────────────────────────────────────────────────────────┤ ││
│  │  │ CV SUKSES MAKMUR   │ PPN      │ Dec 26  │ 🔴 Blocked  │ [View]   │ ││
│  │  │ Assigned: Ahmad R. │          │         │             │ [Edit]   │ ││
│  │  │                    │          │         │             │ [Msg]    │ ││
│  │  ├──────────────────────────────────────────────────────────────────┤ ││
│  │  │ UD BERKAH          │ PPh Badan│ Dec 31  │ 🟢 On Track │ [View]   │ ││
│  │  │ Assigned: Dewi S.  │          │         │             │ [Edit]   │ ││
│  │  │                    │          │         │             │ [Msg]    │ ││
│  │  ├──────────────────────────────────────────────────────────────────┤ ││
│  │  │ PT GEMILANG        │ PPh 23   │ Jan 05  │ 🟠 Draft    │ [View]   │ ││
│  │  │ Assigned: Budi H.  │          │         │             │ [Edit]   │ ││
│  │  │                    │          │         │             │ [Msg]    │ ││
│  │  └──────────────────────────────────────────────────────────────────┘ ││
│  │                                                                        ││
│  │  Showing 1-4 of 23 filings        [1] [2] [3] [4] [5] [Next >]       ││
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │  📊 TEAM PERFORMANCE       │  │  💬 RECENT MESSAGES                  │  │
│  ├────────────────────────────┤  ├──────────────────────────────────────┤  │
│  │                            │  │                                      │  │
│  │  Accountants: 8            │  │  From: PT Maju Jaya                  │  │
│  │  Active Tasks: 45          │  │  "When will the filing be ready?"    │  │
│  │  Avg Completion: 2.3 days  │  │  5 mins ago                          │  │
│  │                            │  │  [Reply]                             │  │
│  │  ┌──────────────────────┐  │  │                                      │  │
│  │  │ Siti W.    ▓▓▓▓▓ 100% │  │  From: Ahmad R. (Accountant)         │  │
│  │  │ Ahmad R.   ▓▓▓░░  60% │  │  "Need clarification on CV Sukses"   │  │
│  │  │ Dewi S.    ▓▓▓▓░  80% │  │  12 mins ago                         │  │
│  │  │ Budi H.    ▓▓▓▓▓  90% │  │  [Reply]                             │  │
│  │  └──────────────────────┘  │  │                                      │  │
│  │                            │  │  From: System                        │  │
│  │  [View Details]            │  │  "New client onboarded: UD Sinar"    │  │
│  │                            │  │  1 hour ago                          │  │
│  │                            │  │  [View Client]                       │  │
│  └────────────────────────────┘  │                                      │  │
│                                  │  [View All Messages (12)]            │  │
│                                  └──────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Header Navigation
```
┌───────────────────────────────────────────────────────────┐
│ [AI-PAJAK LOGO]  Dashboard  Clients  Filings  Reports 🔔 👤│
└───────────────────────────────────────────────────────────┘
```

**Components:**
- Logo/Brand (left-aligned)
- Primary navigation links
- Notification bell icon with badge counter
- User profile avatar with dropdown

**Interactions:**
- Click logo → Navigate to dashboard
- Click nav items → Navigate to respective sections
- Click 🔔 → Open notifications panel
- Click 👤 → Open user menu (profile, settings, logout)

**States:**
- Active navigation item highlighted
- Notification badge shows count (red dot if > 0)
- User avatar shows online status

---

### 2. Welcome Header
```
┌──────────────────────────────────────────────────┐
│ Welcome back, Budi Santoso 👋    📅 Dec 23, 2025 │
└──────────────────────────────────────────────────┘
```

**Components:**
- Personalized greeting with user name
- Current date display
- Optional time-based greeting (Good morning/afternoon/evening)

**Interactions:**
- Static display, no interaction
- Updates date automatically

---

### 3. KPI Cards
```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│   📊     │  │   ⏰     │  │   ✓      │  │   ⚠      │
│  Total   │  │ Pending  │  │Complete  │  │ Overdue  │
│ Clients  │  │ Filings  │  │  This    │  │ Actions  │
│   142    │  │    23    │  │  Month   │  │    5     │
│          │  │          │  │   87     │  │          │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
```

**Components:**
- Icon indicator
- Metric label
- Primary value (large font)
- Comparison or trend indicator (optional)

**Interactions:**
- Click card → Navigate to filtered view
- Hover → Show trend graph tooltip
- Color coding:
  - Green for positive/on-track
  - Yellow for attention needed
  - Red for urgent/overdue

**Data Source:**
- Real-time aggregated data from database
- Updates every 5 minutes

---

### 4. Urgent Actions Panel
```
┌────────────────────────────────────────────────┐
│  🚨 URGENT ACTIONS REQUIRED                    │
├────────────────────────────────────────────────┤
│                                                │
│  ⚠ PT MAJU JAYA - PPh 21 Filing               │
│     Due: Dec 25, 2025 (2 days)                │
│     Status: Waiting for Approval               │
│     [View Details] [Send Reminder]            │
└────────────────────────────────────────────────┘
```

**Components:**
- Alert header with icon
- List of urgent items (max 3-5 visible)
- Each item shows:
  - Client name
  - Tax type
  - Due date with countdown
  - Current status
  - Action buttons
- "View All" link at bottom

**Interactions:**
- [View Details] → Open filing detail page
- [Send Reminder] → Send notification to accountant/client
- [Request Docs] → Open document request modal
- [Reassign] → Open accountant reassignment dialog
- Click item → Expand for more details

**Priority Logic:**
- Sort by due date (ascending)
- Color code: Red (< 2 days), Yellow (< 5 days), Orange (blocked)
- Auto-refresh every 30 seconds

---

### 5. Upcoming Deadlines Sidebar
```
┌──────────────────┐
│  📅 UPCOMING     │
│   DEADLINES      │
├──────────────────┤
│                  │
│  📍 Dec 25       │
│  PT Maju Jaya    │
│  PPh 21          │
│                  │
│  📍 Dec 28       │
│  CV Sukses       │
│  PPN             │
│                  │
│  [View All]      │
└──────────────────┘
```

**Components:**
- Calendar icon header
- List of upcoming deadlines (max 3 visible)
- Each item shows:
  - Date indicator
  - Client name (truncated)
  - Tax type
- "View All" button

**Interactions:**
- Click item → Navigate to filing details
- [View All] → Open calendar view with all deadlines
- Hover → Show full client name and additional details

**Data Source:**
- Next 7 days of deadlines
- Excludes completed filings

---

### 6. Active Filings Table
```
┌────────────────────────────────────────────────────────────┐
│  📋 ACTIVE FILINGS          [+ New Filing] [Filter] 🔍     │
├────────────────────────────────────────────────────────────┤
│ Client Name    │ Tax Type │ Period │ Status    │ Actions  │
├────────────────────────────────────────────────────────────┤
│ PT MAJU JAYA   │ PPh 21   │ Dec 25 │ 🟡 Review │ [View]   │
│ Assigned: Siti │          │        │           │ [Edit]   │
│                │          │        │           │ [Msg]    │
└────────────────────────────────────────────────────────────┘
```

**Components:**
- Table header with title and actions
- [+ New Filing] button (primary CTA)
- [Filter] dropdown button
- Search icon
- Data table with columns:
  - Client Name + Assigned Accountant
  - Tax Type
  - Period/Deadline
  - Status with indicator
  - Actions dropdown
- Pagination controls

**Interactions:**
- [+ New Filing] → Open filing creation wizard
- [Filter] → Show filter options (status, tax type, accountant, date range)
- 🔍 Search → Live search across client names
- [View] → Open filing details in view mode
- [Edit] → Open filing details in edit mode
- [Msg] → Open messaging modal with client/accountant
- Click row → Navigate to filing details
- Sort by column → Click column header

**Status Indicators:**
- 🟢 On Track - Green
- 🟡 Review - Yellow
- 🟠 Draft - Orange
- 🔴 Blocked - Red
- ✓ Completed - Gray

---

### 7. Team Performance Widget
```
┌────────────────────────────┐
│  📊 TEAM PERFORMANCE       │
├────────────────────────────┤
│  Accountants: 8            │
│  Active Tasks: 45          │
│  Avg Completion: 2.3 days  │
│                            │
│  Siti W.    ▓▓▓▓▓ 100%     │
│  Ahmad R.   ▓▓▓░░  60%     │
│  Dewi S.    ▓▓▓▓░  80%     │
│                            │
│  [View Details]            │
└────────────────────────────┘
```

**Components:**
- Summary metrics
- Progress bars for each accountant
- "View Details" link

**Interactions:**
- Click accountant name → View accountant profile and tasks
- [View Details] → Open team performance report
- Hover on progress bar → Show task breakdown tooltip

**Data Updates:**
- Real-time progress updates
- Color coding based on workload/performance

---

### 8. Recent Messages Widget
```
┌──────────────────────────────────────┐
│  💬 RECENT MESSAGES                  │
├──────────────────────────────────────┤
│  From: PT Maju Jaya                  │
│  "When will the filing be ready?"    │
│  5 mins ago                          │
│  [Reply]                             │
│                                      │
│  [View All Messages (12)]            │
└──────────────────────────────────────┘
```

**Components:**
- Message list (max 3 visible)
- Each message shows:
  - Sender name
  - Message preview (truncated)
  - Timestamp
  - [Reply] button
- Unread indicator
- "View All" link with count

**Interactions:**
- [Reply] → Open messaging modal
- Click message → Open full conversation
- [View All] → Navigate to messages page
- Auto-refresh for new messages

---

## Responsive Behavior

### Desktop (> 1200px)
- Full layout as shown above
- 3-column layout for bottom section
- All widgets visible

### Tablet (768px - 1200px)
- 2-column layout
- Stack urgent actions above filings table
- Collapse sidebar widgets below main content
- Reduce KPI cards to 2 columns

### Mobile (< 768px)
- Single column layout
- KPI cards stack vertically (2x2 grid)
- Hide team performance widget
- Show only top 2 urgent actions
- Simplified table view (cards instead of table)
- Bottom navigation bar appears

---

## Accessibility

### Keyboard Navigation
- Tab order: Header nav → KPIs → Urgent actions → Filings table
- Enter/Space to activate buttons
- Arrow keys for table navigation
- Esc to close modals

### Screen Readers
- ARIA labels for all icons
- Status announcements for updates
- Table headers properly marked
- Alert region for urgent actions

### Visual
- High contrast mode support
- Color blind safe palette
- Minimum 16px font size
- 44px minimum touch target

---

## State Management

### Loading States
- Skeleton screens for each section
- Loading spinners for data refresh
- Progressive loading (KPIs → Urgent → Filings → Widgets)

### Empty States
- "No urgent actions" → Show success message
- "No active filings" → Show "Create First Filing" CTA
- "No messages" → Show illustration

### Error States
- Failed data load → Show retry button
- Network error → Show offline mode
- Action failure → Show error toast

---

## Performance Considerations

### Initial Load
- Critical CSS inline
- Lazy load widgets below fold
- Preload KPI data
- Cache dashboard layout

### Real-time Updates
- WebSocket connection for live data
- Debounce search inputs (300ms)
- Throttle scroll events
- Batch status updates

### Data Refresh
- KPIs: Every 5 minutes
- Urgent actions: Every 30 seconds
- Messages: Real-time push
- Filings table: On user action or 2 minutes

---

## Integration Points

### API Endpoints
- `GET /api/v1/dashboard/summary` - KPI data
- `GET /api/v1/dashboard/urgent-actions` - Urgent items
- `GET /api/v1/dashboard/filings?status=active` - Active filings
- `GET /api/v1/dashboard/team-performance` - Team metrics
- `GET /api/v1/messages/recent` - Recent messages
- `GET /api/v1/dashboard/deadlines` - Upcoming deadlines

### WebSocket Events
- `filing:status-updated`
- `message:received`
- `deadline:approaching`
- `task:completed`

---

## Related Documentation
- [User Flows - Tax Consultant](/Users/tommy/git/ai-pajak/docs/02-design/ui-ux/user-flows.md)
- [Dashboard Screen Spec](/Users/tommy/git/ai-pajak/docs/02-design/ui-ux/screens/dashboard.md)
- [Dashboard API](/Users/tommy/git/ai-pajak/docs/02-design/api/endpoints/dashboard-api.md)
- [Design System](/Users/tommy/git/ai-pajak/docs/02-design/ui-ux/design-system.md)

---

**Wireframe Version:** 1.0
**Last Updated:** 2025-12-23
**Designer:** Product Design Team
**Status:** Draft for Review
