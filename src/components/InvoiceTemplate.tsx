import { forwardRef } from "react";
import { InvoiceData } from "@/types/invoice";
import emrsLogo from "@/assets/emrs-logo.png";
import signatureImg from "@/assets/signature.png";
import stampImg from "@/assets/company-stamp.png";

interface InvoiceTemplateProps {
  data: InvoiceData;
}

function formatDate(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const pageStyle = {
  width: "210mm",
  minHeight: "285mm",
  padding: "18mm",
  fontFamily: "'IBM Plex Sans', Arial, sans-serif",
  fontSize: "12px",
  color: "#2d3748",
  position: "relative" as const,
  boxSizing: "border-box" as const,
  backgroundColor: "white",
};

export const InvoiceTemplate = forwardRef<HTMLDivElement, InvoiceTemplateProps>(
  ({ data }, ref) => {
    return (
      <div ref={ref} className="invoice-template">
        {/* Page 1 - Invoice */}
        <div style={pageStyle}>
          {/* Centered Header with Logo and Title */}
          <div
            style={{
              textAlign: "center",
              marginBottom: "32px",
              borderBottom: "2px solid #e2e8f0",
              paddingBottom: "24px",
            }}
          >
            <div style={{ marginBottom: "16px" }}>
              <img
                src={emrsLogo.src}
                alt="EMRS Logo"
                style={{
                  width: "120px",
                  height: "auto",
                  margin: "0 auto",
                  display: "block",
                }}
              />
            </div>
            <div
              style={{
                fontSize: "14px",
                fontWeight: "600",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#4a5568",
                marginBottom: "8px",
              }}
            >
              EMRS AMBULANCE SERVICES LLC
            </div>
            <h1
              style={{
                fontSize: "32px",
                fontWeight: "800",
                color: "#1e3a5f",
                margin: "0",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {data.isTaxDocument ? "Tax Invoice" : "Invoice"}
            </h1>
          </div>

          {/* Details Row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "24px",
            }}
          >
            <div style={{ fontSize: "12px", lineHeight: "1.6" }}>
              <div>
                <span style={{ color: "#718096" }}>Invoice number</span>{" "}
                <span style={{ color: "#2b6cb0", fontWeight: "600" }}>{data.invoiceNumber || "—"}</span>
              </div>
              <div>
                <span style={{ color: "#718096" }}>Date of issue</span>{" "}
                <span style={{ color: "#2b6cb0", fontWeight: "600" }}>
                  {formatDate(data.dateOfIssue) || "—"}
                </span>
              </div>
              <div>
                <span style={{ color: "#718096" }}>Date due</span>{" "}
                <span style={{ color: "#2b6cb0", fontWeight: "600" }}>
                  {formatDate(data.dateDue) || "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Company & Client Details */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "24px",
              fontSize: "12px",
            }}
          >
            <div style={{ lineHeight: "1.6", maxWidth: "55%" }}>
              <div style={{ fontWeight: "600", color: "#1e3a5f" }}>
                {data.companyName || "—"}
              </div>
              <div style={{ color: "#718096" }}>{data.companyAddress}</div>
              <div style={{ color: "#718096" }}>{data.companyCity}</div>
              {data.companyTRN && !data.hideCompanyTRN && (
                <div style={{ color: "#1e3a5f", fontWeight: 600 }}>TRN: {data.companyTRN}</div>
              )}
              {data.companyPhone && (
                <div style={{ color: "#718096" }}>Contact: {data.companyPhone}</div>
              )}
              {data.companyEmail && (
                <div style={{ color: "#2b6cb0" }}>Email: {data.companyEmail}</div>
              )}
            </div>
            <div style={{ textAlign: "left", lineHeight: "1.6" }}>
              <div style={{ fontWeight: "600", color: "#718096" }}>BILL TO:</div>
              <div style={{ color: "#1e3a5f", fontWeight: 600 }}>{data.clientName || "—"}</div>
              {data.clientBillingAddress && (
                <div style={{
                  whiteSpace: "pre-line",
                  color: "#718096",
                  fontSize: "11px",
                }}>
                  {data.clientBillingAddress}
                </div>
              )}
              {data.clientTRN && (
                <div style={{ color: "#1e3a5f", fontWeight: 600 }}>TRN: {data.clientTRN}</div>
              )}
              {data.clientNumber && (
                <div style={{ color: "#718096" }}>Contact: {data.clientNumber}</div>
              )}
              {data.clientEmail && (
                <div style={{ color: "#2b6cb0" }}>Email: {data.clientEmail}</div>
              )}
            </div>
          </div>

          {/* Amount Due Header */}
          <div
            style={{
              fontSize: "18px",
              fontWeight: "500",
              color: "#2b6cb0",
              marginBottom: "24px",
            }}
          >
            {data.amountDue || "AED0.00"} due {formatDate(data.dateDue)}
          </div>

          {/* Line Items Table */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginBottom: "24px",
              fontSize: "12px",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <th
                  style={{
                    textAlign: "left",
                    padding: "8px 0",
                    color: "#718096",
                    fontWeight: "500",
                  }}
                >
                  Description
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "8px 0",
                    color: "#718096",
                    fontWeight: "500",
                  }}
                >
                  Qty
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "8px 0",
                    color: "#718096",
                    fontWeight: "500",
                  }}
                >
                  Unit price
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "8px 0",
                    color: "#718096",
                    fontWeight: "500",
                  }}
                >
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {data.lineItems.length > 0 ? (
                data.lineItems.map((item) => (
                  <tr
                    key={item.id}
                    style={{ borderBottom: "1px solid #f7fafc" }}
                  >
                    <td style={{ padding: "12px 0", color: "#2d3748" }}>
                      {item.description}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        padding: "12px 0",
                        color: "#2d3748",
                      }}
                    >
                      {item.qty}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        padding: "12px 0",
                        color: "#2d3748",
                      }}
                    >
                      {item.unitPrice}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        padding: "12px 0",
                        color: "#2d3748",
                      }}
                    >
                      {item.amount}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} style={{ padding: "12px 0", color: "#a0aec0" }}>
                    —
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Totals */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "48px",
            }}
          >
            <div style={{ width: "250px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: "1px solid #f7fafc",
                }}
              >
                <span style={{ color: "#718096" }}>Subtotal (Excl. VAT)</span>
                <span style={{ color: "#2d3748" }}>
                  {data.subtotal || "AED0.00"}
                </span>
              </div>
              {data.discountAmount && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid #f7fafc",
                  }}
                >
                  <span style={{ color: "#718096" }}>
                    Discount{data.discountPercent ? ` (${data.discountPercent}%)` : ""}
                  </span>
                  <span style={{ color: "#2d3748" }}>{data.discountAmount}</span>
                </div>
              )}
              {data.vatAmount && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid #f7fafc",
                  }}
                >
                  <span style={{ color: "#718096" }}>
                    Total VAT ({data.vatPercent || "0"}%)
                  </span>
                  <span style={{ color: "#2d3748" }}>{data.vatAmount}</span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: "1px solid #f7fafc",
                }}
              >
                <span style={{ color: "#718096" }}>Total (Incl. VAT)</span>
                <span style={{ color: "#2d3748" }}>
                  {data.total || "AED0.00"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  fontWeight: "600",
                }}
              >
                <span style={{ color: "#1e3a5f" }}>Amount due</span>
                <span style={{ color: "#1e3a5f" }}>
                  {data.amountDue || "AED0.00"}
                </span>
              </div>
            </div>
          </div>

          {/* Signature & Stamp Area on First Page */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "flex-end",
              gap: "24px",
              marginTop: "48px",
              marginBottom: "48px",
            }}
          >
            {data.includeSignature && (
              <div style={{ textAlign: "center" }}>
                <img
                  src={signatureImg.src}
                  alt="Signature"
                  style={{ height: "50px", marginBottom: "8px" }}
                />
              </div>
            )}
            {data.includeStamp && (
              <div style={{ textAlign: "center" }}>
                <img
                  src={stampImg.src}
                  alt="Company Stamp"
                  style={{ width: "100px", height: "100px", objectFit: "contain" }}
                />
              </div>
            )}
          </div>

          {/* Footer with Page Number */}
          <div
            style={{
              position: "absolute",
              bottom: "15mm",
              left: "20mm",
              fontSize: "10px",
              color: "#a0aec0",
            }}
          >
            Page 1 of 2
          </div>
        </div>

        {/* Page 2 - Bank Account Details */}
        <div style={pageStyle}>
          {/* Decorative Corner */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "80px",
              height: "80px",
              background: "linear-gradient(135deg, #1e3a5f 0%, #2b6cb0 100%)",
              clipPath: "polygon(0 0, 100% 0, 0 100%)",
            }}
          />

          {/* Bank Account Details Title */}
          <h2
            style={{
              textAlign: "center",
              fontSize: "18px",
              fontWeight: "700",
              color: "#1e3a5f",
              marginBottom: "24px",
              marginTop: "40px",
            }}
          >
            BANK ACCOUNT DETAILS
          </h2>

          {/* Bank Details Table */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginBottom: "20px",
              fontSize: "11px",
            }}
          >
            <tbody>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td
                  style={{
                    padding: "10px 12px",
                    backgroundColor: "#f7fafc",
                    fontWeight: "500",
                    width: "40%",
                  }}
                >
                  PROVIDER NAME
                </td>
                <td style={{ padding: "10px 12px" }}>
                  {data.bankDetails.providerName}
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td
                  style={{
                    padding: "10px 12px",
                    backgroundColor: "#f7fafc",
                    fontWeight: "500",
                  }}
                >
                  BENEFICIARY ACCOUNT NAME
                </td>
                <td style={{ padding: "10px 12px" }}>
                  {data.bankDetails.beneficiaryAccountName}
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td
                  style={{
                    padding: "10px 12px",
                    backgroundColor: "#f7fafc",
                    fontWeight: "500",
                  }}
                >
                  BENEFICIARY ACCOUNT NUMBER
                </td>
                <td style={{ padding: "10px 12px" }}>
                  {data.bankDetails.beneficiaryAccountNumber}
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td
                  style={{
                    padding: "10px 12px",
                    backgroundColor: "#f7fafc",
                    fontWeight: "500",
                  }}
                >
                  INTERNATIONAL BANK ACCOUNT NUMBER/IBAN
                </td>
                <td style={{ padding: "10px 12px" }}>{data.bankDetails.iban}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td
                  style={{
                    padding: "10px 12px",
                    backgroundColor: "#f7fafc",
                    fontWeight: "500",
                  }}
                >
                  BANK NAME
                </td>
                <td style={{ padding: "10px 12px" }}>
                  {data.bankDetails.bankName}
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td
                  style={{
                    padding: "10px 12px",
                    backgroundColor: "#f7fafc",
                    fontWeight: "500",
                  }}
                >
                  SWIFT CODE
                </td>
                <td style={{ padding: "10px 12px" }}>
                  {data.bankDetails.swiftCode}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Contact Details */}
          <div
            style={{
              backgroundColor: "#1e3a5f",
              color: "white",
              padding: "10px 12px",
              fontWeight: "600",
              fontSize: "12px",
              marginBottom: "0",
            }}
          >
            CONTACT DETAILS
          </div>
          <div
            style={{
              border: "1px solid #e2e8f0",
              borderTop: "none",
              padding: "10px 12px",
              marginBottom: "12px",
              fontSize: "11px",
              lineHeight: "1.6",
            }}
          >
            <div>{data.contactDetails.companyAddress}</div>
            <div>
              Email: <span style={{ color: "#2b6cb0" }}>{data.contactDetails.email}</span>
            </div>
          </div>

          {/* Contact Person Table */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginBottom: "12px",
              fontSize: "11px",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f7fafc" }}>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: "600",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  Name of person
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: "600",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  Designation
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: "600",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  Email ID
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  {data.contactDetails.contactPersonName}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  {data.contactDetails.contactPersonDesignation}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  {data.contactDetails.contactPersonEmail}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Authorized Signatory Table */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginBottom: "32px",
              fontSize: "11px",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f7fafc" }}>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: "600",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  Authorized signatory name
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: "600",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  Designation
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: "600",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  Mobile number
                </th>
                <th
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: "600",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  Email ID
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  {data.contactDetails.authorizedSignatoryName}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  {data.contactDetails.authorizedSignatoryDesignation}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  {data.contactDetails.authorizedSignatoryMobile}
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  {data.contactDetails.authorizedSignatoryEmail}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Signature & Stamp Area on Second Page */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "flex-end",
              gap: "24px",
              marginTop: "28px",
            }}
          >
            {data.includeSignature && (
              <div style={{ textAlign: "center" }}>
                <img
                  src={signatureImg.src}
                  alt="Signature"
                  style={{ height: "50px", marginBottom: "8px" }}
                />
              </div>
            )}
            {data.includeStamp && (
              <div style={{ textAlign: "center" }}>
                <img
                  src={stampImg.src}
                  alt="Company Stamp"
                  style={{ width: "100px", height: "100px", objectFit: "contain" }}
                />
              </div>
            )}
          </div>

          {/* Decorative Bottom Corner */}
          <div
            style={{
              position: "absolute",
              bottom: "60px",
              left: "20mm",
              display: "flex",
              gap: "4px",
            }}
          >
            <div
              style={{
                width: "60px",
                height: "60px",
                background: "#2b6cb0",
                clipPath: "polygon(0 0, 100% 100%, 0 100%)",
              }}
            />
            <div
              style={{
                width: "60px",
                height: "60px",
                background: "#1e3a5f",
                clipPath: "polygon(0 0, 100% 0, 100% 100%)",
              }}
            />
          </div>

          {/* Footer Info */}
          <div
            style={{
              position: "absolute",
              bottom: "30px",
              right: "20mm",
              textAlign: "right",
              fontSize: "10px",
              color: "#2b6cb0",
            }}
          >
            <div style={{ fontWeight: "600" }}>
              Address: {data.contactDetails.companyAddress}
            </div>
            <div>
              Email:{" "}
              <span style={{ color: "#2b6cb0" }}>{data.contactDetails.email}</span>
            </div>
          </div>

          {/* Footer with Page Number */}
          <div
            style={{
              position: "absolute",
              bottom: "15mm",
              left: "20mm",
              fontSize: "10px",
              color: "#a0aec0",
            }}
          >
            Page 2 of 2
          </div>
        </div>
      </div>
    );
  }
);

InvoiceTemplate.displayName = "InvoiceTemplate";
