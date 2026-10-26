"use client";

import { useEffect, useRef, useState } from "react";

/** Prints /receipts?{query} through a hidden iframe, so the current page stays put. */
export function printReceipts(query: string, onDone?: () => void) {
  document.getElementById("receipt-frame")?.remove();
  const frame = document.createElement("iframe");
  frame.id = "receipt-frame";
  frame.setAttribute("aria-hidden", "true");
  // Off-screen but laid out at receipt width, so heights measure correctly.
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:80mm;height:600px;border:0;";
  frame.src = `/receipts?${query}&autoprint=1`;
  frame.addEventListener("load", () => {
    frame.contentWindow?.addEventListener("afterprint", () => {
      onDone?.();
      setTimeout(() => frame.remove(), 1000);
    });
  });
  document.body.appendChild(frame);
}

type Props = {
  query: string;
  label?: string;
  className?: string;
  /** Print once as soon as the component mounts (used after saving an order). */
  auto?: boolean;
};

export default function PrintReceiptButton({ query, label = "Print receipt", className = "btn", auto }: Props) {
  const [busy, setBusy] = useState(false);
  const fired = useRef(false);

  const print = () => {
    setBusy(true);
    printReceipts(query, () => setBusy(false));
    setTimeout(() => setBusy(false), 8000);
  };

  useEffect(() => {
    if (!auto || fired.current) return;
    fired.current = true;
    print();
    // Drop ?print=1 so a refresh doesn't print again.
    const url = new URL(window.location.href);
    url.searchParams.delete("print");
    window.history.replaceState(null, "", url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation();
        print();
      }}
    >
      {busy ? "Printing…" : label}
    </button>
  );
}
