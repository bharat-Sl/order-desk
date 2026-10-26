import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatDate, formatMoney, formatSlot, lineTotal } from "@/lib/format";
import { ARCHIVE_RETENTION_DAYS } from "@/lib/types";
import ArchiveControls from "@/components/ArchiveControls";
import StatusButtons from "@/components/StatusButtons";
import PrintReceiptButton from "@/components/PrintReceiptButton";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; print?: string }> };

export default async function OrderPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { saved, print } = await searchParams;
  const order = await db().getOrder(id);
  if (!order) notFound();
  const deletesOn =
    order.archivedAt &&
    new Date(new Date(order.archivedAt).getTime() + ARCHIVE_RETENTION_DAYS * 864e5).toLocaleDateString("en-US", {
      dateStyle: "medium",
    });

  return (
    <>
      {saved && <div className="alert alert-ok no-print">Order saved.</div>}
      {deletesOn && (
        <div className="alert alert-warn no-print">
          This order is archived and will be deleted permanently on {deletesOn}. Restore it to keep it.
        </div>
      )}
      <div className="page-head">
        <div>
          <Link href={order.archivedAt ? "/?view=archived" : "/"} className="small no-print">
            ← {order.archivedAt ? "Archived orders" : "Orders"}
          </Link>
          <h1>{order.customerName}</h1>
          <div className="sub small">
            Order #{order.id.slice(0, 8).toUpperCase()} · created{" "}
            {new Date(order.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          </div>
        </div>
        <div className="actions no-print">
          <PrintReceiptButton
            query={`id=${order.id}`}
            className="btn btn-primary"
            auto={print === "1" && !order.archivedAt}
          />
          <Link href={`/receipts?id=${order.id}`} className="btn btn-ghost">
            Preview
          </Link>
          {!order.archivedAt && (
            <Link href={`/orders/${order.id}/edit`} className="btn">Edit</Link>
          )}
          <ArchiveControls id={order.id} archived={Boolean(order.archivedAt)} />
        </div>
      </div>

      {!order.archivedAt && (
        <div className="status-bar no-print">
          <span className="muted small">Status</span>
          <StatusButtons id={order.id} status={order.status} />
        </div>
      )}

      <div className="card card-pad">
        <div className="meta">
          <div>
            <div className="k">Customer</div>
            <div className="v">{order.customerName}</div>
          </div>
          <div>
            <div className="k">Pick-up date</div>
            <div className="v">{formatDate(order.pickupDate)}</div>
          </div>
          <div>
            <div className="k">Pick-up time</div>
            <div className="v">{formatSlot(order.pickupTime)}</div>
          </div>
        </div>
        {order.notes && (
          <p style={{ marginBottom: 0 }}>
            <span className="muted">Notes:</span> {order.notes}
          </p>
        )}
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Qty</th>
              <th className="num">Unit price</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i, idx) => (
              <tr key={idx}>
                <td>
                  <strong>{i.name}</strong>
                  {i.instructions && <span className="instr">Note: {i.instructions}</span>}
                </td>
                <td className="num">{i.quantity} {i.unit}</td>
                <td className="num">{formatMoney(i.unitPrice)} / {i.unit}</td>
                <td className="num">{formatMoney(lineTotal(i.quantity, i.unitPrice))}</td>
              </tr>
            ))}
            {order.discount > 0 && (
              <>
                <tr>
                  <td colSpan={3} className="muted">Subtotal</td>
                  <td className="num">{formatMoney(order.subtotal)}</td>
                </tr>
                <tr className="discount-row">
                  <td colSpan={3}>
                    Discount{order.discountType === "percent" ? ` (${order.discountValue}%)` : ""}
                  </td>
                  <td className="num">− {formatMoney(order.discount)}</td>
                </tr>
              </>
            )}
            <tr className="total-row">
              <td colSpan={3}>Total</td>
              <td className="num">{formatMoney(order.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted small">Prices are stored as they were when the order was taken.</p>
    </>
  );
}
