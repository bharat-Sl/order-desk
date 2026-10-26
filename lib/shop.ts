/**
 * Shop details printed at the top of every receipt. Edit these, or override any of them with the
 * matching NEXT_PUBLIC_SHOP_* environment variable in Vercel. Leave a line empty to hide it.
 */
export const SHOP = {
  name: process.env.NEXT_PUBLIC_SHOP_NAME ?? "MOR MUKUT PETHA BHANDAR",
  address: process.env.NEXT_PUBLIC_SHOP_ADDRESS ?? "143, INSIDE SAIYAR GATE JHANSI",
  phone: process.env.NEXT_PUBLIC_SHOP_PHONE ?? "9936915155",
  fssai: process.env.NEXT_PUBLIC_SHOP_FSSAI ?? "12714013000303",
  gstin: process.env.NEXT_PUBLIC_SHOP_GSTIN ?? "09ABTPA1792K1Z6",
  receiptTitle: process.env.NEXT_PUBLIC_RECEIPT_TITLE ?? "INVOICE",
};
