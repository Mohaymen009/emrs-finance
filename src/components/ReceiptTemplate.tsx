import { forwardRef } from "react";
import { ReceiptData } from "@/types/invoice";
import emrsLogo from "@/assets/emrs-logo.png";
import signatureImg from "@/assets/signature.png";
import stampImg from "@/assets/company-stamp.png";

interface ReceiptTemplateProps {
  data: ReceiptData;
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

export const ReceiptTemplate = forwardRef<HTMLDivElement, ReceiptTemplateProps>(
  ({ data }, ref) => {
    return (
      <div ref={ref} className="receipt-template">
        {/* Page 1 - Receipt (Single Page) */}
        <div style={pageStyle}>
          {/* Centered Header with Logo and Title */}
          <div
            style={{
              textAlign: "center",
              marginBottom: "32px",
              borderBottom: "2px solid #e2e8f0",
              paddingBottom: "24px",
              position: "relative",
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
              {data.isTaxDocument ? "Tax Receipt" : "Receipt"}
            </h1>

            {/* Centered PAID Badge below title */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: "12px",
              }}
            >
              <div
                style={{
                  backgroundColor: "#48bb78",
                  color: "white",
                  padding: "4px 16px",
                  borderRadius: "6px",
                  fontWeight: "700",
                  fontSize: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "80px",
                  height: "28px",
                }}
              >
                PAID
              </div>
            </div>
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
                <span style={{ color: "#718096" }}>Receipt number</span>{" "}
                <span style={{ color: "#2b6cb0", fontWeight: "600" }}>{data.receiptNumber || "—"}</span>
              </div>
              <div>
                <span style={{ color: "#718096" }}>Date of issue</span>{" "}
                <span style={{ color: "#2b6cb0", fontWeight: "600" }}>
                  {formatDate(data.dateOfIssue) || "—"}
                </span>
              </div>
              <div>
                <span style={{ color: "#718096" }}>Payment date</span>{" "}
                <span style={{ color: "#2b6cb0", fontWeight: "600" }}>
                  {formatDate(data.paymentDate) || "—"}
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

          {/* Amount Paid Header */}
          <div
            style={{
              fontSize: "18px",
              fontWeight: "500",
              color: "#48bb78",
              marginBottom: "24px",
            }}
          >
            {data.amountPaid || "AED0.00"} paid on {formatDate(data.paymentDate)}
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
                <span style={{ color: "#1e3a5f", fontWeight: 600 }}>Total Amount Paid (Incl. VAT)</span>
                <span style={{ color: "#1e3a5f", fontWeight: 600 }}>
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
                <span style={{ color: "#48bb78" }}>Amount paid</span>
                <span style={{ color: "#48bb78" }}>
                  {data.amountPaid || "AED0.00"}
                </span>
              </div>
            </div>
          </div>

          {/* Signature & Stamp Area */}
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
            Page 1 of 1
          </div>
        </div>
      </div>
    );
  }
);

ReceiptTemplate.displayName = "ReceiptTemplate";
