"use client";

import { useRouter } from "next/navigation";

/** A table row that navigates on click (the customer name is also a real link). */
export default function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr className="row-link" onClick={() => router.push(href)}>
      {children}
    </tr>
  );
}
