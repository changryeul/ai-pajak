import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';

// Wrap component with Router for useNavigate
const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

// Mock date for consistent testing
const mockNow = new Date('2026-01-03T14:30:00Z');

describe('DashboardPage Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Page Header', () => {
    it('renders Dashboard title for all roles', () => {
      renderWithRouter(<DashboardPage userRole="CONSULTANT_JTC" />);
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('shows consultant-specific description for CONSULTANT_JTC', () => {
      renderWithRouter(<DashboardPage userRole="CONSULTANT_JTC" />);
      expect(
        screen.getByText('Review the tax processing status for your assigned customers.')
      ).toBeInTheDocument();
    });

    it('shows advisor-specific description for TAX_ADVISOR_JTC', () => {
      renderWithRouter(<DashboardPage userRole="TAX_ADVISOR_JTC" />);
      expect(screen.getByText('Review approval and submission status.')).toBeInTheDocument();
    });
  });

  describe('Consultant Dashboard (CONSULTANT_JTC)', () => {
    it('renders consultant-focused stat cards', () => {
      renderWithRouter(<DashboardPage userRole="CONSULTANT_JTC" />);

      expect(screen.getByText('Assigned Customers')).toBeInTheDocument();
      expect(screen.getByText('Pending Review')).toBeInTheDocument();
      expect(screen.getByText('AI Analyzing')).toBeInTheDocument();
      expect(screen.getByText('Filed')).toBeInTheDocument();
    });

    it('displays mock data values', () => {
      renderWithRouter(<DashboardPage userRole="CONSULTANT_JTC" />);

      // From consultantDashboardMock
      expect(screen.getByText('35')).toBeInTheDocument(); // totalCustomers
      expect(screen.getByText('12')).toBeInTheDocument(); // humanReview
      expect(screen.getByText('5')).toBeInTheDocument(); // aiAnalyzed
      expect(screen.getByText('7')).toBeInTheDocument(); // filed
    });

    it('renders UrgentCasesPanel', () => {
      renderWithRouter(<DashboardPage userRole="CONSULTANT_JTC" />);

      expect(screen.getByText('Urgent Cases')).toBeInTheDocument();
      // PT ABC Industries appears in both UrgentCasesPanel and RecentActivityTimeline
      const elements = screen.getAllByText('PT ABC Industries');
      expect(elements.length).toBeGreaterThan(0);
    });

    it('renders RecentActivityTimeline', () => {
      renderWithRouter(<DashboardPage userRole="CONSULTANT_JTC" />);

      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });
  });

  describe('Tax Advisor Dashboard (TAX_ADVISOR_JTC)', () => {
    it('renders advisor-focused stat cards', () => {
      renderWithRouter(<DashboardPage userRole="TAX_ADVISOR_JTC" />);

      expect(screen.getByText('Pending Approval')).toBeInTheDocument();
      expect(screen.getByText('Ready to File')).toBeInTheDocument();
      expect(screen.getByText('Filed')).toBeInTheDocument();
      expect(screen.getByText('Due Soon')).toBeInTheDocument();
    });

    it('displays advisor mock data values', () => {
      renderWithRouter(<DashboardPage userRole="TAX_ADVISOR_JTC" />);

      // From advisorDashboardMock
      expect(screen.getByText('24')).toBeInTheDocument(); // humanReview
      expect(screen.getByText('18')).toBeInTheDocument(); // approved
      expect(screen.getByText('91')).toBeInTheDocument(); // filed
    });

    it('renders advisor-specific urgent cases', () => {
      renderWithRouter(<DashboardPage userRole="TAX_ADVISOR_JTC" />);

      // PT Mega Holdings appears in both UrgentCasesPanel and RecentActivityTimeline
      const elements = screen.getAllByText('PT Mega Holdings');
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  describe('Non-JTC Roles (CUSTOMER, PLATFORM_ADMIN)', () => {
    it('renders simplified dashboard for CUSTOMER', () => {
      renderWithRouter(<DashboardPage userRole="CUSTOMER" />);

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Upcoming Deadline')).toBeInTheDocument();
    });

    it('shows welcome message with userName for CUSTOMER', () => {
      renderWithRouter(<DashboardPage userRole="CUSTOMER" userName="John" />);

      expect(
        screen.getByText('Welcome, John! Check your tax filing status.')
      ).toBeInTheDocument();
    });

    it('shows default "User" when userName not provided', () => {
      renderWithRouter(<DashboardPage userRole="CUSTOMER" />);

      expect(
        screen.getByText('Welcome, User! Check your tax filing status.')
      ).toBeInTheDocument();
    });

    it('renders simplified dashboard for PLATFORM_ADMIN', () => {
      renderWithRouter(<DashboardPage userRole="PLATFORM_ADMIN" />);

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    it('does not render UrgentCasesPanel for non-JTC roles', () => {
      renderWithRouter(<DashboardPage userRole="CUSTOMER" />);

      // Should not have urgent cases panel
      expect(screen.queryByText('Urgent Cases')).not.toBeInTheDocument();
    });

    it('does not render RecentActivityTimeline for non-JTC roles', () => {
      renderWithRouter(<DashboardPage userRole="CUSTOMER" />);

      expect(screen.queryByText('Recent Activity')).not.toBeInTheDocument();
    });
  });

  describe('Responsive Grid', () => {
    it('renders 4-column grid for JTC dashboard stats', () => {
      const { container } = renderWithRouter(<DashboardPage userRole="CONSULTANT_JTC" />);

      const statsGrid = container.querySelector('.lg\\:grid-cols-4');
      expect(statsGrid).toBeInTheDocument();
    });

    it('renders 3-column grid for non-JTC dashboard stats', () => {
      const { container } = renderWithRouter(<DashboardPage userRole="CUSTOMER" />);

      const statsGrid = container.querySelector('.lg\\:grid-cols-3');
      expect(statsGrid).toBeInTheDocument();
    });

    it('renders 2-column grid for main content panels', () => {
      const { container } = renderWithRouter(<DashboardPage userRole="CONSULTANT_JTC" />);

      const contentGrid = container.querySelector('.lg\\:grid-cols-2');
      expect(contentGrid).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles unknown role gracefully with fallback data', () => {
      // SYSTEM role should use default mock data
      renderWithRouter(<DashboardPage userRole="SYSTEM" />);

      // Should render without crashing
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  describe('Stat Card Variants', () => {
    it('applies urgent variant when humanReview exceeds threshold for consultant', () => {
      const { container } = renderWithRouter(<DashboardPage userRole="CONSULTANT_JTC" />);

      // With 12 cases in humanReview (> 10 threshold), should have urgent styling
      const urgentCards = container.querySelectorAll('.border-destructive\\/50');
      expect(urgentCards.length).toBeGreaterThan(0);
    });

    it('applies success variant to Filed stat card', () => {
      const { container } = renderWithRouter(<DashboardPage userRole="CONSULTANT_JTC" />);

      const successCards = container.querySelectorAll('.border-green-500\\/50');
      expect(successCards.length).toBeGreaterThan(0);
    });
  });
});
