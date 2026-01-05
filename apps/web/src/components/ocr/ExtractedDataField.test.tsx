import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExtractedDataField } from './ExtractedDataField';

describe('ExtractedDataField Component', () => {
  const defaultProps = {
    index: 0,
    text: 'Sample OCR text',
    confidence: 85,
    onUpdate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('displays field index', () => {
      render(<ExtractedDataField {...defaultProps} />);

      expect(screen.getByText('#1')).toBeInTheDocument();
    });

    it('displays OCR text', () => {
      render(<ExtractedDataField {...defaultProps} />);

      expect(screen.getByText('Sample OCR text')).toBeInTheDocument();
    });

    it('displays confidence indicator', () => {
      render(<ExtractedDataField {...defaultProps} />);

      expect(screen.getByText('85%')).toBeInTheDocument();
    });

    it('displays edit button', () => {
      render(<ExtractedDataField {...defaultProps} />);

      const editButton = screen.getByRole('button');
      expect(editButton).toBeInTheDocument();
    });
  });

  describe('Low Confidence Highlighting', () => {
    it('applies red background for low confidence (< 70%)', () => {
      const { container } = render(
        <ExtractedDataField {...defaultProps} confidence={50} />
      );

      const field = container.firstChild;
      expect(field).toHaveClass('bg-red-50');
    });

    it('does not apply red background for high confidence', () => {
      const { container } = render(
        <ExtractedDataField {...defaultProps} confidence={90} />
      );

      const field = container.firstChild;
      expect(field).not.toHaveClass('bg-red-50');
    });
  });

  describe('Selection Highlighting', () => {
    it('applies highlight styling when isHighlighted is true', () => {
      const { container } = render(
        <ExtractedDataField {...defaultProps} isHighlighted />
      );

      const field = container.firstChild;
      expect(field).toHaveClass('ring-2');
      expect(field).toHaveClass('ring-blue-500');
    });

    it('calls onFocus when field is clicked', () => {
      const onFocus = vi.fn();
      const { container } = render(
        <ExtractedDataField {...defaultProps} onFocus={onFocus} />
      );

      fireEvent.click(container.firstChild!);
      expect(onFocus).toHaveBeenCalled();
    });
  });

  describe('Inline Editing', () => {
    it('shows input field when edit button is clicked', async () => {
      const user = userEvent.setup();
      render(<ExtractedDataField {...defaultProps} />);

      const editButton = screen.getByRole('button');
      await user.click(editButton);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('shows save and cancel buttons in edit mode', async () => {
      const user = userEvent.setup();
      render(<ExtractedDataField {...defaultProps} />);

      const editButton = screen.getByRole('button');
      await user.click(editButton);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2); // Save and Cancel
    });

    it('calls onUpdate when save is clicked with changed value', async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();
      render(<ExtractedDataField {...defaultProps} onUpdate={onUpdate} />);

      // Enter edit mode
      const editButton = screen.getByRole('button');
      await user.click(editButton);

      // Change value
      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'New value');

      // Save
      const saveButton = screen.getAllByRole('button')[0];
      await user.click(saveButton);

      expect(onUpdate).toHaveBeenCalledWith(0, 'New value');
    });

    it('does not call onUpdate if value is unchanged', async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();
      render(<ExtractedDataField {...defaultProps} onUpdate={onUpdate} />);

      // Enter edit mode
      const editButton = screen.getByRole('button');
      await user.click(editButton);

      // Save without changing
      const saveButton = screen.getAllByRole('button')[0];
      await user.click(saveButton);

      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('cancels edit and restores original value', async () => {
      const user = userEvent.setup();
      render(<ExtractedDataField {...defaultProps} />);

      // Enter edit mode
      const editButton = screen.getByRole('button');
      await user.click(editButton);

      // Change value
      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'New value');

      // Cancel
      const cancelButton = screen.getAllByRole('button')[1];
      await user.click(cancelButton);

      // Should show original text
      expect(screen.getByText('Sample OCR text')).toBeInTheDocument();
    });

    it('saves on Enter key press', async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();
      render(<ExtractedDataField {...defaultProps} onUpdate={onUpdate} />);

      // Enter edit mode
      const editButton = screen.getByRole('button');
      await user.click(editButton);

      // Change value and press Enter
      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'New value{Enter}');

      expect(onUpdate).toHaveBeenCalledWith(0, 'New value');
    });

    it('cancels on Escape key press', async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();
      render(<ExtractedDataField {...defaultProps} onUpdate={onUpdate} />);

      // Enter edit mode
      const editButton = screen.getByRole('button');
      await user.click(editButton);

      // Change value and press Escape
      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'New value{Escape}');

      expect(onUpdate).not.toHaveBeenCalled();
      expect(screen.getByText('Sample OCR text')).toBeInTheDocument();
    });
  });

  describe('Null Confidence', () => {
    it('handles null confidence (Gemini results)', () => {
      render(<ExtractedDataField {...defaultProps} confidence={null} />);

      expect(screen.getByText('N/A')).toBeInTheDocument();
    });
  });
});
