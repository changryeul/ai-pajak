/**
 * Dashboard Types for Story 1-6
 * @module dashboard.types
 */

/**
 * Represents an urgent tax case requiring immediate attention
 */
export interface UrgentCase {
  /** Unique case identifier */
  id: string;
  /** Customer/company name */
  customerName: string;
  /** Tax type (e.g., "PPh 21", "PPN") */
  taxType: string;
  /** Days until deadline (negative = overdue) */
  daysUntilDeadline: number;
  /** Current workflow status */
  status: string;
}

/**
 * Represents a single activity event in the timeline
 */
export interface ActivityItem {
  /** Unique activity identifier */
  id: string;
  /** ISO timestamp of the activity */
  timestamp: string;
  /** Customer/company name involved */
  customerName: string;
  /** Type of activity */
  action: 'status_change' | 'document_upload' | 'approved' | 'rejected';
  /** Human-readable description of the activity */
  details: string;
}

/**
 * Distribution of tax cases across workflow stages
 */
export interface StatusDistribution {
  /** Cases in UPLOADED stage */
  uploaded: number;
  /** Cases in AI_ANALYZED stage */
  aiAnalyzed: number;
  /** Cases in HUMAN_REVIEW stage */
  humanReview: number;
  /** Cases in APPROVED stage */
  approved: number;
  /** Cases in FILED stage */
  filed: number;
}

/**
 * Complete dashboard statistics for a user
 */
export interface DashboardStats {
  /** Total number of customers managed */
  totalCustomers: number;
  /** Distribution of cases by status */
  statusDistribution: StatusDistribution;
  /** List of urgent cases (D-3 or less) */
  urgentCases: UrgentCase[];
  /** Recent activity timeline (last 7 days) */
  recentActivities: ActivityItem[];
}

/**
 * @deprecated Use UserRole from '@/config/navigation' instead.
 * This type is kept for backward compatibility but should not be used in new code.
 */
export type DashboardRole = 'CONSULTANT_JTC' | 'TAX_ADVISOR_JTC';
