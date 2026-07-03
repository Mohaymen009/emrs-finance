import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { and, asc, eq, gte, lte, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { incomeRecords, expenseRecords, divisions, clients, payments } from "@/db/schema";
import { requireUser, assertDivisionAccess } from "@/lib/auth";
import { writeExportLog, writeAuditLog } from "@/lib/audit";
import { exportFiltersSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api-helpers";
import { formatRefNumber } from "@/lib/refnumber";

// Consistent branded look for every exported report: bold white-on-navy
// frozen header with autofilter, currency-formatted amount columns, thin
// borders, and light zebra striping on the data rows.
function styleWorksheet(sheet: ExcelJS.Worksheet, currencyColumnKeys: string[]) {
  const headerRow = sheet.getRow(1);
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    cell.alignment = { vertical: "middle" };
  });

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns?.length ?? 1 } };

  const thinBorder = { style: "thin" as const, color: { argb: "FFE2E8F0" } };
  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      });
    }
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
    });
  }

  for (const key of currencyColumnKeys) {
    const column = sheet.getColumn(key);
    column.numFmt = '#,##0.00 "AED"';
    column.alignment = { horizontal: "right" };
  }
}

// GET /api/reports/export?type=INCOME|EXPENSE|VAT|PROFIT&division=...&dateFrom=...&dateTo=...&status=...&vatOnly=true
// Streams back an .xlsx workbook and logs the export (who, what filters, when).
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.role === "DISPATCHER") {
      return NextResponse.json({ error: "Dispatchers cannot export financial reports." }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const type = (searchParams.get("type") ?? "INCOME") as "INCOME" | "EXPENSE" | "VAT" | "PROFIT";

    const filters = exportFiltersSchema.parse({
      divisionCode: searchParams.get("division") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      paymentStatus: searchParams.get("status") ?? undefined,
      vatOnly: searchParams.get("vatOnly") === "true",
    });

    if (filters.divisionCode) assertDivisionAccess(user, filters.divisionCode);

    const allDivisions = await db.select().from(divisions);
    const allowedDivisionIds = allDivisions
      .filter((d) => user.divisionCodes.includes(d.code))
      .filter((d) => !filters.divisionCode || d.code === filters.divisionCode)
      .map((d) => d.id);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "EMRS Finance Platform";
    workbook.created = new Date();

    if (type === "INCOME" || type === "VAT" || type === "PROFIT") {
      const conditions = [isNull(incomeRecords.deletedAt)];
      if (filters.dateFrom) conditions.push(gte(incomeRecords.date, filters.dateFrom));
      if (filters.dateTo) conditions.push(lte(incomeRecords.date, filters.dateTo));
      if (filters.paymentStatus) conditions.push(eq(incomeRecords.paymentStatus, filters.paymentStatus));
      if (filters.vatOnly) conditions.push(isNotNull(incomeRecords.vatAmount));

      const rows = await db
        .select({
          record: incomeRecords,
          divisionCode: divisions.code,
          client: clients,
          payment: payments,
        })
        .from(incomeRecords)
        .innerJoin(divisions, eq(incomeRecords.divisionId, divisions.id))
        .leftJoin(clients, eq(incomeRecords.clientId, clients.id))
        .leftJoin(payments, eq(payments.incomeRecordId, incomeRecords.id))
        .where(and(...conditions))
        .orderBy(asc(incomeRecords.date));
      const filtered = rows.filter((r) => allowedDivisionIds.includes(r.record.divisionId));

      // Standard sales ledger layout: gross - discount = net (the taxable
      // base), VAT on the net, Amount Charged = net + VAT (what's billed to
      // the client). Net Received is the actual amount that landed after
      // payment-processor fees, recorded only once paid.
      const sheet = workbook.addWorksheet("Income");
      sheet.columns = [
        { header: "Ref No", key: "ref", width: 12 },
        { header: "Service Date", key: "date", width: 14 },
        { header: "Client", key: "client", width: 24 },
        { header: "Description", key: "title", width: 30 },
        { header: "Department", key: "division", width: 20 },
        { header: "Gross Amount", key: "gross", width: 15 },
        { header: "Discount", key: "discount", width: 13 },
        { header: "Net Amount", key: "amount", width: 15 },
        { header: "VAT Amount", key: "vat", width: 13 },
        { header: "Amount Charged", key: "charged", width: 16 },
        { header: "Payment Status", key: "status", width: 15 },
        { header: "Payment Date", key: "paymentDate", width: 14 },
        { header: "Payment Method", key: "method", width: 16 },
        { header: "Net Received", key: "netReceived", width: 15 },
      ];
      filtered.forEach((r) => {
        const net = Number(r.record.amount);
        const discount = Number(r.record.discountAmount ?? 0);
        const vat = r.record.vatAmount ? Number(r.record.vatAmount) : 0;
        sheet.addRow({
          ref: formatRefNumber(r.record.refNumber, r.record.refYear, r.record.refSeq),
          date: r.record.date.toISOString().slice(0, 10),
          client: r.client ? r.client.companyName || r.client.name || "" : "",
          title: r.record.title,
          division: r.divisionCode,
          gross: net + discount,
          discount,
          amount: net,
          vat,
          charged: net + vat,
          status: r.record.paymentStatus,
          paymentDate: r.payment ? r.payment.paymentDate.toISOString().slice(0, 10) : "",
          method: r.payment?.paymentMethod ?? "",
          netReceived: r.payment?.netReceivedAmount ? Number(r.payment.netReceivedAmount) : "",
        });
      });
      styleWorksheet(sheet, ["gross", "discount", "amount", "vat", "charged", "netReceived"]);
    }

    if (type === "EXPENSE" || type === "PROFIT") {
      const conditions = [isNull(expenseRecords.deletedAt)];
      if (filters.dateFrom) conditions.push(gte(expenseRecords.date, filters.dateFrom));
      if (filters.dateTo) conditions.push(lte(expenseRecords.date, filters.dateTo));
      if (filters.vatOnly) conditions.push(isNotNull(expenseRecords.vatAmount));

      const rows = await db
        .select({ record: expenseRecords, divisionCode: divisions.code })
        .from(expenseRecords)
        .innerJoin(divisions, eq(expenseRecords.divisionId, divisions.id))
        .where(and(...conditions))
        .orderBy(asc(expenseRecords.date));
      const filtered = rows.filter((r) => allowedDivisionIds.includes(r.record.divisionId));

      // Purchase ledger layout: the purchase/service date (when we bought or
      // received it) and the payment date (when we actually paid) are
      // separate columns.
      const sheet = workbook.addWorksheet("Expenses");
      sheet.columns = [
        { header: "Ref No", key: "ref", width: 12 },
        { header: "Purchase Date", key: "date", width: 14 },
        { header: "Payment Date", key: "paymentDate", width: 14 },
        { header: "Supplier", key: "supplier", width: 22 },
        { header: "Description", key: "description", width: 30 },
        { header: "Category", key: "category", width: 20 },
        { header: "Department", key: "division", width: 20 },
        { header: "Net Amount", key: "amount", width: 15 },
        { header: "VAT Amount", key: "vat", width: 13 },
        { header: "Total", key: "total", width: 15 },
      ];
      filtered.forEach((r) => {
        const net = Number(r.record.amount);
        const vat = r.record.vatAmount ? Number(r.record.vatAmount) : 0;
        sheet.addRow({
          ref: formatRefNumber(r.record.refNumber, r.record.refYear, r.record.refSeq),
          date: r.record.date.toISOString().slice(0, 10),
          paymentDate: r.record.paymentDate ? r.record.paymentDate.toISOString().slice(0, 10) : "",
          supplier: r.record.supplierName ?? "",
          description: r.record.description,
          category: r.record.category ?? "",
          division: r.divisionCode,
          amount: net,
          vat,
          total: net + vat,
        });
      });
      styleWorksheet(sheet, ["amount", "vat", "total"]);
    }

    await writeExportLog({ userId: user.id, exportType: type, filters });
    await writeAuditLog({
      userId: user.id,
      action: "EXPORT_REPORT",
      divisionId: undefined,
      metadata: { type, filters },
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${type.toLowerCase()}-report-${Date.now()}.xlsx"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
