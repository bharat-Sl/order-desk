"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { saveOrder } from "@/app/actions";
import {
  CURRENCY_SYMBOL,
  TIME_SLOTS,
  UNITS,
  formatDate,
  formatMoney,
  formatSlot,
  lineTotal,
  totals,
  type DiscountType,
} from "@/lib/format";
import type { ItemHistory, Order } from "@/lib/types";

type Row = {
  key: number;
  name: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  instructions: string;
  // Fields the user has typed into are never overwritten by a prefill.
  manual: { quantity: boolean; unit: boolean; unitPrice: boolean };
  hint: ItemHistory | null;
};

type Props = {
  order?: Order;
  customers: string[];
  history: ItemHistory[];
  today: string;
};

let nextKey = 1;

function emptyRow(): Row {
  return {
    key: nextKey++,
    name: "",
    quantity: "",
    unit: "pcs",
    unitPrice: "",
    instructions: "",
    manual: { quantity: false, unit: false, unitPrice: false },
    hint: null,
  };
}

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export default function OrderForm({ order, customers, history, today }: Props) {
  const lookup = useMemo(() => {
    const m = new Map<string, ItemHistory>();
    for (const h of history) m.set(`${h.customerName ? norm(h.customerName) : ""}|${norm(h.name)}`, h);
    return m;
  }, [history]);
  const itemNames = useMemo(
    () => [...new Set(history.filter((h) => !h.customerName).map((h) => h.name))].sort((a, b) => a.localeCompare(b)),
    [history]
  );
  const knownCustomers = useMemo(() => new Set(customers.map(norm)), [customers]);

  const [customerName, setCustomerName] = useState(order?.customerName ?? "");
  const [pickupDate, setPickupDate] = useState(order?.pickupDate ?? today);
  const [pickupTime, setPickupTime] = useState(order?.pickupTime ?? "");
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [discountType, setDiscountType] = useState<DiscountType>(order?.discountType ?? "amount");
  const [discountValue, setDiscountValue] = useState(order?.discountValue ? String(order.discountValue) : "");
  const [rows, setRows] = useState<Row[]>(() =>
    order
      ? order.items.map((i) => ({
          key: nextKey++,
          name: i.name,
          quantity: String(i.quantity),
          unit: i.unit,
          unitPrice: i.unitPrice.toFixed(2),
          instructions: i.instructions,
          // Existing orders keep the price they were taken at.
          manual: { quantity: true, unit: true, unitPrice: true },
          hint: null,
        }))
      : [emptyRow()]
  );
  const [focusKey, setFocusKey] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function findHistory(itemName: string, customer: string) {
    if (!norm(itemName)) return null;
    return lookup.get(`${norm(customer)}|${norm(itemName)}`) ?? lookup.get(`|${norm(itemName)}`) ?? null;
  }

  function prefill(row: Row, customer: string): Row {
    const h = findHistory(row.name, customer);
    if (!h) return { ...row, hint: null };
    return {
      ...row,
      hint: h,
      quantity: row.manual.quantity ? row.quantity : String(h.quantity),
      unit: row.manual.unit ? row.unit : h.unit,
      unitPrice: row.manual.unitPrice ? row.unitPrice : h.unitPrice.toFixed(2),
    };
  }

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        return "name" in patch ? prefill(next, customerName) : next;
      })
    );
  }

  function editField(key: number, field: "quantity" | "unit" | "unitPrice", value: string) {
    setRows((rs) =>
      rs.map((r) => (r.key === key ? { ...r, [field]: value, manual: { ...r.manual, [field]: true } } : r))
    );
  }

  function changeCustomer(name: string) {
    setCustomerName(name);
    setRows((rs) => rs.map((r) => prefill(r, name)));
  }

  function addRow() {
    const r = emptyRow();
    setRows((rs) => [...rs, r]);
    setFocusKey(r.key);
  }

  function removeRow(key: number) {
    setRows((rs) => (rs.length === 1 ? [emptyRow()] : rs.filter((r) => r.key !== key)));
  }

  const sums = totals(
    rows.map((r) => ({ quantity: Number(r.quantity), unitPrice: Number(r.unitPrice) })),
    discountType,
    Number(discountValue)
  );
  const filledRows = rows.filter((r) => r.name.trim()).length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await saveOrder(order?.id ?? null, {
        customerName,
        pickupDate,
        pickupTime: pickupTime || null,
        notes,
        discountType,
        discountValue: Number(discountValue) || 0,
        items: rows.map((r) => ({
          name: r.name,
          quantity: Number(r.quantity),
          unit: r.unit,
          unitPrice: Number(r.unitPrice),
          instructions: r.instructions,
        })),
      });
      if (res?.error) {
        setError(res.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  const returning = customerName.trim() && knownCustomers.has(norm(customerName));

  return (
    <form onSubmit={submit}>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card card-pad">
        <h2>Customer &amp; pick-up</h2>
        <div className="grid-3">
          <label className="field">
            <span className="required">
              Customer name {returning && <span className="pill">Returning customer</span>}
            </span>
            <input
              list="customer-list"
              value={customerName}
              onChange={(e) => changeCustomer(e.target.value)}
              placeholder="e.g. Jane Smith"
              autoComplete="off"
              autoFocus={!order}
              required
            />
            <datalist id="customer-list">
              {customers.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span className="required">Pick-up date</span>
            <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} required />
          </label>
          <label className="field">
            <span>
              Pick-up time <span className="hint">(optional)</span>
            </span>
            <select value={pickupTime} onChange={(e) => setPickupTime(e.target.value)}>
              <option value="">No specific time</option>
              {TIME_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {formatSlot(s)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        <div className="card-pad" style={{ paddingBottom: 6 }}>
          <h2 style={{ marginBottom: 2 }}>Items</h2>
          <div className="muted small">
            Previously ordered items fill in their last quantity, unit and price automatically. You can change any
            value.
          </div>
        </div>
        <table className="items-table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="c-qty">Qty</th>
              <th className="c-unit">Unit</th>
              <th className="c-price">Unit price</th>
              <th className="c-total num">Amount</th>
              <th className="c-del" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isPrefilled = r.hint && !(r.manual.quantity && r.manual.unit && r.manual.unitPrice);
              return (
                <ItemRow
                  key={r.key}
                  row={r}
                  isPrefilled={Boolean(isPrefilled)}
                  autoFocus={focusKey === r.key}
                  forCustomer={Boolean(r.hint?.customerName)}
                  onName={(v) => updateRow(r.key, { name: v })}
                  onField={(f, v) => editField(r.key, f, v)}
                  onInstructions={(v) => updateRow(r.key, { instructions: v })}
                  onRemove={() => removeRow(r.key)}
                />
              );
            })}
          </tbody>
        </table>
        <datalist id="item-list">
          {itemNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <div className="form-foot">
          <button type="button" className="btn" onClick={addRow}>
            + Add item
          </button>
          <div className="muted">
            {filledRows} item{filledRows === 1 ? "" : "s"}
          </div>
        </div>
        <div className="summary">
          <div className="summary-row">
            <span className="muted">Subtotal</span>
            <span className="num">{formatMoney(sums.subtotal)}</span>
          </div>
          <div className="summary-row">
            <label className="discount">
              <span className="muted">Discount</span>
              <span className="discount-input">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max={discountType === "percent" ? 100 : undefined}
                  step="0.01"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="0"
                  aria-label="Discount"
                />
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                  aria-label="Discount type"
                >
                  <option value="amount">{CURRENCY_SYMBOL}</option>
                  <option value="percent">%</option>
                </select>
              </span>
            </label>
            <span className="num">{sums.discount > 0 ? `− ${formatMoney(sums.discount)}` : formatMoney(0)}</span>
          </div>
          <div className="summary-row summary-total">
            <span>Total</span>
            <span className="num grand-total">{formatMoney(sums.total)}</span>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <label className="field">
          <span>
            Order notes <span className="hint">(optional)</span>
          </span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything else about this order" />
        </label>
      </div>

      <div className="sticky-bar">
        <span className="muted" style={{ marginRight: "auto" }}>
          {customerName.trim() || "New order"} · {pickupDate ? formatDate(pickupDate) : "No date"} ·{" "}
          {formatSlot(pickupTime || null)} · <strong>{formatMoney(sums.total)}</strong>
        </span>
        <Link href={order ? `/orders/${order.id}` : "/"} className="btn">
          Cancel
        </Link>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : order ? "Save changes" : "Create order"}
        </button>
      </div>
    </form>
  );
}

function ItemRow(props: {
  row: Row;
  isPrefilled: boolean;
  autoFocus: boolean;
  forCustomer: boolean;
  onName: (v: string) => void;
  onField: (f: "quantity" | "unit" | "unitPrice", v: string) => void;
  onInstructions: (v: string) => void;
  onRemove: () => void;
}) {
  const { row: r, isPrefilled, forCustomer } = props;
  const h = r.hint;
  const units = UNITS.includes(r.unit) ? UNITS : [r.unit, ...UNITS];
  return (
    <tr className={isPrefilled ? "prefilled" : ""}>
      <td className="c-name">
        <input
          list="item-list"
          value={r.name}
          onChange={(e) => props.onName(e.target.value)}
          // Snap "croissant" to the saved spelling "Croissant" so the item list stays tidy.
          onBlur={() => h && norm(r.name) === norm(h.name) && r.name !== h.name && props.onName(h.name)}
          placeholder="Item name"
          autoComplete="off"
          autoFocus={props.autoFocus}
          aria-label="Item name"
        />
        <input
          className="c-instr"
          style={{ marginTop: 6, fontSize: 13 }}
          value={r.instructions}
          onChange={(e) => props.onInstructions(e.target.value)}
          placeholder="Special instructions (optional)"
          aria-label="Special instructions"
        />
        {h && (
          <div className="prefill">
            {isPrefilled ? "Prefilled from " : "Last ordered: "}
            {forCustomer ? "this customer's last order" : "the last order"} on {formatDate(h.orderedAt.slice(0, 10))} —{" "}
            {h.quantity} {h.unit} @ {formatMoney(h.unitPrice)}
          </div>
        )}
      </td>
      <td className="c-qty">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={r.quantity}
          onChange={(e) => props.onField("quantity", e.target.value)}
          placeholder="Qty"
          aria-label="Quantity"
        />
      </td>
      <td className="c-unit">
        <select value={r.unit} onChange={(e) => props.onField("unit", e.target.value)} aria-label="Unit">
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </td>
      <td className="c-price">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={r.unitPrice}
          onChange={(e) => props.onField("unitPrice", e.target.value)}
          placeholder="0.00"
          aria-label="Unit price"
        />
      </td>
      <td className="c-total num" style={{ paddingTop: 16 }}>
        {formatMoney(lineTotal(Number(r.quantity), Number(r.unitPrice)))}
      </td>
      <td className="c-del">
        <button type="button" className="icon-btn" onClick={props.onRemove} title="Remove item" aria-label="Remove item">
          ×
        </button>
      </td>
    </tr>
  );
}
