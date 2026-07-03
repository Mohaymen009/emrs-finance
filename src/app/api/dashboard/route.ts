import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { computeDivisionStats, getAllDivisions } from "@/lib/stats";
import { handleApiError } from "@/lib/api-helpers";

// GET /api/dashboard — division dashboards the user has access to, plus a
// combined company-wide dashboard if (and only if) the user is an Admin.
export async function GET() {
  try {
    const user = await requireUser();
    if (user.role === "DISPATCHER") {
      return NextResponse.json({ error: "Dispatchers cannot view financial dashboards." }, { status: 403 });
    }
    const allDivisions = await getAllDivisions();
    const visibleDivisions = allDivisions.filter((d) => user.divisionCodes.includes(d.code));

    const divisionStats = await Promise.all(
      visibleDivisions.map(async (d) => ({
        divisionCode: d.code,
        divisionName: d.name,
        ...(await computeDivisionStats(d.id)),
      }))
    );

    let combined = null;
    if (user.role === "ADMIN") {
      const perDivision = await Promise.all(
        allDivisions.map(async (d) => ({
          divisionCode: d.code,
          divisionName: d.name,
          ...(await computeDivisionStats(d.id)),
        }))
      );
      combined = perDivision.reduce(
        (acc, d) => ({
          totalIncome: acc.totalIncome + d.totalIncome,
          totalExpenses: acc.totalExpenses + d.totalExpenses,
          netProfit: acc.netProfit + d.netProfit,
          vatCollected: acc.vatCollected + d.vatCollected,
          incomeEntryCount: acc.incomeEntryCount + d.incomeEntryCount,
          expenseEntryCount: acc.expenseEntryCount + d.expenseEntryCount,
        }),
        { totalIncome: 0, totalExpenses: 0, netProfit: 0, vatCollected: 0, incomeEntryCount: 0, expenseEntryCount: 0 }
      );
    }

    return NextResponse.json({ divisions: divisionStats, combined });
  } catch (err) {
    return handleApiError(err);
  }
}
