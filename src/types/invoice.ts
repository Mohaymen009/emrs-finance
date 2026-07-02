export interface LineItem {
  id: string;
  description: string;
  qty: string;
  unitPrice: string;
  amount: string;
}

export interface BankDetails {
  providerName: string;
  beneficiaryAccountName: string;
  beneficiaryAccountNumber: string;
  iban: string;
  bankName: string;
  swiftCode: string;
}

export interface ContactDetails {
  companyAddress: string;
  email: string;
  contactPersonName: string;
  contactPersonDesignation: string;
  contactPersonEmail: string;
  authorizedSignatoryName: string;
  authorizedSignatoryDesignation: string;
  authorizedSignatoryMobile: string;
  authorizedSignatoryEmail: string;
}

export interface SavedQuotation {
  id: string;
  data: QuotationData;
  createdAt: string;
  fileName: string;
}

export type ClientType = "business" | "individual";

export interface QuotationData {
  quotationNumber: string;
  dateOfIssue: string;
  companyName: string;
  companyAddress: string;
  companyCity: string;
  companyCountry: string;
  companyPhone: string;
  companyTRN?: string;
  companyEmail?: string;
  hideCompanyTRN?: boolean;
  clientName: string;
  clientEmail: string;
  clientNumber: string;
  clientTRN?: string;
  clientType?: ClientType;
  clientBillingAddress?: string;
  lineItems: LineItem[];
  subtotal: string;
  vatPercent?: string;
  vatAmount?: string;
  total: string;
  discountPercent?: string;
  discountAmount?: string;
  // Page 2 - Bank & Contact Details
  bankDetails: BankDetails;
  contactDetails: ContactDetails;
  includeSignature: boolean;
  includeStamp: boolean;
  isTaxDocument?: boolean;
}

export interface SavedInvoice {
  id: string;
  data: InvoiceData;
  createdAt: string;
  fileName: string;
}

export interface InvoiceData {
  invoiceNumber: string;
  dateOfIssue: string;
  dateDue: string;
  companyName: string;
  companyAddress: string;
  companyCity: string;
  companyCountry: string;
  companyPhone: string;
  companyTRN?: string;
  companyEmail?: string;
  hideCompanyTRN?: boolean;
  clientName: string;
  clientEmail: string;
  clientNumber: string;
  clientTRN?: string;
  clientType?: ClientType;
  clientBillingAddress?: string;
  lineItems: LineItem[];
  subtotal: string;
  vatPercent?: string;
  vatAmount?: string;
  total: string;
  amountDue: string;
  discountPercent?: string;
  discountAmount?: string;
  // Page 2 - Bank & Contact Details
  bankDetails: BankDetails;
  contactDetails: ContactDetails;
  // Signature & Stamp options
  includeSignature: boolean;
  includeStamp: boolean;
  isTaxDocument?: boolean;
}

export interface SavedReceipt {
  id: string;
  data: ReceiptData;
  createdAt: string;
  fileName: string;
}

export interface ReceiptData {
  receiptNumber: string;
  dateOfIssue: string;
  paymentDate: string;
  companyName: string;
  companyAddress: string;
  companyCity: string;
  companyCountry: string;
  companyPhone: string;
  companyTRN?: string;
  companyEmail?: string;
  hideCompanyTRN?: boolean;
  clientName: string;
  clientEmail: string;
  clientNumber: string;
  clientTRN?: string;
  clientType?: ClientType;
  clientBillingAddress?: string;
  lineItems: LineItem[];
  subtotal: string;
  vatPercent?: string;
  vatAmount?: string;
  total: string;
  amountPaid: string;
  discountPercent?: string;
  discountAmount?: string;
  includeSignature: boolean;
  includeStamp: boolean;
  isTaxDocument?: boolean;
}

export interface TransactionItem {
  id: string;
  date: string;
  reference: string;
  description: string;
  debit: string;
  credit: string;
  runningBalance: string;
}

export interface SavedStatement {
  id: string;
  data: StatementData;
  createdAt: string;
  fileName: string;
}

export interface StatementData {
  statementNumber: string;
  statementDate: string;
  periodFrom: string;
  periodTo: string;
  companyName: string;
  companyAddress: string;
  companyCity: string;
  companyCountry: string;
  companyPhone: string;
  companyEmail: string;
  companyTRN?: string;
  hideCompanyTRN?: boolean;
  clientName: string;
  clientEmail: string;
  clientNumber: string;
  clientBillingAddress?: string;
  openingBalance: string;
  closingBalance: string;
  totalDebits: string;
  totalCredits: string;
  transactions: TransactionItem[];
  bankDetails: BankDetails;
  contactDetails: ContactDetails;
  includeSignature: boolean;
  includeStamp: boolean;
  includeBankPage?: boolean;
}
