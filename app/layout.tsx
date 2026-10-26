import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE, authRequired, isValidSession } from "@/lib/auth";
import { logout } from "./actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Order Desk",
  description: "Pick-up order management",
  icons: { icon: "/icon.svg" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const signedIn = await isValidSession((await cookies()).get(SESSION_COOKIE)?.value);
  return (
    <html lang="en">
      <body>
        {signedIn && (
          <header className="topbar no-print">
            <div className="topbar-inner">
              <Link href="/" className="brand">
                <span className="brand-mark">OD</span> Order Desk
              </Link>
              <nav className="nav">
                <Link href="/">Orders</Link>
                <Link href="/orders/new" className="btn btn-primary btn-sm">
                  + New order
                </Link>
                {authRequired() && (
                  <form action={logout}>
                    <button className="btn btn-ghost btn-sm" type="submit">
                      Sign out
                    </button>
                  </form>
                )}
              </nav>
            </div>
          </header>
        )}
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
