# RestoStock — React + Vite + Supabase

Restaurant Inventory Management System converted from a single HTML file to a
full React + Vite project with Supabase as the backend.

---

## 🚀 SETUP (5 steps, ~3 minutes)

### Step 1 — Move this folder somewhere clean

Put the `restostock` folder anywhere on your machine, e.g.:
```
C:\Users\user\Documents\restostock
```

### Step 2 — Install dependencies

Open a terminal, `cd` into the folder, then run:

```bash
cd restostock
npm install
```

Wait for it to finish (downloads React, Vite, Supabase client).

### Step 3 — Verify your .env file

The `.env` file is already filled in:
```
VITE_SUPABASE_URL=https://uzljuujevdttsnacfbpq.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_lFgpYZyiAEbqWbJr39nXRg_Nk1Jb58y
```
No changes needed unless your keys change.

### Step 4 — Start the app

```bash
npm run dev
```

Open your browser at: **http://localhost:5173**

### Step 5 — Log in

Use any user from your Supabase `users` table.
Default demo credentials (add these to your DB if not already there):

| Email | Password | Role |
|-------|----------|------|
| admin@restaurant.com | admin123 | Admin |
| manager@restaurant.com | mgr123 | Manager |
| store@restaurant.com | store123 | Store Keeper |

---

## 🗄️ SUPABASE DATABASE SETUP

Your tables need these minimum columns. Run these in the Supabase SQL Editor
if the tables don't exist yet or are missing columns.

### users
```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password text not null,
  role text not null default 'Store Keeper',
  status text not null default 'Active',
  phone text,
  branch_id uuid references branches(id),
  created_at timestamptz default now()
);
```

### transactions (source of truth — inventory is derived from this)
```sql
create table transactions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  item_name text not null,
  type text not null,           -- 'Stock IN', 'Stock OUT', 'Wastage', 'Fulfillment'
  quantity numeric not null,
  unit text,
  price_per_unit numeric default 0,
  total_amount numeric default 0,
  source text,                  -- supplier name for Stock IN
  category text,
  notes text,
  recorded_by uuid references users(id),
  recorded_by_name text,
  created_at timestamptz default now()
);
```

### demands
```sql
create table demands (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  item_name text not null,
  name text,
  category text,
  unit text,
  quantity numeric not null,
  qty numeric,
  priority text default 'Medium',
  department text,
  notes text,
  status text default 'Pending',
  created_by uuid references users(id),
  created_by_name text,
  approved_by uuid references users(id),
  approved_at timestamptz,
  rejected_by uuid references users(id),
  rejection_reason text,
  fulfilled_by uuid references users(id),
  fulfilled_at timestamptz,
  fulfilled_qty numeric,
  txn_id uuid references transactions(id),
  created_at timestamptz default now()
);
```

### item_templates
```sql
create table item_templates (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  name text not null,
  category text,
  unit text default 'pcs',
  default_price numeric default 0,
  low_stock_threshold numeric default 0,
  enabled boolean default true,
  created_by uuid references users(id),
  created_at timestamptz default now()
);
```

### suppliers
```sql
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  name text not null,
  phone text,
  address text,
  status text default 'Active',
  notes text,
  created_at timestamptz default now()
);
```

### financial_transactions
```sql
create table financial_transactions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  type text default 'purchase',
  item_name text,
  category text,
  quantity numeric,
  unit text,
  price_per_unit numeric default 0,
  total_amount numeric default 0,
  payment_status text default 'unpaid',
  supplier text,
  department text,
  recorded_by uuid references users(id),
  reference_id uuid,
  created_at timestamptz default now()
);
```

### procurement_requests
```sql
create table procurement_requests (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  item_name text not null,
  quantity numeric,
  unit text,
  priority text default 'Medium',
  status text default 'Open',
  notes text,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz
);
```

### purchase_orders
```sql
create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  supplier text,
  total_amount numeric default 0,
  status text default 'Ordered',
  notes text,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz
);
```

### purchase_order_items
```sql
create table purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid references purchase_orders(id) on delete cascade,
  item_name text,
  quantity numeric,
  unit text,
  price_per_unit numeric,
  total_amount numeric,
  created_at timestamptz default now()
);
```

### activity_logs
```sql
create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  user_id uuid references users(id),
  user_name text,
  action text,
  details text,
  created_at timestamptz default now()
);
```

---

## 🔐 ROW LEVEL SECURITY (recommended)

Enable RLS on all tables and add a policy for authenticated users.
For now, if you're using simple email/password auth (not Supabase Auth),
you can disable RLS for development:

```sql
-- Run for each table to allow all access during development
alter table transactions  disable row level security;
alter table demands       disable row level security;
alter table item_templates disable row level security;
alter table suppliers     disable row level security;
alter table users         disable row level security;
-- etc.
```

---

## 📁 PROJECT STRUCTURE

```
restostock/
├── .env                          ← Supabase credentials
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx                  ← Entry point
    ├── App.jsx                   ← Router + layout shell
    ├── index.css                 ← Global styles
    ├── context/
    │   └── AppContext.jsx        ← All global state + Supabase data loading
    ├── lib/
    │   ├── supabase.js           ← Supabase client
    │   ├── api.js                ← All DB operations (single source)
    │   ├── computeInventory.js   ← Pure function: inventory from transactions
    │   └── constants.js          ← Roles, permissions, themes, formatting
    ├── components/
    │   ├── ui/index.jsx          ← Icons, Button, Modal, Toast, Confirm, Card
    │   └── layout/
    │       ├── Sidebar.jsx
    │       └── Header.jsx
    └── pages/
        ├── Login.jsx
        ├── Dashboard.jsx
        ├── Inventory.jsx         ← Read-only, derived from transactions
        ├── StockMovement.jsx     ← Stock IN / OUT / Wastage
        ├── Demands.jsx
        ├── FulfillmentCenter.jsx
        └── OtherPages.jsx        ← Templates, Suppliers, Users, Reports, etc.
```

---

## ⚙️ KEY DESIGN DECISIONS

### Inventory is never stored
Exactly as in the original app — `computeInventory()` is a pure function that
walks the `transactions` table chronologically and derives current stock levels.
No separate inventory table is ever written to.

### API layer (src/lib/api.js)
All Supabase calls live here. No component imports `supabase` directly.
This makes it easy to add caching, error handling, or swap the backend later.

### AppContext loads everything on login
When a user logs in, `loadAllData()` runs `Promise.all()` across all tables
and populates React state. After that, the app works optimistically — writes
go to Supabase and then update local state, so the UI is always snappy.

---

## 🛠️ COMMANDS

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start dev server at localhost:5173 |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build |

---

## ❓ TROUBLESHOOTING

**White screen / nothing loads**
→ Check browser console for errors. Usually a missing Supabase table.

**Login fails immediately**
→ Make sure your `users` table has rows with matching email + password + status='Active'.

**"column does not exist" errors**
→ Run the SQL above in Supabase SQL Editor to create/update the tables.

**Inventory shows 0 everywhere**
→ You need at least one Stock IN transaction in the `transactions` table.
   Go to Stock Movement and record one.
