import { InvoiceData, SavedInvoice, QuotationData, SavedQuotation, ReceiptData, SavedReceipt, StatementData, SavedStatement } from "@/types/invoice";

const STORAGE_KEY = "emrs-saved-invoices";
const QUOTATION_STORAGE_KEY = "emrs-saved-quotations";
const RECEIPT_STORAGE_KEY = "emrs-saved-receipts";
const STATEMENT_STORAGE_KEY = "emrs-saved-statements";

export const saveInvoice = (invoiceData: InvoiceData, fileName: string): SavedInvoice => {
  const savedInvoice: SavedInvoice = {
    id: crypto.randomUUID(),
    data: invoiceData,
    createdAt: new Date().toISOString(),
    fileName,
  };

  const existingInvoices = getSavedInvoices();
  const updatedInvoices = [savedInvoice, ...existingInvoices];
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedInvoices));
  return savedInvoice;
};

export const getSavedInvoices = (): SavedInvoice[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error loading saved invoices:", error);
    return [];
  }
};

export const deleteSavedInvoice = (id: string): boolean => {
  try {
    const existingInvoices = getSavedInvoices();
    const updatedInvoices = existingInvoices.filter(invoice => invoice.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedInvoices));
    return true;
  } catch (error) {
    console.error("Error deleting saved invoice:", error);
    return false;
  }
};

export const loadSavedInvoice = (id: string): SavedInvoice | null => {
  try {
    const invoices = getSavedInvoices();
    return invoices.find(invoice => invoice.id === id) || null;
  } catch (error) {
    console.error("Error loading saved invoice:", error);
    return null;
  }
};

// Quotation storage functions
export const saveQuotation = (quotationData: QuotationData, fileName: string): SavedQuotation => {
  const savedQuotation: SavedQuotation = {
    id: crypto.randomUUID(),
    data: quotationData,
    createdAt: new Date().toISOString(),
    fileName,
  };

  const existingQuotations = getSavedQuotations();
  const updatedQuotations = [savedQuotation, ...existingQuotations];
  
  localStorage.setItem(QUOTATION_STORAGE_KEY, JSON.stringify(updatedQuotations));
  return savedQuotation;
};

export const getSavedQuotations = (): SavedQuotation[] => {
  try {
    const stored = localStorage.getItem(QUOTATION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error loading saved quotations:", error);
    return [];
  }
};

export const deleteSavedQuotation = (id: string): boolean => {
  try {
    const existingQuotations = getSavedQuotations();
    const updatedQuotations = existingQuotations.filter(quotation => quotation.id !== id);
    localStorage.setItem(QUOTATION_STORAGE_KEY, JSON.stringify(updatedQuotations));
    return true;
  } catch (error) {
    console.error("Error deleting saved quotation:", error);
    return false;
  }
};

export const loadSavedQuotation = (id: string): SavedQuotation | null => {
  try {
    const quotations = getSavedQuotations();
    return quotations.find(quotation => quotation.id === id) || null;
  } catch (error) {
    console.error("Error loading saved quotation:", error);
    return null;
  }
};

// Receipt storage functions
export const saveReceipt = (receiptData: ReceiptData, fileName: string): SavedReceipt => {
  const savedReceipt: SavedReceipt = {
    id: crypto.randomUUID(),
    data: receiptData,
    createdAt: new Date().toISOString(),
    fileName,
  };

  const existingReceipts = getSavedReceipts();
  const updatedReceipts = [savedReceipt, ...existingReceipts];
  
  localStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(updatedReceipts));
  return savedReceipt;
};

export const getSavedReceipts = (): SavedReceipt[] => {
  try {
    const stored = localStorage.getItem(RECEIPT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error loading saved receipts:", error);
    return [];
  }
};

export const deleteSavedReceipt = (id: string): boolean => {
  try {
    const existingReceipts = getSavedReceipts();
    const updatedReceipts = existingReceipts.filter(receipt => receipt.id !== id);
    localStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(updatedReceipts));
    return true;
  } catch (error) {
    console.error("Error deleting saved receipt:", error);
    return false;
  }
};

export const loadSavedReceipt = (id: string): SavedReceipt | null => {
  try {
    const receipts = getSavedReceipts();
    return receipts.find(receipt => receipt.id === id) || null;
  } catch (error) {
    console.error("Error loading saved receipt:", error);
    return null;
  }
};

// Statement storage functions
export const saveStatement = (statementData: StatementData, fileName: string): SavedStatement => {
  const savedStatement: SavedStatement = {
    id: crypto.randomUUID(),
    data: statementData,
    createdAt: new Date().toISOString(),
    fileName,
  };
  const existing = getSavedStatements();
  localStorage.setItem(STATEMENT_STORAGE_KEY, JSON.stringify([savedStatement, ...existing]));
  return savedStatement;
};

export const getSavedStatements = (): SavedStatement[] => {
  try {
    const stored = localStorage.getItem(STATEMENT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error loading saved statements:", error);
    return [];
  }
};

export const deleteSavedStatement = (id: string): boolean => {
  try {
    const existing = getSavedStatements();
    localStorage.setItem(STATEMENT_STORAGE_KEY, JSON.stringify(existing.filter(s => s.id !== id)));
    return true;
  } catch (error) {
    console.error("Error deleting saved statement:", error);
    return false;
  }
};

export const loadSavedStatement = (id: string): SavedStatement | null => {
  try {
    return getSavedStatements().find(s => s.id === id) || null;
  } catch (error) {
    console.error("Error loading saved statement:", error);
    return null;
  }
};
