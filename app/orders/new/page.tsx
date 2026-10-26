import Link from "next/link";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/format";
import OrderForm from "@/components/OrderForm";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const [customers, history] = await Promise.all([db().customerNames(), db().itemHistory()]);
  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/" className="small">← Orders</Link>
          <h1>New order</h1>
        </div>
      </div>
      <OrderForm customers={customers} history={history} today={todayISO()} />
    </>
  );
}
