import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate, formatMoney, formatSlot, todayISO } from "@/lib/format";
import type { Order, OrderFilter } from "@/lib/types";
import RowLink from "@/components/RowLink";

export const dynamic = "force-dynamic";

const VIEWS: { key: OrderFilter["view"]; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "today", label: "Today" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
];

type Search = Promise<{ view?: string; q?: string; date?: string }>;

export default async function OrdersPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const view = (VIEWS.find((v) => v.key === sp.view)?.key ?? "upcoming") as OrderFilter["view"];
  const filter: OrderFilter = { view, q: sp.q?.trim() || undefined, date: sp.date || undefined };
  const [orders, stats] = await Promise.all([db().listOrders(filter), db().stats()]);
  const today = todayISO();

  const groups = new Map<string, Order[]>();
  for (const o of orders) groups.set(o.pickupDate, [...(groups.get(o.pickupDate) ?? []), o]);

  const viewHref = (key: string) => {
    const p = new URLSearchParams({ view: key });
    if (filter.q) p.set("q", filter.q);
    return `/?${p}`;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Orders</h1>
          <div className="sub">{formatDate(today)}</div>
        </div>
        <Link href="/orders/new" className="btn btn-primary">
          + New order
        </Link>
      </div>

      <div className="stats">
        <div className="card stat">
          <div className="label">Pick-ups today</div>
          <div className="value">{stats.todayCount}</div>
        </div>
        <div className="card stat">
          <div className="label">Upcoming orders</div>
          <div className="value">{stats.upcomingCount}</div>
        </div>
        <div className="card stat">
          <div className="label">Upcoming value</div>
          <div className="value">{formatMoney(stats.upcomingValue)}</div>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="tabs">
            {VIEWS.map((v) => (
              <Link key={v.key} href={viewHref(v.key)} className={v.key === view ? "active" : ""}>
                {v.label}
              </Link>
            ))}
          </div>
          <form>
            <input type="hidden" name="view" value={view} />
            <input type="search" name="q" placeholder="Search customer or item" defaultValue={filter.q} />
            <input type="date" name="date" defaultValue={filter.date} aria-label="Pick-up date" />
            <button className="btn" type="submit">
              Filter
            </button>
            {(filter.q || filter.date) && (
              <Link href={`/?view=${view}`} className="btn btn-ghost">
                Clear
              </Link>
            )}
          </form>
        </div>

        {orders.length === 0 ? (
          <div className="empty">
            <p>No orders found.</p>
            <Link href="/orders/new" className="btn btn-primary">
              Create an order
            </Link>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 150 }}>Pick-up time</th>
                <th>Customer</th>
                <th className="hide-sm">Items</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {[...groups].map(([date, list]) => (
                <Group key={date} date={date} today={today} orders={list} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Group({ date, today, orders }: { date: string; today: string; orders: Order[] }) {
  return (
    <>
      <tr className="date-group">
        <td colSpan={4}>
          {formatDate(date)} {date === today && <span className="pill">Today</span>}{" "}
          <span className="muted">
            · {orders.length} order{orders.length === 1 ? "" : "s"}
          </span>
        </td>
      </tr>
      {orders.map((o) => (
        <RowLink key={o.id} href={`/orders/${o.id}`}>
          <td>
            <span className={o.pickupTime ? "pill" : "pill pill-muted"}>{formatSlot(o.pickupTime)}</span>
          </td>
          <td>
            <Link href={`/orders/${o.id}`} style={{ fontWeight: 600, color: "inherit" }}>
              {o.customerName}
            </Link>
            {o.notes && <div className="muted small">{o.notes}</div>}
          </td>
          <td className="hide-sm">
            {o.items.slice(0, 4).map((i, idx) => (
              <div key={idx}>
                {i.quantity} {i.unit} × {i.name}
                {i.instructions && <span className="muted small"> — {i.instructions}</span>}
              </div>
            ))}
            {o.items.length > 4 && <div className="muted small">+{o.items.length - 4} more</div>}
          </td>
          <td className="num">
            <strong>{formatMoney(o.total)}</strong>
          </td>
        </RowLink>
      ))}
    </>
  );
}
