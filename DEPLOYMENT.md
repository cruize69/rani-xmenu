# Rani Mahal — Full Deployment Guide

Complete step-by-step for every service, in the order you need to do them.
Estimated total setup time: 2–3 hours on your first run.

---

## Before you start — what you need

- A laptop or desktop (not phone) for the setup steps
- A credit card for Vercel Pro ($20/mo), Twilio (~$1.15/mo), Stripe (no monthly fee)
- Your restaurant phone number for SMS alerts
- The downloaded project files (ranimahal-backend.zip)
- Node.js installed on your computer — download from nodejs.org if not already installed
  Check by opening Terminal (Mac) or Command Prompt (Windows) and typing: node --version

---

## STEP 1 — Buy the domain (Namecheap)

**Time: 5 minutes**

1. Go to namecheap.com
2. Search: `ranimahal.cc`
3. If available, add to cart — $10.98/year
4. At checkout, leave Domain Privacy ON (it's free — keeps your personal info off public records)
5. Skip all upsells (hosting, SSL, email — you don't need them through Namecheap)
6. Complete purchase
7. Log in to Namecheap dashboard — you'll come back here in Step 8 to point the domain at Vercel

**If ranimahal.cc is taken:** try `order.ranimahal.com` (requires owning ranimahal.com first),
or `ranimahal.menu`, or `ranimahalorder.com`

---

## STEP 2 — Set up Stripe (payments)

**Time: 15 minutes**

1. Go to stripe.com → click "Start now"
2. Create account with your business email
3. Complete identity verification (Stripe requires ID + business info for payouts)
4. Add your bank account for payouts: Dashboard → Settings → Bank accounts
5. Get your API keys:
   - Dashboard → Developers → API keys
   - Copy "Secret key" (starts with sk_live_...) — this is your STRIPE_SECRET_KEY
   - Keep this secret — never share it or put it in code

6. Create your webhook (come back to this after Step 4 when you have your Vercel URL):
   - Dashboard → Developers → Webhooks → Add endpoint
   - URL: https://YOUR-VERCEL-URL/api/webhook
   - Select event: checkout.session.completed
   - Click Add endpoint
   - Copy the "Signing secret" (starts with whsec_...) — this is your STRIPE_WEBHOOK_SECRET

7. Test mode vs Live mode:
   - Toggle is top-right of Stripe dashboard
   - Start in TEST mode, use test card 4242 4242 4242 4242 to verify everything works
   - Switch to LIVE mode before opening to real customers

---

## STEP 3 — Set up Resend (order confirmation emails)

**Time: 10 minutes**

1. Go to resend.com → Create account
2. Add your domain: Dashboard → Domains → Add domain → enter ranimahal.cc
3. Resend will show you DNS records to add. Leave this tab open.
4. Go to Namecheap dashboard → Domain List → ranimahal.cc → Manage → Advanced DNS
5. Add each record Resend shows you (usually 3 TXT/CNAME records)
6. Back in Resend, click Verify — may take 5–30 minutes to propagate
7. Create API key: Dashboard → API Keys → Create API key
   - Name it "Rani Mahal Production"
   - Copy the key — this is your RESEND_API_KEY
   - You only see this once, save it somewhere safe

---

## STEP 4 — Set up Vercel (hosting & backend)

**Time: 20 minutes**

### Install Vercel CLI
Open Terminal (Mac) or Command Prompt (Windows):
```
npm install -g vercel
```

### Prepare your project files
1. Unzip ranimahal-backend.zip to a folder on your desktop, e.g. Desktop/ranimahal-backend
2. In Terminal, navigate to that folder:
   ```
   cd ~/Desktop/ranimahal-backend
   ```

### Deploy
```
vercel login
```
Choose "Continue with Email" and follow the prompts.

```
vercel
```
Answer the questions:
- Set up and deploy? → Y
- Which scope? → your account name
- Link to existing project? → N
- Project name? → ranimahal (or rani-mahal)
- In which directory is your code? → . (just press Enter)
- Want to override settings? → N

This gives you a preview URL like `https://ranimahal-xyz.vercel.app`

### Upgrade to Pro (required for commercial use)
1. Go to vercel.com → Log in → your team → Settings → Billing
2. Upgrade to Pro ($20/month)

### Enable Vercel KV (database)
1. Vercel Dashboard → Storage → Create Database → KV
2. Name it: rani-mahal-kv
3. Click Connect to Project → select your project
4. Vercel automatically adds KV environment variables — you don't need to copy them

### Enable Vercel Blob (image storage)
1. Vercel Dashboard → Storage → Create Database → Blob
2. Name it: rani-mahal-images
3. Click Connect to Project → select your project
4. Vercel automatically adds BLOB_READ_WRITE_TOKEN — you don't need to copy it

### Add environment variables
Vercel Dashboard → your project → Settings → Environment Variables

Add each one (set Environment to "Production, Preview, Development" for all):

| Name | Value | Where to find it |
|------|-------|-----------------|
| STRIPE_SECRET_KEY | sk_live_... | Stripe → Developers → API keys |
| STRIPE_WEBHOOK_SECRET | whsec_... | Stripe → Webhooks → your endpoint |
| MANAGER_SECRET | (make one up — random 20+ char string) | You create this |
| RESEND_API_KEY | re_... | Resend → API Keys |
| RESTAURANT_EMAIL | your@email.com | Your email |
| TWILIO_ACCOUNT_SID | AC... | Twilio dashboard |
| TWILIO_AUTH_TOKEN | (from Twilio) | Twilio dashboard |
| TWILIO_FROM | +1914... | Your Twilio number |
| RESTAURANT_PHONE | +1914835... | Rani Mahal mobile |
| NEXT_PUBLIC_BASE_URL | https://ranimahal.cc | Your domain (or Vercel URL for now) |
| CLERK_SECRET_KEY | sk_live_... | Clerk → API Keys |
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY | pk_live_... | Clerk → API Keys |

After adding all variables, redeploy:
```
vercel --prod
```

---

## STEP 5 — Set up Twilio (SMS notifications)

**Time: 10 minutes**

1. Go to twilio.com → Sign Up
2. Verify your phone number
3. Answer onboarding questions: "Send SMS notifications", "With code", "Node.js"
4. Get a phone number:
   - Console → Phone Numbers → Manage → Buy a number
   - Search for a 914 area code number (Westchester — looks local to customers)
   - Buy it (~$1.15/month)
5. Find your credentials:
   - Console home page shows Account SID and Auth Token
   - Copy both into Vercel environment variables (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
   - Copy your new phone number as TWILIO_FROM (format: +19145551234)
6. Set RESTAURANT_PHONE to the mobile number where you want order alerts sent

**Twilio trial account limitation:** In trial mode, you can only send SMS to verified numbers.
Go to Console → Verified Caller IDs → add your mobile number to test.
Once you upgrade ($20 minimum credit), SMS goes to any US number.

---

## STEP 6 — Set up Clerk (customer accounts)

**Time: 15 minutes**

1. Go to clerk.com → Sign Up
2. Create application:
   - Application name: Rani Mahal
   - Sign-in options: check Google, Apple, Email (magic links)
   - Click Create application
3. Get your API keys:
   - Clerk Dashboard → API Keys
   - Copy "Publishable key" (pk_live_...) → NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
   - Copy "Secret key" (sk_live_...) → CLERK_SECRET_KEY
   - Add both to Vercel environment variables
4. Configure redirect URLs:
   - Clerk Dashboard → Paths
   - Sign-in URL: https://ranimahal.cc
   - Sign-up URL: https://ranimahal.cc
   - After sign-in: https://ranimahal.cc
   - After sign-up: https://ranimahal.cc
5. In your React app (index.js or App.js), wrap the root component:
   ```jsx
   import { ClerkProvider } from '@clerk/clerk-react';

   <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
     <App />
   </ClerkProvider>
   ```

---

## STEP 7 — Deploy React frontend

**Time: 15 minutes**

Your frontend (RaniMahal.jsx, OrderSuccess.jsx, AccountPortal.jsx, etc.) needs to be
part of a React project and deployed to Vercel alongside the backend.

### If you're using Create React App:
```bash
npx create-react-app rani-mahal-frontend
cd rani-mahal-frontend
```
Copy your .jsx files into the src/ folder.

### Add environment variables to your .env file:
Create a file called `.env` in your project root:
```
REACT_APP_API_BASE=https://ranimahal.cc
REACT_APP_MANAGER_SECRET=your-manager-secret-here
```

### Deploy:
```bash
vercel --prod
```

---

## STEP 8 — Connect your domain to Vercel

**Time: 5 minutes setup, up to 48 hours DNS propagation**

1. Vercel Dashboard → your project → Settings → Domains
2. Add domain: ranimahal.cc
3. Vercel shows you DNS records to add. You need two:
   - An A record pointing to Vercel's IP
   - A CNAME record for www
4. Go to Namecheap → Domain List → ranimahal.cc → Manage → Advanced DNS
5. Delete any existing A records and CNAME for @
6. Add the records Vercel shows you
7. Back in Vercel, click Verify — green checkmark means it's working

While waiting for DNS: your site works at the Vercel URL (xyz.vercel.app)
After propagation: ranimahal.cc goes live

---

## STEP 9 — Set up the receipt printer (Star TSP100)

**Time: 10 minutes**

### Find your printer's IP address
1. Make sure printer is connected to your restaurant WiFi
2. Hold the FEED button while powering on
3. A self-test receipt prints — find the IP address on it (looks like 192.168.1.x)

### Install Node.js on the restaurant computer
Download from nodejs.org — use the LTS version

### Set up the print bridge
1. Copy the ranimahal-backend folder to the restaurant computer
2. Open Terminal / Command Prompt
3. Navigate to the folder: `cd path/to/ranimahal-backend`
4. Install dependencies: `npm install`
5. Edit print-bridge.js — update these three lines:
   ```javascript
   apiBase: "https://ranimahal.cc",        // your live domain
   managerSecret: "your-manager-secret",       // same as MANAGER_SECRET env var
   host: "192.168.1.x",                        // your printer's IP from above
   ```
6. Start the bridge: `node print-bridge.js`
7. You should see the startup message with printer IP confirmed

### Make it start automatically (so it runs after reboots)

**Windows:**
1. Create a file called `start-bridge.bat` on the Desktop:
   ```bat
   @echo off
   cd C:\path\to\ranimahal-backend
   node print-bridge.js
   ```
2. Press Win+R → type `shell:startup` → press Enter
3. Copy the .bat file into that folder

**Mac:**
1. Open Terminal
2. Run: `crontab -e`
3. Add this line: `@reboot cd /path/to/ranimahal-backend && node print-bridge.js >> ~/bridge.log 2>&1`
4. Save and exit

---

## STEP 10 — Upload dish photos

**Time: as long as you want**

1. Go to ranimahal.cc/image-manager
2. You'll see a grid of all 98 menu items — all showing grey placeholders
3. Click any dish to upload a photo, or drag a photo directly onto the card
4. Photos go live on the menu within 60 seconds
5. Work through sections using the tab filters at the top
6. The coverage bar shows your progress (0% → 100%)

**Photo tips:**
- Shoot on your phone in good natural light
- Square or slightly landscape orientation works best
- Don't overthink it — a real photo of the dish beats a placeholder every time

---

## STEP 11 — Test everything end to end

**Time: 20 minutes**

Do this in order, with your printer running and bridge connected.

1. **Open ranimahal.cc** — menu should load, photos should appear
2. **Add items to cart** — CC fee line should appear in totals
3. **Tap "Proceed to checkout"** — checkout gate should open (Guest / Google / Apple / Email)
4. **Choose Guest** → enter a test email → click Continue to payment
5. **Stripe checkout** — use test card: 4242 4242 4242 4242, any future date, any CVC
6. **Order success page** — should load with animated checkmark and confetti
7. **Enter your mobile number** for SMS updates → tap Notify me
8. **Check printer** — receipt should print within 10 seconds
9. **Check your email** — order confirmation should arrive
10. **Check restaurant phone** — SMS alert should arrive
11. **Open Order Manager** at ranimahal.cc/manager
12. **Find your test order** — tap to expand, tap "Start Order"
13. **Check your mobile** — you should get "order being prepared" SMS
14. **Tap "Mark Done"** in Order Manager
15. **Check your mobile** — you should get "order ready for pickup" SMS
16. **Open Kitchen Display** at ranimahal.cc/kitchen — verify your order appeared there too

If everything works → switch Stripe from Test mode to Live mode → you're open.

---

## STEP 12 — Go live checklist

Before switching Stripe to live mode, confirm:

- [ ] ranimahal.cc loads and shows the full menu
- [ ] All photos uploaded (or at least key dishes)
- [ ] Stripe in Live mode (not Test)
- [ ] Print bridge running on restaurant computer
- [ ] Printer IP confirmed, test receipt printed
- [ ] Restaurant phone receives SMS alerts
- [ ] MANAGER_SECRET set and working in Order Manager
- [ ] Order Manager loads at /manager
- [ ] Kitchen Display loads at /kitchen
- [ ] NEXT_PUBLIC_BASE_URL set to https://ranimahal.cc (not Vercel URL)

---

## Quick reference — important URLs

| Page | URL |
|------|-----|
| Customer menu | ranimahal.cc |
| Order success | ranimahal.cc/order-success |
| Order manager | ranimahal.cc/manager |
| Kitchen display | ranimahal.cc/kitchen |
| Image manager | ranimahal.cc/image-manager |
| Customer account | ranimahal.cc/account |

## Quick reference — dashboards

| Service | Dashboard URL |
|---------|---------------|
| Vercel | vercel.com/dashboard |
| Stripe | dashboard.stripe.com |
| Twilio | console.twilio.com |
| Resend | resend.com/emails |
| Clerk | dashboard.clerk.com |
| Namecheap | ap.www.namecheap.com |

---

## Troubleshooting

**Printer not printing**
- Is print-bridge.js running? (check terminal window)
- Is the printer on the same WiFi as the computer?
- Try pinging the printer: `ping 192.168.1.x` in terminal
- Check the printer IP hasn't changed (reprint self-test receipt)

**SMS not sending**
- Is Twilio account upgraded past trial? (trial only sends to verified numbers)
- Check TWILIO_FROM is in E.164 format: +12125551234
- Check Vercel logs: Dashboard → your project → Functions → update-order

**Stripe webhook not firing**
- Check the webhook URL in Stripe matches your live domain exactly
- Check STRIPE_WEBHOOK_SECRET is the whsec_ key, not the API key
- Stripe Dashboard → Webhooks → your endpoint → Recent deliveries → check for errors

**Order not appearing in Order Manager**
- Webhook may have failed — check Stripe → Webhooks → Recent deliveries
- Check Vercel function logs for errors
- Make sure MANAGER_SECRET in your frontend .env matches the one in Vercel env vars

**Domain not resolving**
- DNS can take up to 48 hours — check current status at dnschecker.org
- Make sure you deleted old A records in Namecheap before adding Vercel's
- Vercel Dashboard → Domains → should show green checkmark when ready

