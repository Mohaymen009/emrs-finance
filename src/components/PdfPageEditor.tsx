import { useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Download, FileUp, RotateCcw, Trash2, Upload } from "lucide-react";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// Same worker the document signer's viewer uses.
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const THUMB_WIDTH = 220;

interface PdfPageEditorProps {
  onBack: () => void;
}

export const PdfPageEditor = ({ onBack }: PdfPageEditorProps) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState(0);
  // 0-based indices of pages marked for removal. Pages are only marked here
  // and stripped at download time, so any deletion can be undone.
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const keptCount = numPages - removed.size;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Allow re-selecting the same file after a replace.
    e.target.value = "";
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      setNumPages(0);
      setRemoved(new Set());
      toast({ title: "PDF Uploaded", description: `${file.name} is ready for editing.` });
    } else if (file) {
      toast({ title: "Invalid File", description: "Please upload a PDF file.", variant: "destructive" });
    }
  };

  const toggleRemoved = (pageIndex: number) => {
    setRemoved((prev) => {
      const next = new Set(prev);
      if (next.has(pageIndex)) {
        next.delete(pageIndex);
      } else {
        if (numPages - next.size <= 1) {
          toast({
            title: "Cannot remove every page",
            description: "The document must keep at least one page.",
            variant: "destructive",
          });
          return prev;
        }
        next.add(pageIndex);
      }
      return next;
    });
  };

  const handleDownload = async () => {
    if (!pdfFile || keptCount < 1) return;

    setIsDownloading(true);
    try {
      // Read a fresh copy of the bytes — pdf.js may detach buffers it was
      // handed, so the viewer and pdf-lib never share one.
      const sourceBytes = await pdfFile.arrayBuffer();
      const sourceDoc = await PDFDocument.load(sourceBytes);
      const keptIndices = sourceDoc.getPageIndices().filter((i) => !removed.has(i));

      const outDoc = await PDFDocument.create();
      const pages = await outDoc.copyPages(sourceDoc, keptIndices);
      pages.forEach((page) => outDoc.addPage(page));
      const outBytes = await outDoc.save();

      const blob = new Blob([outBytes.slice().buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Edited-${pdfFile.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "PDF Downloaded",
        description:
          removed.size > 0
            ? `Saved with ${removed.size} page${removed.size === 1 ? "" : "s"} removed (${keptCount} kept).`
            : "Saved with all pages kept.",
      });
    } catch (error) {
      console.error("PDF page removal error:", error);
      toast({ title: "Error", description: "Failed to generate PDF. Please try again.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    // Same fixed-viewport, single-scroll workspace pattern as the invoice
    // tool and document signer: header stays put, the page grid scrolls.
    <div className="flex flex-col lg:h-[calc(100vh-3.5rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to invoice tool">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Remove Pages</h1>
            <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">
              Upload a PDF, delete the pages you don&apos;t need, then download the rest
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
            <Upload className="h-4 w-4" />
            {pdfFile ? "Replace PDF" : "Upload PDF"}
          </Button>
          <Button
            onClick={handleDownload}
            disabled={!pdfFile || isDownloading}
            className="gap-2 flex-1 sm:flex-initial"
          >
            <Download className="h-4 w-4" />
            {isDownloading
              ? "Processing..."
              : removed.size > 0
                ? `Download (${keptCount} page${keptCount === 1 ? "" : "s"})`
                : "Download PDF"}
          </Button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />

      <div className="mt-4 flex-1 min-h-0 lg:overflow-y-auto scrollbar-thin">
        {!pdfFile ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-64 lg:h-full rounded-2xl border-2 border-dashed border-gray-300 bg-white/60 flex flex-col items-center justify-center gap-3 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FileUp className="h-8 w-8" />
            <span className="text-sm font-medium">Click to upload a PDF</span>
            <span className="text-xs text-gray-400">Each page will appear below with a delete button</span>
          </button>
        ) : (
          <Document
            file={pdfFile}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={() =>
              toast({ title: "Error", description: "Could not read this PDF.", variant: "destructive" })
            }
            loading={<p className="text-sm text-gray-500 p-4">Loading pages…</p>}
          >
            <div className="flex flex-wrap gap-4 pb-4">
              {Array.from({ length: numPages }, (_, i) => {
                const isRemoved = removed.has(i);
                return (
                  <Card
                    key={i}
                    className={`relative overflow-hidden transition-opacity ${isRemoved ? "opacity-90" : ""}`}
                    style={{ width: THUMB_WIDTH }}
                  >
                    <div className={isRemoved ? "opacity-30 grayscale" : ""}>
                      <Page
                        pageNumber={i + 1}
                        width={THUMB_WIDTH}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                      />
                    </div>

                    {isRemoved && (
                      <div className="absolute inset-0 flex items-center justify-center pb-10">
                        <span className="rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1">
                          Will be removed
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between px-3 py-2 border-t bg-white relative">
                      <span className="text-xs font-medium text-gray-600">Page {i + 1}</span>
                      {isRemoved ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1.5 text-xs"
                          onClick={() => toggleRemoved(i)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => toggleRemoved(i)}
                          aria-label={`Delete page ${i + 1}`}
                          title="Delete this page"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </Document>
        )}
      </div>
    </div>
  );
};
