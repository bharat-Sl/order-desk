"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { SESSION_COOKIE, adminPassword, isValidSession, sessionToken } from "@/lib/auth";
import { TIME_SLOTS, lineTotal, round2 } from "@/lib/format";
import { ORDER_STATUSES, type OrderInput, type OrderStatus } from "@/lib/types";

async function assertAdmin() {
  const jar = await cookies();
  if (!(await isValidSession(jar.get(SESSION_COOKIE)?.value))) redirect("/login");
}

function validate(raw: OrderInput): { input?: OrderInput; error?: string } {
  const customerName = String(raw.customerName ?? "").trim().replace(/\s+/g, " ");
  if (!customerName) return { error: "Customer name is required." };
  if (customerName.length > 120) return { error: "Customer name is too long." };

  const pickupDate = String(raw.pickupDate ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate) || isNaN(Date.parse(pickupDate)))
    return { error: "Pick-up date is required." };

  const pickupTime = raw.pickupTime ? String(raw.pickupTime) : null;
  if (pickupTime && !TIME_SLOTS.includes(pickupTime)) return { error: "Pick a valid half-hour time slot." };

  const items = (Array.isArray(raw.items) ? raw.items : [])
    .map((i) => ({
      name: String(i.name ?? "").trim().replace(/\s+/g, " "),
      quantity: Number(i.quantity),
      unit: String(i.unit ?? "").trim(),
      unitPrice: round2(Number(i.unitPrice)),
      instructions: String(i.instructions ?? "").trim().slice(0, 500),
    }))
    .filter((i) => i.name);
  if (items.length === 0) return { error: "Add at least one item." };
  for (const i of items) {
    if (!(i.quantity > 0)) return { error: `Enter a quantity for "${i.name}".` };
    if (!i.unit) return { error: `Choose a unit for "${i.name}".` };
    if (!(i.unitPrice >= 0) || !isFinite(i.unitPrice)) return { error: `Enter a price for "${i.name}".` };
  }

  const discountType = raw.discountType === "percent" ? "percent" : "amount";
  const discountValue = round2(Number(raw.discountValue) || 0);
  if (discountValue < 0 || !isFinite(discountValue)) return { error: "Discount cannot be negative." };
  if (discountType === "percent" && discountValue > 100) return { error: "Discount cannot be more than 100%." };
  const subtotal = round2(items.reduce((s, i) => s + lineTotal(i.quantity, i.unitPrice), 0));
  if (discountType === "amount" && discountValue > subtotal)
    return { error: "Discount cannot be more than the order subtotal." };

  const notes = String(raw.notes ?? "").trim().slice(0, 1000);
  return { input: { customerName, pickupDate, pickupTime, notes, items, discountType, discountValue } };
}

export async function saveOrder(id: string | null, raw: OrderInput, printAfter = false): Promise<{ error: string }> {
  await assertAdmin();
  const { input, error } = validate(raw);
  if (!input) return { error: error! };
  let orderId = id;
  try {
    if (id) await db().updateOrder(id, input);
    else orderId = await db().createOrder(input);
  } catch (e) {
    console.error(e);
    return { error: "Could not save the order. Please try again." };
  }
  revalidatePath("/", "layout");
  redirect(`/orders/${orderId}?saved=1${printAfter ? "&print=1" : ""}`);
}

export async function setOrderStatus(id: string, status: OrderStatus) {
  await assertAdmin();
  if (!ORDER_STATUSES.includes(status)) return;
  await db().setStatus(id, status);
  revalidatePath("/", "layout");
}

export async function archiveOrder(id: string) {
  await assertAdmin();
  await db().archiveOrder(id);
  revalidatePath("/", "layout");
  redirect("/?archived=1");
}

export async function restoreOrder(id: string) {
  await assertAdmin();
  await db().restoreOrder(id);
  revalidatePath("/", "layout");
}

/** Permanent delete — only for orders that are already archived. */
export async function deleteOrderForever(id: string) {
  await assertAdmin();
  const order = await db().getOrder(id);
  if (order?.archivedAt) await db().deleteOrder(id);
  revalidatePath("/", "layout");
  redirect("/?view=archived");
}

export async function login(_prev: { error: string } | null, form: FormData) {
  const pw = adminPassword();
  if (!pw) return { error: "ADMIN_PASSWORD is not set. Add it in your Vercel project settings and redeploy." };
  if (String(form.get("password") ?? "") !== pw) return { error: "Incorrect password." };
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await sessionToken(pw), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
