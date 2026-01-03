import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from './badge'

describe('Badge Component', () => {
  // Base variants
  it('renders with default variant', () => {
    render(<Badge>Default</Badge>)
    const badge = screen.getByText('Default')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-primary')
  })

  it('renders with secondary variant', () => {
    render(<Badge variant="secondary">Secondary</Badge>)
    expect(screen.getByText('Secondary')).toHaveClass('bg-secondary')
  })

  it('renders with destructive variant', () => {
    render(<Badge variant="destructive">Destructive</Badge>)
    expect(screen.getByText('Destructive')).toHaveClass('bg-destructive')
  })

  it('renders with outline variant', () => {
    render(<Badge variant="outline">Outline</Badge>)
    expect(screen.getByText('Outline')).toHaveClass('text-foreground')
  })

  // Stage variants (Workflow)
  describe('Stage Variants', () => {
    it('renders uploaded stage', () => {
      render(<Badge variant="uploaded">UPLOADED</Badge>)
      expect(screen.getByText('UPLOADED')).toHaveClass('bg-stage-uploaded')
    })

    it('renders aiAnalyzed stage', () => {
      render(<Badge variant="aiAnalyzed">AI_ANALYZED</Badge>)
      expect(screen.getByText('AI_ANALYZED')).toHaveClass('bg-stage-ai-analyzed')
    })

    it('renders humanReview stage', () => {
      render(<Badge variant="humanReview">HUMAN_REVIEW</Badge>)
      expect(screen.getByText('HUMAN_REVIEW')).toHaveClass('bg-stage-human-review')
    })

    it('renders approved stage', () => {
      render(<Badge variant="approved">APPROVED</Badge>)
      expect(screen.getByText('APPROVED')).toHaveClass('bg-stage-approved')
    })

    it('renders filed stage', () => {
      render(<Badge variant="filed">FILED</Badge>)
      expect(screen.getByText('FILED')).toHaveClass('bg-stage-filed')
    })
  })

  // Tax type variants
  describe('Tax Type Variants', () => {
    it('renders PPh21 tax type', () => {
      render(<Badge variant="pph21">PPh 21</Badge>)
      expect(screen.getByText('PPh 21')).toHaveClass('bg-tax-pph21')
    })

    it('renders PPh23 tax type', () => {
      render(<Badge variant="pph23">PPh 23</Badge>)
      expect(screen.getByText('PPh 23')).toHaveClass('bg-tax-pph23')
    })

    it('renders PPN tax type', () => {
      render(<Badge variant="ppn">PPN</Badge>)
      expect(screen.getByText('PPN')).toHaveClass('bg-tax-ppn')
    })

    it('renders Annual tax type', () => {
      render(<Badge variant="annual">Annual</Badge>)
      expect(screen.getByText('Annual')).toHaveClass('bg-tax-annual')
    })
  })

  // OCR Confidence variants
  describe('Confidence Variants', () => {
    it('renders high confidence', () => {
      render(<Badge variant="confidenceHigh">95%</Badge>)
      expect(screen.getByText('95%')).toHaveClass('bg-confidence-high')
    })

    it('renders medium confidence', () => {
      render(<Badge variant="confidenceMedium">75%</Badge>)
      expect(screen.getByText('75%')).toHaveClass('bg-confidence-medium')
    })

    it('renders low confidence', () => {
      render(<Badge variant="confidenceLow">50%</Badge>)
      expect(screen.getByText('50%')).toHaveClass('bg-confidence-low')
    })
  })

  it('applies custom className', () => {
    render(<Badge className="custom-class">Custom</Badge>)
    expect(screen.getByText('Custom')).toHaveClass('custom-class')
  })
})
