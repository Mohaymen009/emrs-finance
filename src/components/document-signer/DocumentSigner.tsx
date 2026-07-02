import { useState, useRef, useCallback } from "react";
import { PDFDocument } from "pdf-lib";
import { SignerElement, SavedAsset } from "@/types/document-signer";
import { saveAsset } from "@/utils/signer-storage";
import { PDFViewer } from "./PDFViewer";
import { SignatureDrawer } from "./SignatureDrawer";
import { AssetLibrary } from "./AssetLibrary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Upload, Download, PenLine, Stamp, FileUp, ArrowLeft } from "lucide-react";

interface DocumentSignerProps {
  onBack: () => void;
}

export const DocumentSigner = ({ onBack }: DocumentSignerProps) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [elements, setElements] = useState<SignerElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [pageSize, setPageSize] = useState({ width: 595, height: 842 }); // A4 default
  const [showSignatureDrawer, setShowSignatureDrawer] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState<'signature' | 'stamp' | null>(null);
  const [assetRefreshKey, setAssetRefreshKey] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      const arrayBuffer = await file.arrayBuffer();
      setPdfFile(file);
      setPdfBytes(arrayBuffer);
      setElements([]);
      setCurrentPage(1);
      toast({
        title: "PDF Uploaded",
        description: `${file.name} is ready for signing.`,
      });
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload a PDF file.",
        variant: "destructive",
      });
    }
  };

  const handleAssetSelect = (asset: SavedAsset) => {
    if (!pdfFile) {
      toast({
        title: "No Document",
        description: "Please upload a PDF first.",
        variant: "destructive",
      });
      return;
    }
    
    const newElement: SignerElement = {
      id: Date.now().toString(),
      type: asset.type,
      x: 100,
      y: 100,
      width: asset.type === 'stamp' ? 100 : 120,
      height: asset.type === 'stamp' ? 100 : 50,
      pageIndex: currentPage - 1,
      imageData: asset.imageData,
    };
    setElements((prev) => [...prev, newElement]);
    setSelectedElementId(newElement.id);
    toast({
      title: `${asset.type === 'stamp' ? 'Stamp' : 'Signature'} Added`,
      description: "Drag to position, resize if needed.",
    });
  };

  const handleSignatureDrawn = (dataUrl: string) => {
    const name = `Signature ${new Date().toLocaleDateString()}`;
    saveAsset({ name, imageData: dataUrl, type: 'signature' });
    setAssetRefreshKey((k) => k + 1);
    setShowSignatureDrawer(false);

    if (pdfFile) {
      const newElement: SignerElement = {
        id: Date.now().toString(),
        type: 'signature',
        x: 100,
        y: 100,
        width: 120,
        height: 50,
        pageIndex: currentPage - 1,
        imageData: dataUrl,
      };
      setElements((prev) => [...prev, newElement]);
      setSelectedElementId(newElement.id);
    }

    toast({
      title: "Signature Saved",
      description: pdfFile 
        ? "Your signature has been saved and added to the document."
        : "Your signature has been saved to the library.",
    });
  };

  const handleAssetUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'signature' | 'stamp') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const name = file.name.replace(/\.[^/.]+$/, "");
      saveAsset({ name, imageData: dataUrl, type });
      setAssetRefreshKey((k) => k + 1);
      setShowUploadDialog(null);

      toast({
        title: `${type === 'stamp' ? 'Stamp' : 'Signature'} Saved`,
        description: `${name} has been added to your library.`,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateElement = useCallback((id: string, updates: Partial<SignerElement>) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...updates } : el))
    );
  }, []);

  const handleDeleteElement = useCallback((id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    setSelectedElementId(null);
  }, []);

  // Convert image URL/data to bytes
  const getImageBytes = async (imageData: string): Promise<Uint8Array> => {
    // If it's a data URL
    if (imageData.startsWith('data:')) {
      const base64 = imageData.split(',')[1];
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
    
    // If it's a URL (like imported asset), fetch it
    const response = await fetch(imageData);
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  };

  const handleDownload = async () => {
    if (!pdfFile || !pdfBytes) {
      toast({
        title: "No Document",
        description: "Please upload a PDF first.",
        variant: "destructive",
      });
      return;
    }

    setIsDownloading(true);
    toast({
      title: "Generating PDF",
      description: "Please wait while we add signatures and stamps...",
    });

    try {
      // Load the original PDF
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();

      // Add each element to the PDF
      for (const element of elements) {
        const page = pages[element.pageIndex];
        if (!page) continue;

        const { width: pageWidth, height: pageHeight } = page.getSize();
        
        // Get image bytes
        const imageBytes = await getImageBytes(element.imageData);
        
        // Embed image (try PNG first for transparency, fallback to JPEG)
        let image;
        try {
          image = await pdfDoc.embedPng(imageBytes);
        } catch {
          try {
            image = await pdfDoc.embedJpg(imageBytes);
          } catch (err) {
            console.error('Failed to embed image:', err);
            continue;
          }
        }

        // Calculate position - PDF coordinates are from bottom-left
        // Our coordinates are from top-left, so we need to flip Y
        const scaleRatio = pageWidth / pageSize.width;
        const pdfX = element.x * scaleRatio;
        const pdfY = pageHeight - (element.y * scaleRatio) - (element.height * scaleRatio);
        const pdfWidth = element.width * scaleRatio;
        const pdfHeight = element.height * scaleRatio;

        page.drawImage(image, {
          x: pdfX,
          y: pdfY,
          width: pdfWidth,
          height: pdfHeight,
        });
      }

      // Save the modified PDF
      const modifiedPdfBytes = await pdfDoc.save();
      
      // Create download link - slice to create a proper ArrayBuffer
      const blob = new Blob([modifiedPdfBytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Signed-${pdfFile.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "PDF Downloaded",
        description: "Your signed document has been saved with all signatures and stamps.",
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="p-2.5 rounded-xl bg-primary text-primary-foreground shadow-md">
                <PenLine className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                  Document Signer
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  Sign and stamp your documents
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Upload PDF
              </Button>
              <Button onClick={handleDownload} disabled={!pdfFile || isDownloading}>
                <Download className="h-4 w-4 mr-2" />
                {isDownloading ? "Processing..." : "Download Signed"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileUpload}
      />

      <main className="container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Tools */}
          <div className="lg:col-span-1 space-y-4">
            {/* Upload PDF Card */}
            {!pdfFile && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileUp className="h-4 w-4" />
                    Upload Document
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    className="w-full h-24 border-dashed"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <span className="text-sm">Click to upload PDF</span>
                    </div>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Signature Tools */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <PenLine className="h-4 w-4" />
                  Signatures
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowSignatureDrawer(true)}
                >
                  Draw Signature
                </Button>

                <Dialog open={showUploadDialog === 'signature'} onOpenChange={(open) => setShowUploadDialog(open ? 'signature' : null)}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      Upload Signature Image
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload Signature Image</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Label>Select an image file (PNG recommended for transparency)</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleAssetUpload(e, 'signature')}
                      />
                    </div>
                  </DialogContent>
                </Dialog>

                {showSignatureDrawer && (
                  <SignatureDrawer
                    onSave={handleSignatureDrawn}
                    onCancel={() => setShowSignatureDrawer(false)}
                  />
                )}
              </CardContent>
            </Card>

            {/* Stamp Tools */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Stamp className="h-4 w-4" />
                  Stamps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Dialog open={showUploadDialog === 'stamp'} onOpenChange={(open) => setShowUploadDialog(open ? 'stamp' : null)}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full">
                      Upload Stamp Image
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload Stamp Image</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Label>Select an image file (PNG recommended for transparency)</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleAssetUpload(e, 'stamp')}
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            {/* Asset Libraries */}
            <div className="space-y-4">
              <AssetLibrary
                type="signature"
                onSelect={handleAssetSelect}
                onAddNew={() => setShowSignatureDrawer(true)}
                refreshKey={assetRefreshKey}
              />
              <AssetLibrary
                type="stamp"
                onSelect={handleAssetSelect}
                onAddNew={() => setShowUploadDialog('stamp')}
                refreshKey={assetRefreshKey}
              />
            </div>
          </div>

          {/* Main Content - PDF Viewer */}
          <div className="lg:col-span-3">
            <Card className="h-[calc(100vh-180px)] overflow-hidden">
              <PDFViewer
                file={pdfFile}
                elements={elements}
                onUpdateElement={handleUpdateElement}
                onDeleteElement={handleDeleteElement}
                selectedElementId={selectedElementId}
                onSelectElement={setSelectedElementId}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                numPages={numPages}
                onNumPagesChange={setNumPages}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
              />
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};
