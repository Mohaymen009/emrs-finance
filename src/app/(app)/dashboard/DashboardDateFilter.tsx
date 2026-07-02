"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { DateRangeFilter, type DateRange } from "@/components/DateRangeFilter";

export default function DashboardDateFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(range: DateRange) {
    // The picker fires once on mount with its default ("All time"). Only
    // navigate if the range actually differs from what's already in the
    // URL, so loading /dashboard?dateFrom=...&dateTo=... doesn't get
    // immediately clobbered back to "all time" by that initial call.
    if ((range.dateFrom ?? "") === (searchParams.get("dateFrom") ?? "") && (range.dateTo ?? "") === (searchParams.get("dateTo") ?? "")) {
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    if (range.dateFrom) params.set("dateFrom", range.dateFrom);
    else params.delete("dateFrom");
    if (range.dateTo) params.set("dateTo", range.dateTo);
    else params.delete("dateTo");
    const qs = params.toString();
    router.push(qs ? `/dashboard?${qs}` : "/dashboard");
  }

  return <DateRangeFilter onChange={onChange} />;
}
