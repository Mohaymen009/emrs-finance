import { forwardRef } from "react";
import { StatementData } from "@/types/invoice";
import emrsLogo from "@/assets/emrs-logo.png";
import signatureImg from "@/assets/signature.png";
import stampImg from "@/assets/company-stamp.png";

interface StatementTemplateProps {
  data: StatementData;
}

function formatDate(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
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

export const StatementTemplate = forwardRef<HTMLDivElement, StatementTemplateProps>(
  ({ data }, ref) => {
    return (
      <div ref={ref} className="statement-template">
        {/* Page 1 - Statement of Account */}
        <div style={pageStyle}>
          {/* Logo + Company Name */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <img src={emrsLogo.src} alt="EMRS Logo" style={{ width: "80px", height: "auto", objectFit: "contain" }} />
            <div style={{ fontSize: "16px", fontWeight: "600", letterSpacing: "0.08em", textTransform: "uppercase", color: "#1e3a5f" }}>
              {data.companyName || "EMRS AMBULANCE SERVICES LLC"}
            </div>
          </div>

          {/* Company Address */}
          <div style={{ fontSize: "11px", color: "#718096", lineHeight: "1.6", marginBottom: "16px" }}>
            <div>{data.companyAddress}, {data.companyCity}</div>
            {data.companyTRN && !data.hideCompanyTRN && <div style={{ color: "#1e3a5f", fontWeight: 600 }}>TRN: {data.companyTRN}</div>}
            {data.companyPhone && <div>Phone: {data.companyPhone}</div>}
            {data.companyEmail && <div>Email: {data.companyEmail}</div>}
          </div>

          {/* Title */}
          <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#1e3a5f", textAlign: "center", margin: "16px 0 24px 0", borderBottom: "2px solid #1e3a5f", borderTop: "2px solid #1e3a5f", padding: "8px 0" }}>
            STATEMENT OF ACCOUNT
          </h1>

          {/* Statement Details */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px", fontSize: "12px" }}>
            <div style={{ lineHeight: "1.8" }}>
              <div><span style={{ color: "#718096" }}>Statement Number:</span> <span style={{ fontWeight: "600", color: "#1e3a5f" }}>{data.statementNumber || "—"}</span></div>
              <div><span style={{ color: "#718096" }}>Statement Date:</span> <span style={{ color: "#2b6cb0" }}>{formatDate(data.statementDate) || "—"}</span></div>
              <div><span style={{ color: "#718096" }}>Statement Period:</span> <span style={{ color: "#2b6cb0" }}>{formatDate(data.periodFrom)} – {formatDate(data.periodTo)}</span></div>
            </div>
          </div>

          {/* Bill To */}
          <div style={{ marginBottom: "20px", padding: "12px", backgroundColor: "#f7fafc", borderRadius: "4px", fontSize: "12px" }}>
            <div style={{ fontWeight: "600", color: "#718096", marginBottom: "4px" }}>Bill To:</div>
            <div style={{ fontWeight: "600", color: "#1e3a5f" }}>{data.clientName || "—"}</div>
            {data.clientEmail && <div style={{ color: "#718096" }}>{data.clientEmail}</div>}
            {data.clientNumber && <div style={{ color: "#718096" }}>{data.clientNumber}</div>}
            {data.clientBillingAddress && (
              <div style={{ whiteSpace: "pre-line", color: "#718096", marginTop: "4px", fontSize: "11px" }}>{data.clientBillingAddress}</div>
            )}
          </div>

          {/* Opening Balance */}
          <div style={{ fontSize: "14px", fontWeight: "600", color: "#1e3a5f", marginBottom: "16px", padding: "8px 12px", backgroundColor: "#ebf4ff", borderRadius: "4px" }}>
            Opening Balance: {data.openingBalance || "AED 0.00"}
          </div>

          {/* Transaction Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px", fontSize: "11px" }}>
            <thead>
              <tr style={{ backgroundColor: "#1e3a5f" }}>
                <th style={{ textAlign: "left", padding: "8px 10px", color: "white", fontWeight: "500" }}>Date</th>
                <th style={{ textAlign: "left", padding: "8px 10px", color: "white", fontWeight: "500" }}>Reference</th>
                <th style={{ textAlign: "left", padding: "8px 10px", color: "white", fontWeight: "500" }}>Description</th>
                <th style={{ textAlign: "right", padding: "8px 10px", color: "white", fontWeight: "500" }}>Debit (AED)</th>
                <th style={{ textAlign: "right", padding: "8px 10px", color: "white", fontWeight: "500" }}>Credit (AED)</th>
                <th style={{ textAlign: "right", padding: "8px 10px", color: "white", fontWeight: "500" }}>Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.length > 0 ? (
                data.transactions.map((item, index) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: index % 2 === 0 ? "white" : "#f7fafc" }}>
                    <td style={{ padding: "8px 10px", color: "#2d3748" }}>{formatDate(item.date)}</td>
                    <td style={{ padding: "8px 10px", color: "#2d3748" }}>{item.reference}</td>
                    <td style={{ padding: "8px 10px", color: "#2d3748" }}>{item.description}</td>
                    <td style={{ textAlign: "right", padding: "8px 10px", color: "#2d3748" }}>{item.debit || "–"}</td>
                    <td style={{ textAlign: "right", padding: "8px 10px", color: "#2d3748" }}>{item.credit || "–"}</td>
                    <td style={{ textAlign: "right", padding: "8px 10px", color: "#2d3748", fontWeight: "500" }}>{item.runningBalance}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: "24px 10px", color: "#a0aec0", textAlign: "center", fontSize: "13px", fontStyle: "italic" }}>
                    No transactions found for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Statement Summary */}
          <div style={{ marginBottom: "16px" }}>
            <h3 style={{ fontSize: "13px", fontWeight: "600", color: "#1e3a5f", marginBottom: "8px" }}>Statement Summary</h3>
            <div style={{ fontSize: "12px", lineHeight: "1.8" }}>
              <div style={{ display: "flex", justifyContent: "space-between", maxWidth: "350px" }}>
                <span style={{ color: "#718096" }}>Opening Balance:</span>
                <span style={{ color: "#2d3748" }}>{data.openingBalance || "AED 0.00"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", maxWidth: "350px" }}>
                <span style={{ color: "#718096" }}>Total Debits:</span>
                <span style={{ color: "#2d3748" }}>{data.totalDebits || "AED 0.00"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", maxWidth: "350px" }}>
                <span style={{ color: "#718096" }}>Total Credits:</span>
                <span style={{ color: "#2d3748" }}>{data.totalCredits || "AED 0.00"}</span>
              </div>
            </div>
          </div>

          {/* Closing Balance - BIG & CLEAR */}
          <div style={{
            fontSize: "18px",
            fontWeight: "700",
            color: "white",
            backgroundColor: "#1e3a5f",
            padding: "14px 18px",
            borderRadius: "6px",
            marginBottom: "24px",
            textAlign: "center",
          }}>
            Closing Balance: {data.closingBalance || "AED 0.00"} (Amount Outstanding)
          </div>

          {/* Inline Authorized Signatory when bank page is hidden */}
          {!data.includeBankPage && (data.includeSignature || data.includeStamp) && (
            <div style={{ marginTop: "32px" }}>
              <div style={{ fontSize: "12px", fontWeight: "600", color: "#1e3a5f", marginBottom: "12px" }}>
                Authorized Signatory
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "24px" }}>
                {data.includeSignature && (
                  <img src={signatureImg.src} alt="Signature" style={{ height: "50px" }} />
                )}
                {data.includeStamp && (
                  <img src={stampImg.src} alt="Company Stamp" style={{ width: "100px", height: "100px", objectFit: "contain" }} />
                )}
              </div>
            </div>
          )}

          {/* Footer with Page Number */}
          <div style={{ position: "absolute", bottom: "15mm", left: "20mm", fontSize: "10px", color: "#a0aec0" }}>
            Page 1 of {data.includeBankPage ? 2 : 1}
          </div>
        </div>

        {/* Page 2 - Bank Details, Contact, Signature (optional) */}
        {data.includeBankPage && (
        <div style={pageStyle}>
          {/* Decorative Corner */}
          <div style={{ position: "absolute", top: 0, left: 0, width: "80px", height: "80px", background: "linear-gradient(135deg, #1e3a5f 0%, #2b6cb0 100%)", clipPath: "polygon(0 0, 100% 0, 0 100%)" }} />

          {/* Bank Account Details */}
          <h2 style={{ textAlign: "center", fontSize: "18px", fontWeight: "700", color: "#1e3a5f", marginBottom: "24px", marginTop: "40px" }}>
            BANK ACCOUNT DETAILS
          </h2>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "32px", fontSize: "11px" }}>
            <tbody>
              {[
                ["PROVIDER NAME", data.bankDetails.providerName],
                ["BENEFICIARY ACCOUNT NAME", data.bankDetails.beneficiaryAccountName],
                ["BENEFICIARY ACCOUNT NUMBER", data.bankDetails.beneficiaryAccountNumber],
                ["INTERNATIONAL BANK ACCOUNT NUMBER/IBAN", data.bankDetails.iban],
                ["BANK NAME", data.bankDetails.bankName],
                ["SWIFT CODE", data.bankDetails.swiftCode],
              ].map(([label, value], i) => (
                <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "10px 12px", backgroundColor: "#f7fafc", fontWeight: "500", width: "40%" }}>{label}</td>
                  <td style={{ padding: "10px 12px" }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Contact Details */}
          <h2 style={{ textAlign: "center", fontSize: "18px", fontWeight: "700", color: "#1e3a5f", marginBottom: "24px" }}>
            CONTACT PERSON
          </h2>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "32px", fontSize: "11px" }}>
            <tbody>
              {[
                ["NAME", data.contactDetails.contactPersonName],
                ["DESIGNATION", data.contactDetails.contactPersonDesignation],
                ["EMAIL", data.contactDetails.contactPersonEmail],
              ].map(([label, value], i) => (
                <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "10px 12px", backgroundColor: "#f7fafc", fontWeight: "500", width: "40%" }}>{label}</td>
                  <td style={{ padding: "10px 12px" }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Authorized Signatory */}
          <div style={{ marginTop: "48px" }}>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#1e3a5f", marginBottom: "16px" }}>
              Authorized Signatory
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "24px" }}>
              {data.includeSignature && (
                <div style={{ textAlign: "center" }}>
                  <img src={signatureImg.src} alt="Signature" style={{ height: "50px", marginBottom: "8px" }} />
                </div>
              )}
              {data.includeStamp && (
                <div style={{ textAlign: "center" }}>
                  <img src={stampImg.src} alt="Company Stamp" style={{ width: "100px", height: "100px", objectFit: "contain" }} />
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{ position: "absolute", bottom: "15mm", left: "20mm", fontSize: "10px", color: "#a0aec0" }}>
            Page 2 of 2
          </div>
        </div>
        )}
      </div>
    );
  }
);

StatementTemplate.displayName = "StatementTemplate";
