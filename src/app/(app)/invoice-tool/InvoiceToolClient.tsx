"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { InvoiceForm } from "@/components/InvoiceForm";
import { InvoiceTemplate } from "@/components/InvoiceTemplate";
import { InvoiceHistory } from "@/components/InvoiceHistory";
import { QuotationForm } from "@/components/QuotationForm";
import { QuotationTemplate } from "@/components/QuotationTemplate";
import { QuotationHistory } from "@/components/QuotationHistory";
import { ReceiptForm } from "@/components/ReceiptForm";
import { ReceiptTemplate } from "@/components/ReceiptTemplate";
import { ReceiptHistory } from "@/components/ReceiptHistory";
import { StatementForm } from "@/components/StatementForm";
import { StatementTemplate } from "@/components/StatementTemplate";
import { StatementHistory } from "@/components/StatementHistory";
import { InvoiceData, SavedInvoice, QuotationData, SavedQuotation, ReceiptData, SavedReceipt, StatementData, SavedStatement } from "@/types/invoice";
import { saveInvoice, saveQuotation, saveReceipt, saveStatement } from "@/utils/storage";
import { EMRS_COMPANY_DEFAULTS } from "@/utils/companyDefaults";
import { FileText, Download, History, Eye, Receipt, PenLine, ClipboardList, PencilRuler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "@/hooks/use-toast";

// pdf-lib/react-pdf touch canvas/DOM APIs that aren't safe during Next's
// server render pass, even inside a "use client" component — load the whole
// signer client-side only.
const DocumentSigner = dynamic(
  () => import("@/components/document-signer").then((m) => m.DocumentSigner),
  { ssr: false }
);

async function getHtml2Pdf() {
  return (await import("html2pdf.js")).default;
}

const BANK_DEFAULTS = {
  providerName: "E M R S AMBULANCE SERVICES LLC",
  beneficiaryAccountName: "E M R S AMBULANCE SERVICES LLC",
  beneficiaryAccountNumber: "0883638090001",
  iban: "AE980400000883638090001",
  bankName: "The National Bank of Ras Al Khaimah (P.S.C)",
  swiftCode: "NRAKAEAK",
};

const CONTACT_DEFAULTS = {
  companyAddress: `${EMRS_COMPANY_DEFAULTS.companyAddress}, ${EMRS_COMPANY_DEFAULTS.companyCity}`,
  email: EMRS_COMPANY_DEFAULTS.companyEmail,
  contactPersonName: "E M R S AMBULANCE SERVICES",
  contactPersonDesignation: "Management",
  contactPersonEmail: EMRS_COMPANY_DEFAULTS.companyEmail,
  authorizedSignatoryName: "E M R S AMBULANCE SERVICES",
  authorizedSignatoryDesignation: "Management",
  authorizedSignatoryMobile: "",
  authorizedSignatoryEmail: EMRS_COMPANY_DEFAULTS.companyEmail,
};

const getInitialData = (): InvoiceData => ({
  invoiceNumber: "",
  dateOfIssue: new Date().toISOString().split("T")[0],
  dateDue: "",
  ...EMRS_COMPANY_DEFAULTS,
  clientName: "",
  clientEmail: "",
  clientNumber: "",
  clientTRN: "",
  clientType: "business",
  clientBillingAddress: "",
  lineItems: [],
  subtotal: "AED0.00",
  vatPercent: "5",
  vatAmount: "AED0.00",
  total: "AED0.00",
  amountDue: "AED0.00",
  discountPercent: "",
  discountAmount: "",
  bankDetails: { ...BANK_DEFAULTS },
  contactDetails: { ...CONTACT_DEFAULTS },
  includeSignature: true,
  includeStamp: true,
  isTaxDocument: true,
  hideCompanyTRN: false,
});

const getInitialQuotationData = (): QuotationData => ({
  quotationNumber: "",
  dateOfIssue: new Date().toISOString().split("T")[0],
  ...EMRS_COMPANY_DEFAULTS,
  clientName: "",
  clientEmail: "",
  clientNumber: "",
  clientTRN: "",
  clientType: "business",
  clientBillingAddress: "",
  lineItems: [],
  subtotal: "AED0.00",
  vatPercent: "5",
  vatAmount: "AED0.00",
  total: "AED0.00",
  discountPercent: "",
  discountAmount: "",
  bankDetails: { ...BANK_DEFAULTS },
  contactDetails: { ...CONTACT_DEFAULTS },
  includeSignature: true,
  includeStamp: true,
  isTaxDocument: true,
  hideCompanyTRN: false,
});

const getInitialReceiptData = (): ReceiptData => ({
  receiptNumber: "",
  dateOfIssue: new Date().toISOString().split("T")[0],
  paymentDate: new Date().toISOString().split("T")[0],
  ...EMRS_COMPANY_DEFAULTS,
  clientName: "",
  clientEmail: "",
  clientNumber: "",
  clientTRN: "",
  clientType: "business",
  clientBillingAddress: "",
  lineItems: [],
  subtotal: "AED0.00",
  vatPercent: "5",
  vatAmount: "AED0.00",
  total: "AED0.00",
  amountPaid: "AED0.00",
  discountPercent: "",
  discountAmount: "",
  includeSignature: true,
  includeStamp: true,
  isTaxDocument: true,
  hideCompanyTRN: false,
});

const getInitialStatementData = (): StatementData => ({
  statementNumber: "",
  statementDate: new Date().toISOString().split("T")[0],
  periodFrom: "",
  periodTo: "",
  ...EMRS_COMPANY_DEFAULTS,
  clientName: "",
  clientEmail: "",
  clientNumber: "",
  clientBillingAddress: "",
  openingBalance: "",
  closingBalance: "",
  totalDebits: "",
  totalCredits: "",
  transactions: [],
  bankDetails: { ...BANK_DEFAULTS },
  contactDetails: { ...CONTACT_DEFAULTS },
  includeSignature: true,
  includeStamp: true,
  hideCompanyTRN: false,
  includeBankPage: false,
});

const PDF_OPT = {
  margin: 0,
  image: { type: "jpeg" as const, quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true },
  jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "portrait" as const },
};

type DocType = "invoice" | "quotation" | "receipt" | "statement";

const DOC_TABS: { id: DocType; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "invoice", label: "Invoice", shortLabel: "Invoice", icon: FileText },
  { id: "quotation", label: "Quotation", shortLabel: "Quote", icon: FileText },
  { id: "receipt", label: "Receipt", shortLabel: "Receipt", icon: Receipt },
  { id: "statement", label: "Statement", shortLabel: "SOA", icon: ClipboardList },
];

const A4_WIDTH_PX = 794; // 210mm at 96dpi — the templates' fixed render width.

// The A4 templates render at a fixed width. The preview panes are narrower,
// so we zoom the document to fit — `zoom` scales layout too, unlike
// `transform`, which left a page-sized block of dead scroll space under the
// preview.
//
// The width used to fit `containerRef` is measured on a STABLE ancestor —
// the pane's outer wrapper — rather than the scrollable pane itself. The
// scrollable pane's own width shrinks by the scrollbar's width whenever a
// vertical scrollbar appears, which happens exactly when zooming out makes
// the (now shorter) document fit — so measuring it fed the scrollbar's
// appearance back into the zoom calculation and the two fought forever.
// This was most visible on the Statement of Account, whose optional second
// page sits right at that height threshold. Reserving fixed space for
// padding/scrollbar instead of measuring it keeps the fit stable.
function useFitZoom(containerRef: React.RefObject<HTMLElement | null>, reserve: number) {
  const [zoom, setZoom] = useState(0.6);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = el.clientWidth - reserve;
        if (width <= 0) return;
        // Round to whole percent: keeps borders/hairlines on whole pixels
        // instead of drifting sub-pixel and looking soft, and avoids
        // re-render loops from float noise between measurements.
        const next = Math.min(1, Math.round((width / A4_WIDTH_PX) * 100) / 100);
        setZoom((prev) => (prev === next ? prev : next));
      });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [containerRef, reserve]);

  return zoom;
}

function DocumentPreview({ zoom, children }: { zoom: number; children: React.ReactNode }) {
  return (
    <div className="w-fit mx-auto bg-white ring-1 ring-gray-200 shadow-pop" style={{ zoom }}>
      {children}
    </div>
  );
}

export default function InvoiceToolClient() {
  const [formData, setFormData] = useState<InvoiceData>(getInitialData);
  const [quotationData, setQuotationData] = useState<QuotationData>(getInitialQuotationData);
  const [receiptData, setReceiptData] = useState<ReceiptData>(getInitialReceiptData);
  const [statementData, setStatementData] = useState<StatementData>(getInitialStatementData);
  const [docTab, setDocTab] = useState<DocType>("invoice");
  const [view, setView] = useState<"editor" | "history">("editor");
  const [showDocumentSigner, setShowDocumentSigner] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const quotationRef = useRef<HTMLDivElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const statementRef = useRef<HTMLDivElement>(null);
  const desktopPreviewPaneRef = useRef<HTMLDivElement>(null);
  const mobilePreviewPaneRef = useRef<HTMLDivElement>(null);
  // Reserve space for the pane's own padding plus its scrollbar (desktop
  // pane scrolls internally; mobile doesn't) — see useFitZoom for why this
  // has to be a fixed reserve rather than measured live.
  const desktopZoom = useFitZoom(desktopPreviewPaneRef, 48);
  const mobileZoom = useFitZoom(mobilePreviewPaneRef, 24);

  const handleDownload = async () => {
    if (!invoiceRef.current) return;
    const element = invoiceRef.current;
    const fileName = `Invoice-${formData.clientName || "draft"}.pdf`;

    try {
      const html2pdf = await getHtml2Pdf();
      await html2pdf().set({ ...PDF_OPT, filename: fileName }).from(element).save();
      saveInvoice(formData, fileName);
      toast({
        title: "PDF Generated & Saved",
        description: `Invoice ${formData.clientName || "draft"} has been downloaded and saved to your history.`,
      });
    } catch {
      toast({ title: "Error", description: "Failed to generate PDF. Please try again.", variant: "destructive" });
    }
  };

  const handleQuotationDownload = async () => {
    if (!quotationRef.current) return;
    const element = quotationRef.current;
    const fileName = `Quotation-${quotationData.clientName || "draft"}.pdf`;

    try {
      const html2pdf = await getHtml2Pdf();
      await html2pdf().set({ ...PDF_OPT, filename: fileName }).from(element).save();
      saveQuotation(quotationData, fileName);
      toast({
        title: "PDF Generated & Saved",
        description: `Quotation ${quotationData.clientName || "draft"} has been downloaded and saved to your history.`,
      });
    } catch {
      toast({ title: "Error", description: "Failed to generate PDF. Please try again.", variant: "destructive" });
    }
  };

  const handleReceiptDownload = async () => {
    if (!receiptRef.current) return;
    const element = receiptRef.current;
    const fileName = `Receipt-${receiptData.clientName || "draft"}.pdf`;

    try {
      const html2pdf = await getHtml2Pdf();
      await html2pdf().set({ ...PDF_OPT, filename: fileName }).from(element).save();
      saveReceipt(receiptData, fileName);
      toast({
        title: "PDF Generated & Saved",
        description: `Receipt ${receiptData.clientName || "draft"} has been downloaded and saved to your history.`,
      });
    } catch {
      toast({ title: "Error", description: "Failed to generate PDF. Please try again.", variant: "destructive" });
    }
  };

  const handleStatementDownload = async () => {
    if (!statementRef.current) return;
    const element = statementRef.current;
    const fileName = `Statement-${statementData.clientName || "draft"}.pdf`;

    try {
      const html2pdf = await getHtml2Pdf();
      await html2pdf().set({ ...PDF_OPT, filename: fileName }).from(element).save();
      saveStatement(statementData, fileName);
      toast({
        title: "PDF Generated & Saved",
        description: `Statement ${statementData.clientName || "draft"} has been downloaded and saved to your history.`,
      });
    } catch {
      toast({ title: "Error", description: "Failed to generate PDF. Please try again.", variant: "destructive" });
    }
  };

  const handleLoadInvoice = (savedInvoice: SavedInvoice) => {
    setFormData(savedInvoice.data);
    setDocTab("invoice");
    setView("editor");
    toast({ title: "Invoice Loaded", description: `Invoice ${savedInvoice.data.clientName || "draft"} has been loaded for editing.` });
  };

  const handleDownloadInvoiceFromHistory = async (savedInvoice: SavedInvoice) => {
    const tempDiv = document.createElement("div");
    tempDiv.style.position = "absolute";
    tempDiv.style.left = "-9999px";
    tempDiv.style.top = "0";
    tempDiv.style.width = "210mm";
    document.body.appendChild(tempDiv);

    try {
      const React = await import("react");
      const ReactDOM = await import("react-dom/client");
      const root = ReactDOM.createRoot(tempDiv);
      root.render(React.createElement(InvoiceTemplate, { data: savedInvoice.data }));
      await new Promise((resolve) => setTimeout(resolve, 500));

      const fileName = `Invoice-${savedInvoice.data.clientName || "draft"}.pdf`;
      const html2pdf = await getHtml2Pdf();
      await html2pdf().set({ ...PDF_OPT, filename: fileName }).from(tempDiv).save();
      toast({ title: "PDF Downloaded", description: `Invoice ${savedInvoice.data.clientName || "draft"} has been downloaded.` });
    } catch (error) {
      console.error("Download error:", error);
      toast({ title: "Error", description: "Failed to generate PDF. Please try again.", variant: "destructive" });
    } finally {
      document.body.removeChild(tempDiv);
    }
  };

  const handleLoadQuotation = (savedQuotation: SavedQuotation) => {
    setQuotationData(savedQuotation.data);
    setDocTab("quotation");
    setView("editor");
    toast({ title: "Quotation Loaded", description: `Quotation ${savedQuotation.data.clientName || "draft"} has been loaded for editing.` });
  };

  const handleDownloadQuotationFromHistory = async (savedQuotation: SavedQuotation) => {
    setQuotationData(savedQuotation.data);
    setDocTab("quotation");
    setView("editor");
    setTimeout(() => { void handleQuotationDownload(); }, 300);
  };

  const handleLoadReceipt = (savedReceipt: SavedReceipt) => {
    setReceiptData(savedReceipt.data);
    setDocTab("receipt");
    setView("editor");
    toast({ title: "Receipt Loaded", description: `Receipt ${savedReceipt.data.clientName || "draft"} has been loaded for editing.` });
  };

  const handleDownloadReceiptFromHistory = async (savedReceipt: SavedReceipt) => {
    setReceiptData(savedReceipt.data);
    setDocTab("receipt");
    setView("editor");
    setTimeout(() => { void handleReceiptDownload(); }, 300);
  };

  const handleLoadStatement = (savedStatement: SavedStatement) => {
    setStatementData(savedStatement.data);
    setDocTab("statement");
    setView("editor");
    toast({ title: "Statement Loaded", description: `Statement ${savedStatement.data.clientName || "draft"} has been loaded for editing.` });
  };

  const handleDownloadStatementFromHistory = async (savedStatement: SavedStatement) => {
    setStatementData(savedStatement.data);
    setDocTab("statement");
    setView("editor");
    setTimeout(() => { void handleStatementDownload(); }, 300);
  };

  const getActiveDownloadHandler = () => {
    switch (docTab) {
      case "quotation": return handleQuotationDownload;
      case "receipt": return handleReceiptDownload;
      case "statement": return handleStatementDownload;
      default: return handleDownload;
    }
  };

  const renderForm = () => {
    switch (docTab) {
      case "quotation":
        return <QuotationForm formData={quotationData} onChange={setQuotationData} onDownload={handleQuotationDownload} />;
      case "receipt":
        return <ReceiptForm formData={receiptData} onChange={setReceiptData} onDownload={handleReceiptDownload} />;
      case "statement":
        return <StatementForm formData={statementData} onChange={setStatementData} onDownload={handleStatementDownload} />;
      default:
        return <InvoiceForm formData={formData} onChange={setFormData} onDownload={handleDownload} />;
    }
  };

  const renderTemplate = () => {
    switch (docTab) {
      case "quotation":
        return <QuotationTemplate data={quotationData} />;
      case "receipt":
        return <ReceiptTemplate data={receiptData} />;
      case "statement":
        return <StatementTemplate data={statementData} />;
      default:
        return <InvoiceTemplate data={formData} />;
    }
  };

  const renderHistory = () => {
    switch (docTab) {
      case "quotation":
        return <QuotationHistory onLoadQuotation={handleLoadQuotation} onDownloadQuotation={handleDownloadQuotationFromHistory} />;
      case "receipt":
        return <ReceiptHistory onLoadReceipt={handleLoadReceipt} onDownloadReceipt={handleDownloadReceiptFromHistory} />;
      case "statement":
        return <StatementHistory onLoadStatement={handleLoadStatement} onDownloadStatement={handleDownloadStatementFromHistory} />;
      default:
        return <InvoiceHistory onLoadInvoice={handleLoadInvoice} onDownloadInvoice={handleDownloadInvoiceFromHistory} />;
    }
  };

  if (showDocumentSigner) {
    return (
      <>
        <DocumentSigner onBack={() => setShowDocumentSigner(false)} />
        <Toaster />
      </>
    );
  }

  const docName = docTab;

  return (
    // On desktop the workspace claims the full viewport (minus the layout's
    // vertical padding) and never scrolls itself — the form and preview panes
    // each get their own single scroll context instead of stacking page,
    // form and preview scrollbars on top of each other.
    <div className="flex flex-col lg:h-[calc(100vh-3.5rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Invoice Tool</h1>
          <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">
            Generate invoices, quotations, receipts and statements of account
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setShowDocumentSigner(true)} className="gap-2">
            <PenLine className="h-4 w-4" />
            <span className="hidden sm:inline">Sign &amp; Stamp</span>
            <span className="sm:hidden">Sign</span>
          </Button>
          <Button onClick={() => getActiveDownloadHandler()()} className="gap-2 flex-1 sm:flex-initial">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download PDF</span>
            <span className="sm:hidden">Download</span>
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white p-1 shadow-card">
          {DOC_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = docTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setDocTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                  active ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <Icon className="h-3.5 w-3.5 hidden sm:block" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white p-1 shadow-card">
          <button
            onClick={() => setView("editor")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
              view === "editor" ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <PencilRuler className="h-3.5 w-3.5" />
            Editor
          </button>
          <button
            onClick={() => setView("history")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
              view === "history" ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            History
          </button>
        </div>
      </div>

      {view === "editor" ? (
        <div className="mt-4 flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section className="flex flex-col min-h-0">
            <div className="shrink-0 pb-3">
              <h2 className="text-sm font-semibold text-gray-900 capitalize">{docName} details</h2>
              <p className="text-xs text-gray-500">Changes appear in the preview as you type.</p>
            </div>
            <div className="flex-1 min-h-0 lg:overflow-y-auto scrollbar-thin lg:pr-2 lg:pb-4">
              {renderForm()}
              <div className="lg:hidden mt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => document.getElementById("mobile-preview")?.scrollIntoView({ behavior: "smooth" })}
                >
                  <Eye className="h-4 w-4 mr-2" /> View Preview
                </Button>
              </div>
            </div>
          </section>

          <section ref={desktopPreviewPaneRef} className="hidden lg:flex flex-col min-h-0">
            <div className="shrink-0 pb-3">
              <h2 className="text-sm font-semibold text-gray-900">Live preview</h2>
              <p className="text-xs text-gray-500">Exactly what the downloaded PDF will look like.</p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin rounded-2xl border border-gray-200 bg-gray-100/80 p-5">
              <DocumentPreview zoom={desktopZoom}>{renderTemplate()}</DocumentPreview>
            </div>
          </section>

          <section id="mobile-preview" ref={mobilePreviewPaneRef} className="lg:hidden">
            <div className="pb-3">
              <h2 className="text-sm font-semibold text-gray-900 capitalize">{docName} preview</h2>
              <p className="text-xs text-gray-500">This is how your {docName} will look.</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-100/80 p-3">
              <DocumentPreview zoom={mobileZoom}>{renderTemplate()}</DocumentPreview>
            </div>
          </section>
        </div>
      ) : (
        <div className="mt-4 flex-1 min-h-0 lg:overflow-y-auto scrollbar-thin lg:pr-2">
          <div className="pb-3">
            <h2 className="text-sm font-semibold text-gray-900 capitalize">Saved {docName}s</h2>
            <p className="text-xs text-gray-500">Load a previous {docName} to edit it, or download it again.</p>
          </div>
          {renderHistory()}
        </div>
      )}

      {/* Off-screen, unscaled copy of the active document that html2pdf captures. */}
      <div aria-hidden style={{ position: "absolute", left: "-9999px", top: 0 }}>
        {docTab === "invoice" && <InvoiceTemplate ref={invoiceRef} data={formData} />}
        {docTab === "quotation" && <QuotationTemplate ref={quotationRef} data={quotationData} />}
        {docTab === "receipt" && <ReceiptTemplate ref={receiptRef} data={receiptData} />}
        {docTab === "statement" && <StatementTemplate ref={statementRef} data={statementData} />}
      </div>

      <Toaster />
    </div>
  );
}
