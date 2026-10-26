export type OrderItem = {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  instructions: string;
};

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
  createdAt: string;
  updatedAt: string;
};

export type OrderInput = Omit<Order, "id" | "subtotal" | "discount" | "total" | "createdAt" | "updatedAt">;

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
  view: "upcoming" | "today" | "past" | "all";
  q?: string;
  date?: string;
};
