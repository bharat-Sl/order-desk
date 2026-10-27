import Link from "next/link";
import { db } from "@/lib/db";
import { buildReport, parseRange, reportQuery } from "@/lib/report";
import ItemTotalsSlip from "@/components/ItemTotalsSlip";
import ReceiptPrinter from "@/components/ReceiptPrinter";

export const dynamic = "force-dynamic";

type Search = Promise<{ from?: string; to?: string; split?: string; autoprint?: string }>;

/** 80mm item totals slip. Opened in a hidden iframe by the Print button; also works as a preview. */
export default async function ItemTotalsPrintPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const { from, to, byDay } = parseRange(sp);
  const report = buildReport(await db().itemTotals(from, to), from, to, byDay);

  return (
    <div className="receipts-page">
      <div className="receipts-bar no-print">
        <Link href={`/reports/items?${reportQuery(report)}`} className="small">
          ← Back
        </Link>
        <span className="muted small">Item totals · 80mm</span>
        <ReceiptPrinter autoPrint={sp.autoprint === "1"} />
      </div>
      <ItemTotalsSlip report={report} />
    </div>
  );
}
