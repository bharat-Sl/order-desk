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
- 80mm thermal receipts (e.g. Helett H80i): print one order, every order in the current list, or
  automatically after saving an order
- Item totals: the total quantity of every item to prepare for a pick-up day or date range,
  optionally split by day, printable on the 80mm receipt printer
- Order detail page with edit
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
   - Receipt header, all optional: `NEXT_PUBLIC_SHOP_NAME`, `NEXT_PUBLIC_SHOP_ADDRESS`, `NEXT_PUBLIC_SHOP_PHONE`,
     `NEXT_PUBLIC_SHOP_FSSAI`, `NEXT_PUBLIC_SHOP_GSTIN` and `NEXT_PUBLIC_RECEIPT_TITLE`. The defaults are in
     `lib/shop.ts`; set a variable to an empty value to hide that line.
   - `NEXT_PUBLIC_TIMEZONE`: optional, defaults to `Asia/Kolkata`. This sets what counts as "today".
4. Redeploy. Tables are created automatically on first use.

Keep the server next to the database: `vercel.json` pins the app's server functions to `sin1` (Singapore)
because the Neon database is in AWS ap-southeast-1 (Singapore). If the database ever moves, change
`regions` to the matching Vercel region, otherwise every database query crosses continents.

## Printing receipts on a thermal printer

Receipts are laid out for 80mm paper and printed through the browser, so any computer with the
printer's Windows driver installed (it shows up as **POS80** for the Helett H80i) can print. Each
receipt is placed at the top of one of the driver's own 80mm sheets (210mm, 297mm or the long roll,
whichever fits) and the driver skips the unused rest, so every receipt comes out at its own length.
It ends with a small dot about 8mm below "Thank You!" so that space isn't trimmed. **Print all**
puts every receipt on its own page so the printer cuts between them. The shop details at the top
come from `lib/shop.ts`.

Where to print from:

- **Print receipt** on an order's page (**Preview** shows it on screen first)
- **Print** on any row of the orders list
- **Print all** next to the filters, for every order in the current view
- **Print receipt after saving** checkbox on the order form (remembered per browser)

First-time setup in Chrome or Edge:

1. Click any print button. In the print dialog choose **POS80** as the destination, then under
   *More settings* set **Margins: None** and **Scale: Default**. The browser remembers these.
2. In Windows, **Printers & scanners → POS80 → Printing preferences → Page Settings**, under
   *Print Options* set:
   - **Page End: Ignore page tails blank** (otherwise every receipt runs out to the full sheet length)
   - **Cutting: After one page**
   - **Feed after: Feed 3x3.75mm** (space fed before the cut; raise it for more space at the bottom)
3. Under **Printer properties → Advanced**, choose **Start printing after last page is spooled**.
   Without it the printer can stop partway through a receipt.

### Item totals

**Item totals** in the top bar lists every item in the orders picked up on a day or across a date
range (Today, Tomorrow, Next 7 days, Yesterday, or any From/To dates), with the total quantity,
number of orders and value. Tick **Split by day** to see each day separately, followed by the
combined totals. **Print totals** prints the same list on the 80mm printer.

Cancelled and archived orders are not counted, values are before order-level discounts, and the
same item in different units (for example kg and g) is listed on separate lines.

### One-click printing (no print dialog)

Chrome and Edge can skip the print dialog and send straight to the printer:

1. Make **POS80** your Windows default printer, or print once through the dialog with POS80 selected.
2. Create a desktop shortcut whose target is:

   ```
   "C:Program Files (x86)MicrosoftEdgeApplicationmsedge.exe" --kiosk-printing https://your-app.vercel.app
   ```

3. Always open the order desk from that shortcut (close other Edge windows first, since the flag only
   applies when the browser starts).

## Run locally

```bash
npm install
npm run dev
```

Without `DATABASE_URL`, local development stores orders in `.data/orders.json`.
Without `ADMIN_PASSWORD`, local development skips the sign-in page.
Copy `.env.example` to `.env.local` to try Postgres or the password locally.
