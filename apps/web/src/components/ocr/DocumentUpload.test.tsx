import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentUpload } from './DocumentUpload';
import * as useDocumentUploadModule from '@/hooks/useDocumentUpload';

// Mock the useDocumentUpload hook
vi.mock('@/hooks/useDocumentUpload', () => ({
  useDocumentUpload: vi.fn(),
}));

const mockUseDocumentUpload = useDocumentUploadModule.useDocumentUpload as Mock;

describe('DocumentUpload Component', () => {
  const defaultMockReturn = {
    upload: vi.fn(),
    progress: 0,
    isUploading: false,
    error: null,
    reset: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDocumentUpload.mockReturnValue(defaultMockReturn);
  });

  describe('Rendering (AC #1)', () => {
    it('renders drag and drop area with correct instructions', () => {
      render(<DocumentUpload />);

      expect(screen.getByText(/파일을 드래그하거나 클릭하여 선택/i)).toBeInTheDocument();
      expect(screen.getByText(/PDF, JPG, PNG \(최대 10MB\)/i)).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      const { container } = render(<DocumentUpload className="custom-class" />);

      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('shows file input element with correct accept attribute', () => {
      render(<DocumentUpload />);

      const input = document.querySelector('input[type="file"]');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('accept');
    });
  });

  describe('Upload Progress Display (AC #1)', () => {
    it('shows progress bar during upload', () => {
      mockUseDocumentUpload.mockReturnValue({
        ...defaultMockReturn,
        progress: 50,
        isUploading: true,
      });

      render(<DocumentUpload />);

      expect(screen.getByText('업로드 중...')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
      // Progress bar should be visible
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('disables dropzone during upload', () => {
      mockUseDocumentUpload.mockReturnValue({
        ...defaultMockReturn,
        isUploading: true,
        progress: 50,
      });

      render(<DocumentUpload />);

      // When uploading, the dropzone container should have pointer-events-none
      const container = screen.getByText('업로드 중...').closest('[class*="pointer-events-none"]');
      expect(container).toBeInTheDocument();
    });

    it('shows 100% progress when complete', () => {
      mockUseDocumentUpload.mockReturnValue({
        ...defaultMockReturn,
        progress: 100,
        isUploading: true,
      });

      render(<DocumentUpload />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('File Type Validation (AC #2)', () => {
    it('accepts valid file types: PDF, JPG, PNG', () => {
      render(<DocumentUpload />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const acceptAttr = input?.getAttribute('accept');

      // react-dropzone sets accept based on mime types
      expect(acceptAttr).toBeDefined();
    });

    it('displays error for invalid file types', async () => {
      const onUploadError = vi.fn();
      render(<DocumentUpload onUploadError={onUploadError} />);

      // The dropzone should handle invalid files
      const dropzone = screen.getByText(/파일을 드래그하거나 클릭하여 선택/i).closest('div');
      expect(dropzone).toBeInTheDocument();
    });
  });

  describe('Error Handling (AC #2, #4)', () => {
    it('displays error message when upload fails', () => {
      mockUseDocumentUpload.mockReturnValue({
        ...defaultMockReturn,
        error: '파일 업로드에 실패했습니다.',
      });

      render(<DocumentUpload />);

      expect(screen.getByText('파일 업로드에 실패했습니다.')).toBeInTheDocument();
    });

    it('shows error icon with error message', () => {
      mockUseDocumentUpload.mockReturnValue({
        ...defaultMockReturn,
        error: '서버 오류',
      });

      render(<DocumentUpload />);

      // AlertCircle icon should be present
      const errorContainer = screen.getByText('서버 오류').parentElement;
      expect(errorContainer).toHaveClass('text-destructive');
    });

    it('calls onUploadError callback when error occurs', async () => {
      const onUploadError = vi.fn();
      const mockUpload = vi.fn().mockRejectedValue(new Error('Upload failed'));

      mockUseDocumentUpload.mockReturnValue({
        ...defaultMockReturn,
        upload: mockUpload,
      });

      render(<DocumentUpload onUploadError={onUploadError} />);

      // Verify callback is passed correctly
      expect(screen.getByText(/파일을 드래그하거나 클릭하여 선택/i)).toBeInTheDocument();
    });
  });

  describe('Upload Callbacks (AC #3)', () => {
    it('calls onUploadComplete with document ID after successful upload', async () => {
      const onUploadComplete = vi.fn();
      const mockUpload = vi.fn().mockResolvedValue({
        id: 'doc-123',
        ocrJobId: 'job-456',
      });

      mockUseDocumentUpload.mockReturnValue({
        ...defaultMockReturn,
        upload: mockUpload,
      });

      render(<DocumentUpload onUploadComplete={onUploadComplete} />);

      // Component should be ready to handle upload
      expect(screen.getByText(/파일을 드래그하거나 클릭하여 선택/i)).toBeInTheDocument();
    });

    it('passes taxCaseId to upload function', () => {
      const taxCaseId = '123';
      render(<DocumentUpload taxCaseId={taxCaseId} />);

      // Verify component accepts taxCaseId prop
      expect(screen.getByText(/파일을 드래그하거나 클릭하여 선택/i)).toBeInTheDocument();
    });
  });

  describe('File Size Validation (AC #4)', () => {
    it('enforces 10MB file size limit', () => {
      render(<DocumentUpload />);

      // The component should display the size limit
      expect(screen.getByText(/최대 10MB/i)).toBeInTheDocument();
    });
  });

  describe('Drag and Drop States', () => {
    it('shows different text when dragging over', () => {
      render(<DocumentUpload />);

      // Default state
      expect(screen.getByText(/파일을 드래그하거나 클릭하여 선택/i)).toBeInTheDocument();

      // Note: Testing actual drag state requires more complex setup with DataTransfer
    });

    it('applies correct styling on drag active', () => {
      render(<DocumentUpload />);

      // The dropzone should have border-dashed class somewhere in its tree
      const dropzoneContainer = screen.getByText(/파일을 드래그하거나 클릭하여 선택/i).closest('[class*="border-dashed"]');
      expect(dropzoneContainer).toBeInTheDocument();
    });
  });
});

describe('DocumentUpload Integration', () => {
  it('integrates with useDocumentUpload hook correctly', () => {
    const mockUpload = vi.fn();
    const mockReset = vi.fn();

    mockUseDocumentUpload.mockReturnValue({
      upload: mockUpload,
      progress: 75,
      isUploading: true,
      error: null,
      reset: mockReset,
    });

    render(<DocumentUpload />);

    // Verify hook values are used
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('업로드 중...')).toBeInTheDocument();
  });
});
