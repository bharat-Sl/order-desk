// Shared by middleware (Edge runtime) and server actions, so Web Crypto only.

export const SESSION_COOKIE = "od_session";

export function adminPassword() {
  return process.env.ADMIN_PASSWORD || "";
}

/** Auth is optional when running locally without ADMIN_PASSWORD; required on Vercel. */
export function authRequired() {
  return Boolean(adminPassword()) || Boolean(process.env.VERCEL);
}

export async function sessionToken(password: string) {
  const data = new TextEncoder().encode(`order-desk:v1:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isValidSession(cookie: string | undefined) {
  if (!authRequired()) return true;
  const pw = adminPassword();
  if (!pw || !cookie) return false;
  return cookie === (await sessionToken(pw));
}
