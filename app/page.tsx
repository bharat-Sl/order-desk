import Link from "next/link";
import { after } from "next/server";
import { db, purgeIfDue } from "@/lib/db";
import { formatDate, formatMoney, formatSlot, todayISO } from "@/lib/format";
import {
  ARCHIVE_RETENTION_DAYS,
  ORDER_STATUSES,
  STATUS_LABELS,
  type Order,
  type OrderFilter,
  type OrderStatus,
} from "@/lib/types";
import RowLink from "@/components/RowLink";
import StatusSelect from "@/components/StatusSelect";
import ArchiveControls from "@/components/ArchiveControls";
import PrintReceiptButton from "@/components/PrintReceiptButton";

export const dynamic = "force-dynamic";

const VIEWS: { key: OrderFilter["view"]; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "today", label: "Today" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
  { key: "archived", label: "Archived" },
];

type Search = Promise<{ view?: string; q?: string; date?: string; status?: string; archived?: string }>;

export default async function OrdersPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const view = (VIEWS.find((v) => v.key === sp.view)?.key ?? "upcoming") as OrderFilter["view"];
  const status = ORDER_STATUSES.find((s) => s === sp.status) as OrderStatus | undefined;
  const filter: OrderFilter = { view, status, q: sp.q?.trim() || undefined, date: sp.date || undefined };
  // Run the 30-day archive cleanup after the page is sent, so it never delays loading.
  after(purgeIfDue);
  const [orders, stats] = await Promise.all([db().listOrders(filter), db().stats()]);
  const today = todayISO();

  const groups = new Map<string, Order[]>();
  for (const o of orders) groups.set(o.pickupDate, [...(groups.get(o.pickupDate) ?? []), o]);

  const printQuery = new URLSearchParams({ view });
  if (filter.q) printQuery.set("q", filter.q);
  if (filter.status) printQuery.set("status", filter.status);
  if (filter.date) printQuery.set("date", filter.date);

  const viewHref = (key: string) => {
    const p = new URLSearchParams({ view: key });
    if (filter.q) p.set("q", filter.q);
    if (filter.status) p.set("status", filter.status);
    return `/?${p}`;
  };

  return (
    <>
      {sp.archived && (
        <div className="alert alert-ok">
          Order archived. It stays in <Link href="/?view=archived">Archived</Link> for {ARCHIVE_RETENTION_DAYS} days
          and can be restored until then.
        </div>
      )}
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
            <select name="status" defaultValue={filter.status ?? ""} aria-label="Status">
              <option value="">All statuses</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <input type="date" name="date" defaultValue={filter.date} aria-label="Pick-up date" />
            <button className="btn" type="submit">
              Filter
            </button>
            {(filter.q || filter.date || filter.status) && (
              <Link href={`/?view=${view}`} className="btn btn-ghost">
                Clear
              </Link>
            )}
          </form>
          {view !== "archived" && orders.length > 0 && (
            <PrintReceiptButton query={printQuery.toString()} label={`Print all (${orders.length})`} />
          )}
        </div>

        {view === "archived" && (
          <div className="archive-note">
            Archived orders are deleted permanently {ARCHIVE_RETENTION_DAYS} days after they were archived.
          </div>
        )}

        {orders.length === 0 ? (
          <div className="empty">
            <p>{view === "archived" ? "No archived orders." : "No orders found."}</p>
            {view !== "archived" && (
              <Link href="/orders/new" className="btn btn-primary">
                Create an order
              </Link>
            )}
          </div>
        ) : view === "archived" ? (
          <ArchivedTable orders={orders} />
        ) : (
          <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 150 }}>Pick-up time</th>
                <th>Customer</th>
                <th className="hide-sm">Items</th>
                <th style={{ width: 130 }}>Status</th>
                <th className="num">Total</th>
                <th className="c-print" />
              </tr>
            </thead>
            <tbody>
              {[...groups].map(([date, list]) => (
                <Group key={date} date={date} today={today} orders={list} />
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </>
  );
}

function Group({ date, today, orders }: { date: string; today: string; orders: Order[] }) {
  return (
    <>
      <tr className="date-group">
        <td colSpan={6}>
          {formatDate(date)} {date === today && <span className="pill">Today</span>}{" "}
          <span className="muted">
            · {orders.length} order{orders.length === 1 ? "" : "s"}
          </span>
        </td>
      </tr>
      {orders.map((o) => (
        <RowLink key={o.id} href={`/orders/${o.id}`} className={o.status === "cancelled" ? "row-cancelled" : ""}>
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
          <td>
            <StatusSelect id={o.id} status={o.status} />
          </td>
          <td className="num">
            <strong>{formatMoney(o.total)}</strong>
          </td>
          <td className="c-print">
            <PrintReceiptButton query={`id=${o.id}`} label="Print" className="btn btn-sm" />
          </td>
        </RowLink>
      ))}
    </>
  );
}

function ArchivedTable({ orders }: { orders: Order[] }) {
  const deletesOn = (archivedAt: string) =>
    new Date(new Date(archivedAt).getTime() + ARCHIVE_RETENTION_DAYS * 864e5).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return (
    <div className="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Customer</th>
          <th className="hide-sm">Pick-up</th>
          <th className="hide-sm">Status</th>
          <th>Deletes on</th>
          <th className="num">Total</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <RowLink key={o.id} href={`/orders/${o.id}`}>
            <td>
              <Link href={`/orders/${o.id}`} style={{ fontWeight: 600, color: "inherit" }}>
                {o.customerName}
              </Link>
              <div className="muted small">
                Archived {new Date(o.archivedAt!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
            </td>
            <td className="hide-sm">
              {formatDate(o.pickupDate)}
              <div className="muted small">{formatSlot(o.pickupTime)}</div>
            </td>
            <td className="hide-sm">
              <span className={`pill status-pill status-${o.status}`}>{STATUS_LABELS[o.status]}</span>
            </td>
            <td>{deletesOn(o.archivedAt!)}</td>
            <td className="num">{formatMoney(o.total)}</td>
            <td className="num">
              <ArchiveControls id={o.id} archived compact />
            </td>
          </RowLink>
        ))}
      </tbody>
    </table>
    </div>
  );
}
