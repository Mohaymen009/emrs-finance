import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2, FileText } from "lucide-react";
import { ReceiptData, LineItem } from "@/types/invoice";

interface ReceiptFormProps {
  formData: ReceiptData;
  onChange: (data: ReceiptData) => void;
  onDownload: () => void;
}

export function ReceiptForm({ formData, onChange, onDownload }: ReceiptFormProps) {
  const parseAED = (value: string): number => {
    if (!value) return 0;
    const cleaned = value.replace(/[^0-9.]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const formatAED = (amount: number): string => {
    if (!isFinite(amount)) return "AED0.00";
    return `AED${amount.toFixed(2)}`;
  };

  const recalc = (next: ReceiptData): ReceiptData => {
    const subtotal = parseAED(next.subtotal);
    const discount = parseAED(next.discountAmount || "");
    const afterDiscount = Math.max(subtotal - discount, 0);
    const vatPercent = next.clientType === "individual" ? 0 : parseFloat(next.vatPercent || "0") || 0;
    const vatAmount = afterDiscount * (vatPercent / 100);
    const total = afterDiscount + vatAmount;
    return {
      ...next,
      vatPercent: next.clientType === "individual" ? "0" : (next.vatPercent || "5"),
      vatAmount: formatAED(vatAmount),
      total: formatAED(total),
      amountPaid: formatAED(total),
    };
  };

  const handleInputChange = (field: keyof ReceiptData, value: string | boolean) => {
    onChange(recalc({ ...formData, [field]: value } as ReceiptData));
  };

  const addLineItem = () => {
    const newItem: LineItem = {
      id: crypto.randomUUID(),
      description: "",
      qty: "",
      unitPrice: "",
      amount: "",
    };
    onChange({ ...formData, lineItems: [...formData.lineItems, newItem] });
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string) => {
    onChange({
      ...formData,
      lineItems: formData.lineItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    });
  };

  const removeLineItem = (id: string) => {
    onChange({
      ...formData,
      lineItems: formData.lineItems.filter((item) => item.id !== id),
    });
  };

  const handleDiscountPercentChange = (value: string) => {
    const subtotalNumber = parseAED(formData.subtotal);
    const percent = parseFloat(value) || 0;
    const discountAmount = subtotalNumber * (percent / 100);
    onChange(recalc({
      ...formData,
      discountPercent: value,
      discountAmount: discountAmount ? formatAED(discountAmount) : "",
    }));
  };

  const handleDiscountAmountChange = (value: string) => {
    const subtotalNumber = parseAED(formData.subtotal);
    const discountNumber = parseAED(value);
    const clampedDiscount = Math.min(discountNumber, subtotalNumber || discountNumber);
    const percent = subtotalNumber ? (clampedDiscount / subtotalNumber) * 100 : 0;
    onChange(recalc({
      ...formData,
      discountAmount: value,
      discountPercent: subtotalNumber ? percent.toFixed(2) : formData.discountPercent,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Receipt Details */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-primary">
            Receipt Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="receiptNumber">Receipt Number</Label>
              <Input
                id="receiptNumber"
                placeholder="e.g., REC-0001"
                value={formData.receiptNumber}
                onChange={(e) => handleInputChange("receiptNumber", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfIssue">Date of Issue</Label>
              <Input
                id="dateOfIssue"
                type="date"
                value={formData.dateOfIssue}
                onChange={(e) => handleInputChange("dateOfIssue", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment Date</Label>
              <Input
                id="paymentDate"
                type="date"
                value={formData.paymentDate}
                onChange={(e) => handleInputChange("paymentDate", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Details */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-primary">
            Company Details (From)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => handleInputChange("companyName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyPhone">Phone</Label>
              <Input
                id="companyPhone"
                value={formData.companyPhone}
                onChange={(e) => handleInputChange("companyPhone", e.target.value)}
                placeholder="+971"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyAddress">Address</Label>
              <Input
                id="companyAddress"
                value={formData.companyAddress}
                onChange={(e) => handleInputChange("companyAddress", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyCity">City / Country</Label>
              <Input
                id="companyCity"
                value={formData.companyCity}
                onChange={(e) => handleInputChange("companyCity", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client Details */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-primary">
            Client Details (Paid By)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Client Type (controls VAT)</Label>
            <RadioGroup
              value={formData.clientType || "business"}
              onValueChange={(v) => handleInputChange("clientType", v)}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="business" id="rct-business" />
                <Label htmlFor="rct-business" className="cursor-pointer">Business / Client (5% VAT)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="individual" id="rct-individual" />
                <Label htmlFor="rct-individual" className="cursor-pointer">Individual (0% VAT)</Label>
              </div>
            </RadioGroup>
          </div>
          {formData.clientType === "individual" && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
              Individual receipt — no company bill-to name required. The receipt will display a generic recipient.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientName">
                {formData.clientType === "individual" ? "Patient Name (Optional)" : "Bill To Name (Company)"}
              </Label>
              <Input
                id="clientName"
                placeholder={formData.clientType === "individual" ? "e.g., John Doe" : "e.g., ABC Corporation LLC"}
                value={formData.clientName}
                onChange={(e) => handleInputChange("clientName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientEmail">Client Email</Label>
              <Input
                id="clientEmail"
                type="email"
                placeholder="e.g., client@email.com"
                value={formData.clientEmail}
                onChange={(e) => handleInputChange("clientEmail", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientNumber">Client Number</Label>
              <Input
                id="clientNumber"
                placeholder="e.g., +971 50 123 4567"
                value={formData.clientNumber}
                onChange={(e) => handleInputChange("clientNumber", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientTRN">Client TRN (Optional)</Label>
              <Input
                id="clientTRN"
                placeholder="e.g., 104945541100003"
                value={formData.clientTRN || ""}
                onChange={(e) => handleInputChange("clientTRN", e.target.value)}
              />
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
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-primary">
              Line Items (Optional)
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLineItem}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {formData.lineItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No line items added. Click &quot;Add Item&quot; to add descriptions.
            </p>
          ) : (
            <div className="space-y-3">
              {formData.lineItems.map((item, index) => (
                <div
                  key={item.id}
                  className="grid grid-cols-12 gap-2 items-end"
                >
                  <div className="col-span-5 space-y-1">
                    {index === 0 && (
                      <Label className="text-xs text-muted-foreground">
                        Description
                      </Label>
                    )}
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) =>
                        updateLineItem(item.id, "description", e.target.value)
                      }
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {index === 0 && (
                      <Label className="text-xs text-muted-foreground">Qty</Label>
                    )}
                    <Input
                      placeholder="Qty"
                      value={item.qty}
                      onChange={(e) =>
                        updateLineItem(item.id, "qty", e.target.value)
                      }
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {index === 0 && (
                      <Label className="text-xs text-muted-foreground">
                        Unit Price
                      </Label>
                    )}
                    <Input
                      placeholder="Unit Price"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateLineItem(item.id, "unitPrice", e.target.value)
                      }
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {index === 0 && (
                      <Label className="text-xs text-muted-foreground">
                        Amount
                      </Label>
                    )}
                    <Input
                      placeholder="Amount"
                      value={item.amount}
                      onChange={(e) =>
                        updateLineItem(item.id, "amount", e.target.value)
                      }
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLineItem(item.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-primary">
            Totals (AED)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subtotal">Subtotal</Label>
              <Input
                id="subtotal"
                placeholder="e.g., AED0.00"
                value={formData.subtotal}
                onChange={(e) => handleInputChange("subtotal", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discountPercent">Discount %</Label>
              <Input
                id="discountPercent"
                placeholder="e.g., 10"
                value={formData.discountPercent ?? ""}
                onChange={(e) => handleDiscountPercentChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discountAmount">Discount (AED)</Label>
              <Input
                id="discountAmount"
                placeholder="e.g., AED100.00"
                value={formData.discountAmount ?? ""}
                onChange={(e) => handleDiscountAmountChange(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="total">Total</Label>
              <Input
                id="total"
                placeholder="e.g., AED0.00"
                value={formData.total}
                onChange={(e) => handleInputChange("total", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amountPaid" className="font-semibold text-green-600">
                Amount Paid
              </Label>
              <Input
                id="amountPaid"
                placeholder="e.g., AED0.00"
                value={formData.amountPaid}
                onChange={(e) => handleInputChange("amountPaid", e.target.value)}
                className="border-green-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signature & Stamp Options */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-primary">
            Signature & Stamp Options
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeSignature"
              checked={formData.includeSignature}
              onCheckedChange={(checked) =>
                handleInputChange("includeSignature", checked as boolean)
              }
            />
            <Label htmlFor="includeSignature" className="cursor-pointer">
              Include Signature
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeStamp"
              checked={formData.includeStamp}
              onCheckedChange={(checked) =>
                handleInputChange("includeStamp", checked as boolean)
              }
            />
            <Label htmlFor="includeStamp" className="cursor-pointer">
              Include Company Stamp
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isTaxDocument"
              checked={!!formData.isTaxDocument}
              onCheckedChange={(checked) =>
                handleInputChange("isTaxDocument", checked as boolean)
              }
            />
            <Label htmlFor="isTaxDocument" className="cursor-pointer">
              Label as <span className="font-semibold">Tax Receipt</span> (uncheck for plain &quot;Receipt&quot;)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="hideCompanyTRN"
              checked={!!formData.hideCompanyTRN}
              onCheckedChange={(checked) =>
                handleInputChange("hideCompanyTRN", checked as boolean)
              }
            />
            <Label htmlFor="hideCompanyTRN" className="cursor-pointer">
              Hide Company TRN on document
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Download Button */}
      <Button onClick={onDownload} className="w-full gap-2" size="lg">
        <FileText className="h-5 w-5" />
        Generate Receipt PDF
      </Button>
    </div>
  );
}
