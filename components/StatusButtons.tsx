"use client";

import { useState, useTransition } from "react";
import { setOrderStatus } from "@/app/actions";
import { ORDER_STATUSES, STATUS_LABELS, type OrderStatus } from "@/lib/types";

/** Segmented status control for the order detail page. */
export default function StatusButtons({ id, status }: { id: string; status: OrderStatus }) {
  const [value, setValue] = useState(status);
  const [pending, startTransition] = useTransition();
  return (
    <div className="segmented" role="group" aria-label="Order status">
      {ORDER_STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          disabled={pending}
          aria-pressed={value === s}
          className={value === s ? `active status-${s}` : ""}
          onClick={() => {
            if (s === value) return;
            setValue(s);
            startTransition(() => setOrderStatus(id, s));
          }}
        >
          {STATUS_LABELS[s]}
        </button>
      ))}
    </div>
  );
}
