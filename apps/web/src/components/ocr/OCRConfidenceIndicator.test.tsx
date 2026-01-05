import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OCRConfidenceIndicator } from './OCRConfidenceIndicator';

describe('OCRConfidenceIndicator Component', () => {
  describe('Confidence Level Coloring (Story 2-5, AC #3)', () => {
    it('shows green for high confidence (>= 90%)', () => {
      render(<OCRConfidenceIndicator confidence={95} />);

      const badge = screen.getByText('95%');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-green-100');
    });

    it('shows yellow for medium confidence (70-89%)', () => {
      render(<OCRConfidenceIndicator confidence={75} />);

      const badge = screen.getByText('75%');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-yellow-100');
    });

    it('shows red for low confidence (< 70%)', () => {
      render(<OCRConfidenceIndicator confidence={50} />);

      const badge = screen.getByText('50%');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-red-100');
    });

    it('shows gray for unknown confidence (null)', () => {
      render(<OCRConfidenceIndicator confidence={null} />);

      const badge = screen.getByText('N/A');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-gray-100');
    });
  });

  describe('Display Options', () => {
    it('shows percentage by default', () => {
      render(<OCRConfidenceIndicator confidence={85} />);

      expect(screen.getByText('85%')).toBeInTheDocument();
    });

    it('shows level text when showPercentage is false', () => {
      render(<OCRConfidenceIndicator confidence={90} showPercentage={false} />);

      expect(screen.getByText('High')).toBeInTheDocument();
    });

    it('shows Medium text for 85% confidence when showPercentage is false', () => {
      render(<OCRConfidenceIndicator confidence={85} showPercentage={false} />);

      expect(screen.getByText('Medium')).toBeInTheDocument();
    });

    it('shows N/A for null confidence regardless of showPercentage', () => {
      render(<OCRConfidenceIndicator confidence={null} showPercentage={false} />);

      expect(screen.getByText('N/A')).toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('applies small size styling', () => {
      render(<OCRConfidenceIndicator confidence={85} size="sm" />);

      const badge = screen.getByText('85%');
      expect(badge).toHaveClass('text-xs');
    });

    it('applies medium size styling by default', () => {
      render(<OCRConfidenceIndicator confidence={85} />);

      const badge = screen.getByText('85%');
      expect(badge).toHaveClass('text-sm');
    });

    it('applies large size styling', () => {
      render(<OCRConfidenceIndicator confidence={85} size="lg" />);

      const badge = screen.getByText('85%');
      expect(badge).toHaveClass('text-base');
    });
  });

  describe('Edge Cases', () => {
    it('handles 0% confidence', () => {
      render(<OCRConfidenceIndicator confidence={0} />);

      const badge = screen.getByText('0%');
      expect(badge).toHaveClass('bg-red-100');
    });

    it('handles 100% confidence', () => {
      render(<OCRConfidenceIndicator confidence={100} />);

      const badge = screen.getByText('100%');
      expect(badge).toHaveClass('bg-green-100');
    });

    it('handles boundary value 90%', () => {
      render(<OCRConfidenceIndicator confidence={90} />);

      const badge = screen.getByText('90%');
      expect(badge).toHaveClass('bg-green-100');
    });

    it('handles boundary value 89% (should be medium)', () => {
      render(<OCRConfidenceIndicator confidence={89} />);

      const badge = screen.getByText('89%');
      expect(badge).toHaveClass('bg-yellow-100');
    });

    it('handles boundary value 70%', () => {
      render(<OCRConfidenceIndicator confidence={70} />);

      const badge = screen.getByText('70%');
      expect(badge).toHaveClass('bg-yellow-100');
    });

    it('rounds decimal confidence values', () => {
      render(<OCRConfidenceIndicator confidence={85.6} />);

      expect(screen.getByText('86%')).toBeInTheDocument();
    });
  });
});
