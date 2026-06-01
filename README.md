# LJK Knitwear Inventory Control & Valuation System

A secure, production-ready, mobile-first Inventory Management System designed specifically for knitwear manufacturing businesses (ponchos, capes, sweaters, shawls, and accessories). 

This system completely replaces unreliable Excel tracking with a secure **immutable ledger database design** and strict database-level **Row Level Security (RLS)**.

---

## Technical Stack
* **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, Lucide icons.
* **Database & ORM**: Supabase PostgreSQL, Drizzle ORM.
* **Valuation & Exports**: SheetJS (`xlsx`) for multi-sheet Excel compile, native CSV downloads.
* **Hosting**: Vercel.

---

## Core Inventory Control Rules
1. **Dynamic Stock Compilation**: Available stock quantity is never stored as a mutable or editable column. Stock is always compiled dynamically from the immutable ledger of transactions.
   $$\text{Current Stock} = \text{STOCK\_IN} + \text{RETURN} + \text{ADJUSTMENT\_IN} - \text{SALE} - \text{DAMAGE} - \text{ADJUSTMENT\_OUT}$$
2. **Immutable Ledger Transactions**: Once posted, a transaction cannot be edited or deleted. Database-level triggers prevent any updates or deletions on the `stock_transactions` table for all users. Errors are corrected via reversal/offsetting transactions.
3. **Negative Stock Prevention**: The system checks live balances before registering dispatches, preventing negative inventory balances.

---

## Database Architecture & Row Level Security (RLS)

All security rules are enforced at the database level using Supabase PostgreSQL RLS.

* **Profiles**: Extends Supabase Auth users. Syncs automatically via an database trigger (`on_auth_user_created`). Roles: `ADMIN` or `STAFF`.
* **RLS Rules**:
  * **Admins**: Full read/write/insert permissions across products, variants, pricing, and transactions.
  * **Staff**: Read-only select query permissions. Any insert, update, or delete commands are rejected by the database.
  * **Immutability Trigger**: A database-level trigger (`trg_prevent_transaction_update_delete`) blocks any `UPDATE` or `DELETE` statements on the `stock_transactions` table.

---

## Local Setup & Immediate Validation Mode
To facilitate instant operational testing and review without connecting to a live Supabase instance immediately, the application has an integrated **Local Mock JSON Fallback Store** (`mock_db.json`). 

* **Active Role Toggle**: We have embedded a role-switching control in the sidebar footer. Toggle between **Admin Mode** (for full record creation, stock postings, and pricing adjustments) and **Staff Mode** (restricts UI inputs, displaying read-only status and reflecting RLS constraints).
* **Live Calculations**: Adding transactions, changing pricing, and generating reports compiled directly in mock storage instantly revalidates all dashboard metrics, valuation graphs, and ledger history.

To switch to your live Supabase instance:
1. Create a Supabase project.
2. Run the SQL statements provided in [supabase_setup.sql](./supabase_setup.sql) in your Supabase SQL Editor.
3. Define the connection parameters inside `.env.local` using [.env.local.example](./.env.local.example) as a reference.

---

## Production Deployment Checklist (Vercel)
1. Commit this repository to GitHub.
2. Link the repository to your Vercel Dashboard.
3. Configure the environment variables in Vercel:
   * `NEXT_PUBLIC_SUPABASE_URL`
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   * `DATABASE_URL`
4. Deploy. Vercel automatically compiles the Next.js production build bundle.
