import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/format";
import OrderForm from "@/components/OrderForm";

export const dynamic = "force-dynamic";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, customers, history] = await Promise.all([
    db().getOrder(id),
    db().customerNames(),
    db().itemHistory(),
  ]);
  if (!order) notFound();
  return (
    <>
      <div className="page-head">
        <div>
          <Link href={`/orders/${order.id}`} className="small">← Back to order</Link>
          <h1>Edit order</h1>
        </div>
      </div>
      <OrderForm order={order} customers={customers} history={history} today={todayISO()} />
    </>
  );
}
