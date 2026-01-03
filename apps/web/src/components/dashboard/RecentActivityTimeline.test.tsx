import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecentActivityTimeline } from './RecentActivityTimeline';
import type { ActivityItem } from '@/types/dashboard.types';

// Mock date for consistent testing
const mockNow = new Date('2026-01-03T14:30:00Z');

const mockActivities: ActivityItem[] = [
  {
    id: 'act-001',
    timestamp: '2026-01-03T14:00:00Z', // Today
    customerName: 'PT ABC Industries',
    action: 'status_change',
    details: 'Status changed: AI_ANALYZED → HUMAN_REVIEW',
  },
  {
    id: 'act-002',
    timestamp: '2026-01-03T10:30:00Z', // Today
    customerName: 'CV Maju Jaya',
    action: 'document_upload',
    details: 'Document upload completed',
  },
  {
    id: 'act-003',
    timestamp: '2026-01-02T16:45:00Z', // Yesterday
    customerName: 'PT XYZ Corp',
    action: 'approved',
    details: 'Review approved',
  },
  {
    id: 'act-004',
    timestamp: '2026-01-01T09:00:00Z', // 2 days ago
    customerName: 'PT Delta Corp',
    action: 'rejected',
    details: 'Rejected due to missing documents',
  },
];

describe('RecentActivityTimeline Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Empty State', () => {
    it('renders empty state message when no activities', () => {
      render(<RecentActivityTimeline activities={[]} />);

      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
      expect(screen.getByText('No activity in the last 7 days.')).toBeInTheDocument();
    });
  });

  describe('With Activities', () => {
    it('renders all activities', () => {
      render(<RecentActivityTimeline activities={mockActivities} />);

      expect(screen.getByText('PT ABC Industries')).toBeInTheDocument();
      expect(screen.getByText('CV Maju Jaya')).toBeInTheDocument();
      expect(screen.getByText('PT XYZ Corp')).toBeInTheDocument();
      expect(screen.getByText('PT Delta Corp')).toBeInTheDocument();
    });

    it('displays activity details', () => {
      render(<RecentActivityTimeline activities={mockActivities} />);

      expect(
        screen.getByText('Status changed: AI_ANALYZED → HUMAN_REVIEW')
      ).toBeInTheDocument();
      expect(screen.getByText('Document upload completed')).toBeInTheDocument();
      expect(screen.getByText('Review approved')).toBeInTheDocument();
      expect(screen.getByText('Rejected due to missing documents')).toBeInTheDocument();
    });
  });

  describe('Date Grouping', () => {
    it('groups activities by date with "Today" label', () => {
      const todayActivities: ActivityItem[] = [
        {
          id: 'act-today',
          timestamp: '2026-01-03T12:00:00Z',
          customerName: 'Test Company',
          action: 'approved',
          details: 'Test details',
        },
      ];

      render(<RecentActivityTimeline activities={todayActivities} />);

      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('groups activities with "Yesterday" label', () => {
      const yesterdayActivities: ActivityItem[] = [
        {
          id: 'act-yesterday',
          timestamp: '2026-01-02T12:00:00Z',
          customerName: 'Test Company',
          action: 'approved',
          details: 'Test details',
        },
      ];

      render(<RecentActivityTimeline activities={yesterdayActivities} />);

      expect(screen.getByText('Yesterday')).toBeInTheDocument();
    });

    it('uses date format for older dates', () => {
      const oldActivities: ActivityItem[] = [
        {
          id: 'act-old',
          timestamp: '2025-12-25T12:00:00Z',
          customerName: 'Test Company',
          action: 'approved',
          details: 'Test details',
        },
      ];

      render(<RecentActivityTimeline activities={oldActivities} />);

      // Should show "Dec 25" format (en-US locale)
      expect(screen.getByText('Dec 25')).toBeInTheDocument();
    });
  });

  describe('Activity Types', () => {
    it('renders status_change activity', () => {
      const activities: ActivityItem[] = [
        {
          id: 'act-1',
          timestamp: '2026-01-03T12:00:00Z',
          customerName: 'Test Co',
          action: 'status_change',
          details: 'Status changed',
        },
      ];

      render(<RecentActivityTimeline activities={activities} />);
      expect(screen.getByText('Status changed')).toBeInTheDocument();
    });

    it('renders document_upload activity', () => {
      const activities: ActivityItem[] = [
        {
          id: 'act-1',
          timestamp: '2026-01-03T12:00:00Z',
          customerName: 'Test Co',
          action: 'document_upload',
          details: 'Document uploaded',
        },
      ];

      render(<RecentActivityTimeline activities={activities} />);
      expect(screen.getByText('Document uploaded')).toBeInTheDocument();
    });

    it('renders approved activity', () => {
      const activities: ActivityItem[] = [
        {
          id: 'act-1',
          timestamp: '2026-01-03T12:00:00Z',
          customerName: 'Test Co',
          action: 'approved',
          details: 'Approved',
        },
      ];

      render(<RecentActivityTimeline activities={activities} />);
      expect(screen.getByText('Approved')).toBeInTheDocument();
    });

    it('renders rejected activity', () => {
      const activities: ActivityItem[] = [
        {
          id: 'act-1',
          timestamp: '2026-01-03T12:00:00Z',
          customerName: 'Test Co',
          action: 'rejected',
          details: 'Rejected',
        },
      ];

      render(<RecentActivityTimeline activities={activities} />);
      expect(screen.getByText('Rejected')).toBeInTheDocument();
    });
  });

  describe('Activity Colors', () => {
    it('applies blue color for status_change', () => {
      const activities: ActivityItem[] = [
        {
          id: 'act-1',
          timestamp: '2026-01-03T12:00:00Z',
          customerName: 'Test Co',
          action: 'status_change',
          details: 'Changed',
        },
      ];

      const { container } = render(<RecentActivityTimeline activities={activities} />);
      expect(container.querySelector('.text-blue-500')).toBeInTheDocument();
    });

    it('applies purple color for document_upload', () => {
      const activities: ActivityItem[] = [
        {
          id: 'act-1',
          timestamp: '2026-01-03T12:00:00Z',
          customerName: 'Test Co',
          action: 'document_upload',
          details: 'Uploaded',
        },
      ];

      const { container } = render(<RecentActivityTimeline activities={activities} />);
      expect(container.querySelector('.text-purple-500')).toBeInTheDocument();
    });

    it('applies green color for approved', () => {
      const activities: ActivityItem[] = [
        {
          id: 'act-1',
          timestamp: '2026-01-03T12:00:00Z',
          customerName: 'Test Co',
          action: 'approved',
          details: 'Approved',
        },
      ];

      const { container } = render(<RecentActivityTimeline activities={activities} />);
      expect(container.querySelector('.text-green-500')).toBeInTheDocument();
    });

    it('applies destructive color for rejected', () => {
      const activities: ActivityItem[] = [
        {
          id: 'act-1',
          timestamp: '2026-01-03T12:00:00Z',
          customerName: 'Test Co',
          action: 'rejected',
          details: 'Rejected',
        },
      ];

      const { container } = render(<RecentActivityTimeline activities={activities} />);
      expect(container.querySelector('.text-destructive')).toBeInTheDocument();
    });
  });

  describe('Timeline Structure', () => {
    it('renders timeline with border', () => {
      const { container } = render(<RecentActivityTimeline activities={mockActivities} />);

      expect(container.querySelector('.border-l-2')).toBeInTheDocument();
    });

    it('renders header with Activity title', () => {
      render(<RecentActivityTimeline activities={mockActivities} />);

      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });
  });
});
