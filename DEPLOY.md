# Rani Mahal — Complete Deployment Guide
**Order of operations matters — follow each step exactly in sequence.**

---

## Before you start

You'll need accounts on 6 services. Create them all first:
- stripe.com
- vercel.com
- resend.com
- twilio.com
- clerk.com
- namecheap.com (for the domain)

Keep a notes doc open — you'll be copying keys between services throughout.

---

## Step 1 — Buy rani-mahal.com on Namecheap

1. Go to **namecheap.com**
2. Search for `rani-mahal.com` — confirm it shows as available (you've already purchased this)
3. Add to cart → Checkout
   - Enable **WhoisGuard** (free privacy protection — always turn this on)
   - 1-year registration is fine (~$11)
4. Complete purchase
5. Go to **Dashboard → Domain List → rani-mahal.com → Manage**
   (You've already purchased this — pick up from the nameserver step below)
6. Find **Nameservers** section → change from "Namecheap BasicDNS" to **Custom DNS**
7. Enter these two nameservers:
   ```
   ns1.vercel-dns.com
   ns2.vercel-dns.com
   ```
8. Click the green checkmark to save

> DNS propagation takes up to 48 hours but usually under 30 minutes.
> You can continue with all other steps while this propagates.

---

## Step 2 — Set up Vercel project

### 2a — Create account and project

1. Go to **vercel.com** → Sign up with GitHub (recommended) or email
2. Upgrade to **Pro plan** ($20/month) — required for commercial use
   - Dashboard → Settings → Billing → Upgrade to Pro
3. Click **Add New Project**
4. Choose **Import Git Repository** or **Deploy from template**
   - If using GitHub: push your project folder to a private GitHub repo first, then connect it here
   - If not using GitHub: use Vercel CLI (see 2b below)

### 2b — Deploy via CLI (no GitHub required)

```bash
# Install Vercel CLI
npm install -g vercel

# Inside your ranimahal-backend folder
cd ranimahal-backend
npm install
vercel login
vercel          # follow prompts, creates project
vercel --prod   # deploy to production
```

### 2c — Add your custom domain

1. In Vercel Dashboard → your project → **Settings → Domains**
2. Add `www.rani-mahal.com` (primary) and `rani-mahal.com` (Vercel will auto-redirect bare domain → www)
3. Vercel will confirm DNS is connected (green checkmark once nameservers have propagated)

---

## Step 3 — Vercel KV (database for orders, sessions, images)

1. In Vercel Dashboard → your project → **Storage tab**
2. Click **Create Database** → choose **KV**
3. Name it `ranimahal-kv`
4. Click **Create & Continue** → **Connect to Project**
5. Select your project → **Connect**

Vercel automatically adds these env vars to your project:
```
KV_URL
KV_REST_API_URL
KV_REST_API_TOKEN
KV_REST_API_READ_ONLY_TOKEN
```
You don't need to copy these — they're added automatically.

---

## Step 4 — Vercel Blob (image storage for menu photos)

1. In Vercel Dashboard → your project → **Storage tab**
2. Click **Create Database** → choose **Blob**
3. Name it `ranimahal-images`
4. Click **Create & Continue** → **Connect to Project**

Vercel automatically adds:
```
BLOB_READ_WRITE_TOKEN
```

---

## Step 5 — Stripe (payments)

### 5a — Account setup

1. Go to **stripe.com** → Create account
2. Complete business verification (add your business name, address, bank account for payouts)
3. Toggle from **Test mode** to **Live mode** when ready (top-left switch in dashboard)

### 5b — Get your API keys

1. Dashboard → **Developers → API Keys**
2. Copy **Secret key** (starts with `sk_live_...`)
   - Save this as `STRIPE_SECRET_KEY`

### 5c — Set up webhook

1. Dashboard → **Developers → Webhooks → Add endpoint**
2. Endpoint URL: `https://www.rani-mahal.com/api/webhook`
3. Under **Select events**, choose:
   - `checkout.session.completed`
4. Click **Add endpoint**
5. Click **Reveal** on the **Signing secret** (starts with `whsec_...`)
   - Save this as `STRIPE_WEBHOOK_SECRET`

---

## Step 6 — Resend (order confirmation emails)

1. Go to **resend.com** → Create account
2. Dashboard → **Domains → Add Domain**
3. Enter `rani-mahal.com` (Resend verifies the root domain — covers www automatically)
4. Resend gives you DNS records to add. Go back to **Vercel Dashboard → your project → Settings → Domains** and add each record:
   - Add the TXT record for SPF
   - Add the CNAME records for DKIM
   - Click **Verify Domain** in Resend once added (takes 5–10 minutes)
5. Dashboard → **API Keys → Create API Key**
   - Name: `Rani Mahal Production`
   - Copy the key → save as `RESEND_API_KEY`

---

## Step 7 — Twilio (SMS notifications)

1. Go to **twilio.com** → Create account
2. Verify your phone number during signup
3. Dashboard → **Phone Numbers → Manage → Buy a Number**
   - Search for a 914 area code number (optional — any US number works)
   - Purchase it (~$1.15/month)
4. Copy from Dashboard:
   - **Account SID** → save as `TWILIO_ACCOUNT_SID`
   - **Auth Token** (click to reveal) → save as `TWILIO_AUTH_TOKEN`
   - Your purchased number (format: +19145550000) → save as `TWILIO_FROM`

---

## Step 8 — Clerk (customer authentication)

1. Go to **clerk.com** → Create account
2. Click **Create application**
   - Name: `Rani Mahal`
   - Enable: **Google**, **Apple**, **Email** (magic link)
3. Dashboard → **API Keys**
   - Copy **Publishable key** (starts with `pk_live_...`) → save as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - Copy **Secret key** (starts with `sk_live_...`) → save as `CLERK_SECRET_KEY`
4. Dashboard → **Domains** → Add `rani-mahal.com` as a production domain

---

## Step 9 — Add all environment variables to Vercel

1. Vercel Dashboard → your project → **Settings → Environment Variables**
2. Add each variable below. Set scope to **Production** (and Preview/Development if you want them in testing too):

| Variable | Value | Where you got it |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` | Stripe → API Keys |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Stripe → Webhooks |
| `MANAGER_SECRET` | any strong random string | Generate below |
| `RESEND_API_KEY` | `re_...` | Resend → API Keys |
| `RESTAURANT_EMAIL` | your@email.com | Your email |
| `TWILIO_ACCOUNT_SID` | `AC...` | Twilio dashboard |
| `TWILIO_AUTH_TOKEN` | your token | Twilio dashboard |
| `TWILIO_FROM` | `+19145550000` | Your Twilio number |
| `RESTAURANT_PHONE` | `+19149999999` | Restaurant mobile |
| `NEXT_PUBLIC_BASE_URL` | `https://www.rani-mahal.com` | Your domain (with www) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | Clerk → API Keys |
| `CLERK_SECRET_KEY` | `sk_live_...` | Clerk → API Keys |

**Generate MANAGER_SECRET** — run this in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output and use it as `MANAGER_SECRET`. Save it somewhere safe — you'll need it to access the order manager and kitchen display.

3. After adding all variables → **Redeploy** your project:
   - Deployments tab → three dots on latest deployment → **Redeploy**

---

## Step 10 — Set up the Star TSP100 printer

### Find your printer's IP address

1. Make sure the printer is connected to the restaurant WiFi
2. Hold the **FEED** button while turning the printer on
3. Release when it starts printing
4. A configuration receipt prints — find the **IP Address** line (e.g. `192.168.1.45`)

### Configure and run the print bridge

1. On the restaurant PC/laptop, open `print-bridge.js` in a text editor
2. Find the CONFIG section at the top and update:
```js
const CONFIG = {
  apiBase:       "https://www.rani-mahal.com",   // your live URL
  managerSecret: "paste-your-MANAGER_SECRET-here",
  printer: {
    type: "tcp",
    host: "192.168.1.45",   // your printer's IP from the receipt
    port: 9100,
  },
  pollMs: 5000,
};
```
3. Install Node.js on the PC if not already installed: **nodejs.org → Download LTS**
4. Open Terminal / Command Prompt in the print-bridge folder:
```bash
npm install node-fetch
node print-bridge.js
```
5. You should see:
```
╔══════════════════════════════════════╗
║  Rani Mahal — Print Bridge           ║
║  Printer: 192.168.1.45:9100          ║
║  Polling every 5s                    ║
╚══════════════════════════════════════╝
```

### Auto-start on Windows (so it runs when the PC turns on)

1. Create a file called `start-print-bridge.bat`:
```bat
@echo off
cd C:\path\to\ranimahal-backend
node print-bridge.js
```
2. Press `Win + R` → type `shell:startup` → Enter
3. Copy `start-print-bridge.bat` into that Startup folder

### Auto-start on Mac

1. Create a file called `com.ranimahal.printbridge.plist` in `~/Library/LaunchAgents/`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.ranimahal.printbridge</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/path/to/ranimahal-backend/print-bridge.js</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict>
</plist>
```
2. Run: `launchctl load ~/Library/LaunchAgents/com.ranimahal.printbridge.plist`

---

## Step 11 — Upload menu photos

1. Go to `https://www.rani-mahal.com/image-manager`
2. Log in with your manager secret when prompted
3. You'll see a grid of all 98 dishes — grey placeholders for any without photos
4. Click or drag-and-drop a photo onto each dish
5. Photos go live on the menu within 60 seconds
6. Tips: square or 4:3 landscape photos work best, minimum 600×400px, max 5MB

---

## Step 12 — Test everything end-to-end

Run through this checklist before going live:

**Payments:**
- [ ] Place a test order using Stripe test card `4242 4242 4242 4242` (any future date, any CVV)
- [ ] Stripe webhook fires → check Vercel function logs (Dashboard → your project → Functions tab)
- [ ] Order appears in KV → Vercel Dashboard → Storage → KV → browse keys
- [ ] Order confirmation email received at `RESTAURANT_EMAIL`
- [ ] Order confirmation SMS received at `RESTAURANT_PHONE`
- [ ] Receipt prints at the restaurant

**Order flow:**
- [ ] Order appears in Order Manager (`www.rani-mahal.com/manager`)
- [ ] Order appears in Kitchen Display (`www.rani-mahal.com/kitchen`)
- [ ] Kitchen taps "Start Cooking" → customer gets SMS (if they opted in on success page)
- [ ] Kitchen taps "Mark Ready" → customer gets "order ready" SMS
- [ ] Customer order tracker updates on success page

**Accounts:**
- [ ] Sign in with Google works
- [ ] Sign in with Apple works
- [ ] Email magic link sign-in works
- [ ] Guest checkout with email works
- [ ] Order history shows in account portal after checkout

**Refunds:**
- [ ] Open an order in Order Manager → click Refund → try a partial refund
- [ ] Check Stripe dashboard confirms the refund was issued

**Switch Stripe to live mode** when all test checklist items pass:
1. Stripe Dashboard → toggle from Test to Live (top left)
2. Get your live `sk_live_...` keys and replace in Vercel env vars
3. Update the webhook endpoint to use the live mode webhook secret
4. Redeploy

---

## Access URLs after deployment

| What | URL | Who uses it |
|---|---|---|
| Customer menu | `https://www.rani-mahal.com` | Customers |
| Order success | `https://www.rani-mahal.com/order-success` | Auto-redirect after payment |
| Customer account | `https://www.rani-mahal.com/account` | Customers |
| Order manager | `https://www.rani-mahal.com/manager` | You (owner) |
| Kitchen display | `https://www.rani-mahal.com/kitchen` | Kitchen tablet |
| Image manager | `https://www.rani-mahal.com/image-manager` | You (owner) |

> Protect /manager, /kitchen, and /image-manager with Vercel's password protection
> (Dashboard → project → Settings → Deployment Protection → Vercel Authentication)
> or rely on the MANAGER_SECRET header check already built into those pages.

---

## Monthly cost summary

| Service | Cost |
|---|---|
| Vercel Pro | $20/month |
| Twilio phone number | $1.15/month |
| Twilio SMS (restaurant alerts) | ~$0.0083/order |
| Twilio SMS (customer updates) | ~$0.0083/notification |
| Resend email | Free (under 3,000/month) |
| Clerk auth | Free (under 50,000 users) |
| Vercel KV | Free (under 150k commands) |
| Vercel Blob | ~$0.01/month (200MB photos) |
| Namecheap domain | ~$0.92/month ($11/year) |
| **Total infrastructure** | **~$22–25/month** |
| Stripe processing | 2.9% + $0.30 per order (passed to customer) |

