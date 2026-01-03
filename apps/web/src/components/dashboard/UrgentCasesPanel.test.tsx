import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UrgentCasesPanel } from './UrgentCasesPanel';
import type { UrgentCase } from '@/types/dashboard.types';

const mockCases: UrgentCase[] = [
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
    daysUntilDeadline: 3,
    status: 'APPROVED',
  },
  {
    id: 'tc-003',
    customerName: 'PT XYZ Corp',
    taxType: 'PPN',
    daysUntilDeadline: 0,
    status: 'AI_ANALYZED',
  },
];

describe('UrgentCasesPanel Component', () => {
  describe('Empty State', () => {
    it('renders empty state message when no cases', () => {
      render(<UrgentCasesPanel cases={[]} />);

      expect(screen.getByText('Urgent Cases')).toBeInTheDocument();
      expect(
        screen.getByText('No urgent cases requiring immediate attention.')
      ).toBeInTheDocument();
    });

    it('does not show case count badge when empty', () => {
      render(<UrgentCasesPanel cases={[]} />);

      // Should not show the badge with count like "3 cases"
      expect(screen.queryByText(/\d+ case/)).not.toBeInTheDocument();
    });
  });

  describe('With Cases', () => {
    it('renders all urgent cases', () => {
      render(<UrgentCasesPanel cases={mockCases} />);

      expect(screen.getByText('PT ABC Industries')).toBeInTheDocument();
      expect(screen.getByText('CV Maju Jaya')).toBeInTheDocument();
      expect(screen.getByText('PT XYZ Corp')).toBeInTheDocument();
    });

    it('displays correct case count badge', () => {
      render(<UrgentCasesPanel cases={mockCases} />);

      expect(screen.getByText('3 cases')).toBeInTheDocument();
    });

    it('displays singular "case" for single item', () => {
      render(<UrgentCasesPanel cases={[mockCases[0]]} />);

      expect(screen.getByText('1 case')).toBeInTheDocument();
    });

    it('displays tax type for each case', () => {
      render(<UrgentCasesPanel cases={mockCases} />);

      expect(screen.getByText('PPh 21')).toBeInTheDocument();
      expect(screen.getByText('PPh 23')).toBeInTheDocument();
      expect(screen.getByText('PPN')).toBeInTheDocument();
    });
  });

  describe('Deadline Labels', () => {
    it('displays "Due Today" for 0 days', () => {
      const todayCase: UrgentCase[] = [{ ...mockCases[0], daysUntilDeadline: 0 }];
      render(<UrgentCasesPanel cases={todayCase} />);

      expect(screen.getByText('Due Today')).toBeInTheDocument();
    });

    it('displays "D-1" format for positive days', () => {
      const case1Day: UrgentCase[] = [{ ...mockCases[0], daysUntilDeadline: 1 }];
      render(<UrgentCasesPanel cases={case1Day} />);

      expect(screen.getByText('D-1')).toBeInTheDocument();
    });

    it('displays "D-3" for 3 days until deadline', () => {
      const case3Days: UrgentCase[] = [{ ...mockCases[0], daysUntilDeadline: 3 }];
      render(<UrgentCasesPanel cases={case3Days} />);

      expect(screen.getByText('D-3')).toBeInTheDocument();
    });

    it('displays overdue message for negative days (singular)', () => {
      const overdueCase: UrgentCase[] = [{ ...mockCases[0], daysUntilDeadline: -1 }];
      render(<UrgentCasesPanel cases={overdueCase} />);

      expect(screen.getByText('1 day overdue')).toBeInTheDocument();
    });

    it('displays overdue message for negative days (plural)', () => {
      const overdueCase: UrgentCase[] = [{ ...mockCases[0], daysUntilDeadline: -3 }];
      render(<UrgentCasesPanel cases={overdueCase} />);

      expect(screen.getByText('3 days overdue')).toBeInTheDocument();
    });
  });

  describe('Click Handling', () => {
    it('calls onCaseClick with case id when button clicked', () => {
      const handleClick = vi.fn();
      render(<UrgentCasesPanel cases={mockCases} onCaseClick={handleClick} />);

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[0]);

      expect(handleClick).toHaveBeenCalledWith('tc-001');
    });

    it('calls onCaseClick for each respective case', () => {
      const handleClick = vi.fn();
      render(<UrgentCasesPanel cases={mockCases} onCaseClick={handleClick} />);

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[1]);

      expect(handleClick).toHaveBeenCalledWith('tc-002');
    });

    it('does not throw when onCaseClick is not provided', () => {
      render(<UrgentCasesPanel cases={mockCases} />);

      const buttons = screen.getAllByRole('button');
      expect(() => fireEvent.click(buttons[0])).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('has aria-label on action buttons', () => {
      render(<UrgentCasesPanel cases={mockCases} />);

      const button = screen.getByLabelText('View details for PT ABC Industries');
      expect(button).toBeInTheDocument();
    });

    it('has unique aria-labels for each case', () => {
      render(<UrgentCasesPanel cases={mockCases} />);

      expect(screen.getByLabelText('View details for PT ABC Industries')).toBeInTheDocument();
      expect(screen.getByLabelText('View details for CV Maju Jaya')).toBeInTheDocument();
      expect(screen.getByLabelText('View details for PT XYZ Corp')).toBeInTheDocument();
    });
  });

  describe('Badge Variants', () => {
    it('uses destructive variant for D-1 or less', () => {
      const urgentCase: UrgentCase[] = [{ ...mockCases[0], daysUntilDeadline: 1 }];
      const { container } = render(<UrgentCasesPanel cases={urgentCase} />);

      // Find badge containing D-1 text with destructive class
      const badge = container.querySelector('.bg-destructive');
      expect(badge).toBeInTheDocument();
    });

    it('uses warning variant for D-2 to D-3', () => {
      const warningCase: UrgentCase[] = [{ ...mockCases[0], daysUntilDeadline: 2 }];
      const { container } = render(<UrgentCasesPanel cases={warningCase} />);

      const badge = container.querySelector('.bg-orange-500');
      expect(badge).toBeInTheDocument();
    });
  });
});
