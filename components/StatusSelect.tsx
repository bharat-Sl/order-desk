"use client";

import { useState, useTransition } from "react";
import { setOrderStatus } from "@/app/actions";
import { ORDER_STATUSES, STATUS_LABELS, type OrderStatus } from "@/lib/types";

/** Inline status picker; safe to use inside a clickable table row. */
export default function StatusSelect({ id, status }: { id: string; status: OrderStatus }) {
  const [value, setValue] = useState(status);
  const [pending, startTransition] = useTransition();
  return (
    <select
      className={`status-select status-${value}`}
      value={value}
      disabled={pending}
      aria-label="Order status"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const next = e.target.value as OrderStatus;
        setValue(next);
        startTransition(() => setOrderStatus(id, next));
      }}
    >
      {ORDER_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
