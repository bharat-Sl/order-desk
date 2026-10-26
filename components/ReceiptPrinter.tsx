"use client";

import { useEffect } from "react";

const PX_PER_MM = 96 / 25.4;

/**
 * Paper lengths the 80mm roll driver (POS80) offers. When the CSS page size matches none of
 * them, Chrome/Edge fit the page onto the driver's default sheet and centre it, which leaves a
 * large blank gap above the receipt. With the driver set to "Page End: Ignore page tails
 * blank", the unused rest of the sheet isn't fed, so each receipt comes out at its own length.
 */
const PAPER_LENGTHS_MM = [210, 297, 3276];

function paperLength(el: HTMLElement) {
  const mm = Math.ceil(el.getBoundingClientRect().height / PX_PER_MM);
  return PAPER_LENGTHS_MM.find((len) => mm <= len) ?? PAPER_LENGTHS_MM[PAPER_LENGTHS_MM.length - 1];
}

/** Gives each receipt its own 80mm page, then optionally opens the print dialog. */
function sizePages() {
  const receipts = [...document.querySelectorAll<HTMLElement>(".receipt")];
  const rules = receipts.map((el, i) => {
    return `@page r${i} { size: 80mm ${paperLength(el)}mm; margin: 0; } .receipt[data-index="${i}"] { page: r${i}; }`;
  });
  const first = receipts[0] ? paperLength(receipts[0]) : PAPER_LENGTHS_MM[0];
  let style = document.getElementById("receipt-page-size");
  if (!style) {
    style = document.createElement("style");
    style.id = "receipt-page-size";
    document.head.appendChild(style);
  }
  // The unnamed @page is the fallback for browsers without named-page support.
  style.textContent = `@page { size: 80mm ${first}mm; margin: 0; }\n${rules.join("\n")}`;
}

export default function ReceiptPrinter({ autoPrint }: { autoPrint: boolean }) {
  useEffect(() => {
    sizePages();
    window.addEventListener("beforeprint", sizePages);
    if (autoPrint) {
      // Let fonts and layout settle before measuring and printing.
      const t = setTimeout(() => {
        // Print at most once per page load, even if the component remounts.
        const w = window as Window & { __receiptAutoPrinted?: boolean };
        if (w.__receiptAutoPrinted) return;
        w.__receiptAutoPrinted = true;
        sizePages();
        window.print();
      }, 300);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeprint", sizePages);
      };
    }
    return () => window.removeEventListener("beforeprint", sizePages);
  }, [autoPrint]);

  return (
    <button type="button" className="btn btn-primary" onClick={() => window.print()}>
      Print
    </button>
  );
}
