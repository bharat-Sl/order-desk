# Order Desk

A small admin panel for taking pick-up orders.

- Customer name (with suggestions from past customers)
- Pick-up date and an optional half-hour pick-up slot
- Any number of items, each with quantity, unit, unit price and special instructions
- Optional discount on the whole order, as a flat ₹ amount or a percentage
- Previously ordered items fill in their last quantity, unit and price automatically
  (the customer's own last order first, otherwise the most recent order of that item)
- The price is saved with each order, so later price changes never alter old orders
- Orders list with Upcoming / Today / Past / All views, search, and date filter
- Order status: Pending, Ready, Picked up or Cancelled, changeable from the list or the order page
- Archive (soft delete) with restore; archived orders are deleted permanently after 30 days
- Order detail page with print and edit
- Password-protected admin access

Built with Next.js 15 and Postgres. It runs on Vercel's free Hobby plan with a free Neon database.

## Deploy to Vercel (free)

1. Push this folder to a GitHub repository, then in Vercel choose **Add New → Project** and import it.
   (Or run `npx vercel` from this folder.)
2. In the Vercel project, open **Storage → Create Database → Neon (Postgres)** and pick the free plan.
   Connect it to the project; this sets `DATABASE_URL` automatically.
3. In **Settings → Environment Variables** add:
   - `ADMIN_PASSWORD`: the password used to sign in (required)
   - `NEXT_PUBLIC_CURRENCY`: optional, defaults to `INR` (₹)
   - `CRON_SECRET`: any long random string. Vercel uses it to run the daily cleanup that permanently
     deletes orders archived more than 30 days ago (see `vercel.json`). The cleanup also runs whenever the
     orders list is opened, so it still happens if this is not set.
   - `NEXT_PUBLIC_TIMEZONE`: optional, defaults to `Asia/Kolkata`. This sets what counts as "today".
4. Redeploy. Tables are created automatically on first use.

## Run locally

```bash
npm install
npm run dev
```

Without `DATABASE_URL`, local development stores orders in `.data/orders.json`.
Without `ADMIN_PASSWORD`, local development skips the sign-in page.
Copy `.env.example` to `.env.local` to try Postgres or the password locally.
