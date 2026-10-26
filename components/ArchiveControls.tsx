"use client";

import { useTransition } from "react";
import { archiveOrder, deleteOrderForever, restoreOrder } from "@/app/actions";

type Props = { id: string; archived: boolean; compact?: boolean };

/** Archive (soft delete) for active orders; Restore / Delete permanently for archived ones. */
export default function ArchiveControls({ id, archived, compact }: Props) {
  const [pending, startTransition] = useTransition();
  const size = compact ? " btn-sm" : "";
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  if (!archived) {
    return (
      <button
        type="button"
        className={`btn btn-danger${size}`}
        disabled={pending}
        onClick={(e) => {
          stop(e);
          if (confirm("Archive this order? You can restore it from Archived for 30 days, then it is deleted for good."))
            startTransition(() => archiveOrder(id));
        }}
      >
        {pending ? "Archiving…" : "Archive"}
      </button>
    );
  }

  return (
    <span className="actions" onClick={stop}>
      <button
        type="button"
        className={`btn${size}`}
        disabled={pending}
        onClick={() => startTransition(() => restoreOrder(id))}
      >
        Restore
      </button>
      <button
        type="button"
        className={`btn btn-danger${size}`}
        disabled={pending}
        onClick={() => {
          if (confirm("Delete this order permanently? This cannot be undone."))
            startTransition(() => deleteOrderForever(id));
        }}
      >
        Delete permanently
      </button>
    </span>
  );
}
