export const UNITS = ["pcs", "kg", "g", "lb", "oz", "L", "ml", "dozen", "box", "pack", "tray", "bag"];

const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "INR";
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: CURRENCY });

export const CURRENCY_SYMBOL =
  money.formatToParts(0).find((p) => p.type === "currency")?.value ?? CURRENCY;

export function formatMoney(n: number) {
  return money.format(n || 0);
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function lineTotal(quantity: number, unitPrice: number) {
  return round2((quantity || 0) * (unitPrice || 0));
}

export type DiscountType = "amount" | "percent";

/** Discount in money for a subtotal; never more than the subtotal. */
export function discountAmount(subtotal: number, type: DiscountType, value: number) {
  const v = Math.max(0, value || 0);
  const d = type === "percent" ? round2((subtotal * Math.min(v, 100)) / 100) : round2(v);
  return Math.min(d, subtotal);
}

export function totals(
  items: { quantity: number; unitPrice: number }[],
  discountType: DiscountType,
  discountValue: number
) {
  const subtotal = round2(items.reduce((s, i) => s + lineTotal(i.quantity, i.unitPrice), 0));
  const discount = discountAmount(subtotal, discountType, discountValue);
  return { subtotal, discount, total: round2(subtotal - discount) };
}

/** All 48 half-hour slots of a day as "HH:MM". */
export const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  return `${h}:${i % 2 ? "30" : "00"}`;
});

export function formatSlot(slot: string | null) {
  if (!slot) return "Any time";
  const [h, m] = slot.split(":").map(Number);
  const start = toLabel(h, m);
  const endMin = h * 60 + m + 30;
  const end = toLabel(Math.floor(endMin / 60) % 24, endMin % 60);
  return `${start} – ${end}`;
}

function toLabel(h: number, m: number) {
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Today's date as YYYY-MM-DD in the business time zone. */
export function todayISO() {
  const tz = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Kolkata";
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}
