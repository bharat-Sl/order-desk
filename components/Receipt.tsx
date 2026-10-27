import { formatDate, formatMoney, formatSlot, formatStamp as stamp, lineTotal } from "@/lib/format";
import { STATUS_LABELS, type Order } from "@/lib/types";
import { SHOP } from "@/lib/shop";

/** One 80mm thermal receipt. Black-only text: thermal heads render grey poorly. */
export default function Receipt({ order, index }: { order: Order; index: number }) {
  const headerLines = [
    SHOP.address,
    SHOP.phone && `PH-${SHOP.phone}`,
    SHOP.fssai && `FSSAI-${SHOP.fssai}`,
    SHOP.gstin && `GSTIN-${SHOP.gstin}`,
  ].filter(Boolean);
  return (
    <section className="receipt" data-index={index}>
      <header className="r-head">
        {SHOP.name && <div className="r-shop">{SHOP.name}</div>}
        {headerLines.map((l) => (
          <div key={l as string}>{l}</div>
        ))}
        {SHOP.receiptTitle && <div className="r-title">{SHOP.receiptTitle}</div>}
      </header>
      <div className="r-meta">
        <span>Order No.</span>
        <span>{order.id.slice(0, 8).toUpperCase()}</span>
        <span className="r-meta-right">{stamp(new Date(order.createdAt))}</span>
        <span>Status</span>
        <span>{STATUS_LABELS[order.status]}</span>
        <span className="r-meta-right">Printed {stamp(new Date(), false).slice(11)}</span>
      </div>
      {order.status === "cancelled" && <div className="r-center r-flag">*** CANCELLED ***</div>}
      <hr />
      <div className="r-label">Customer</div>
      <div className="r-big">{order.customerName}</div>
      <div className="r-label">Pick-up</div>
      <div className="r-strong">{formatDate(order.pickupDate)}</div>
      <div className="r-strong">{formatSlot(order.pickupTime)}</div>
      <hr />
      {order.items.map((i, idx) => (
        <div key={idx} className="r-item">
          <div className="r-row">
            <span className="r-strong">
              {i.quantity} {i.unit} × {i.name}
            </span>
            <span>{formatMoney(lineTotal(i.quantity, i.unitPrice))}</span>
          </div>
          <div className="r-sub">
            @ {formatMoney(i.unitPrice)} / {i.unit}
          </div>
          {i.instructions && <div className="r-note">» {i.instructions}</div>}
        </div>
      ))}
      <hr />
      {order.discount > 0 && (
        <>
          <div className="r-row">
            <span>Subtotal</span>
            <span>{formatMoney(order.subtotal)}</span>
          </div>
          <div className="r-row">
            <span>Discount{order.discountType === "percent" ? ` (${order.discountValue}%)` : ""}</span>
            <span>− {formatMoney(order.discount)}</span>
          </div>
        </>
      )}
      <div className="r-row r-total">
        <span>TOTAL</span>
        <span>{formatMoney(order.total)}</span>
      </div>
      {order.notes && (
        <>
          <hr />
          <div className="r-label">Notes</div>
          <div>{order.notes}</div>
        </>
      )}
      <hr />
      <div className="r-center r-thanks">Thank You!</div>
      {/* Bottom space before the cut. The POS80 driver drops trailing blank paper ("Page End:
          Ignore page tails blank"), so the space ends in a small printed dot to keep it. */}
      <div className="r-feed" aria-hidden="true">.</div>
    </section>
  );
}
