import { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ZoomIn, ZoomOut, RotateCw, Download, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface DocumentPreviewProps {
  fileUrl: string;
  mimeType: string;
  highlightedBbox?: number[][];
}

/**
 * Story 2-5: Document Preview
 * Task 7.2: PDF viewer integration with react-pdf
 * Shows the original document with zoom, rotation, and highlight capabilities
 */
export function DocumentPreview({
  fileUrl,
  mimeType,
  highlightedBbox,
}: DocumentPreviewProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const isPdf = mimeType === 'application/pdf';
  const isImage = mimeType.startsWith('image/');

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('PDF load error:', error);
    setIsLoading(false);
  }, []);

  const goToPrevPage = () => setPageNumber(prev => Math.max(prev - 1, 1));
  const goToNextPage = () => setPageNumber(prev => Math.min(prev + 1, numPages));

  return (
    <div className="flex flex-col h-full border rounded-lg bg-gray-50">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-white">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={zoom <= 50}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600 w-12 text-center">{zoom}%</span>
          <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={zoom >= 200}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleRotate}>
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>

        {/* PDF Page Navigation */}
        {isPdf && numPages > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToPrevPage} disabled={pageNumber <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600">
              {pageNumber} / {numPages}
            </span>
            <Button variant="outline" size="sm" onClick={goToNextPage} disabled={pageNumber >= numPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        <Button variant="outline" size="sm" asChild>
          <a href={fileUrl} download>
            <Download className="h-4 w-4 mr-1" />
            Download
          </a>
        </Button>
      </div>

      {/* Preview Area */}
      <div className="flex-1 overflow-auto p-4">
        <div
          className="relative mx-auto transition-transform duration-200"
          style={{
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            transformOrigin: 'top center',
          }}
        >
          {isPdf ? (
            <div className="flex flex-col items-center">
              {isLoading && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              )}
              <Document
                file={fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={null}
                className="shadow-lg"
              >
                <Page
                  pageNumber={pageNumber}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="border"
                />
              </Document>
            </div>
          ) : isImage ? (
            <div className="relative">
              <img
                src={fileUrl}
                alt="Document"
                className="max-w-full h-auto shadow-lg"
                onLoad={() => setIsLoading(false)}
              />
              {/* Highlight overlay for bounding box */}
              {highlightedBbox && highlightedBbox.length >= 4 && (
                <div
                  className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none animate-pulse"
                  style={{
                    left: Math.min(...highlightedBbox.map(p => p[0])),
                    top: Math.min(...highlightedBbox.map(p => p[1])),
                    width: Math.max(...highlightedBbox.map(p => p[0])) - Math.min(...highlightedBbox.map(p => p[0])),
                    height: Math.max(...highlightedBbox.map(p => p[1])) - Math.min(...highlightedBbox.map(p => p[1])),
                  }}
                />
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-gray-500">
              Preview not available for this file type
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
