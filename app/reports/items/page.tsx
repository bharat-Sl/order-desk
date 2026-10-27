import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate, formatMoney, formatQty, todayISO } from "@/lib/format";
import { addDays, buildReport, parseRange, reportQuery, type ItemLine } from "@/lib/report";
import PrintReceiptButton from "@/components/PrintReceiptButton";

export const dynamic = "force-dynamic";

type Search = Promise<{ from?: string; to?: string; split?: string }>;

export default async function ItemTotalsPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const { from, to, byDay } = parseRange(sp);
  const report = buildReport(await db().itemTotals(from, to), from, to, byDay);
  const today = todayISO();
  const query = reportQuery(report);

  const presets = [
    { label: "Today", from: today, to: today },
    { label: "Tomorrow", from: addDays(today, 1), to: addDays(today, 1) },
    { label: "Next 7 days", from: today, to: addDays(today, 6) },
    { label: "Yesterday", from: addDays(today, -1), to: addDays(today, -1) },
  ];
  const presetHref = (p: { from: string; to: string }) =>
    `/reports/items?${reportQuery({ from: p.from, to: p.to, byDay: byDay && p.from !== p.to })}`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Item totals</h1>
          <div className="sub">
            Everything to prepare for orders picked up{" "}
            {from === to ? <>on {formatDate(from)}</> : <>from {formatDate(from)} to {formatDate(to)}</>}
          </div>
        </div>
        <div className="actions">
          <Link href={`/reports/items/print?${query}`} className="btn btn-ghost">
            Preview
          </Link>
          <PrintReceiptButton path="/reports/items/print" query={query} label="Print totals" className="btn btn-primary" />
        </div>
      </div>

      <div className="stats">
        <div className="card stat">
          <div className="label">Orders</div>
          <div className="value">{report.orders}</div>
        </div>
        <div className="card stat">
          <div className="label">Different items</div>
          <div className="value">{report.items.length}</div>
        </div>
        <div className="card stat">
          <div className="label">Value</div>
          <div className="value">{formatMoney(report.amount)}</div>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="tabs">
            {presets.map((p) => (
              <Link key={p.label} href={presetHref(p)} className={p.from === from && p.to === to ? "active" : ""}>
                {p.label}
              </Link>
            ))}
          </div>
          <form>
            <label className="inline-field">
              From <input type="date" name="from" defaultValue={from} required />
            </label>
            <label className="inline-field">
              To <input type="date" name="to" defaultValue={to} required />
            </label>
            <label className="print-after">
              <input type="checkbox" name="split" value="1" defaultChecked={byDay} /> Split by day
            </label>
            <button className="btn" type="submit">
              Show
            </button>
          </form>
        </div>

        {report.items.length === 0 ? (
          <div className="empty">
            <p>No orders for pick-up in this period.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Quantity</th>
                  <th className="num">Orders</th>
                  <th className="num">Value</th>
                </tr>
              </thead>
              <tbody>
                {report.byDay ? (
                  <>
                    {report.days.map((d) => (
                      <DayRows key={d.date} date={d.date} orders={d.orders} items={d.items} today={today} />
                    ))}
                    <tr className="date-group">
                      <td colSpan={4}>All days</td>
                    </tr>
                    <ItemRows items={report.items} />
                  </>
                ) : (
                  <ItemRows items={report.items} />
                )}
                <tr className="total-row">
                  <td>Total</td>
                  <td />
                  <td className="num">{report.orders}</td>
                  <td className="num">{formatMoney(report.amount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="muted small">
        Counts orders by pick-up date. Cancelled and archived orders are left out, and values are before
        order-level discounts. The same item in different units is listed separately.
      </p>
    </>
  );
}

function DayRows({ date, orders, items, today }: { date: string; orders: number; items: ItemLine[]; today: string }) {
  return (
    <>
      <tr className="date-group">
        <td colSpan={4}>
          {formatDate(date)} {date === today && <span className="pill">Today</span>}{" "}
          <span className="muted">
            · {orders} order{orders === 1 ? "" : "s"}
          </span>
        </td>
      </tr>
      <ItemRows items={items} />
    </>
  );
}

function ItemRows({ items }: { items: ItemLine[] }) {
  return (
    <>
      {items.map((i) => (
        <tr key={`${i.name}|${i.unit}`}>
          <td>
            <strong>{i.name}</strong>
          </td>
          <td className="num">
            <strong>
              {formatQty(i.quantity)} {i.unit}
            </strong>
          </td>
          <td className="num">{i.orders}</td>
          <td className="num">{formatMoney(i.amount)}</td>
        </tr>
      ))}
    </>
  );
}
