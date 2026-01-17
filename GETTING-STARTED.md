# Getting Started - Complete Setup Guide

Follow these steps exactly to get your tipping app running. This will take approximately 45-60 minutes.

## Step 1: Set Up Supabase Database (15 minutes)

### 1.1 Create Supabase Account and Project

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub or email
4. Once logged in, click "New project"
5. Fill in the form:
   - **Name**: `tip-app` (or whatever you want)
   - **Database Password**: Generate a strong password and SAVE IT somewhere secure
   - **Region**: Choose `Europe West (Ireland)` (closest to you in Ireland)
   - **Pricing Plan**: Free
6. Click "Create new project"
7. Wait 2-3 minutes for the project to provision

### 1.2 Run Database Schema

1. In your Supabase dashboard, click "SQL Editor" in the left sidebar
2. Click "New query"
3. Open the file `database/schema.sql` from this project on your computer
4. Copy the ENTIRE contents (all ~200 lines)
5. Paste into the Supabase SQL Editor
6. Click "Run" (bottom right)
7. You should see "Success. No rows returned" - this is correct
8. Click "Table Editor" in the left sidebar
9. Verify you see two tables: `musicians` and `rate_limits`

### 1.3 Get Your Supabase API Keys

1. Click "Settings" (gear icon) at the bottom of the left sidebar
2. Click "API" in the settings menu
3. You'll see a page with your API credentials
4. **Copy and save these three values** (you'll need them later):
   - **Project URL**: Looks like `https://abcdefghijklm.supabase.co`
   - **anon public key**: Long string starting with `eyJ` (under "Project API keys")
   - **service_role key**: Another long string starting with `eyJ` (under "Project API keys")
     - Click "Reveal" to see the service_role key
     - ⚠️ Keep this secret - it has full database access

**Write these down now - you'll need them in Step 4**

---

## Step 2: Set Up Stripe (15 minutes)

### 2.1 Create Stripe Account

1. Go to https://stripe.com
2. Click "Sign up" (top right)
3. Fill in your email and create a password
4. Activate your account via email
5. Complete the signup form with your business details
   - You can use your personal details for testing
   - Choose "Individual" for account type

### 2.2 Enable Test Mode

1. Once logged into Stripe Dashboard
2. Look at the top right - there's a toggle that says "Test mode"
3. Make sure it's switched ON (should be dark/blue when on)
4. You'll see "Viewing test data" - this is correct

### 2.3 Enable Stripe Connect

1. Click "Connect" in the left sidebar
2. If you see "Get started with Connect", click it
3. Choose "Platforms or marketplaces" (this is for multiple accounts)
4. Click "Continue"
5. For "Account type", select "Express accounts"
6. Click "Enable Express accounts"
7. Under "Branding", add:
   - **Business name**: Your app name (e.g., "TipApp")
   - **Brand color**: Choose any color (this affects the onboarding screens musicians see)
   - Optionally add a logo
8. Click "Save" at the bottom

### 2.4 Get Your Stripe API Keys

1. Click "Developers" in the top right menu
2. Click "API keys" in the left sidebar
3. Make sure "Test mode" toggle is still ON
4. **Copy and save these values**:
   - **Publishable key**: Starts with `pk_test_` (you don't need this for now)
   - **Secret key**: Click "Reveal test key token" - starts with `sk_test_`
   - ⚠️ Keep the secret key safe - this gives access to your Stripe account

**Write down the secret key - you'll need it in Step 4**

### 2.5 Set Up Webhook (You'll complete this after deploying to Netlify)

For now, just note that you'll need to:
- Create a webhook endpoint later
- Listen for `account.updated` and `account.application.deauthorized` events
- Get a webhook signing secret (starts with `whsec_`)

**We'll do this in Step 7 after deployment**

---

## Step 3: Install Project Dependencies (5 minutes)

### 3.1 Install Node.js (if not already installed)

1. Check if you have Node.js installed:
   ```bash
   node --version
   ```
2. If you see a version number (like `v18.x.x` or `v20.x.x`), you're good
3. If not, download and install from https://nodejs.org (choose LTS version)

### 3.2 Install Project Dependencies

Open Terminal, navigate to your project folder, and run:

```bash
cd /Users/tomasodalaigh/Documents/Dev/TipApp
npm install
```

This will install all required packages (Stripe, Supabase, Tailwind, etc.)

Wait for it to complete (1-2 minutes)

---

## Step 4: Configure Environment Variables (5 minutes)

### 4.1 Create .env File

In your project folder, run:

```bash
cp .env.example .env
```

### 4.2 Edit .env File

Open the `.env` file in a text editor and fill in your actual values:

```env
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_YOUR_ACTUAL_KEY_FROM_STEP_2.4
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_FROM_STEP_7

# Supabase Configuration
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_ANON_KEY=eyJ_YOUR_ANON_KEY_FROM_STEP_1.3
SUPABASE_SERVICE_ROLE_KEY=eyJ_YOUR_SERVICE_ROLE_KEY_FROM_STEP_1.3

# Admin Token
ADMIN_TOKEN=GENERATE_THIS_NOW_SEE_BELOW

# Local Development URL
URL=http://localhost:8888
```

### 4.3 Generate Admin Token

Run this command in Terminal:

```bash
openssl rand -base64 32
```

Copy the output and paste it as your `ADMIN_TOKEN` value in the `.env` file.

Example output: `7Xp9kQ2vL8mN3rT6yU1wZ5aB4cD0eF/gH+iJ=`

### 4.4 Leave Webhook Secret Empty for Now

Leave the `STRIPE_WEBHOOK_SECRET` line commented out (with #) or set to a placeholder.
We'll add the real value after deployment in Step 7.

**Save the .env file**

---

## Step 5: Build and Test Locally (5 minutes)

### 5.1 Build Tailwind CSS

Run this command:

```bash
npm run build
```

You should see output like "Done in XXXms"

This creates the `public/styles/main.css` file.

### 5.2 Start Local Development Server

Run:

```bash
npm run dev
```

You should see:

```
◈ Netlify Dev ◈
◈ Starting Netlify Dev with...
◈ Functions server is listening on 59739
◈
◈ Server now ready on http://localhost:8888
```

**Keep this terminal window open**

### 5.3 Test the App

1. Open your browser
2. Go to http://localhost:8888
3. You should see a page load (might be blank or show an error about musicians - this is normal)
4. The important thing is that it loads without connection errors

**Leave the dev server running for the next step**

---

## Step 6: Create Your First Musician (10 minutes)

### 6.1 Prepare the API Request

Open a NEW terminal window (keep the dev server running in the other one)

Copy your `ADMIN_TOKEN` from the `.env` file

### 6.2 Create a Test Musician

Run this command (replace `YOUR_ADMIN_TOKEN_HERE` with your actual token):

```bash
curl -X POST http://localhost:8888/.netlify/functions/admin-musicians \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-musician",
    "displayName": "Test Musician",
    "description": "Jazz pianist testing the tip app",
    "currency": "eur",
    "presetAmounts": [500, 1000, 2000, 5000],
    "customAmountEnabled": true,
    "customAmountMin": 100,
    "customAmountMax": 50000
  }'
```

**Expected Response**:

You should see JSON output that includes:

```json
{
  "musician": {
    "id": "test-musician",
    "display_name": "Test Musician",
    ...
  },
  "setupToken": "a-long-random-string",
  "setupUrl": "http://localhost:8888/setup/a-long-random-string"
}
```

**Copy the `setupUrl` value** - you'll need it next.

### 6.3 Verify in Database

1. Go back to your Supabase dashboard
2. Click "Table Editor"
3. Click on the `musicians` table
4. You should see one row with your test musician
5. Note that `setup_complete` is `false` - this is correct

### 6.4 Test the Tipping Page

1. Open your browser
2. Go to: http://localhost:8888/tip/test-musician
3. You should see a page that says "Setup Incomplete" - this is correct!
4. The musician needs to complete Stripe onboarding first

---

## Step 7: Test Stripe Onboarding (10 minutes)

### 7.1 Start Onboarding

1. Copy the `setupUrl` from Step 6.2
2. Paste it into your browser
3. You should see the setup page asking for email and country

### 7.2 Fill in Test Details

1. Enter any test email: `test@example.com`
2. Select country: `Ireland` (or `IE`)
3. Click "Continue to Stripe"

### 7.3 Complete Stripe Test Onboarding

You'll be redirected to Stripe Connect onboarding. Use these TEST values:

**Business Details**:
- Business type: Individual
- First name: Test
- Last name: Musician
- Date of birth: 01/01/1990

**Business Information**:
- Industry: Arts and Entertainment
- Business description: Live music performances

**Bank Account** (use Stripe test bank):
- Country: Ireland
- Account number: `IE29AIBK93115212345678` (test IBAN)
- Or for US: Routing `110000000`, Account `000123456789`

**Identity Verification**:
- Skip for test mode (if prompted)
- Or use test ID document if required

### 7.4 Complete Setup

1. Click through all the steps
2. On the final screen, click "Done" or "Submit"
3. You should be redirected back to your app at `/setup/.../success`

### 7.5 Check Database (Manual Verification)

Since webhooks don't work on localhost, you need to manually update the database:

1. Go to Supabase dashboard → Table Editor → `musicians`
2. Find your test musician row
3. Click on the `stripe_account_id` cell
4. Paste the account ID from the success page (starts with `acct_`)
5. Click on the `setup_complete` cell
6. Change from `false` to `true`
7. Click outside the cell to save

### 7.6 Test Tipping Page Again

1. Go to http://localhost:8888/tip/test-musician
2. Now you should see the full tipping page with:
   - Musician name
   - Description
   - Tip amount buttons (€5, €10, €20, €50)
   - "Send Tip" button

### 7.7 Test Payment Flow

1. Click on the €10 button
2. Click "Send Tip"
3. You'll be redirected to Stripe Checkout
4. Use test card: `4242 4242 4242 4242`
5. Expiry: Any future date (e.g., 12/34)
6. CVC: Any 3 digits (e.g., 123)
7. Name: Test User
8. Click "Pay"
9. You should be redirected to the success page

**If this works, your app is fully functional locally!** ✅

---

## Step 8: Deploy to Netlify (15 minutes)

### 8.1 Push Code to GitHub

If you haven't already, initialize git and push to GitHub:

```bash
git init
git add .
git commit -m "Initial commit - tip app"
```

Create a new repository on GitHub, then:

```bash
git remote add origin https://github.com/yourusername/tip-app.git
git branch -M main
git push -u origin main
```

### 8.2 Deploy to Netlify

1. Go to https://netlify.com
2. Sign up or log in (use GitHub to sign in)
3. Click "Add new site" → "Import an existing project"
4. Click "GitHub"
5. Authorize Netlify to access your GitHub
6. Select your `tip-app` repository
7. Build settings should auto-detect:
   - **Build command**: `npm run build`
   - **Publish directory**: `public`
   - **Functions directory**: `netlify/functions`
8. Click "Deploy site"
9. Wait 2-3 minutes for deployment

### 8.3 Get Your Netlify URL

1. Once deployed, you'll see a random URL like `https://random-name-12345.netlify.app`
2. Click on "Site settings"
3. Under "Site details", you'll see your site name
4. **Copy the full URL** (e.g., `https://random-name-12345.netlify.app`)

### 8.4 Configure Environment Variables in Netlify

1. In Netlify dashboard, go to "Site settings" → "Environment variables"
2. Click "Add a variable" and add each of these:

**Add these variables one by one**:

| Key | Value |
|-----|-------|
| `STRIPE_SECRET_KEY` | Your `sk_test_...` key from Step 2.4 |
| `SUPABASE_URL` | Your Supabase URL from Step 1.3 |
| `SUPABASE_ANON_KEY` | Your anon key from Step 1.3 |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key from Step 1.3 |
| `ADMIN_TOKEN` | Your admin token from Step 4.3 |

**DO NOT add `URL` or `STRIPE_WEBHOOK_SECRET` yet**

3. Click "Save" after adding all variables

### 8.5 Redeploy Site

1. Go to "Deploys" tab
2. Click "Trigger deploy" → "Clear cache and deploy site"
3. Wait 1-2 minutes

---

## Step 9: Configure Stripe Webhook (10 minutes)

### 9.1 Create Webhook Endpoint

1. Go to your Stripe Dashboard
2. Make sure you're in **Test mode**
3. Click "Developers" → "Webhooks"
4. Click "Add endpoint"
5. For **Endpoint URL**, enter:
   ```
   https://YOUR-NETLIFY-URL.netlify.app/.netlify/functions/stripe-webhook
   ```
   Replace `YOUR-NETLIFY-URL` with your actual Netlify URL from Step 8.3

6. For **Events to send**, click "Select events"
7. Find and check these two events:
   - `account.updated`
   - `account.application.deauthorized`
8. Click "Add events"
9. Click "Add endpoint"

### 9.2 Get Webhook Signing Secret

1. You'll see your new webhook endpoint listed
2. Click on it to open details
3. Under "Signing secret", click "Reveal"
4. **Copy the secret** (starts with `whsec_`)

### 9.3 Add Webhook Secret to Netlify

1. Go back to Netlify → Site settings → Environment variables
2. Click "Add a variable"
3. Key: `STRIPE_WEBHOOK_SECRET`
4. Value: Paste the `whsec_...` secret
5. Click "Save"

### 9.4 Redeploy Again

1. Go to "Deploys" tab
2. Click "Trigger deploy" → "Clear cache and deploy site"
3. Wait for deployment to complete

---

## Step 10: Test Production Deployment (5 minutes)

### 10.1 Create a Musician on Production

Open Terminal and run (replace YOUR_NETLIFY_URL and YOUR_ADMIN_TOKEN):

```bash
curl -X POST https://YOUR_NETLIFY_URL.netlify.app/.netlify/functions/admin-musicians \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "jane-doe",
    "displayName": "Jane Doe",
    "description": "Classical violinist",
    "currency": "eur",
    "presetAmounts": [500, 1000, 2000, 5000]
  }'
```

Copy the `setupUrl` from the response.

### 10.2 Complete Onboarding

1. Open the setupUrl in your browser
2. Enter email and country
3. Complete Stripe Connect onboarding with test details
4. Wait 30 seconds after completion

### 10.3 Check Database - Webhook Should Auto-Complete

1. Go to Supabase → Table Editor → `musicians`
2. Find the `jane-doe` row
3. The `setup_complete` column should automatically be `true` now!
4. The `stripe_account_id` should be filled in

**If this worked, the webhook is functioning correctly!** ✅

### 10.4 Test Tipping Page

1. Go to `https://YOUR_NETLIFY_URL.netlify.app/tip/jane-doe`
2. You should see the full tipping page
3. Select an amount and test a payment with test card
4. Payment should complete successfully

---

## Step 11: Switch to Live Mode (When Ready)

### 11.1 Complete Stripe Activation

1. In Stripe Dashboard, you'll need to complete business verification
2. Click "Activate payments" and follow the steps
3. Provide business details, bank account, and identity verification

### 11.2 Get Live API Keys

1. Switch Test mode toggle to OFF (top right)
2. Go to Developers → API keys
3. Get your LIVE secret key (starts with `sk_live_`)

### 11.3 Create Live Webhook

1. Go to Developers → Webhooks
2. Create a new endpoint with the same URL as before
3. Select the same events (`account.updated`, `account.application.deauthorized`)
4. Get the LIVE webhook signing secret

### 11.4 Update Netlify Environment Variables

1. Replace `STRIPE_SECRET_KEY` with live key
2. Replace `STRIPE_WEBHOOK_SECRET` with live webhook secret
3. Redeploy site

**Now you're live!** Musicians will receive real payments.

---

## Troubleshooting

### Problem: "Database error" when creating musician

**Solution**:
- Check that you ran the database schema in Step 1.2
- Verify Supabase credentials in .env are correct
- Make sure Supabase project is active (not paused)

### Problem: "Webhook signature verification failed"

**Solution**:
- Check that `STRIPE_WEBHOOK_SECRET` matches the secret in Stripe Dashboard
- Make sure the webhook URL exactly matches your Netlify function URL
- Redeploy after adding the secret

### Problem: Musician doesn't auto-complete after onboarding

**Solution**:
- Check Netlify function logs: Deploys → Functions → `stripe-webhook`
- Look for errors
- Manually check Stripe Dashboard → Events to see if webhook was triggered
- If no events, check webhook URL is correct

### Problem: Can't create checkout session

**Solution**:
- Verify musician has `setup_complete = true` in database
- Check that `stripe_account_id` is filled in
- Look at Netlify function logs for `create-checkout` function

### Problem: Payment fails with "This account cannot currently make charges"

**Solution**:
- The Stripe Connect account hasn't completed onboarding
- Go to Stripe Dashboard → Connect → Accounts
- Find the account and check its status
- Complete any pending requirements

---

## You're Done! 🎉

Your tipping app is now fully operational:

✅ Database configured
✅ Stripe payments working
✅ Musicians can be added via API
✅ Automatic onboarding completion via webhooks
✅ Deployed to production

## Next Steps

1. Create musicians for your actual use case
2. Send them their setup URLs
3. Generate QR codes (see TODO.md for admin UI implementation)
4. Start receiving tips!

For adding features like the Admin UI, image uploads, etc., see `TODO.md`.
