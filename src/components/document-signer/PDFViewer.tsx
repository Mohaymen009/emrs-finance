import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { SignerElement } from "@/types/document-signer";
import { DraggableElement } from "./DraggableElement";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  file: File | null;
  elements: SignerElement[];
  onUpdateElement: (id: string, updates: Partial<SignerElement>) => void;
  onDeleteElement: (id: string) => void;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  numPages: number;
  onNumPagesChange: (num: number) => void;
  pageSize: { width: number; height: number };
  onPageSizeChange: (size: { width: number; height: number }) => void;
}

export const PDFViewer = ({
  file,
  elements,
  onUpdateElement,
  onDeleteElement,
  selectedElementId,
  onSelectElement,
  currentPage,
  onPageChange,
  numPages,
  onNumPagesChange,
  pageSize,
  onPageSizeChange,
}: PDFViewerProps) => {
  const [scale, setScale] = useState(0.8);
  const [pageWidth, setPageWidth] = useState(595); // Default A4 width in points
  const containerRef = useRef<HTMLDivElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    onNumPagesChange(numPages);
  }, [onNumPagesChange]);

  const onPageLoadSuccess = useCallback((page: { width: number; height: number; originalWidth?: number; originalHeight?: number }) => {
    // react-pdf reports `.width`/`.height` at the CURRENT render scale, not
    // the page's intrinsic size — `.originalWidth`/`.originalHeight` are the
    // scale-independent ones. Using the scaled values here fed straight back
    // into the fit-to-width scale calculation below, which fed back into a
    // new render scale, forever ("Maximum update depth exceeded").
    const width = page.originalWidth ?? page.width;
    const height = page.originalHeight ?? page.height;
    onPageSizeChange({ width, height });
    setPageWidth(width);
  }, [onPageSizeChange]);

  const pageElements = elements.filter((el) => el.pageIndex === currentPage - 1);

  useEffect(() => {
    // Nothing to measure/scale when no PDF is loaded — the container this
    // effect measures isn't even rendered in that case.
    if (!file) return;

    const updateWidth = () => {
      if (containerRef.current && pageSize.width > 0) {
        const containerWidth = containerRef.current.clientWidth - 80;
        // Calculate scale to fit container while maintaining aspect ratio
        const targetWidth = Math.min(containerWidth, 700);
        const newScale = Math.min(targetWidth / pageSize.width, 1.2);
        // Skip the update if the recomputed scale is effectively unchanged —
        // setting it unconditionally on every measurement can, if this
        // container's own size depends on the rendered (scaled) content,
        // feed back into itself and trigger a "Maximum update depth
        // exceeded" render loop.
        setScale((prev) => (Math.abs(prev - newScale) < 0.001 ? prev : newScale));
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [pageSize.width, file]);

  if (!file) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/30">
        <p className="text-muted-foreground">Upload a PDF to get started</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[80px] text-center">
            Page {currentPage} / {numPages || 1}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(Math.min(numPages, currentPage + 1))}
            disabled={currentPage >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setScale((s) => Math.max(0.3, s - 0.1))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setScale((s) => Math.min(2, s + 0.1))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Content - using overflow-auto instead of ScrollArea for better performance */}
      <div 
        className="flex-1 overflow-auto bg-muted/30"
        onClick={() => onSelectElement(null)}
      >
        <div className="flex justify-center p-6 min-h-full">
          <div
            ref={pageContainerRef}
            className="relative shadow-xl bg-white"
            style={{ 
              width: pageSize.width * scale,
              height: pageSize.height * scale,
            }}
          >
            <Document file={file} onLoadSuccess={onDocumentLoadSuccess}>
              <Page
                pageNumber={currentPage}
                scale={scale}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                onLoadSuccess={onPageLoadSuccess}
              />
            </Document>

            {/* Overlay elements - positioned relative to scaled page */}
            {pageElements.map((element) => (
              <DraggableElement
                key={element.id}
                element={element}
                containerRef={pageContainerRef}
                scale={scale}
                onUpdate={onUpdateElement}
                onDelete={onDeleteElement}
                isSelected={selectedElementId === element.id}
                onSelect={() => onSelectElement(element.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
