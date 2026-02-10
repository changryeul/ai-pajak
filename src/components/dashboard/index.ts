/**
 * Dashboard Components
 *
 * Role-based dashboard widgets for AI Pajak
 *
 * Customer Widgets:
 * - POAStatusWidget - POA status and actions
 * - FilingSummaryWidget - Recent tax filings summary
 * - DeadlineCalendar - Upcoming tax deadlines
 *
 * Consultant Widgets:
 * - ClientList - Multi-client management
 * - UrgentActionsPanel - Priority actions requiring attention
 * - DeadlineCalendar - Tax deadlines across all clients
 *
 * Platform Admin Widgets:
 * - PlatformStats - Anonymized platform metrics (NO tax data access)
 */

export { POAStatusWidget } from './POAStatusWidget';
export { FilingSummaryWidget } from './FilingSummaryWidget';
export { DeadlineCalendar } from './DeadlineCalendar';
export { ClientList } from './ClientList';
export { UrgentActionsPanel } from './UrgentActionsPanel';
export { PlatformStats } from './PlatformStats';
