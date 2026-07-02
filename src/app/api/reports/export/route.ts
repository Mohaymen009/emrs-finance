import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { and, eq, gte, lte, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { incomeRecords, expenseRecords, divisions } from "@/db/schema";
import { requireUser, assertDivisionAccess } from "@/lib/auth";
import { writeExportLog, writeAuditLog } from "@/lib/audit";
import { exportFiltersSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api-helpers";

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
        .select({ record: incomeRecords, divisionCode: divisions.code })
        .from(incomeRecords)
        .innerJoin(divisions, eq(incomeRecords.divisionId, divisions.id))
        .where(and(...conditions));
      const filtered = rows.filter((r) => allowedDivisionIds.includes(r.record.divisionId));

      const sheet = workbook.addWorksheet("Income");
      sheet.columns = [
        { header: "Department", key: "division", width: 20 },
        { header: "Title", key: "title", width: 30 },
        { header: "Date", key: "date", width: 15 },
        { header: "Amount", key: "amount", width: 16 },
        { header: "VAT Amount", key: "vat", width: 16 },
        { header: "Payment Status", key: "status", width: 16 },
      ];
      filtered.forEach((r) =>
        sheet.addRow({
          division: r.divisionCode,
          title: r.record.title,
          date: r.record.date.toISOString().slice(0, 10),
          amount: Number(r.record.amount),
          vat: r.record.vatAmount ? Number(r.record.vatAmount) : 0,
          status: r.record.paymentStatus,
        })
      );
      styleWorksheet(sheet, ["amount", "vat"]);
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
        .where(and(...conditions));
      const filtered = rows.filter((r) => allowedDivisionIds.includes(r.record.divisionId));

      const sheet = workbook.addWorksheet("Expenses");
      sheet.columns = [
        { header: "Department", key: "division", width: 20 },
        { header: "Description", key: "description", width: 30 },
        { header: "Date", key: "date", width: 15 },
        { header: "Amount", key: "amount", width: 16 },
        { header: "VAT Amount", key: "vat", width: 16 },
        { header: "Supplier", key: "supplier", width: 20 },
      ];
      filtered.forEach((r) =>
        sheet.addRow({
          division: r.divisionCode,
          description: r.record.description,
          date: r.record.date.toISOString().slice(0, 10),
          amount: Number(r.record.amount),
          vat: r.record.vatAmount ? Number(r.record.vatAmount) : 0,
          supplier: r.record.supplierName ?? "",
        })
      );
      styleWorksheet(sheet, ["amount", "vat"]);
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
