# ⬡ Keno Vault — Personal Net Worth Tracker

Track, grow, and secure your wealth. A premium personal finance dashboard with Pro intelligence tools.

---

## Setup

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste `supabase-migration.sql` → **Run**
3. Go to **Authentication → URL Configuration** → set Site URL + Redirect URLs to your Vercel domain

### 2. Config
Update these in `js/config.js`:
- `SUPA_URL` — your Supabase project URL
- `SUPA_KEY` — your Supabase anon key
- `ADMIN_EMAIL` — your email for admin access
- `SITE_URL` — your deployed domain

### 3. Deploy
Push to GitHub, import into [Vercel](https://vercel.com) — auto-detected as a static site.

---

## Features

| Free | Pro ($4.99/mo) |
|------|-----------------|
| 10 asset entries | Unlimited entries |
| KPI dashboard + charts | Everything in Free |
| 30 net worth snapshots | Unlimited history |
| Google sign-in + sync | FIRE Retirement Simulator |
| CSV export | Net Worth Score (0–100) |
| Dark/light theme | Depreciation Engine |
| | Privacy Shield (press B) |
| | Session Auto-Lock PIN |
| | Tax-Drag Simulator |
| | Debt Paydown Optimizer |
| | Asset Allocation Optimizer |
| | Multi-Currency (160+ rates) |
| | AES Encrypted Backups |
| | Legacy Dead-Man's Switch |

---

## Pro Activation (Admin)

Manual activation via Supabase SQL Editor:

```sql
INSERT INTO subscriptions (email, plan, status, provider)
VALUES ('user@example.com', 'pro', 'active', 'manual')
ON CONFLICT (email) DO UPDATE
SET plan = 'pro', status = 'active', updated_at = now();
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Vanilla HTML/CSS/JS |
| Styling | Tailwind CDN + custom properties |
| Charts | Chart.js v4 |
| Auth & DB | Supabase (PostgreSQL + RLS) |
| Hosting | Vercel |
| Encryption | Web Crypto API (AES-256-GCM + PBKDF2) |
| FX Rates | open.er-api.com (160+ currencies, free) |

---

## Customization

- **Free entry limit** — `FREE_LIMIT` in `js/app.js`
- **Pro price** — search `$4.99` across all files
- **Auto-lock timeout** — `_lockTimeout` in `js/security.js`
- **History limit** — `limit` in `loadHistory()` in `js/app.js`

---

*Built with ⬡ Keno Vault — Own Your Wealth*
