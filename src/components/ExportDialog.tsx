"use client";

import { useState } from "react";
import { Modal, Button, buttonClass } from "@/components/ui";
import { DateRangeFilter, type DateRange } from "@/components/DateRangeFilter";

/**
 * Confirms what time frame to export before handing off to the download
 * link — kept as an explicit step separate from whatever date range the
 * list itself happens to be filtered to right now.
 */
export function ExportDialog({
  open,
  onClose,
  buildHref,
}: {
  open: boolean;
  onClose: () => void;
  buildHref: (range: DateRange) => string;
}) {
  const [range, setRange] = useState<DateRange>({ label: "All time" });

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Export to Excel" maxWidth="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Choose the time frame to include in the export.</p>
        <DateRangeFilter onChange={setRange} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <a href={buildHref(range)} className={buttonClass("primary")} onClick={onClose}>
            Export to Excel
          </a>
        </div>
      </div>
    </Modal>
  );
}
