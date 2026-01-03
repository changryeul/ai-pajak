// Dashboard Mock Data for Story 1-6
import type { DashboardStats, UrgentCase, ActivityItem } from '@/types/dashboard.types';

// Helper to generate timestamps
const now = new Date();
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3600000).toISOString();
const daysAgo = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();

// Consultant Dashboard Mock Data
export const consultantDashboardMock: DashboardStats = {
  totalCustomers: 35,
  statusDistribution: {
    uploaded: 3,
    aiAnalyzed: 5,
    humanReview: 12,
    approved: 8,
    filed: 7,
  },
  urgentCases: [
    {
      id: 'tc-001',
      customerName: 'PT ABC Industries',
      taxType: 'PPh 21',
      daysUntilDeadline: 1,
      status: 'HUMAN_REVIEW',
    },
    {
      id: 'tc-002',
      customerName: 'CV Maju Jaya',
      taxType: 'PPh 23',
      daysUntilDeadline: 2,
      status: 'APPROVED',
    },
    {
      id: 'tc-003',
      customerName: 'PT XYZ Corp',
      taxType: 'PPN',
      daysUntilDeadline: 3,
      status: 'AI_ANALYZED',
    },
  ],
  recentActivities: [
    {
      id: 'act-001',
      timestamp: hoursAgo(0.5),
      customerName: 'PT ABC Industries',
      action: 'status_change',
      details: 'Status changed: AI_ANALYZED → HUMAN_REVIEW',
    },
    {
      id: 'act-002',
      timestamp: hoursAgo(2),
      customerName: 'CV Maju Jaya',
      action: 'document_upload',
      details: 'Document upload completed',
    },
    {
      id: 'act-003',
      timestamp: hoursAgo(5),
      customerName: 'PT Sentosa Abadi',
      action: 'approved',
      details: 'Review approved',
    },
    {
      id: 'act-004',
      timestamp: daysAgo(1),
      customerName: 'PT XYZ Corp',
      action: 'status_change',
      details: 'Status changed: UPLOADED → AI_ANALYZED',
    },
    {
      id: 'act-005',
      timestamp: daysAgo(1),
      customerName: 'CV Prima Mandiri',
      action: 'document_upload',
      details: 'Tax invoice uploaded',
    },
    {
      id: 'act-006',
      timestamp: daysAgo(2),
      customerName: 'PT Global Tech',
      action: 'approved',
      details: 'PPh 21 approval completed',
    },
    {
      id: 'act-007',
      timestamp: daysAgo(3),
      customerName: 'PT Delta Corp',
      action: 'rejected',
      details: 'Rejected due to missing documents',
    },
  ],
};

// Tax Advisor Dashboard Mock Data
export const advisorDashboardMock: DashboardStats = {
  totalCustomers: 156,
  statusDistribution: {
    uploaded: 8,
    aiAnalyzed: 15,
    humanReview: 24,
    approved: 18,
    filed: 91,
  },
  urgentCases: [
    {
      id: 'tc-101',
      customerName: 'PT Mega Holdings',
      taxType: 'PPh 21',
      daysUntilDeadline: 0,
      status: 'APPROVED',
    },
    {
      id: 'tc-102',
      customerName: 'CV Berkah Sejahtera',
      taxType: 'PPN',
      daysUntilDeadline: 1,
      status: 'APPROVED',
    },
    {
      id: 'tc-103',
      customerName: 'PT Nusantara Jaya',
      taxType: 'PPh 23',
      daysUntilDeadline: 2,
      status: 'HUMAN_REVIEW',
    },
    {
      id: 'tc-104',
      customerName: 'PT Indo Pacific',
      taxType: 'PPh 21',
      daysUntilDeadline: 3,
      status: 'APPROVED',
    },
    {
      id: 'tc-105',
      customerName: 'CV Usaha Mandiri',
      taxType: 'PPN',
      daysUntilDeadline: -1,
      status: 'APPROVED',
    },
  ],
  recentActivities: [
    {
      id: 'adv-act-001',
      timestamp: hoursAgo(1),
      customerName: 'PT Mega Holdings',
      action: 'approved',
      details: 'PPh 21 final approval',
    },
    {
      id: 'adv-act-002',
      timestamp: hoursAgo(3),
      customerName: 'CV Berkah Sejahtera',
      action: 'status_change',
      details: 'Status changed: HUMAN_REVIEW → APPROVED',
    },
    {
      id: 'adv-act-003',
      timestamp: hoursAgo(6),
      customerName: 'PT Global Finance',
      action: 'status_change',
      details: 'Status changed: APPROVED → FILED',
    },
    {
      id: 'adv-act-004',
      timestamp: daysAgo(1),
      customerName: 'PT Sukses Makmur',
      action: 'approved',
      details: 'VAT approval completed',
    },
    {
      id: 'adv-act-005',
      timestamp: daysAgo(1),
      customerName: 'CV Jaya Abadi',
      action: 'status_change',
      details: 'Status changed: APPROVED → FILED',
    },
    {
      id: 'adv-act-006',
      timestamp: daysAgo(2),
      customerName: 'PT Indah Permai',
      action: 'rejected',
      details: 'Cannot submit due to expired POA',
    },
  ],
};

// Empty state mock for testing
export const emptyDashboardMock: DashboardStats = {
  totalCustomers: 0,
  statusDistribution: {
    uploaded: 0,
    aiAnalyzed: 0,
    humanReview: 0,
    approved: 0,
    filed: 0,
  },
  urgentCases: [],
  recentActivities: [],
};

// Helper function to get mock data by role
export function getDashboardMockByRole(role: string): DashboardStats {
  switch (role) {
    case 'TAX_ADVISOR_JTC':
      return advisorDashboardMock;
    case 'CONSULTANT_JTC':
    default:
      return consultantDashboardMock;
  }
}
