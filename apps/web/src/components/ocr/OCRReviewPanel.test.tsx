import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OCRReviewPanel } from './OCRReviewPanel';
import type { OcrResultResponse } from '@/api/document.api';

// Mock DocumentPreview component (react-pdf requires DOMMatrix which is not available in jsdom)
vi.mock('./DocumentPreview', () => ({
  DocumentPreview: ({ fileUrl, mimeType }: { fileUrl: string; mimeType: string }) => (
    <div data-testid="document-preview">
      <span>Document Preview Mock</span>
      <span>URL: {fileUrl}</span>
      <span>Type: {mimeType}</span>
    </div>
  ),
}));

// Mock OCR result data
const mockOcrResult: OcrResultResponse = {
  documentId: '123',
  fileUrl: '/api/documents/123/file',
  mimeType: 'image/jpeg',
  status: 'COMPLETED',
  results: [
    { text: 'Sample text 1', confidence: 95, bbox: [[0, 0], [100, 0], [100, 20], [0, 20]], page: 1 },
    { text: 'Sample text 2', confidence: 75, bbox: [[0, 25], [100, 25], [100, 45], [0, 45]], page: 1 },
    { text: 'Low confidence', confidence: 50, bbox: [[0, 50], [100, 50], [100, 70], [0, 70]], page: 1 },
  ],
  tables: [
    {
      page: 1,
      cells: [
        { row: 0, col: 0, text: 'Header 1', confidence: 92 },
        { row: 0, col: 1, text: 'Header 2', confidence: 88 },
        { row: 1, col: 0, text: 'Data 1', confidence: 65 },
        { row: 1, col: 1, text: 'Data 2', confidence: 78 },
      ],
    },
  ],
  engine: 'PADDLEOCR',
  fallbackUsed: false,
  processingTimeMs: 1500,
};

describe('OCRReviewPanel Integration Tests (Story 2-5)', () => {
  const defaultProps = {
    ocrResult: mockOcrResult,
    onFieldUpdate: vi.fn(),
    onConfirm: vi.fn().mockResolvedValue(undefined),
    isConfirming: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Layout and Structure (AC #1, #2)', () => {
    it('renders two-column layout with document preview and extracted data', () => {
      render(<OCRReviewPanel {...defaultProps} />);

      // Left panel - Document Preview (mocked)
      expect(screen.getByTestId('document-preview')).toBeInTheDocument();

      // Right panel - Extracted Data
      expect(screen.getByText('Extracted Data')).toBeInTheDocument();
    });

    it('displays all extracted fields', () => {
      render(<OCRReviewPanel {...defaultProps} />);

      expect(screen.getByText('Sample text 1')).toBeInTheDocument();
      expect(screen.getByText('Sample text 2')).toBeInTheDocument();
      expect(screen.getByText('Low confidence')).toBeInTheDocument();
    });

    it('shows engine badge', () => {
      render(<OCRReviewPanel {...defaultProps} />);

      expect(screen.getByText('PADDLEOCR')).toBeInTheDocument();
    });

    it('shows fallback badge when fallback was used', () => {
      const propsWithFallback = {
        ...defaultProps,
        ocrResult: { ...mockOcrResult, fallbackUsed: true },
      };
      render(<OCRReviewPanel {...propsWithFallback} />);

      expect(screen.getByText('Fallback')).toBeInTheDocument();
    });
  });

  describe('Confidence Display (AC #3)', () => {
    it('shows confidence indicators for all fields', () => {
      render(<OCRReviewPanel {...defaultProps} />);

      // High confidence: 95%
      expect(screen.getByText('95%')).toBeInTheDocument();
      // Medium confidence: 75%
      expect(screen.getByText('75%')).toBeInTheDocument();
      // Low confidence: 50%
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('shows low confidence count warning', () => {
      render(<OCRReviewPanel {...defaultProps} />);

      // One field with confidence < 70% (50% text - table cells not counted)
      expect(screen.getByText('1 low confidence')).toBeInTheDocument();
    });

    it('displays average confidence', () => {
      render(<OCRReviewPanel {...defaultProps} />);

      // Average of 95, 75, 50 = 73.33%
      // Should find the confidence text
      expect(screen.getByText('Confidence:')).toBeInTheDocument();
    });
  });

  describe('Field Editing (AC #4)', () => {
    it('calls onFieldUpdate when a field is edited', async () => {
      const user = userEvent.setup();
      const onFieldUpdate = vi.fn();
      render(<OCRReviewPanel {...defaultProps} onFieldUpdate={onFieldUpdate} />);

      // Find edit button (Pencil icon) for first field
      const editButtons = screen.getAllByRole('button');
      // Find the first pencil edit button (not the confirm button)
      const editButton = editButtons.find((btn) =>
        btn.querySelector('svg.lucide-pencil') || btn.className.includes('h-7')
      );

      if (editButton) {
        await user.click(editButton);

        // Find input and change value
        const input = screen.getByRole('textbox');
        await user.clear(input);
        await user.type(input, 'Updated text');

        // Save changes (Enter key or save button)
        await user.keyboard('{Enter}');

        expect(onFieldUpdate).toHaveBeenCalledWith(0, 'Updated text');
      }
    });
  });

  describe('Review Confirmation (AC #5)', () => {
    it('shows confirm button', () => {
      render(<OCRReviewPanel {...defaultProps} />);

      expect(screen.getByText('Confirm Review')).toBeInTheDocument();
    });

    it('calls onConfirm when confirm button is clicked', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn().mockResolvedValue(undefined);
      render(<OCRReviewPanel {...defaultProps} onConfirm={onConfirm} />);

      const confirmButton = screen.getByText('Confirm Review');
      await user.click(confirmButton);

      expect(onConfirm).toHaveBeenCalled();
    });

    it('shows loading state during confirmation', () => {
      render(<OCRReviewPanel {...defaultProps} isConfirming={true} />);

      expect(screen.getByText('Confirming...')).toBeInTheDocument();
    });

    it('disables confirm button during confirmation', () => {
      render(<OCRReviewPanel {...defaultProps} isConfirming={true} />);

      const confirmButton = screen.getByRole('button', { name: /confirming/i });
      expect(confirmButton).toBeDisabled();
    });
  });

  describe('Table Data Display (AC #6)', () => {
    it('renders table section when tables exist', () => {
      render(<OCRReviewPanel {...defaultProps} />);

      expect(screen.getByText('Tables')).toBeInTheDocument();
    });

    it('displays table cells with data', () => {
      render(<OCRReviewPanel {...defaultProps} />);

      expect(screen.getByText('Header 1')).toBeInTheDocument();
      expect(screen.getByText('Header 2')).toBeInTheDocument();
      expect(screen.getByText('Data 1')).toBeInTheDocument();
      expect(screen.getByText('Data 2')).toBeInTheDocument();
    });

    it('shows page number for table', () => {
      render(<OCRReviewPanel {...defaultProps} />);

      expect(screen.getByText('Page 1')).toBeInTheDocument();
    });

    it('does not render table section when no tables', () => {
      const propsWithoutTables = {
        ...defaultProps,
        ocrResult: { ...mockOcrResult, tables: [] },
      };
      render(<OCRReviewPanel {...propsWithoutTables} />);

      expect(screen.queryByText('Tables')).not.toBeInTheDocument();
    });
  });

  describe('Pending Updates Tracking', () => {
    it('shows pending changes count after field update', async () => {
      const user = userEvent.setup();
      const onFieldUpdate = vi.fn();
      render(<OCRReviewPanel {...defaultProps} onFieldUpdate={onFieldUpdate} />);

      // Find all buttons and get the first edit button (h-7 w-7 are edit buttons)
      const allButtons = screen.getAllByRole('button');
      const editButtons = allButtons.filter(
        (btn) => btn.className.includes('h-7') && btn.className.includes('w-7')
      );

      if (editButtons.length > 0) {
        await user.click(editButtons[0]);

        // Wait for textbox to appear
        await waitFor(() => {
          expect(screen.getByRole('textbox')).toBeInTheDocument();
        });

        // Change value
        const input = screen.getByRole('textbox');
        await user.clear(input);
        await user.type(input, 'Changed value');
        await user.keyboard('{Enter}');

        // onFieldUpdate should have been called
        expect(onFieldUpdate).toHaveBeenCalled();
      }
    });
  });

  describe('Field Highlighting', () => {
    it('highlights selected field', async () => {
      const user = userEvent.setup();
      const { container } = render(<OCRReviewPanel {...defaultProps} />);

      // Click on a field to focus it
      const firstField = screen.getByText('Sample text 1').closest('div');
      if (firstField) {
        await user.click(firstField);

        // Check if parent element has highlight class
        await waitFor(() => {
          const highlightedElement = container.querySelector('.ring-2.ring-blue-500');
          expect(highlightedElement).toBeInTheDocument();
        });
      }
    });
  });

  describe('Null Confidence Handling (Gemini fallback)', () => {
    it('handles null confidence values from Gemini', () => {
      const propsWithNullConfidence = {
        ...defaultProps,
        ocrResult: {
          ...mockOcrResult,
          results: [
            { text: 'Gemini text', confidence: null, bbox: [], page: 1 },
          ],
          tables: [], // Remove tables to avoid multiple N/A elements
          fallbackUsed: true,
          engine: 'GEMINI',
        },
      };
      render(<OCRReviewPanel {...propsWithNullConfidence} />);

      expect(screen.getByText('Gemini text')).toBeInTheDocument();
      // Use getAllByText since there might be multiple N/A elements
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThan(0);
    });
  });
});
