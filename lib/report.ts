import { round2, todayISO } from "./format";
import type { ItemTotalRow, ItemTotals } from "./types";

export type ItemLine = Omit<ItemTotalRow, "date">;
export type DayGroup = { date: string; orders: number; items: ItemLine[] };

export type ItemReport = {
  from: string;
  to: string;
  byDay: boolean;
  /** Every item across the whole range (same name, case-insensitive, and unit = one line). */
  items: ItemLine[];
  /** Only filled when byDay is set. */
  days: DayGroup[];
  orders: number;
  amount: number;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Largest range one report covers, so a typo can't ask for decades of data. */
export const MAX_REPORT_DAYS = 366;

export function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5);
}

/** Reads ?from=&to=&split= into a valid range; defaults to today. */
export function parseRange(sp: { from?: string; to?: string; split?: string }) {
  const today = todayISO();
  let from = sp.from && ISO.test(sp.from) && !isNaN(Date.parse(sp.from)) ? sp.from : today;
  let to = sp.to && ISO.test(sp.to) && !isNaN(Date.parse(sp.to)) ? sp.to : from;
  if (to < from) [from, to] = [to, from];
  if (daysBetween(from, to) >= MAX_REPORT_DAYS) to = addDays(from, MAX_REPORT_DAYS - 1);
  return { from, to, byDay: sp.split === "1" && from !== to };
}

function sortLines(lines: ItemLine[]) {
  return lines.sort((a, b) => a.name.localeCompare(b.name) || a.unit.localeCompare(b.unit));
}

export function buildReport(data: ItemTotals, from: string, to: string, byDay: boolean): ItemReport {
  const merged = new Map<string, ItemLine>();
  for (const r of data.rows) {
    const key = `${r.name.toLowerCase()}|${r.unit}`;
    const m = merged.get(key);
    if (m) {
      m.quantity += r.quantity;
      m.orders += r.orders; // an order has one pick-up date, so per-day counts add up exactly
      m.amount = round2(m.amount + r.amount);
    } else {
      merged.set(key, { name: r.name, unit: r.unit, quantity: r.quantity, orders: r.orders, amount: r.amount });
    }
  }

  const days: DayGroup[] = byDay
    ? data.orderCounts.map((c) => ({
        date: c.date,
        orders: c.orders,
        items: sortLines(
          data.rows
            .filter((r) => r.date === c.date)
            .map(({ date: _date, ...line }) => line)
        ),
      }))
    : [];

  return {
    from,
    to,
    byDay,
    items: sortLines([...merged.values()]),
    days,
    orders: data.orderCounts.reduce((s, c) => s + c.orders, 0),
    amount: round2(data.rows.reduce((s, r) => s + r.amount, 0)),
  };
}

export function reportQuery(r: { from: string; to: string; byDay: boolean }) {
  const p = new URLSearchParams({ from: r.from, to: r.to });
  if (r.byDay) p.set("split", "1");
  return p.toString();
}
