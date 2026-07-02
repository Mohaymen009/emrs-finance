import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { StatementData, TransactionItem, BankDetails, ContactDetails } from "@/types/invoice";

interface StatementFormProps {
  formData: StatementData;
  onChange: (data: StatementData) => void;
  onDownload: () => void;
}

export function StatementForm({ formData, onChange, onDownload }: StatementFormProps) {
  const handleInputChange = (field: keyof StatementData, value: string | boolean) => {
    onChange({ ...formData, [field]: value });
  };

  const handleBankChange = (field: keyof BankDetails, value: string) => {
    onChange({
      ...formData,
      bankDetails: { ...formData.bankDetails, [field]: value },
    });
  };

  const handleContactChange = (field: keyof ContactDetails, value: string) => {
    onChange({
      ...formData,
      contactDetails: { ...formData.contactDetails, [field]: value },
    });
  };

  const addTransaction = () => {
    const newItem: TransactionItem = {
      id: crypto.randomUUID(),
      date: "",
      reference: "",
      description: "",
      debit: "",
      credit: "",
      runningBalance: "",
    };
    onChange({
      ...formData,
      transactions: [...formData.transactions, newItem],
    });
  };

  const recalculate = (transactions: TransactionItem[], openingBal: string) => {
    const opening = parseFloat(openingBal.replace(/[^0-9.-]/g, "")) || 0;
    let running = opening;
    let totalDeb = 0;
    let totalCred = 0;

    const updated = transactions.map((t) => {
      const debit = parseFloat(t.debit.replace(/[^0-9.-]/g, "")) || 0;
      const credit = parseFloat(t.credit.replace(/[^0-9.-]/g, "")) || 0;
      totalDeb += debit;
      totalCred += credit;
      running = running + debit - credit;
      return { ...t, runningBalance: `AED ${running.toLocaleString("en-US", { minimumFractionDigits: 2 })}` };
    });

    return {
      transactions: updated,
      totalDebits: `AED ${totalDeb.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      totalCredits: `AED ${totalCred.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      closingBalance: `AED ${running.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    };
  };

  const updateTransaction = (id: string, field: keyof TransactionItem, value: string) => {
    const newTransactions = formData.transactions.map((item) =>
      item.id === id ? { ...item, [field]: value } : item
    );
    const calc = recalculate(newTransactions, formData.openingBalance);
    onChange({ ...formData, ...calc });
  };

  const removeTransaction = (id: string) => {
    const filtered = formData.transactions.filter((item) => item.id !== id);
    const calc = recalculate(filtered, formData.openingBalance);
    onChange({ ...formData, ...calc });
  };

  return (
    <div className="space-y-6">
      {/* Statement Details */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-primary">Statement Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="statementNumber">Statement Number</Label>
              <Input
                id="statementNumber"
                placeholder="e.g., SOA-2026-03-001"
                value={formData.statementNumber}
                onChange={(e) => handleInputChange("statementNumber", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="statementDate">Statement Date</Label>
              <Input
                id="statementDate"
                type="date"
                value={formData.statementDate}
                onChange={(e) => handleInputChange("statementDate", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="periodFrom">Period From</Label>
              <Input
                id="periodFrom"
                type="date"
                value={formData.periodFrom}
                onChange={(e) => handleInputChange("periodFrom", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodTo">Period To</Label>
              <Input
                id="periodTo"
                type="date"
                value={formData.periodTo}
                onChange={(e) => handleInputChange("periodTo", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Details */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-primary">Company Details (From)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input id="companyName" value={formData.companyName} onChange={(e) => handleInputChange("companyName", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyPhone">Phone</Label>
              <Input id="companyPhone" value={formData.companyPhone} onChange={(e) => handleInputChange("companyPhone", e.target.value)} placeholder="+971" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyAddress">Address</Label>
              <Input id="companyAddress" value={formData.companyAddress} onChange={(e) => handleInputChange("companyAddress", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyCity">City / Country</Label>
              <Input id="companyCity" value={formData.companyCity} onChange={(e) => handleInputChange("companyCity", e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyEmail">Email</Label>
            <Input id="companyEmail" value={formData.companyEmail} onChange={(e) => handleInputChange("companyEmail", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Client Details */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-primary">Client Details (Bill To)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name</Label>
              <Input id="clientName" placeholder="e.g., Test Customer LLC" value={formData.clientName} onChange={(e) => handleInputChange("clientName", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientEmail">Client Email</Label>
              <Input id="clientEmail" type="email" placeholder="e.g., client@email.com" value={formData.clientEmail} onChange={(e) => handleInputChange("clientEmail", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientNumber">Client Contact</Label>
              <Input id="clientNumber" placeholder="e.g., +971 50 123 4567" value={formData.clientNumber} onChange={(e) => handleInputChange("clientNumber", e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientBillingAddress">Billing Address (Optional)</Label>
            <textarea
              id="clientBillingAddress"
              placeholder="Enter client's complete billing address"
              value={formData.clientBillingAddress || ""}
              onChange={(e) => handleInputChange("clientBillingAddress", e.target.value)}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-vertical"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Opening Balance */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-primary">Balances (AED)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="openingBalance">Opening Balance</Label>
              <Input id="openingBalance" placeholder="e.g., 2000" value={formData.openingBalance} onChange={(e) => {
                const val = e.target.value;
                const calc = recalculate(formData.transactions, val);
                onChange({ ...formData, openingBalance: val, ...calc });
              }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="closingBalance" className="font-semibold">Closing Balance (Auto)</Label>
              <Input id="closingBalance" value={formData.closingBalance} readOnly className="border-primary bg-muted" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="totalDebits">Total Debits (Auto)</Label>
              <Input id="totalDebits" value={formData.totalDebits} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalCredits">Total Credits (Auto)</Label>
              <Input id="totalCredits" value={formData.totalCredits} readOnly className="bg-muted" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-primary">Transactions</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addTransaction} className="gap-1">
              <Plus className="h-4 w-4" /> Add Transaction
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {formData.transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No transactions added. Click &quot;Add Transaction&quot; to begin.</p>
          ) : (
            <div className="space-y-3">
              {formData.transactions.map((item, index) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-2 space-y-1">
                    {index === 0 && <Label className="text-xs text-muted-foreground">Date</Label>}
                    <Input type="date" value={item.date} onChange={(e) => updateTransaction(item.id, "date", e.target.value)} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {index === 0 && <Label className="text-xs text-muted-foreground">Reference</Label>}
                    <Input placeholder="INV-0001" value={item.reference} onChange={(e) => updateTransaction(item.id, "reference", e.target.value)} />
                  </div>
                  <div className="col-span-3 space-y-1">
                    {index === 0 && <Label className="text-xs text-muted-foreground">Description</Label>}
                    <Input placeholder="Description" value={item.description} onChange={(e) => updateTransaction(item.id, "description", e.target.value)} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {index === 0 && <Label className="text-xs text-muted-foreground">Debit</Label>}
                    <Input placeholder="0.00" value={item.debit} onChange={(e) => updateTransaction(item.id, "debit", e.target.value)} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {index === 0 && <Label className="text-xs text-muted-foreground">Credit</Label>}
                    <Input placeholder="0.00" value={item.credit} onChange={(e) => updateTransaction(item.id, "credit", e.target.value)} />
                  </div>
                  <div className="col-span-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeTransaction(item.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Bank Account Details */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-primary">Bank Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provider Name</Label>
              <Input value={formData.bankDetails.providerName} onChange={(e) => handleBankChange("providerName", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Beneficiary Account Name</Label>
              <Input value={formData.bankDetails.beneficiaryAccountName} onChange={(e) => handleBankChange("beneficiaryAccountName", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Beneficiary Account Number</Label>
              <Input value={formData.bankDetails.beneficiaryAccountNumber} onChange={(e) => handleBankChange("beneficiaryAccountNumber", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>IBAN</Label>
              <Input value={formData.bankDetails.iban} onChange={(e) => handleBankChange("iban", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input value={formData.bankDetails.bankName} onChange={(e) => handleBankChange("bankName", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>SWIFT Code</Label>
              <Input value={formData.bankDetails.swiftCode} onChange={(e) => handleBankChange("swiftCode", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Details */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-primary">Contact Person</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contact Person Name</Label>
              <Input value={formData.contactDetails.contactPersonName} onChange={(e) => handleContactChange("contactPersonName", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Designation</Label>
              <Input value={formData.contactDetails.contactPersonDesignation} onChange={(e) => handleContactChange("contactPersonDesignation", e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Contact Email</Label>
            <Input value={formData.contactDetails.contactPersonEmail} onChange={(e) => handleContactChange("contactPersonEmail", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Signature & Stamp Options */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-primary">Signature & Stamp</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeSignature"
              checked={formData.includeSignature}
              onCheckedChange={(checked) => handleInputChange("includeSignature", checked as boolean)}
            />
            <Label htmlFor="includeSignature">Include Authorized Signature</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeStamp"
              checked={formData.includeStamp}
              onCheckedChange={(checked) => handleInputChange("includeStamp", checked as boolean)}
            />
            <Label htmlFor="includeStamp">Include Company Stamp</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="hideCompanyTRN"
              checked={!!formData.hideCompanyTRN}
              onCheckedChange={(checked) => handleInputChange("hideCompanyTRN", checked as boolean)}
            />
            <Label htmlFor="hideCompanyTRN">Hide Company TRN on document</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeBankPage"
              checked={!!formData.includeBankPage}
              onCheckedChange={(checked) => handleInputChange("includeBankPage", checked as boolean)}
            />
            <Label htmlFor="includeBankPage">Include Bank Details & Contact Page (Page 2)</Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
