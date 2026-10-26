"use client";

import { useTransition } from "react";
import { deleteOrder } from "@/app/actions";

export default function DeleteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-danger"
      disabled={pending}
      onClick={() => {
        if (confirm("Delete this order? This cannot be undone.")) startTransition(() => deleteOrder(id));
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
