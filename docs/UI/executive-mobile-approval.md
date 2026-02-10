# Executive Mobile Approval - Wireframe

## Overview
The Executive Mobile Approval interface is optimized for quick, on-the-go approvals by business executives. It features biometric authentication, streamlined review process, and digital signature capabilities.

---

## Device Specifications
- **Target Devices:** iOS (iPhone 12+), Android (Pixel 6+)
- **Screen Sizes:** 375px - 428px width
- **Orientation:** Portrait (primary), Landscape (supported)
- **OS Requirements:** iOS 15+, Android 12+
- **Biometric:** Face ID, Touch ID, Fingerprint

---

## Screen Flows

### Flow 1: Push Notification to Approval

```
┌──────────────────────┐
│   NOTIFICATION       │
├──────────────────────┤
│  📱 AI-Pajak         │
│                      │
│  ✓ Tax Filing Ready  │
│  PT Maju Jaya -      │
│  PPh 21 Dec 2025     │
│                      │
│  Tax: Rp 62.5M       │
│  Due: Dec 25         │
│                      │
│  [View] [Dismiss]    │
└──────────────────────┘
        ↓
    [Tap View]
        ↓
┌──────────────────────┐
│   BIOMETRIC AUTH     │
├──────────────────────┤
│                      │
│      👤              │
│   Face ID            │
│                      │
│  Authenticate to     │
│  view sensitive      │
│  tax information     │
│                      │
│  [Cancel]            │
└──────────────────────┘
        ↓
   [Face Scan]
        ↓
┌──────────────────────┐
│  APPROVAL SCREEN     │
│  (See detailed       │
│   wireframes below)  │
└──────────────────────┘
```

---

## Main Screen: Approval Home

```
┌─────────────────────────────────┐
│ ←  AI-Pajak              🔔 ⚙  │ ← Header (60px)
├─────────────────────────────────┤
│                                 │
│  👋 Hi, Pak Wijaya             │
│  You have 3 pending approvals   │
│                                 │
│  ┌────────────────────────────┐│
│  │ 🚨 URGENT (1)              ││
│  │                            ││
│  │ PT Maju Jaya               ││
│  │ PPh 21 - December 2025     ││
│  │                            ││
│  │ Tax Amount: Rp 62,500,000  ││
│  │ Due Date: Dec 25 (2 days)  ││
│  │                            ││
│  │ Prepared by: Siti Wijaya   ││
│  │ Status: Ready for Approval ││
│  │                            ││
│  │      [REVIEW & APPROVE]    ││
│  └────────────────────────────┘│
│                                 │
│  ┌────────────────────────────┐│
│  │ ⏰ PENDING (2)             ││
│  │                            ││
│  │ CV Sukses Makmur           ││
│  │ PPN - December 2025        ││
│  │ Tax: Rp 45.2M | Due: Dec 28││
│  │ [Review →]                 ││
│  ├────────────────────────────┤│
│  │ UD Berkah                  ││
│  │ PPh Badan - Dec 2025       ││
│  │ Tax: Rp 128M | Due: Dec 31 ││
│  │ [Review →]                 ││
│  └────────────────────────────┘│
│                                 │
│  ┌────────────────────────────┐│
│  │ ✓ APPROVED THIS WEEK (5)   ││
│  │ [View History →]           ││
│  └────────────────────────────┘│
│                                 │
├─────────────────────────────────┤
│  🏠  📋  ✓  👤                 │ ← Bottom Nav
└─────────────────────────────────┘
```

### Component Details: Approval Home

#### Header
- Back button (if navigated from notification)
- App logo/title
- Notification bell (with badge count)
- Settings gear icon

#### Greeting Card
- Personalized greeting
- Pending count summary
- Time-based greeting (Good morning/afternoon)

#### Urgent Approval Card
- Red accent border
- Company name (bold, 18px)
- Tax type and period
- Tax amount (prominent, 20px)
- Due date with countdown
- Accountant name
- Status indicator
- Primary CTA button (full width)

#### Pending Approvals List
- Compact card design
- Essential info only
- Right arrow for navigation
- Swipe left for quick actions

#### Bottom Navigation
- Home
- Approvals list
- Approved history
- Profile

---

## Detail Screen: Quick Review View

```
┌─────────────────────────────────┐
│ ←  PT Maju Jaya           ⋮     │
├─────────────────────────────────┤
│ ⚡ Quick Review Mode            │
│ [Switch to Detailed View →]     │
├─────────────────────────────────┤
│                                 │
│  📊 TAX FILING SUMMARY          │
│  ┌────────────────────────────┐│
│  │ Tax Type:     PPh 21       ││
│  │ Period:       Dec 2025     ││
│  │ Due Date:     Dec 25, 2025 ││
│  │ Status:       Ready        ││
│  │ Filing ID:    #TF-2025-1245││
│  └────────────────────────────┘│
│                                 │
│  💰 FINANCIAL SUMMARY           │
│  ┌────────────────────────────┐│
│  │ Gross Income: 1,308,000,000││
│  │ Deductions:      58,000,000││
│  │ ───────────────────────────││
│  │ Taxable:      1,250,000,000││
│  │ Tax Rate:              5.0%││
│  │ ═══════════════════════════││
│  │ Tax Due:         62,500,000││
│  │                            ││
│  │ Variance vs Last Month:    ││
│  │ ↗ +12% (within normal)     ││
│  └────────────────────────────┘│
│                                 │
│  ✓ VALIDATION CHECKS (12/12)   │
│  ┌────────────────────────────┐│
│  │ ✓ All documents verified   ││
│  │ ✓ Calculations accurate    ││
│  │ ✓ Compliance rules met     ││
│  │ ✓ AI validation passed     ││
│  │ [View All Checks →]        ││
│  └────────────────────────────┘│
│                                 │
│  👥 PREPARED BY                 │
│  ┌────────────────────────────┐│
│  │ 👤 Siti Wijaya (Accountant)││
│  │ ✓ Reviewed by: Budi Santoso││
│  │    (Tax Consultant)        ││
│  │ Date: Dec 22, 2025 14:30   ││
│  └────────────────────────────┘│
│                                 │
│  📎 DOCUMENTS (8)               │
│  ┌────────────────────────────┐│
│  │ ✓ Financial Statements     ││
│  │ ✓ Payroll Records (12)     ││
│  │ ✓ Tax Calculations         ││
│  │ ✓ Supporting Receipts      ││
│  │ [View All Documents →]     ││
│  └────────────────────────────┘│
│                                 │
│ ↓ Scroll for actions ↓          │
│                                 │
├─────────────────────────────────┤
│  [✓ APPROVE]  [✗ REJECT]       │ ← Sticky Footer
└─────────────────────────────────┘
```

### Component Details: Quick Review

#### Mode Switcher
- Toggle between Quick and Detailed view
- Quick view: Summary only
- Detailed view: Full line-by-line data

#### Summary Cards
- Collapsible sections
- Color-coded indicators
- Variance highlights
- Expandable details

#### Validation Badge
- Count of passed checks
- Warning indicators if any
- Link to full validation report

#### Team Info
- Profile pictures
- Names and roles
- Approval chain visualization
- Timestamp

#### Document List
- Count badge
- Status icons
- Quick preview on tap
- Download option

#### Sticky Footer
- Always visible during scroll
- Approve (green) and Reject (red) buttons
- Equal width, high contrast

---

## Detail Screen: Full Review View

```
┌─────────────────────────────────┐
│ ←  PT Maju Jaya           ⋮     │
├─────────────────────────────────┤
│ 📊 Detailed Review Mode         │
│ [Switch to Quick View →]        │
├─────────────────────────────────┤
│                                 │
│  EMPLOYEE INCOME DATA ▼         │
│  ┌────────────────────────────┐│
│  │ Total Employees:        45 ││
│  │                            ││
│  │ Gross Salary:              ││
│  │ Rp 1,250,000,000           ││
│  │                            ││
│  │ Allowances:                ││
│  │ • Transport:    15,000,000 ││
│  │ • Meal:         18,000,000 ││
│  │ • Health:       25,000,000 ││
│  │ Total:          58,000,000 ││
│  │                            ││
│  │ Tax Withheld:              ││
│  │ Rp 62,500,000 (5.0%)       ││
│  └────────────────────────────┘│
│                                 │
│  DEDUCTIONS & CREDITS ▼         │
│  ┌────────────────────────────┐│
│  │ Standard Deductions:       ││
│  │ Rp 58,000,000              ││
│  │                            ││
│  │ Tax Credits:               ││
│  │ None                       ││
│  │                            ││
│  │ Net Tax Payable:           ││
│  │ Rp 62,500,000              ││
│  └────────────────────────────┘│
│                                 │
│  COMPARISON CHART ▼             │
│  ┌────────────────────────────┐│
│  │ Tax Amount vs Last 3 Months││
│  │                            ││
│  │ 70M ┤           ╭─●        ││
│  │     │        ╭──╯          ││
│  │ 60M ┤     ╭──╯             ││
│  │     │  ●──╯                ││
│  │ 50M ┼──●────────────────── ││
│  │     Sep Oct Nov Dec        ││
│  │                            ││
│  │ ↗ +12% from last month     ││
│  │ ✓ Within expected range   ││
│  └────────────────────────────┘│
│                                 │
│  NOTES FROM ACCOUNTANT ▼        │
│  ┌────────────────────────────┐│
│  │ Salary increase due to     ││
│  │ year-end bonuses. All      ││
│  │ documentation verified.    ││
│  │                            ││
│  │ - Siti Wijaya              ││
│  │   Dec 22, 14:30            ││
│  └────────────────────────────┘│
│                                 │
│ ↓ Scroll for more ↓             │
├─────────────────────────────────┤
│  [✓ APPROVE]  [✗ REJECT]       │
└─────────────────────────────────┘
```

### Component Details: Full Review

#### Expandable Sections
- Tap header to expand/collapse
- Arrow indicator (▼/▶)
- Default: Income data expanded, rest collapsed
- Smooth animation (300ms)

#### Data Tables
- Formatted currency values
- Right-aligned numbers
- Left-aligned labels
- Divider lines for subtotals

#### Comparison Chart
- Simple ASCII/SVG chart
- 3-month trend
- Current month highlighted
- Variance indicator with explanation

#### Notes Section
- Rich text display
- Author attribution
- Timestamp
- Read more/less for long notes

---

## Approval Flow: Approve

```
┌─────────────────────────────────┐
│      CONFIRM APPROVAL           │
├─────────────────────────────────┤
│                                 │
│  You are about to approve:      │
│                                 │
│  PT Maju Jaya                   │
│  PPh 21 - December 2025         │
│  Tax Amount: Rp 62,500,000      │
│                                 │
│  ✓ Auto-submit to DJP           │
│    immediately after approval   │
│                                 │
│  ⚠ This action cannot be undone │
│                                 │
│  ┌────────────────────────────┐│
│  │ Add Comment (Optional)     ││
│  │ ┌────────────────────────┐││
│  │ │ Approved. Looks good.  │││
│  │ │                        │││
│  │ └────────────────────────┘││
│  └────────────────────────────┘│
│                                 │
│  [CANCEL]  [CONFIRM APPROVAL]   │
└─────────────────────────────────┘
        ↓
  [Confirm Approval]
        ↓
┌─────────────────────────────────┐
│    BIOMETRIC SIGNATURE          │
├─────────────────────────────────┤
│                                 │
│         🔐                      │
│                                 │
│  Use Face ID to apply           │
│  your digital signature         │
│                                 │
│  Required for approval          │
│                                 │
│                                 │
│  [Use Passcode Instead]         │
│  [Cancel]                       │
└─────────────────────────────────┘
        ↓
    [Face ID Scan]
        ↓
┌─────────────────────────────────┐
│    PROCESSING                   │
├─────────────────────────────────┤
│                                 │
│         ⏳                      │
│                                 │
│  Applying signature...          │
│  Submitting to DJP...           │
│                                 │
│  ▓▓▓▓▓▓▓▓░░░░░░░░ 60%          │
│                                 │
└─────────────────────────────────┘
        ↓
┌─────────────────────────────────┐
│    SUCCESS                      │
├─────────────────────────────────┤
│                                 │
│         ✅                      │
│                                 │
│  Approval Successful!           │
│                                 │
│  PT Maju Jaya - PPh 21 has been │
│  approved and submitted to DJP  │
│                                 │
│  Submission ID: #DJP-2025-45678 │
│  Receipt sent to your email     │
│                                 │
│  [VIEW RECEIPT]  [DONE]         │
└─────────────────────────────────┘
```

---

## Approval Flow: Reject

```
┌─────────────────────────────────┐
│      REJECT FILING              │
├─────────────────────────────────┤
│                                 │
│  PT Maju Jaya                   │
│  PPh 21 - December 2025         │
│                                 │
│  Please provide a reason for    │
│  rejection:                     │
│                                 │
│  ┌────────────────────────────┐│
│  │ ○ Incorrect calculations   ││
│  │ ○ Missing documents        ││
│  │ ○ Need more information    ││
│  │ ● Other (specify below)    ││
│  └────────────────────────────┘│
│                                 │
│  ┌────────────────────────────┐│
│  │ Additional Comments:       ││
│  │ ┌────────────────────────┐││
│  │ │ Please verify the      │││
│  │ │ allowance calculations │││
│  │ │ for December.          │││
│  │ │                        │││
│  │ └────────────────────────┘││
│  └────────────────────────────┘│
│                                 │
│  🎤 [Voice Input]               │
│                                 │
│  [CANCEL]  [SUBMIT REJECTION]   │
└─────────────────────────────────┘
        ↓
  [Submit Rejection]
        ↓
┌─────────────────────────────────┐
│    BIOMETRIC CONFIRMATION       │
├─────────────────────────────────┤
│         🔐                      │
│  Confirm rejection with Face ID │
│  [Use Passcode]  [Cancel]       │
└─────────────────────────────────┘
        ↓
┌─────────────────────────────────┐
│    REJECTION CONFIRMED          │
├─────────────────────────────────┤
│         ℹ️                      │
│                                 │
│  Filing rejected successfully   │
│                                 │
│  Accountant and Tax Consultant  │
│  have been notified.            │
│                                 │
│  They can resubmit after making │
│  the requested changes.         │
│                                 │
│  [VIEW PENDING]  [DONE]         │
└─────────────────────────────────┘
```

---

## Additional Screens

### Screen: Document Viewer

```
┌─────────────────────────────────┐
│ ←  Financial Statement    ⋯     │
├─────────────────────────────────┤
│                                 │
│  ┌────────────────────────────┐│
│  │                            ││
│  │  [PDF/IMAGE PREVIEW]       ││
│  │                            ││
│  │  Pinch to zoom            ││
│  │  Swipe for next doc        ││
│  │                            ││
│  │                            ││
│  │                            ││
│  └────────────────────────────┘│
│                                 │
│  Page 1 of 5    [1][2][3][4][5]│
│                                 │
│  Financial Statement - Dec 2025 │
│  Uploaded: Dec 22, 2025         │
│  Size: 2.4 MB                   │
│                                 │
├─────────────────────────────────┤
│  [< Prev]  [Download]  [Next >] │
└─────────────────────────────────┘
```

### Screen: Validation Details

```
┌─────────────────────────────────┐
│ ←  Validation Report             │
├─────────────────────────────────┤
│                                 │
│  ✓ ALL CHECKS PASSED (12/12)    │
│                                 │
│  COMPLIANCE CHECKS ✓             │
│  ┌────────────────────────────┐│
│  │ ✓ NPWP format valid        ││
│  │ ✓ Tax rates correct        ││
│  │ ✓ DJP regulations met      ││
│  │ ✓ Deadline compliance      ││
│  └────────────────────────────┘│
│                                 │
│  CALCULATION CHECKS ✓            │
│  ┌────────────────────────────┐│
│  │ ✓ Income totals accurate   ││
│  │ ✓ Deductions valid         ││
│  │ ✓ Tax brackets applied     ││
│  │ ✓ Rounding correct         ││
│  └────────────────────────────┘│
│                                 │
│  DOCUMENT CHECKS ✓               │
│  ┌────────────────────────────┐│
│  │ ✓ All required docs        ││
│  │ ✓ Signatures present       ││
│  │ ✓ OCR verification         ││
│  │ ✓ Version control          ││
│  └────────────────────────────┘│
│                                 │
│  Last validated: Dec 22, 14:35  │
│  Validation score: 100%         │
│                                 │
└─────────────────────────────────┘
```

### Screen: Approval History

```
┌─────────────────────────────────┐
│ ←  Approval History       🔍     │
├─────────────────────────────────┤
│  Filter: [All ▾] [This Week ▾]  │
├─────────────────────────────────┤
│                                 │
│  THIS WEEK (5)                  │
│  ┌────────────────────────────┐│
│  │ ✓ PT Maju Jaya             ││
│  │ PPh 21 - Dec 2025          ││
│  │ Approved: Dec 23, 09:15    ││
│  │ Tax: Rp 62.5M              ││
│  │ [View Details →]           ││
│  └────────────────────────────┘│
│                                 │
│  ┌────────────────────────────┐│
│  │ ✓ CV Sukses Makmur         ││
│  │ PPN - Dec 2025             ││
│  │ Approved: Dec 22, 16:45    ││
│  │ Tax: Rp 45.2M              ││
│  │ [View Details →]           ││
│  └────────────────────────────┘│
│                                 │
│  LAST WEEK (8)                  │
│  ┌────────────────────────────┐│
│  │ ✓ UD Berkah                ││
│  │ PPh Badan - Nov 2025       ││
│  │ Approved: Dec 18, 14:20    ││
│  │ [View Details →]           ││
│  └────────────────────────────┘│
│                                 │
│  [Load More]                    │
│                                 │
└─────────────────────────────────┘
```

---

## Gestures & Interactions

### Swipe Gestures
- **Swipe left on card** → Quick actions (Approve/Reject/Defer)
- **Swipe right** → Back navigation
- **Swipe down on document** → Close viewer
- **Swipe left/right on document** → Previous/Next document

### Tap Interactions
- **Tap card** → Open detail view
- **Tap section header** → Expand/collapse
- **Long press on amount** → Copy to clipboard
- **Double tap document** → Zoom in/out

### Pull to Refresh
- **Pull down on list** → Refresh approvals
- Loading indicator appears
- Haptic feedback on release

---

## Biometric Authentication

### Face ID Flow
1. Prompt appears with Face ID icon
2. User looks at device
3. Success: Green checkmark + haptic
4. Failure: Retry (max 3 attempts)
5. Fallback: Passcode entry

### Touch ID/Fingerprint Flow
1. Prompt with fingerprint icon
2. User touches sensor
3. Success/Failure same as Face ID

### Passcode Fallback
```
┌─────────────────────────────────┐
│    ENTER PASSCODE               │
├─────────────────────────────────┤
│                                 │
│  ● ● ● ○ ○ ○                   │
│                                 │
│  ┌─────┬─────┬─────┐           │
│  │  1  │  2  │  3  │           │
│  ├─────┼─────┼─────┤           │
│  │  4  │  5  │  6  │           │
│  ├─────┼─────┼─────┤           │
│  │  7  │  8  │  9  │           │
│  ├─────┼─────┼─────┤           │
│  │     │  0  │  ⌫  │           │
│  └─────┴─────┴─────┘           │
│                                 │
│  [Cancel]                       │
└─────────────────────────────────┘
```

---

## Offline Mode

### Offline Indicator
```
┌─────────────────────────────────┐
│  ⚠ You are offline              │
│  Approvals require connection   │
│  [Retry]  [View Cached]         │
└─────────────────────────────────┘
```

### Cached Data
- Last 10 pending approvals
- Approved history (last 30 days)
- User profile and settings
- Cannot approve/reject while offline
- Queue actions when back online

---

## Push Notification Types

### Approval Request
```
📱 AI-Pajak
✓ Tax Filing Ready for Approval
PT Maju Jaya - PPh 21
Tax: Rp 62.5M | Due: Dec 25
Tap to review
```

### Deadline Reminder
```
📱 AI-Pajak
⏰ Approval Due in 1 Day
PT Maju Jaya - PPh 21
Please review before Dec 24
Tap to review
```

### Submission Success
```
📱 AI-Pajak
✅ Successfully Submitted
PT Maju Jaya - PPh 21
Submission ID: #DJP-2025-45678
View receipt
```

### Rejection Acknowledged
```
📱 AI-Pajak
ℹ️ Rejection Acknowledged
PT Maju Jaya filing updated
Accountant is making revisions
View status
```

---

## Accessibility Features

### VoiceOver/TalkBack Support
- All UI elements properly labeled
- Status announcements for approvals
- Currency amounts spelled out
- Gesture alternatives for swipe actions

### Visual Accessibility
- Large text support (up to 200%)
- High contrast mode
- Reduce motion option
- Color blind safe palette

### Physical Accessibility
- Large tap targets (44x44px minimum)
- Voice input for comments
- Alternative to biometric (passcode)
- Haptic feedback for confirmations

---

## Performance Considerations

### Initial Load
- Splash screen (max 2 seconds)
- Preload pending approvals
- Lazy load document thumbnails
- Progressive image loading

### Responsiveness
- 60 FPS animations
- Instant UI feedback (<100ms)
- Optimistic UI updates
- Background sync

### Battery Optimization
- Throttle location services
- Reduce background refresh
- Efficient push notifications
- Dark mode support

---

## Security Features

### Session Management
- Auto-lock after 5 minutes inactive
- Biometric re-auth for sensitive actions
- Secure storage for credentials
- Clear data on logout

### Data Protection
- End-to-end encryption for documents
- TLS 1.3 for API calls
- Certificate pinning
- No sensitive data in screenshots

### Audit Trail
- All approvals logged with biometric signature
- IP address and device info recorded
- Timestamp with timezone
- Cannot be repudiated

---

## Error Handling

### Network Errors
```
┌─────────────────────────────────┐
│  ⚠ Connection Error             │
│  Could not load approval data   │
│  [Retry]  [View Offline]        │
└─────────────────────────────────┘
```

### Biometric Errors
```
┌─────────────────────────────────┐
│  ⚠ Face ID Not Recognized       │
│  Attempts remaining: 2           │
│  [Try Again]  [Use Passcode]    │
└─────────────────────────────────┘
```

### Submission Errors
```
┌─────────────────────────────────┐
│  ⛔ Submission Failed            │
│  DJP system temporarily         │
│  unavailable. Retry?            │
│  [Retry]  [Cancel]              │
└─────────────────────────────────┘
```

---

## Integration Points

### API Endpoints
- `GET /api/v1/mobile/approvals/pending` - Pending approvals
- `GET /api/v1/mobile/approvals/{id}` - Approval details
- `POST /api/v1/mobile/approvals/{id}/approve` - Submit approval
- `POST /api/v1/mobile/approvals/{id}/reject` - Submit rejection
- `GET /api/v1/mobile/approvals/history` - Approval history
- `POST /api/v1/mobile/auth/biometric` - Verify biometric signature

### Push Notifications
- Firebase Cloud Messaging (Android)
- Apple Push Notification Service (iOS)
- Delivery receipts tracked
- Silent notifications for sync

### Analytics Events
- `approval_viewed`
- `approval_approved`
- `approval_rejected`
- `biometric_used`
- `document_opened`
- `error_encountered`

---

## Related Documentation
- [User Flows - Executive](/Users/tommy/git/ai-pajak/docs/02-design/ui-ux/user-flows.md)
- [Mobile Design System](/Users/tommy/git/ai-pajak/docs/02-design/ui-ux/design-system.md)
- [Authentication API](/Users/tommy/git/ai-pajak/docs/02-design/api/authentication.md)
- [Approval API](/Users/tommy/git/ai-pajak/docs/02-design/api/endpoints/approval-api.md)
- [Security Specifications](/Users/tommy/git/ai-pajak/docs/03-technical/security.md)

---

**Wireframe Version:** 1.0
**Last Updated:** 2025-12-23
**Designer:** Product Design Team
**Platform:** iOS & Android
**Status:** Draft for Review
