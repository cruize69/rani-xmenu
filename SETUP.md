# Rani Mahal — Backend Setup Guide

## Architecture overview

```
Customer pays via Stripe Checkout
        ↓
Stripe fires webhook → /api/webhook
        ↓
Order saved to Vercel KV (Redis)
        ↓
├── Email via Resend
├── SMS via Twilio  
└── Order ID pushed to print_queue in KV
        ↓
print-bridge.js (running at restaurant) polls KV
        ↓
Prints to Star TSP100 via LAN/USB
        ↓
OrderManager.jsx polls /api/orders every 10s
```

---

## Step 1 — Vercel project setup

```bash
npm install -g vercel
vercel login
vercel link  # link to your project
vercel env add STRIPE_SECRET_KEY
vercel env add STRIPE_WEBHOOK_SECRET
vercel env add MANAGER_SECRET
vercel env add RESEND_API_KEY
vercel env add RESTAURANT_EMAIL
vercel env add TWILIO_ACCOUNT_SID
vercel env add TWILIO_AUTH_TOKEN
vercel env add TWILIO_FROM
vercel env add RESTAURANT_PHONE
vercel env add NEXT_PUBLIC_BASE_URL
```

## Step 2 — Enable Vercel KV

1. Go to Vercel Dashboard → Storage → Create KV Database
2. Link it to your project — env vars are added automatically:
   - `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`

---

## Step 3 — Stripe setup

1. Create account at stripe.com
2. Get your Secret Key from Dashboard → Developers → API Keys
3. Set up webhook:
   - Dashboard → Developers → Webhooks → Add endpoint
   - URL: `https://ranimahal.food/api/webhook`
   - Events: `checkout.session.completed`
   - Copy the Signing Secret → add as `STRIPE_WEBHOOK_SECRET`

---

## Step 4 — Resend (email)

1. Create account at resend.com
2. Add your domain (ranimahal.food) and verify DNS
3. Create API key → add as `RESEND_API_KEY`
4. Set `RESTAURANT_EMAIL` to where orders should go

---

## Step 5 — Twilio (SMS)

1. Create account at twilio.com
2. Get a phone number (~$1/month)
3. Copy Account SID, Auth Token, phone number
4. Set `TWILIO_FROM` to your Twilio number (format: +19145551234)
5. Set `RESTAURANT_PHONE` to the restaurant's mobile number

---

## Step 6 — Deploy

```bash
vercel deploy --prod
```

---

## Step 7 — Star TSP100 printer setup

### Find your printer's IP address
1. Hold the FEED button while powering on the printer
2. A self-test receipt prints with the IP address
3. Enter that IP in `print-bridge.js` → `CONFIG.printer.host`

### Run the print bridge at the restaurant
```bash
# On the restaurant PC/tablet (must be on same network as printer)
cd ranimahal-backend
npm install node-fetch
node print-bridge.js
```

### Run on startup (Windows)
Create a `.bat` file and add it to Startup:
```bat
@echo off
cd C:\ranimahal-backend
node print-bridge.js
```

### Run on startup (Mac/Linux)
```bash
# Create a launchd/systemd service or add to crontab:
@reboot cd /path/to/ranimahal-backend && node print-bridge.js >> /var/log/print-bridge.log 2>&1
```

---

## Environment variables reference

| Variable | Description | Where to get |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key | stripe.com → Developers |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | stripe.com → Webhooks |
| `MANAGER_SECRET` | Any strong random string | Generate: `openssl rand -hex 32` |
| `RESEND_API_KEY` | Email API key | resend.com |
| `RESTAURANT_EMAIL` | Where order emails go | Your email |
| `TWILIO_ACCOUNT_SID` | Twilio account ID | twilio.com |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | twilio.com |
| `TWILIO_FROM` | Your Twilio number | twilio.com |
| `RESTAURANT_PHONE` | Restaurant mobile | Your number |
| `NEXT_PUBLIC_BASE_URL` | Ordering site URL | https://ranimahal.food |

---

## Connecting RaniMahal.jsx to the backend

In `RaniMahal.jsx`, replace the checkout stub:

```js
// Find handleCheckout() and replace:
async function handleCheckout() {
  const res = await fetch("/api/create-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: Object.values(cart),
      specialInstructions: document.getElementById("special-instructions")?.value ?? "",
    }),
  });
  const { url } = await res.json();
  window.location.href = url;
}
```

---

## Order flow test checklist

- [ ] Place a test order with Stripe test card `4242 4242 4242 4242`
- [ ] Webhook fires → check Vercel function logs
- [ ] Order appears in KV → check Vercel KV dashboard
- [ ] Email received at RESTAURANT_EMAIL
- [ ] SMS received at RESTAURANT_PHONE
- [ ] Print bridge running → receipt prints
- [ ] Order appears in OrderManager.jsx
- [ ] Status change (New → In Progress → Done) works
- [ ] Daily summary shows correct totals

---

## Step 8 — Vercel Blob (image storage)

### Enable Blob storage
1. Go to Vercel Dashboard → Storage → Create Blob Store
2. Name it `ranimahal-images` (or anything you like)
3. Link it to your project — Vercel auto-adds `BLOB_READ_WRITE_TOKEN` to env vars
4. Deploy: `vercel deploy --prod`

### That's it — image storage is ready
Now open `ranimahal.food/image-manager` and start uploading photos.

### How images flow
1. You upload a photo in Image Manager
2. It saves to Vercel Blob (CDN-hosted, globally fast)
3. The URL is stored in Vercel KV alongside your orders
4. Every customer's menu loads the image from KV on page open
5. All 98 items, any device, anywhere in the world

### Image tips
- **Best dimensions:** 800×600px or larger (4:3 ratio)
- **Max file size:** 5MB per image
- **Formats:** JPEG, PNG, WebP, AVIF (WebP is fastest)
- **Replace anytime:** upload a new photo to replace the old one instantly
- **Live:** changes appear on the menu within 60 seconds (CDN cache)
