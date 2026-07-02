"use client";

import { useState, useRef } from "react";
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
import { FileText, Download, History, Eye, Receipt, PenLine, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function InvoiceToolClient() {
  const [formData, setFormData] = useState<InvoiceData>(getInitialData);
  const [quotationData, setQuotationData] = useState<QuotationData>(getInitialQuotationData);
  const [receiptData, setReceiptData] = useState<ReceiptData>(getInitialReceiptData);
  const [statementData, setStatementData] = useState<StatementData>(getInitialStatementData);
  const [activeTab, setActiveTab] = useState("create");
  const [showDocumentSigner, setShowDocumentSigner] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const quotationRef = useRef<HTMLDivElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const statementRef = useRef<HTMLDivElement>(null);

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
    setActiveTab("create");
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
    setActiveTab("quotation");
    toast({ title: "Quotation Loaded", description: `Quotation ${savedQuotation.data.clientName || "draft"} has been loaded for editing.` });
  };

  const handleDownloadQuotationFromHistory = async (savedQuotation: SavedQuotation) => {
    setQuotationData(savedQuotation.data);
    setActiveTab("quotation");
    setTimeout(() => { void handleQuotationDownload(); }, 300);
  };

  const handleLoadReceipt = (savedReceipt: SavedReceipt) => {
    setReceiptData(savedReceipt.data);
    setActiveTab("receipt");
    toast({ title: "Receipt Loaded", description: `Receipt ${savedReceipt.data.clientName || "draft"} has been loaded for editing.` });
  };

  const handleDownloadReceiptFromHistory = async (savedReceipt: SavedReceipt) => {
    setReceiptData(savedReceipt.data);
    setActiveTab("receipt");
    setTimeout(() => { void handleReceiptDownload(); }, 300);
  };

  const handleLoadStatement = (savedStatement: SavedStatement) => {
    setStatementData(savedStatement.data);
    setActiveTab("statement");
    toast({ title: "Statement Loaded", description: `Statement ${savedStatement.data.clientName || "draft"} has been loaded for editing.` });
  };

  const handleDownloadStatementFromHistory = async (savedStatement: SavedStatement) => {
    setStatementData(savedStatement.data);
    setActiveTab("statement");
    setTimeout(() => { void handleStatementDownload(); }, 300);
  };

  const getActiveDownloadHandler = () => {
    switch (activeTab) {
      case "quotation": return handleQuotationDownload;
      case "receipt": return handleReceiptDownload;
      case "statement": return handleStatementDownload;
      default: return handleDownload;
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

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary text-primary-foreground shadow-md">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">Invoice Tool</h1>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
              Generate invoices, quotations, receipts and statements of account
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setShowDocumentSigner(true)} className="gap-2 hover:bg-accent transition-colors">
            <PenLine className="h-4 w-4" />
            <span className="hidden sm:inline">Sign & Stamp</span>
            <span className="sm:hidden">Sign</span>
          </Button>
          <Button onClick={() => getActiveDownloadHandler()()} className="gap-2 flex-1 sm:flex-initial shadow-md hover:shadow-lg transition-shadow">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download PDF</span>
            <span className="sm:hidden">Download</span>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-8 h-12 p-1 bg-muted/60 rounded-xl">
          <TabsTrigger value="create" className="flex items-center gap-1 text-xs sm:text-sm rounded-lg data-[state=active]:shadow-md transition-all">
            <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Invoice</span>
            <span className="sm:hidden">Inv</span>
          </TabsTrigger>
          <TabsTrigger value="quotation" className="flex items-center gap-1 text-xs sm:text-sm rounded-lg data-[state=active]:shadow-md transition-all">
            <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Quotation</span>
            <span className="sm:hidden">Quote</span>
          </TabsTrigger>
          <TabsTrigger value="receipt" className="flex items-center gap-1 text-xs sm:text-sm rounded-lg data-[state=active]:shadow-md transition-all">
            <Receipt className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Receipt</span>
            <span className="sm:hidden">Rec</span>
          </TabsTrigger>
          <TabsTrigger value="statement" className="flex items-center gap-1 text-xs sm:text-sm rounded-lg data-[state=active]:shadow-md transition-all">
            <ClipboardList className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">SOA</span>
            <span className="sm:hidden">SOA</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1 text-xs sm:text-sm rounded-lg data-[state=active]:shadow-md transition-all">
            <History className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Inv Hist</span>
            <span className="sm:hidden">Inv H</span>
          </TabsTrigger>
          <TabsTrigger value="quotation-history" className="flex items-center gap-1 text-xs sm:text-sm rounded-lg data-[state=active]:shadow-md transition-all">
            <History className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Quote Hist</span>
            <span className="sm:hidden">Q H</span>
          </TabsTrigger>
          <TabsTrigger value="receipt-history" className="flex items-center gap-1 text-xs sm:text-sm rounded-lg data-[state=active]:shadow-md transition-all">
            <History className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Rec Hist</span>
            <span className="sm:hidden">R H</span>
          </TabsTrigger>
          <TabsTrigger value="statement-history" className="flex items-center gap-1 text-xs sm:text-sm rounded-lg data-[state=active]:shadow-md transition-all">
            <History className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">SOA Hist</span>
            <span className="sm:hidden">S H</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="lg:col-span-1">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-foreground mb-1">Invoice Details</h2>
                <p className="text-sm text-muted-foreground">Fill in the details below. Preview updates in real-time.</p>
              </div>
              <ScrollArea className="h-[calc(100vh-280px)]">
                <InvoiceForm formData={formData} onChange={setFormData} onDownload={handleDownload} />
              </ScrollArea>
            </div>

            <div className="hidden lg:block lg:col-span-1">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-foreground mb-1">Live Preview</h2>
                <p className="text-sm text-muted-foreground">Preview your invoice as you type.</p>
              </div>
              <Card className="overflow-hidden border-2 border-border/50 shadow-lg rounded-xl">
                <ScrollArea className="h-[calc(100vh-280px)] scrollbar-thin">
                  <div className="p-6 bg-gradient-to-b from-muted/40 to-muted/20">
                    <div className="shadow-2xl rounded-lg overflow-hidden" style={{ transform: "scale(0.5)", transformOrigin: "top left", width: "200%" }}>
                      <InvoiceTemplate data={formData} />
                    </div>
                  </div>
                </ScrollArea>
              </Card>
            </div>

            <div className="lg:hidden">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => document.getElementById("mobile-preview")?.scrollIntoView({ behavior: "smooth" })}
              >
                <Eye className="h-4 w-4 mr-2" /> View Preview
              </Button>
            </div>

            <div id="mobile-preview" className="lg:hidden col-span-1 mt-6">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-foreground mb-1">Invoice Preview</h2>
                <p className="text-sm text-muted-foreground">This is how your invoice will look.</p>
              </div>
              <Card className="overflow-hidden">
                <ScrollArea className="h-[400px]">
                  <div className="p-4 bg-muted/30">
                    <div style={{ transform: "scale(0.35)", transformOrigin: "top left", width: "285%" }}>
                      <InvoiceTemplate ref={invoiceRef} data={formData} />
                    </div>
                  </div>
                </ScrollArea>
              </Card>
            </div>

            <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
              <InvoiceTemplate ref={invoiceRef} data={formData} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="quotation" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="lg:col-span-1">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-foreground mb-1">Quotation Details</h2>
                <p className="text-sm text-muted-foreground">Fill in the details below. Preview updates in real-time.</p>
              </div>
              <ScrollArea className="h-[calc(100vh-280px)]">
                <QuotationForm formData={quotationData} onChange={setQuotationData} onDownload={handleQuotationDownload} />
              </ScrollArea>
            </div>

            <div className="hidden lg:block lg:col-span-1">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-foreground mb-1">Live Preview</h2>
                <p className="text-sm text-muted-foreground">Preview your quotation as you type.</p>
              </div>
              <Card className="overflow-hidden">
                <ScrollArea className="h-[calc(100vh-280px)]">
                  <div className="p-4 bg-muted/30">
                    <div style={{ transform: "scale(0.5)", transformOrigin: "top left", width: "200%" }}>
                      <QuotationTemplate data={quotationData} />
                    </div>
                  </div>
                </ScrollArea>
              </Card>
            </div>

            <div className="lg:hidden">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => document.getElementById("quotation-mobile-preview")?.scrollIntoView({ behavior: "smooth" })}
              >
                <Eye className="h-4 w-4 mr-2" /> View Preview
              </Button>
            </div>

            <div id="quotation-mobile-preview" className="lg:hidden col-span-1 mt-6">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-foreground mb-1">Quotation Preview</h2>
                <p className="text-sm text-muted-foreground">This is how your quotation will look.</p>
              </div>
              <Card className="overflow-hidden">
                <ScrollArea className="h-[400px]">
                  <div className="p-4 bg-muted/30">
                    <div style={{ transform: "scale(0.35)", transformOrigin: "top left", width: "285%" }}>
                      <QuotationTemplate ref={quotationRef} data={quotationData} />
                    </div>
                  </div>
                </ScrollArea>
              </Card>
            </div>

            <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
              <QuotationTemplate ref={quotationRef} data={quotationData} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="receipt" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="lg:col-span-1">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-foreground mb-1">Receipt Details</h2>
                <p className="text-sm text-muted-foreground">Fill in the details below. Preview updates in real-time.</p>
              </div>
              <ScrollArea className="h-[calc(100vh-280px)]">
                <ReceiptForm formData={receiptData} onChange={setReceiptData} onDownload={handleReceiptDownload} />
              </ScrollArea>
            </div>

            <div className="hidden lg:block lg:col-span-1">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-foreground mb-1">Live Preview</h2>
                <p className="text-sm text-muted-foreground">Preview your receipt as you type.</p>
              </div>
              <Card className="overflow-hidden border-2 border-border/50 shadow-lg rounded-xl">
                <ScrollArea className="h-[calc(100vh-280px)] scrollbar-thin">
                  <div className="p-6 bg-gradient-to-b from-muted/40 to-muted/20">
                    <div className="shadow-2xl rounded-lg overflow-hidden" style={{ transform: "scale(0.5)", transformOrigin: "top left", width: "200%" }}>
                      <ReceiptTemplate data={receiptData} />
                    </div>
                  </div>
                </ScrollArea>
              </Card>
            </div>

            <div className="lg:hidden">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => document.getElementById("receipt-mobile-preview")?.scrollIntoView({ behavior: "smooth" })}
              >
                <Eye className="h-4 w-4 mr-2" /> View Preview
              </Button>
            </div>

            <div id="receipt-mobile-preview" className="lg:hidden col-span-1 mt-6">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-foreground mb-1">Receipt Preview</h2>
                <p className="text-sm text-muted-foreground">This is how your receipt will look.</p>
              </div>
              <Card className="overflow-hidden">
                <ScrollArea className="h-[400px]">
                  <div className="p-4 bg-muted/30">
                    <div style={{ transform: "scale(0.35)", transformOrigin: "top left", width: "285%" }}>
                      <ReceiptTemplate ref={receiptRef} data={receiptData} />
                    </div>
                  </div>
                </ScrollArea>
              </Card>
            </div>

            <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
              <ReceiptTemplate ref={receiptRef} data={receiptData} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-medium text-foreground mb-1">Previously Downloaded Invoices</h2>
              <p className="text-sm text-muted-foreground">View and load your previously created invoices for editing.</p>
            </div>
            <InvoiceHistory onLoadInvoice={handleLoadInvoice} onDownloadInvoice={handleDownloadInvoiceFromHistory} />
          </div>
        </TabsContent>

        <TabsContent value="quotation-history" className="space-y-6">
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-medium text-foreground mb-1">Previously Downloaded Quotations</h2>
              <p className="text-sm text-muted-foreground">View and load your previously created quotations for editing.</p>
            </div>
            <QuotationHistory onLoadQuotation={handleLoadQuotation} onDownloadQuotation={handleDownloadQuotationFromHistory} />
          </div>
        </TabsContent>

        <TabsContent value="receipt-history" className="space-y-6">
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-medium text-foreground mb-1">Previously Downloaded Receipts</h2>
              <p className="text-sm text-muted-foreground">View and load your previously created receipts for editing.</p>
            </div>
            <ReceiptHistory onLoadReceipt={handleLoadReceipt} onDownloadReceipt={handleDownloadReceiptFromHistory} />
          </div>
        </TabsContent>

        <TabsContent value="statement" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="lg:col-span-1">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-foreground mb-1">Statement of Account</h2>
                <p className="text-sm text-muted-foreground">Fill in the details below. Preview updates in real-time.</p>
              </div>
              <ScrollArea className="h-[calc(100vh-280px)]">
                <StatementForm formData={statementData} onChange={setStatementData} onDownload={handleStatementDownload} />
              </ScrollArea>
            </div>
            <div className="hidden lg:block lg:col-span-1">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-foreground mb-1">Live Preview</h2>
                <p className="text-sm text-muted-foreground">Preview your statement as you type.</p>
              </div>
              <Card className="overflow-hidden border-2 border-border/50 shadow-lg rounded-xl">
                <ScrollArea className="h-[calc(100vh-280px)] scrollbar-thin">
                  <div className="p-6 bg-gradient-to-b from-muted/40 to-muted/20">
                    <div className="shadow-2xl rounded-lg overflow-hidden" style={{ transform: "scale(0.5)", transformOrigin: "top left", width: "200%" }}>
                      <StatementTemplate data={statementData} />
                    </div>
                  </div>
                </ScrollArea>
              </Card>
            </div>
            <div className="lg:hidden">
              <Button variant="outline" className="w-full" onClick={() => document.getElementById("statement-mobile-preview")?.scrollIntoView({ behavior: "smooth" })}>
                <Eye className="h-4 w-4 mr-2" /> View Preview
              </Button>
            </div>
            <div id="statement-mobile-preview" className="lg:hidden col-span-1 mt-6">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-foreground mb-1">Statement Preview</h2>
                <p className="text-sm text-muted-foreground">This is how your statement will look.</p>
              </div>
              <Card className="overflow-hidden">
                <ScrollArea className="h-[400px]">
                  <div className="p-4 bg-muted/30">
                    <div style={{ transform: "scale(0.35)", transformOrigin: "top left", width: "285%" }}>
                      <StatementTemplate ref={statementRef} data={statementData} />
                    </div>
                  </div>
                </ScrollArea>
              </Card>
            </div>
            <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
              <StatementTemplate ref={statementRef} data={statementData} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="statement-history" className="space-y-6">
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-medium text-foreground mb-1">Previously Downloaded Statements</h2>
              <p className="text-sm text-muted-foreground">View and load your previously created statements for editing.</p>
            </div>
            <StatementHistory onLoadStatement={handleLoadStatement} onDownloadStatement={handleDownloadStatementFromHistory} />
          </div>
        </TabsContent>
      </Tabs>

      <Toaster />
    </div>
  );
}
