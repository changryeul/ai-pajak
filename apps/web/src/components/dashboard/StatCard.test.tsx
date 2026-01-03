import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Users, Brain } from 'lucide-react';
import { StatCard } from './StatCard';

describe('StatCard Component', () => {
  it('renders with required props', () => {
    render(<StatCard title="Test Title" value={42} icon={Users} />);

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders with string value', () => {
    render(<StatCard title="Status" value="Active" icon={Users} />);

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <StatCard title="Customers" value={100} icon={Users} description="Total assigned customers" />
    );

    expect(screen.getByText('Total assigned customers')).toBeInTheDocument();
  });

  describe('Variants', () => {
    it('renders default variant', () => {
      const { container } = render(<StatCard title="Default" value={10} icon={Users} />);

      const card = container.querySelector('.transition-shadow');
      expect(card).not.toHaveClass('border-destructive/50');
      expect(card).not.toHaveClass('border-green-500/50');
    });

    it('renders urgent variant with destructive styling', () => {
      const { container } = render(
        <StatCard title="Urgent" value={5} icon={Users} variant="urgent" />
      );

      const card = container.querySelector('.transition-shadow');
      expect(card).toHaveClass('border-destructive/50');
      expect(card).toHaveClass('bg-destructive/5');
    });

    it('renders success variant with green styling', () => {
      const { container } = render(
        <StatCard title="Success" value={20} icon={Users} variant="success" />
      );

      const card = container.querySelector('.transition-shadow');
      expect(card).toHaveClass('border-green-500/50');
    });
  });

  describe('Trend Indicator', () => {
    it('renders positive trend with up arrow', () => {
      render(
        <StatCard
          title="Growth"
          value={100}
          icon={Brain}
          trend={{ value: 15, isPositive: true }}
        />
      );

      expect(screen.getByText(/↑ 15% from last week/)).toBeInTheDocument();
    });

    it('renders negative trend with down arrow', () => {
      render(
        <StatCard
          title="Decline"
          value={50}
          icon={Brain}
          trend={{ value: 10, isPositive: false }}
        />
      );

      expect(screen.getByText(/↓ 10% from last week/)).toBeInTheDocument();
    });

    it('applies correct color for positive trend', () => {
      render(
        <StatCard title="Test" value={1} icon={Users} trend={{ value: 5, isPositive: true }} />
      );

      const trendText = screen.getByText(/↑ 5% from last week/);
      expect(trendText).toHaveClass('text-green-600');
    });

    it('applies correct color for negative trend', () => {
      render(
        <StatCard title="Test" value={1} icon={Users} trend={{ value: 5, isPositive: false }} />
      );

      const trendText = screen.getByText(/↓ 5% from last week/);
      expect(trendText).toHaveClass('text-destructive');
    });
  });

  it('applies custom className', () => {
    const { container } = render(
      <StatCard title="Custom" value={1} icon={Users} className="custom-test-class" />
    );

    const card = container.querySelector('.custom-test-class');
    expect(card).toBeInTheDocument();
  });

  it('renders hover effect class', () => {
    const { container } = render(<StatCard title="Hover" value={1} icon={Users} />);

    const card = container.querySelector('.hover\\:shadow-md');
    expect(card).toBeInTheDocument();
  });
});
