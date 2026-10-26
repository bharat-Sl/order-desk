export type OrderItem = {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  instructions: string;
};

export const ORDER_STATUSES = ["pending", "ready", "picked_up", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  ready: "Ready",
  picked_up: "Picked up",
  cancelled: "Cancelled",
};

/** Archived orders are permanently deleted after this many days. */
export const ARCHIVE_RETENTION_DAYS = 30;

export type Order = {
  id: string;
  customerName: string;
  pickupDate: string; // YYYY-MM-DD
  pickupTime: string | null; // HH:MM, on a half-hour slot
  notes: string;
  items: OrderItem[];
  discountType: "amount" | "percent";
  discountValue: number; // rupees, or a percentage when discountType is "percent"
  subtotal: number;
  discount: number; // discount in money
  total: number;
  status: OrderStatus;
  archivedAt: string | null; // set when soft-deleted
  createdAt: string;
  updatedAt: string;
};

export type OrderInput = Omit<
  Order,
  "id" | "subtotal" | "discount" | "total" | "status" | "archivedAt" | "createdAt" | "updatedAt"
>;

/** Most recent price/unit/quantity seen for an item, optionally for one customer. */
export type ItemHistory = {
  name: string;
  customerName: string | null;
  unit: string;
  unitPrice: number;
  quantity: number;
  orderedAt: string;
};

export type OrderFilter = {
  view: "upcoming" | "today" | "past" | "all" | "archived";
  status?: OrderStatus;
  q?: string;
  date?: string;
};
