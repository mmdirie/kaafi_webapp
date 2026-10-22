# Kaafi Business — Business & Inventory Management System

**Kaafi Business** is a modern, responsive, multi-entity Business Management, Inventory Control, and Point of Sale (POS) application built with Node.js, Express.js, Supabase PostgreSQL, TailwindCSS, and Vanilla JavaScript.

---

## 1. System Architecture & Data Flow

```text
┌────────────────────────────────────────────────────────────────────────┐
│               Frontend (HTML5 / TailwindCSS / Vanilla JS)             │
│   • Responsive Single Page Dashboard        • Point of Sale Terminal   │
│   • Real-Time Product Catalog & Search       • Receipts & Printing      │
│   • Stock Adjustment Modals & Auditing       • Profit & Loss Reports    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS + Bearer Access Token
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  Backend API (Node.js & Express.js)                    │
│   • Token Verification & Auth Middleware    • Input Validation (Zod)   │
│   • Role-Based Access Control (RBAC)         • CORS & Helmet Security   │
│   • Rate Limiting & Structured Logging       • Static Asset Serving     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ PostgreSQL Connection / RPC Calls
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Supabase PostgreSQL Database                      │
│   • Row-Level Security (RLS) Isolation       • ACID Transaction RPCs    │
│   • Authoritative Price Calculations         • Row Locking (FOR UPDATE) │
│   • Stock Movement History & Audit Logs      • Real DB Statistics       │
└────────────────────────────────────────────────────────────────────────┘
```

### Security & Authority Principles
- **Untrusted Frontend:** The browser never dictates authoritative prices, discounts, taxes, or stock levels. All financial totals and inventory deductions are computed server-side in PostgreSQL.
- **Transactional Row Locking:** Operations like POS checkout, customer refunds, and purchase order receiving lock affected product rows using `SELECT ... FOR UPDATE` within PostgreSQL transactions to eliminate concurrency race conditions.
- **Idempotency Keys:** Checkouts and refunds accept unique idempotency tokens to prevent accidental double-billing or duplicate transactions.
- **Tenant Isolation:** Multi-business records are strictly partitioned via foreign keys, unique constraints, and Supabase Row Level Security (RLS) policies.
- **Zero Secret Leakage:** The Supabase Service Role key is strictly server-side and never exposed to client-side code.

---

## 2. Technology Stack

- **Frontend:** HTML5, CSS3, TailwindCSS (CDN), Chart.js (CDN), and Vanilla ES6+ JavaScript.
- **Backend:** Node.js (v20+) and Express.js with ES Modules.
- **Database:** Supabase PostgreSQL with custom stored functions, triggers, and Row Level Security.
- **Authentication:** Supabase Auth (JWT bearer token verification on Express).
- **Security:** Helmet headers, CORS origin allowlists, express-rate-limit, and Zod schema validation.
- **Testing:** Node.js native test runner (`node --test`).

---

## 3. Project Directory Structure

```text
busenesses_app/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── auth-middleware.js     # Factory linking auth to Supabase client
│   │   │   ├── env.js                 # Zod validated environment variables
│   │   │   └── supabase.js            # User-scoped Supabase client factory
│   │   ├── middleware/
│   │   │   ├── auth.js                # Bearer token verification middleware
│   │   │   ├── authorization.js       # Business role check (admin/manager/cashier/staff)
│   │   │   └── error-handler.js       # Centralized error handler & status mapper
│   │   ├── routes/
│   │   │   ├── audit.js               # Audit log querying
│   │   │   ├── auth.js                # /api/auth/me and user profiles
│   │   │   ├── businesses.js          # Business profiles, settings, and team members
│   │   │   ├── categories.js          # Category CRUD & delete protection
│   │   │   ├── expenses.js            # Business operating expenses CRUD
│   │   │   ├── inventory.js           # Stock adjustments, movements, & alerts
│   │   │   ├── pos.js                 # Terminal products & transactional checkout
│   │   │   ├── products.js            # Product catalog, stock movements, & soft-delete
│   │   │   ├── purchases.js           # PO creation, payments, & stock receiving
│   │   │   ├── reports.js             # Dashboard metrics, financial P&L, & CSV export
│   │   │   └── suppliers.js           # Vendor profiles and history
│   │   ├── utils/
│   │   │   └── http-error.js          # Typed HTTP error utility
│   │   ├── app.js                     # Express app setup, middleware, and route mounting
│   │   └── server.js                  # HTTP server listener
│   ├── test/
│   │   ├── app.test.js                # Health check & CORS tests
│   │   ├── auth.test.js               # Auth & business authorization tests
│   │   └── business-logic.test.js     # Stock limits, pricing, and role enforcement
│   ├── .env.example
│   └── package.json
├── database/
│   ├── schema.sql                     # Full normalized tables, RLS, & transactional RPCs
│   └── seed.sql                       # Sample businesses, categories, suppliers, & products
├── frontend/
│   ├── index.html                     # Responsive single-page dashboard shell
│   ├── css/
│   │   └── styles.css                 # Custom scrollbars, fonts, and printable receipt styles
│   └── js/
│       ├── components/
│       │   ├── modal.js               # Keyboard-friendly accessible modal manager
│       │   └── toast.js               # Animated notifications (success, error, warning)
│       ├── views/
│       │   ├── auth.js                # Sign-in, password reset, and Supabase config
│       │   ├── categories.js          # Category organizer & product counts
│       │   ├── dashboard.js           # Real-time metrics cards & Chart.js sales graph
│       │   ├── expenses.js            # Expense tracking by category
│       │   ├── inventory.js           # Stock movement logs & quick adjustment modal
│       │   ├── pos.js                 # POS terminal, shopping cart, & receipt printing
│       │   ├── products.js            # Product table, filters, Add/Edit & history modals
│       │   ├── purchases.js           # Purchase orders & stock receiving modal
│       │   ├── reports.js             # Income statement (P&L) & CSV data export
│       │   ├── settings.js            # Business details, tax rates, currency, & team
│       │   └── suppliers.js           # Vendor management
│       ├── api.js                     # REST fetch wrapper with token injection
│       ├── app.js                     # SPA bootstrap & view routing
│       ├── config.js                  # Client configuration, currency/date formatters
│       └── state.js                   # Reactive app state & cart calculations
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## 4. Role-Based Access Control (RBAC)

The application enforces strict role-based authorization:

| Role | Permissions |
| :--- | :--- |
| **Admin** | Full access to business profile, team roles, system settings, financial reports, all CRUD operations, inventory adjustments, and checkout. |
| **Manager** | Product & category catalog, suppliers, purchase orders, customer refunds, inventory adjustments, operating expenses, and financial P&L reports. |
| **Cashier** | Point of Sale (POS) register, cart operations, processing sales, printing receipts, and viewing sales history. |
| **Inventory Staff** | Product catalog updates, receiving supplier shipments, adjusting stock counts, and monitoring low-stock alerts. |

---

## 5. Database Setup & Stored Procedures

### Step 1: Create a Supabase Project
1. Log in to [supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL** and **anon public key** from Project Settings &rarr; API.

### Step 2: Apply the Database Schema
1. Open the **SQL Editor** in your Supabase dashboard.
2. Open `database/schema.sql` from this repository, copy its entire contents, paste it into the SQL editor, and click **Run**.
3. This creates:
   - All normalized PostgreSQL tables (`user_profiles`, `businesses`, `business_members`, `business_settings`, `categories`, `products`, `suppliers`, `purchases`, `purchase_items`, `sales`, `sale_items`, `inventory_movements`, `refunds`, `expenses`, `audit_logs`).
   - Row Level Security (RLS) policies enforcing multi-tenant isolation.
   - Profile auto-creation triggers on `auth.users`.
   - Security-definer stored functions:
     - `public.perform_checkout(...)`
     - `public.perform_refund(...)`
     - `public.perform_stock_adjustment(...)`
     - `public.receive_purchase(...)`
     - `public.get_business_dashboard_stats(...)`

### Step 3: Seed Initial Data (Optional)
Once you have created an initial user through the application or Supabase Auth, run `database/seed.sql` to populate sample categories, suppliers, products, and expenses.

---

## 6. Local Development Instructions

### Prerequisites
- Node.js version 20 or higher.
- A Supabase project with `database/schema.sql` applied.

### Setup Steps
1. Clone the repository and navigate into the project directory:
   ```bash
   cd busenesses_app
   ```
2. Copy the environment variables:
   ```bash
   cp .env.example backend/.env
   ```
3. Edit `backend/.env` with your Supabase credentials:
   ```env
   NODE_ENV=development
   PORT=3000
   FRONTEND_ORIGIN=http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000,http://127.0.0.1:3000
   SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   ```
4. Install backend dependencies:
   ```bash
   npm install --prefix backend
   ```
5. Run the test suite:
   ```bash
   npm test
   ```
6. Start the development server:
   ```bash
   npm run dev
   ```
7. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```
   *(The Express backend serves the complete responsive frontend from `/` while also exposing all RESTful API endpoints at `/api`)*.

---

## 7. Key RESTful API Endpoints

### Authentication & Profile
- `GET /api/auth/me` &mdash; Returns verified user, profile details, and active business memberships.
- `PUT /api/auth/profile` &mdash; Updates display name and contact phone number.

### Businesses & Settings
- `GET /api/businesses` &mdash; List businesses the caller belongs to.
- `POST /api/businesses` &mdash; Create a new business (caller automatically becomes Admin).
- `GET /api/businesses/:id/settings` &mdash; Fetch business settings (currency, tax rate, max discount).
- `PUT /api/businesses/:id/settings` &mdash; Update financial rules and receipt footer.
- `GET /api/businesses/:id/members` &mdash; List team members and their roles.
- `POST /api/businesses/:id/members` &mdash; Assign a user to the business with a designated role.

### Products & Categories
- `GET /api/businesses/:id/products` &mdash; Paginated product list with search, category/supplier filters, and stock status filters.
- `POST /api/businesses/:id/products` &mdash; Create a product (with initial stock adjustment audit log).
- `PUT /api/businesses/:id/products/:productId` &mdash; Update product specs and pricing.
- `DELETE /api/businesses/:id/products/:productId` &mdash; Delete or safely deactivate product.
- `GET /api/businesses/:id/products/:productId/movements` &mdash; Product-specific stock audit trail.
- `GET /api/businesses/:id/categories` &mdash; List categories with real-time product counts.
- `DELETE /api/businesses/:id/categories/:catId` &mdash; Delete category (rejects if products are attached).

### Point of Sale (POS) & Sales
- `GET /api/businesses/:id/pos/products` &mdash; Fast product lookup for the cash register.
- `POST /api/businesses/:id/pos/checkout` &mdash; Atomic checkout execution via PostgreSQL `perform_checkout` RPC.
- `GET /api/businesses/:id/sales` &mdash; Filterable sales history by date range, status, payment method, and cashier.
- `GET /api/businesses/:id/sales/:saleId` &mdash; Detailed breakdown of purchased items and historical refunds.
- `POST /api/businesses/:id/sales/:saleId/refund` &mdash; Restock items, issue partial or full refund, and write audit trail.

### Inventory & Purchases
- `POST /api/businesses/:id/inventory/adjust` &mdash; Stock-in or stock-out adjustment with mandatory reason.
- `GET /api/businesses/:id/inventory/movements` &mdash; Audit trail of all inventory movements.
- `GET /api/businesses/:id/inventory/alerts` &mdash; Low-stock and out-of-stock summary.
- `GET /api/businesses/:id/purchases` &mdash; List supplier purchase orders.
- `POST /api/businesses/:id/purchases` &mdash; Create purchase order with line items.
- `POST /api/businesses/:id/purchases/:poId/receive` &mdash; Safely receive stock and increment inventory.

### Expenses & Financial Reporting
- `GET /api/businesses/:id/expenses` &mdash; Filterable list of categorized business expenses.
- `POST /api/businesses/:id/expenses` &mdash; Record an operating expenditure.
- `GET /api/businesses/:id/reports/dashboard` &mdash; Live executive stats and 7-day sales graph.
- `GET /api/businesses/:id/reports/financial` &mdash; Profit & Loss statement (Gross Sales, Net Sales, COGS, Expenses, Gross & Net Profit).
- `GET /api/businesses/:id/reports/export-csv?type=sales|inventory|expenses` &mdash; CSV data export.

---

## 8. Git & GitHub Integration Guide

### Step 1: Initialize Git Repository
In the root directory `busenesses_app`:
```bash
git init
```

### Step 2: Verify `.gitignore`
Ensure `.env`, `node_modules/`, and logs are excluded:
```bash
git status
```
*(Verify that `node_modules` and `.env` files are untracked and omitted).*

### Step 3: Create Initial Commit
```bash
git add .
git commit -m "feat: complete Kaafi Business management, POS, inventory, and reporting system"
```

### Step 4: Link to GitHub Repository
1. Create a new repository on [GitHub](https://github.com) named `kaafi-business` (leave "Initialize with README" unchecked).
2. Set the remote URL:
   ```bash
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/kaafi-business.git
   ```
3. Set the default branch to `main` and push:
   ```bash
   git branch -M main
   git push -u origin main
   ```

### Step 5: Pushing Future Changes
```bash
git add .
git commit -m "chore: describe your updates"
git push
```

### Security & Secret Rotation Protocol
- **Never commit `.env` or files containing service role keys.**
- **If a secret is accidentally committed:**
  1. Immediately navigate to the **Supabase Dashboard &rarr; Project Settings &rarr; API** and click **Rotate Key** for the leaked secret.
  2. In your local Git repository, purge the file from Git history using `git rm --cached <file>` or `git filter-repo`.
  3. Force push the sanitized commit to GitHub.

---

## 9. Production Deployment Guide

### Backend Deployment (e.g. Render, Railway, Fly.io, or VPS)
1. Set the root directory or build command:
   ```bash
   npm install --prefix backend
   ```
2. Set the start command:
   ```bash
   npm start --prefix backend
   ```
3. Set the production environment variables:
   - `NODE_ENV=production`
   - `PORT=3000` (or provided dynamically by host)
   - `FRONTEND_ORIGIN=https://your-custom-domain.com`
   - `SUPABASE_URL=https://your-project.supabase.co`
   - `SUPABASE_ANON_KEY=your-production-anon-key`
   - `SUPABASE_SERVICE_ROLE_KEY=your-production-service-key` (optional, for admin user provisioning)

### Frontend Deployment
Because the Express backend statically serves the `frontend/` directory, deploying the backend automatically serves the frontend at `https://your-custom-domain.com`.

Alternatively, the frontend can be deployed independently to services like Cloudflare Pages, Vercel, or Netlify by setting the publish directory to `frontend/` and setting `API_BASE_URL` in `frontend/js/config.js` to your deployed backend URL.

---

## 10. Production Security Checklist

- [x] Passwords never handled in plaintext &mdash; authenticated through Supabase Auth.
- [x] Authorization verified on both the Express API and Supabase PostgreSQL Row Level Security (RLS).
- [x] Strict Content Security Policy (CSP) and Helmet security headers enabled.
- [x] Rate limiting active on all `/api` routes (300-500 requests per 15-minute window).
- [x] Safe DOM rendering &mdash; user input rendered using safe text nodes and strict HTML escaping.
- [x] Atomic transactions & row locks (`FOR UPDATE`) for all inventory changes.
- [x] Idempotency keys enforced to eliminate duplicate transactions and double-billing.
- [x] Input validation with Zod schemas on every endpoint.
- [x] Sensitive operations (sales, refunds, adjustments, receiving) recorded in immutable audit logs.
- [x] Cross-origin resource sharing (CORS) restricted to verified origins.

---

## 11. License

This project is licensed under the MIT License.
