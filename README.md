# ⬡ Keno Vault — Personal Net Worth Tracker

A premium, SaaS-ready personal finance tracker with Pro intelligence features.
Built with vanilla HTML/CSS/JS + Supabase + Vercel.

---

## 📁 Project Structure

```
keno-vault/
├── index.html                  ← Landing page (CloudGuard-inspired)
├── vercel.json                 ← Vercel routing & security headers
├── supabase-migration.sql      ← Run this in Supabase SQL Editor
│
├── pages/
│   ├── dashboard.html          ← Main app dashboard
│   └── settings.html          ← Settings page
│
├── css/
│   └── dashboard.css          ← All dashboard styles (dark + light)
│
└── js/
    ├── app.js                  ← Core app logic, auth, CRUD, charts
    ├── calculators.js          ← FIRE, Tax, Depreciation, Debt, FX
    └── security.js             ← Privacy shield, PIN lock, AES encryption
```

---

## 🚀 Setup Guide

### Step 1 — Supabase (Database)

1. Go to [supabase.com](https://supabase.com) → Your project
2. Click **SQL Editor** → **New Query**
3. Paste the entire contents of `supabase-migration.sql` and click **Run**
4. You should see `assets`, `nw_history`, `subscriptions` in your tables

**URL Configuration:**
- Go to **Authentication → URL Configuration**
- Set **Site URL**: `https://keno-vault.vercel.app`
- Add to **Redirect URLs**: `https://keno-vault.vercel.app`

### Step 2 — Update Config Values

In `js/app.js`, update line 5:
```js
const ADMIN_EMAIL = 'your-actual-email@gmail.com'; // Your Google email
```

In `pages/settings.html`, update the USDT address:
```html
YOUR_USDT_TRC20_ADDRESS_HERE  ← Replace with your actual wallet address
```

In `pages/dashboard.html`, update the USDT address in the upgrade modal:
```html
YOUR_USDT_TRC20_ADDRESS  ← Replace with your actual wallet address
```

### Step 3 — Deploy to Vercel

**Option A — GitHub (Recommended):**
1. Push this entire folder to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your repo
3. Vercel auto-detects it as a static site — click **Deploy**
4. Your app is live at `https://your-project.vercel.app`

**Option B — Drag & Drop:**
1. Go to [vercel.com](https://vercel.com)
2. Drag the entire `keno-vault/` folder onto the dashboard
3. Done — live URL assigned instantly

---

## ⚙️ Feature Overview

### Free Tier
| Feature | Limit |
|---------|-------|
| Asset entries | 10 max |
| Net worth history | 30 snapshots |
| KPI dashboard | Basic 4 cards |
| Google sign-in & sync | ✅ Unlimited |
| CSV export | ✅ |

### Pro Tier ($4.99/month)
| Feature | Details |
|---------|---------|
| Asset entries | Unlimited |
| History | Unlimited snapshots |
| FIRE Simulator | Interactive sliders, FI Number |
| Net Worth Score | 0–100 proprietary algorithm |
| Depreciation Engine | Straight-line & reducing balance |
| Privacy Shield | Press `B` to blur all values |
| Session Auto-Lock | PIN after 5min inactivity |
| Tax-Drag Simulator | CGT + withholding tax |
| Debt Paydown Optimizer | Snowball vs Avalanche |
| Asset Optimizer | Diversification recommendations |
| Multi-Currency FX | Live rates, 6 currencies |
| AES Encrypted Backups | Password-protected JSON export |
| Legacy Mode | Dead-man's switch to heir email |

---

## 💳 Manual Pro Activation (Admin)

Since you're using manual payment via USDT:

1. User sends $4.99 USDT + their email
2. You verify the payment
3. Go to Supabase → SQL Editor and run:

```sql
-- Activate Pro for a user by email
insert into subscriptions (email, plan, status, provider)
values ('user@example.com', 'pro', 'active', 'manual')
on conflict (email) do update
set plan = 'pro', status = 'active', updated_at = now();
```

4. User refreshes their browser — Pro is active immediately ✅

**To deactivate:**
```sql
update subscriptions
set plan = 'free', status = 'inactive', updated_at = now()
where email = 'user@example.com';
```

---

## 🔒 Security Architecture

| Layer | Implementation |
|-------|----------------|
| Auth | Google OAuth via Supabase |
| Database | Row-Level Security (users see only their data) |
| Session | Auto-refresh tokens, persistent session |
| Privacy | Client-side blur toggle (`B` key shortcut) |
| Auto-Lock | SHA-256 hashed PIN, 5min inactivity timer |
| Backups | AES-256-GCM encryption via Web Crypto API |
| Transport | HTTPS enforced by Vercel |
| Headers | X-Frame-Options, XSS protection via vercel.json |

---

## 🛠 Customization

### Change Pro price display
Search for `$4.99` across all files and update.

### Change free entry limit
In `js/app.js`:
```js
const FREE_LIMIT = 10; // Change to any number
```

### Add a new currency
In `js/calculators.js`, add to `MOCK_RATES`:
```js
const MOCK_RATES = { USD:1, NGN:1580, GBP:0.79, EUR:0.92, JPY:149.5, ... };
```

### Change auto-lock timeout
In `js/security.js`:
```js
let _lockTimeout = 5 * 60 * 1000; // Change 5 to any number of minutes
```

### Change history limit for free users
In `js/app.js`:
```js
// In loadHistory():
const limit = isPro() ? 500 : 30; // Change 30 to desired limit
```

---

## 📦 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla HTML5 + CSS3 + JavaScript (ES2022) |
| Styling | Tailwind CSS (CDN) + Custom CSS |
| Charts | Chart.js v4.4 |
| Auth & DB | Supabase (PostgreSQL + GoTrue) |
| Hosting | Vercel (static) |
| Encryption | Web Crypto API (AES-256-GCM + PBKDF2) |
| FX Rates | Frankfurter API (free, no key needed) |

---

## 🐛 Troubleshooting

**Login loop / stuck on loading:**
- Check Supabase → Authentication → URL Configuration
- Ensure `https://keno-vault.vercel.app` is in both Site URL and Redirect URLs
- Clear browser localStorage and try again

**Data not saving:**
- Run the SQL migration and confirm all 3 tables exist
- Check browser console for Supabase errors
- Verify your Supabase project is not paused (free tier pauses after inactivity)

**Pro features not unlocking:**
- Check the `subscriptions` table in Supabase for the user's email
- Run the activation SQL above manually
- User should refresh or sign out and back in

**Charts not rendering:**
- Ensure Chart.js CDN is loading (check network tab)
- Try toggling theme — this forces chart re-render

---

## 📧 Support

For Pro activation or issues: **kenovault@gmail.com**

---

*Built with ⬡ Keno Vault — Own Your Wealth*