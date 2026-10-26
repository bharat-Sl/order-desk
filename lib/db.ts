import "server-only";
import postgres from "postgres";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { ARCHIVE_RETENTION_DAYS } from "./types";
import type { ItemHistory, Order, OrderFilter, OrderInput, OrderItem, OrderStatus } from "./types";
import { round2, todayISO, totals } from "./format";

export type Stats = { todayCount: number; upcomingCount: number; upcomingValue: number };

interface Store {
  listOrders(filter: OrderFilter): Promise<Order[]>;
  getOrder(id: string): Promise<Order | null>;
  createOrder(input: OrderInput): Promise<string>;
  updateOrder(id: string, input: OrderInput): Promise<void>;
  setStatus(id: string, status: OrderStatus): Promise<void>;
  /** Soft delete: hides the order everywhere except the Archived view. */
  archiveOrder(id: string): Promise<void>;
  restoreOrder(id: string): Promise<void>;
  /** Permanent delete. */
  deleteOrder(id: string): Promise<void>;
  /** Permanently deletes orders archived more than ARCHIVE_RETENTION_DAYS ago; returns how many. */
  purgeArchived(): Promise<number>;
  /** Latest entry per item (customerName = null) and per customer + item. */
  itemHistory(): Promise<ItemHistory[]>;
  customerNames(): Promise<string[]>;
  stats(): Promise<Stats>;
}

function withTotals(input: OrderInput) {
  return { ...input, ...totals(input.items, input.discountType, input.discountValue) };
}

function matchesFilter(o: Order, f: OrderFilter, today: string) {
  if ((f.view === "archived") !== Boolean(o.archivedAt)) return false;
  if (f.status && o.status !== f.status) return false;
  if (f.view === "upcoming" && o.pickupDate < today) return false;
  if (f.view === "today" && o.pickupDate !== today) return false;
  if (f.view === "past" && o.pickupDate >= today) return false;
  if (f.date && o.pickupDate !== f.date) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    const hit =
      o.customerName.toLowerCase().includes(q) || o.items.some((i) => i.name.toLowerCase().includes(q));
    if (!hit) return false;
  }
  return true;
}

function sortOrders(orders: Order[], f: OrderFilter) {
  if (f.view === "archived") return orders.sort((a, b) => (a.archivedAt! < b.archivedAt! ? 1 : -1));
  const key = (o: Order) => `${o.pickupDate} ${o.pickupTime ?? "99:99"}`;
  const dir = f.view === "past" || f.view === "all" ? -1 : 1;
  return orders.sort((a, b) => (key(a) < key(b) ? -dir : key(a) > key(b) ? dir : 0));
}

/* ------------------------------------------------------------------ */
/* Postgres (Neon / Vercel Postgres / any Postgres)                    */
/* ------------------------------------------------------------------ */

function postgresStore(url: string): Store {
  const g = globalThis as unknown as { __sql?: postgres.Sql; __schema?: Promise<unknown> };
  const sql = (g.__sql ??= postgres(url, { prepare: false, max: 5, idle_timeout: 20, onnotice: () => {} }));

  // Bump when the DDL below changes. A cold start then costs one quick version check instead of
  // re-running every statement; the full script only runs on the first start after a change.
  const SCHEMA_VERSION = 1;

  async function migrate() {
    const current = await sql`select value from app_meta where key = 'schema_version'`.then(
      (r) => Number(r[0]?.value ?? 0),
      () => 0 // app_meta doesn't exist yet
    );
    if (current >= SCHEMA_VERSION) return;
    await sql.unsafe(`
      create table if not exists orders (
        id uuid primary key,
        customer_name text not null,
        pickup_date date not null,
        pickup_time text,
        notes text not null default '',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create table if not exists order_items (
        id bigserial primary key,
        order_id uuid not null references orders(id) on delete cascade,
        position int not null,
        name text not null,
        quantity numeric(12,3) not null,
        unit text not null,
        unit_price numeric(12,2) not null,
        instructions text not null default ''
      );
      alter table orders add column if not exists discount_type text not null default 'amount';
      alter table orders add column if not exists discount_value numeric(12,2) not null default 0;
      alter table orders add column if not exists status text not null default 'pending';
      alter table orders add column if not exists archived_at timestamptz;
      create index if not exists orders_archived_idx on orders (archived_at);
      create index if not exists orders_pickup_idx on orders (pickup_date, pickup_time);
      create index if not exists order_items_order_idx on order_items (order_id);
      create table if not exists app_meta (key text primary key, value text not null);
    `);
    await sql`insert into app_meta (key, value) values ('schema_version', ${String(SCHEMA_VERSION)})
              on conflict (key) do update set value = excluded.value`;
  }

  const ready = () =>
    (g.__schema ??= migrate().catch((e) => {
      g.__schema = undefined;
      throw e;
    }));

  type OrderRow = {
    id: string;
    customer_name: string;
    pickup_date: string;
    pickup_time: string | null;
    notes: string;
    discount_type: "amount" | "percent";
    discount_value: string;
    status: OrderStatus;
    archived_at: Date | null;
    created_at: Date;
    updated_at: Date;
    items: { name: string; quantity: number | string; unit: string; unit_price: number | string; instructions: string }[];
  };

  function hydrate(rows: OrderRow[]): Order[] {
    return rows.map((r) => {
      const discountValue = Number(r.discount_value);
      return {
        id: r.id,
        ...withTotals({
          customerName: r.customer_name,
          pickupDate: r.pickup_date,
          pickupTime: r.pickup_time,
          notes: r.notes,
          items: r.items.map((i) => ({
            name: i.name,
            quantity: Number(i.quantity),
            unit: i.unit,
            unitPrice: Number(i.unit_price),
            instructions: i.instructions,
          })),
          discountType: r.discount_type,
          discountValue,
        }),
        status: r.status,
        archivedAt: r.archived_at ? r.archived_at.toISOString() : null,
        createdAt: r.created_at.toISOString(),
        updatedAt: r.updated_at.toISOString(),
      };
    });
  }

  // Each order's items come back with it as JSON, so a page needs one query instead of two.
  const orderCols = sql`o.id, o.customer_name, o.pickup_date::text as pickup_date, o.pickup_time, o.notes,
    o.discount_type, o.discount_value, o.status, o.archived_at, o.created_at, o.updated_at,
    coalesce((select json_agg(json_build_object('name', i.name, 'quantity', i.quantity, 'unit', i.unit,
                'unit_price', i.unit_price, 'instructions', i.instructions) order by i.position)
              from order_items i where i.order_id = o.id), '[]'::json) as items`;

  async function insertItems(tx: postgres.TransactionSql, orderId: string, items: OrderItem[]) {
    if (items.length === 0) return;
    const rows = items.map((i, position) => ({
      order_id: orderId,
      position,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      unit_price: i.unitPrice,
      instructions: i.instructions,
    }));
    await tx`insert into order_items ${tx(rows)}`;
  }

  return {
    async listOrders(f) {
      await ready();
      const today = todayISO();
      const q = f.q ? `%${f.q}%` : null;
      const rows = await sql<OrderRow[]>`
        select ${orderCols} from orders o
        where ${f.view === "archived" ? sql`archived_at is not null` : sql`archived_at is null`}
          ${f.status ? sql`and status = ${f.status}` : sql``}
          ${f.view === "upcoming" ? sql`and pickup_date >= ${today}` : sql``}
          ${f.view === "today" ? sql`and pickup_date = ${today}` : sql``}
          ${f.view === "past" ? sql`and pickup_date < ${today}` : sql``}
          ${f.date ? sql`and pickup_date = ${f.date}` : sql``}
          ${
            q
              ? sql`and (customer_name ilike ${q} or exists (
                  select 1 from order_items i where i.order_id = o.id and i.name ilike ${q}))`
              : sql``
          }
        order by ${
          f.view === "archived"
            ? sql`archived_at desc`
            : sql`pickup_date ${f.view === "past" || f.view === "all" ? sql`desc` : sql`asc`}, pickup_time asc nulls last`
        }
        limit 500`;
      return hydrate(rows);
    },

    async getOrder(id) {
      await ready();
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const rows = await sql<OrderRow[]>`select ${orderCols} from orders o where o.id = ${id}`;
      return hydrate(rows)[0] ?? null;
    },

    async createOrder(input) {
      await ready();
      const id = randomUUID();
      await sql.begin(async (tx) => {
        await tx`insert into orders (id, customer_name, pickup_date, pickup_time, notes, discount_type, discount_value)
                 values (${id}, ${input.customerName}, ${input.pickupDate}, ${input.pickupTime}, ${input.notes},
                         ${input.discountType}, ${input.discountValue})`;
        await insertItems(tx, id, input.items);
      });
      return id;
    },

    async updateOrder(id, input) {
      await ready();
      await sql.begin(async (tx) => {
        await tx`update orders set customer_name = ${input.customerName}, pickup_date = ${input.pickupDate},
                 pickup_time = ${input.pickupTime}, notes = ${input.notes},
                 discount_type = ${input.discountType}, discount_value = ${input.discountValue}, updated_at = now()
                 where id = ${id}`;
        await tx`delete from order_items where order_id = ${id}`;
        await insertItems(tx, id, input.items);
      });
    },

    async setStatus(id, status) {
      await ready();
      await sql`update orders set status = ${status}, updated_at = now() where id = ${id}`;
    },

    async archiveOrder(id) {
      await ready();
      await sql`update orders set archived_at = now() where id = ${id} and archived_at is null`;
    },

    async restoreOrder(id) {
      await ready();
      await sql`update orders set archived_at = null where id = ${id}`;
    },

    async deleteOrder(id) {
      await ready();
      await sql`delete from orders where id = ${id}`;
    },

    async purgeArchived() {
      await ready();
      const rows = await sql`delete from orders
        where archived_at < now() - make_interval(days => ${ARCHIVE_RETENTION_DAYS}) returning id`;
      return rows.length;
    },

    async itemHistory() {
      await ready();
      type Row = { name: string; customer_name: string | null; unit: string; unit_price: string; quantity: string; ordered_at: Date };
      const rows = await sql<Row[]>`
        (select distinct on (lower(i.name)) i.name, null::text as customer_name, i.unit, i.unit_price, i.quantity,
                o.created_at as ordered_at
           from order_items i join orders o on o.id = i.order_id
          order by lower(i.name), o.created_at desc)
        union all
        (select distinct on (lower(o.customer_name), lower(i.name)) i.name, o.customer_name, i.unit, i.unit_price,
                i.quantity, o.created_at
           from order_items i join orders o on o.id = i.order_id
          order by lower(o.customer_name), lower(i.name), o.created_at desc)`;
      return rows.map((r) => ({
        name: r.name,
        customerName: r.customer_name,
        unit: r.unit,
        unitPrice: Number(r.unit_price),
        quantity: Number(r.quantity),
        orderedAt: r.ordered_at.toISOString(),
      }));
    },

    async customerNames() {
      await ready();
      const rows = await sql<{ name: string }[]>`
        select min(customer_name) as name from orders
        group by lower(customer_name) order by max(created_at) desc limit 1000`;
      return rows.map((r) => r.name);
    },

    async stats() {
      await ready();
      const today = todayISO();
      const [r] = await sql<{ today_count: number; upcoming_count: number; upcoming_value: string | null }[]>`
        with t as (
          select o.pickup_date, o.discount_type, o.discount_value,
                 coalesce(sum(round(i.quantity * i.unit_price, 2)), 0) as sub
            from orders o left join order_items i on i.order_id = o.id
           where o.pickup_date >= ${today} and o.archived_at is null and o.status <> 'cancelled'
           group by o.id)
        select
          count(*) filter (where pickup_date = ${today})::int as today_count,
          count(*)::int as upcoming_count,
          sum(sub - least(sub, case when discount_type = 'percent'
                                    then round(sub * least(discount_value, 100) / 100, 2)
                                    else discount_value end)) as upcoming_value
        from t`;
      return {
        todayCount: r.today_count,
        upcomingCount: r.upcoming_count,
        upcomingValue: round2(Number(r.upcoming_value ?? 0)),
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Local JSON file — for development without a database only           */
/* ------------------------------------------------------------------ */

function fileStore(): Store {
  const file = path.join(process.cwd(), ".data", "orders.json");

  async function load(): Promise<Order[]> {
    try {
      return JSON.parse(await fs.readFile(file, "utf8"));
    } catch {
      return [];
    }
  }
  async function save(orders: Order[]) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(orders, null, 2));
  }
  const byNewest = (a: Order, b: Order) => (a.createdAt < b.createdAt ? 1 : -1);

  return {
    async listOrders(f) {
      const today = todayISO();
      return sortOrders((await load()).filter((o) => matchesFilter(o, f, today)), f);
    },
    async getOrder(id) {
      return (await load()).find((o) => o.id === id) ?? null;
    },
    async createOrder(input) {
      const orders = await load();
      const now = new Date().toISOString();
      const id = randomUUID();
      orders.push({ ...withTotals(input), id, status: "pending", archivedAt: null, createdAt: now, updatedAt: now });
      await save(orders);
      return id;
    },
    async updateOrder(id, input) {
      const orders = await load();
      const o = orders.find((x) => x.id === id);
      if (!o) return;
      Object.assign(o, withTotals(input), { updatedAt: new Date().toISOString() });
      await save(orders);
    },
    async setStatus(id, status) {
      const orders = await load();
      const o = orders.find((x) => x.id === id);
      if (o) Object.assign(o, { status, updatedAt: new Date().toISOString() });
      await save(orders);
    },
    async archiveOrder(id) {
      const orders = await load();
      const o = orders.find((x) => x.id === id);
      if (o && !o.archivedAt) o.archivedAt = new Date().toISOString();
      await save(orders);
    },
    async restoreOrder(id) {
      const orders = await load();
      const o = orders.find((x) => x.id === id);
      if (o) o.archivedAt = null;
      await save(orders);
    },
    async deleteOrder(id) {
      await save((await load()).filter((o) => o.id !== id));
    },
    async purgeArchived() {
      const cutoff = new Date(Date.now() - ARCHIVE_RETENTION_DAYS * 864e5).toISOString();
      const orders = await load();
      const keep = orders.filter((o) => !o.archivedAt || o.archivedAt >= cutoff);
      if (keep.length !== orders.length) await save(keep);
      return orders.length - keep.length;
    },
    async itemHistory() {
      const seen = new Map<string, ItemHistory>();
      for (const o of (await load()).sort(byNewest)) {
        for (const i of o.items) {
          const entry = (customerName: string | null): ItemHistory => ({
            name: i.name,
            customerName,
            unit: i.unit,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            orderedAt: o.createdAt,
          });
          const g = `|${i.name.toLowerCase()}`;
          const c = `${o.customerName.toLowerCase()}|${i.name.toLowerCase()}`;
          if (!seen.has(g)) seen.set(g, entry(null));
          if (!seen.has(c)) seen.set(c, entry(o.customerName));
        }
      }
      return [...seen.values()];
    },
    async customerNames() {
      const names = new Map<string, string>();
      for (const o of (await load()).sort(byNewest)) {
        if (!names.has(o.customerName.toLowerCase())) names.set(o.customerName.toLowerCase(), o.customerName);
      }
      return [...names.values()];
    },
    async stats() {
      const today = todayISO();
      const orders = (await load()).filter((o) => !o.archivedAt && o.status !== "cancelled");
      const upcoming = orders.filter((o) => o.pickupDate >= today);
      return {
        todayCount: orders.filter((o) => o.pickupDate === today).length,
        upcomingCount: upcoming.length,
        upcomingValue: round2(upcoming.reduce((s, o) => s + o.total, 0)),
      };
    },
  };
}

let store: Store | null = null;
let lastPurge = 0;

/** Runs the 30-day archive purge at most every 10 minutes per server instance. */
export async function purgeIfDue() {
  if (Date.now() - lastPurge < 10 * 60 * 1000) return;
  lastPurge = Date.now();
  try {
    await db().purgeArchived();
  } catch (e) {
    console.error("Archive purge failed", e);
  }
}

export function db(): Store {
  if (store) return store;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) return (store = postgresStore(url));
  if (process.env.VERCEL) {
    throw new Error(
      "No database configured. Add a Neon Postgres database in Vercel (Storage tab) so DATABASE_URL is set, then redeploy."
    );
  }
  return (store = fileStore());
}
