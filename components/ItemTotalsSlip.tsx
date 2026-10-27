import { formatDate, formatMoney, formatQty, formatStamp } from "@/lib/format";
import type { ItemLine, ItemReport } from "@/lib/report";
import { SHOP } from "@/lib/shop";

function Lines({ items }: { items: ItemLine[] }) {
  return (
    <>
      {items.map((i) => (
        <div key={`${i.name}|${i.unit}`} className="r-item">
          <div className="r-row">
            <span className="r-strong">{i.name}</span>
            <span className="r-strong">
              {formatQty(i.quantity)} {i.unit}
            </span>
          </div>
          <div className="r-row r-sub">
            <span>
              {i.orders} order{i.orders === 1 ? "" : "s"}
            </span>
            <span>{formatMoney(i.amount)}</span>
          </div>
        </div>
      ))}
    </>
  );
}

/** 80mm slip with the items to prepare for a pick-up date range. Styled like the order receipts. */
export default function ItemTotalsSlip({ report }: { report: ItemReport }) {
  const single = report.from === report.to;
  return (
    <section className="receipt" data-index={0}>
      <header className="r-head">
        {SHOP.name && <div className="r-shop">{SHOP.name}</div>}
        <div className="r-title">ITEM TOTALS</div>
      </header>
      <div className="r-meta">
        <span>{single ? "Pick-up" : "From"}</span>
        <span />
        <span className="r-meta-right">{formatDate(report.from)}</span>
        {!single && (
          <>
            <span>To</span>
            <span />
            <span className="r-meta-right">{formatDate(report.to)}</span>
          </>
        )}
        <span>Printed</span>
        <span />
        <span className="r-meta-right">{formatStamp(new Date(), false)}</span>
      </div>
      <hr />
      {report.items.length === 0 ? (
        <div className="r-center">No orders in this period.</div>
      ) : report.byDay ? (
        report.days.map((d) => (
          <div key={d.date}>
            <div className="r-row r-day">
              <span>{formatDate(d.date)}</span>
              <span>
                {d.orders} order{d.orders === 1 ? "" : "s"}
              </span>
            </div>
            <Lines items={d.items} />
            <hr />
          </div>
        ))
      ) : (
        <>
          <Lines items={report.items} />
          <hr />
        </>
      )}
      {report.byDay && report.items.length > 0 && (
        <>
          <div className="r-label">All days</div>
          <Lines items={report.items} />
          <hr />
        </>
      )}
      <div className="r-row">
        <span>Orders</span>
        <span>{report.orders}</span>
      </div>
      <div className="r-row r-total">
        <span>VALUE</span>
        <span>{formatMoney(report.amount)}</span>
      </div>
      <div className="r-sub">Value is before order discounts. Cancelled orders are not included.</div>
      {/* Bottom space before the cut; the dot stops the driver trimming it. See Receipt.tsx. */}
      <div className="r-feed" aria-hidden="true">.</div>
    </section>
  );
}
