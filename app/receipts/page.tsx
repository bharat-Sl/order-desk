import Link from "next/link";
import { db } from "@/lib/db";
import { ORDER_STATUSES, type Order, type OrderFilter, type OrderStatus } from "@/lib/types";
import Receipt from "@/components/Receipt";
import ReceiptPrinter from "@/components/ReceiptPrinter";

export const dynamic = "force-dynamic";

const VIEWS = ["upcoming", "today", "past", "all"] as const;

type Search = Promise<{
  id?: string;
  view?: string;
  q?: string;
  date?: string;
  status?: string;
  autoprint?: string;
}>;

/**
 * 80mm receipts for one order (?id=) or for every order matching the orders-list filters.
 * Opened in a hidden iframe by the print buttons; also usable directly as a print preview.
 */
export default async function ReceiptsPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  let orders: Order[];
  if (sp.id) {
    const o = await db().getOrder(sp.id);
    orders = o ? [o] : [];
  } else {
    const filter: OrderFilter = {
      view: VIEWS.find((v) => v === sp.view) ?? "upcoming",
      status: ORDER_STATUSES.find((s) => s === sp.status) as OrderStatus | undefined,
      q: sp.q?.trim() || undefined,
      date: sp.date || undefined,
    };
    orders = await db().listOrders(filter);
  }

  return (
    <div className="receipts-page">
      <div className="receipts-bar no-print">
        <Link href={sp.id ? `/orders/${sp.id}` : "/"} className="small">
          ← Back
        </Link>
        <span className="muted small">
          {orders.length} receipt{orders.length === 1 ? "" : "s"} · 80mm
        </span>
        <ReceiptPrinter autoPrint={sp.autoprint === "1" && orders.length > 0} />
      </div>
      {orders.length === 0 ? (
        <div className="card empty no-print">Nothing to print.</div>
      ) : (
        orders.map((o, i) => <Receipt key={o.id} order={o} index={i} />)
      )}
    </div>
  );
}
