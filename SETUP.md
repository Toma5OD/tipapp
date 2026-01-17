# Setup Guide - Multi-Musician Tip App

This guide will walk you through setting up the tip app from scratch. The setup is now **fully self-service** - musicians can configure themselves without requiring code changes or redeployment.

## Architecture Overview

- **Database**: Supabase (PostgreSQL) for musician configurations
- **Payment Processing**: Stripe Connect with **direct charges** (fastest payouts, lowest platform liability)
- **Hosting**: Netlify with serverless functions
- **Frontend**: Static HTML/CSS/JavaScript (no build process required after CSS compilation)

## Prerequisites

1. Node.js 18+ installed
2. Stripe account (free)
3. Supabase account (free tier available)
4. Netlify account (free tier available)
5. Git (for deployment)

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Supabase Database

### 2.1 Create Supabase Project

1. Go to https://supabase.com and create a new project
2. Choose a region (closest to Ireland: EU West - Ireland or EU Central - Frankfurt)
3. Set a strong database password and save it securely
4. Wait for the project to be created (~2 minutes)

### 2.2 Run Database Schema

1. In your Supabase project, go to **SQL Editor**
2. Open `database/schema.sql` from this project
3. Copy the entire contents and paste into the SQL Editor
4. Click "Run" to execute the schema
5. Verify that the `musicians` and `rate_limits` tables were created (check "Table Editor")

### 2.3 Create Storage Bucket (Optional - for future image uploads)

1. Go to **Storage** in Supabase
2. Create a new bucket named `musician-images`
3. Set it to **public** access
4. Storage policies are already defined in the schema

### 2.4 Get Supabase API Keys

1. Go to **Settings** > **API**
2. Copy the following values:
   - **Project URL** (e.g., `https://abc123.supabase.co`)
   - **anon public** key (starts with `eyJ...`)
   - **service_role** key (starts with `eyJ...`, keep this secret!)

## Step 3: Set Up Stripe

### 3.1 Enable Stripe Connect

1. Go to https://dashboard.stripe.com
2. Navigate to **Connect** > **Settings**
3. Enable **Express accounts**
4. Configure your brand settings (name, logo, colors) - this affects the onboarding experience

### 3.2 Get Stripe API Keys

1. Go to **Developers** > **API Keys**
2. For testing, use **Test mode** (toggle in top right)
3. Copy your **Secret key** (starts with `sk_test_...`)

### 3.3 Set Up Webhook for Automatic Setup Completion

This is **critical** - without webhooks, you must manually mark musicians as setup_complete.

1. Go to **Developers** > **Webhooks**
2. Click **Add endpoint**
3. For **Endpoint URL**, enter:
   - Development: `https://your-netlify-url.netlify.app/.netlify/functions/stripe-webhook`
   - You'll get this URL after deploying to Netlify (see Step 6)
4. For **Events to listen to**, select:
   - `account.updated`
   - `account.application.deauthorized`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_...`)

## Step 4: Configure Environment Variables

### 4.1 Create Local .env File

Copy `.env.example` to `.env` and fill in your values:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJyour_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=eyJyour_service_role_key_here

# Admin Access
ADMIN_TOKEN=generate_a_secure_random_token_here

# Local Development
URL=http://localhost:8888
```

### 4.2 Generate Admin Token

The admin token is used to create and manage musicians via API.

```bash
# Generate a secure random token
openssl rand -base64 32
```

Copy the output and use it as your `ADMIN_TOKEN`.

## Step 5: Build and Test Locally

### 5.1 Build Tailwind CSS

```bash
npm run build
```

### 5.2 Start Development Server

```bash
npm run dev
```

This starts Netlify Dev on http://localhost:8888

### 5.3 Create Your First Musician (via API)

You can use curl, Postman, or any HTTP client:

```bash
curl -X POST http://localhost:8888/.netlify/functions/admin-musicians \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-musician",
    "displayName": "Test Musician",
    "description": "Testing the tip app",
    "currency": "eur",
    "presetAmounts": [500, 1000, 2000, 5000],
    "customAmountEnabled": true
  }'
```

This will return a response with a `setupToken` and `setupUrl`.

### 5.4 Test Musician Onboarding

1. Copy the `setupUrl` from the previous response
2. Open it in your browser
3. Enter an email and country
4. You'll be redirected to Stripe Connect onboarding
5. Use Stripe test data to complete onboarding
6. After completion, check your database - `setup_complete` should automatically become `true` (via webhook)

### 5.5 Test Tipping Flow

1. Visit `http://localhost:8888/tip/test-musician`
2. Select a tip amount
3. Click "Send Tip"
4. Use Stripe test card: `4242 4242 4242 4242`, any future date, any CVC
5. Complete the payment
6. You should see the success page

## Step 6: Deploy to Netlify

### 6.1 Push Code to Git

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/tip-app.git
git push -u origin main
```

### 6.2 Deploy to Netlify

#### Option A: Netlify CLI

```bash
netlify login
netlify init
netlify deploy --prod
```

#### Option B: Netlify Dashboard

1. Go to https://app.netlify.com
2. Click "Add new site" > "Import an existing project"
3. Connect your Git repository
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
5. Click "Deploy site"

### 6.3 Configure Environment Variables in Netlify

1. Go to **Site settings** > **Environment variables**
2. Add all variables from your `.env` file:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_TOKEN`
3. `URL` will be automatically set by Netlify (don't add it manually)

### 6.4 Update Stripe Webhook URL

1. Go back to Stripe Dashboard > **Webhooks**
2. Edit your webhook endpoint
3. Update the URL to your production Netlify URL:
   `https://your-site.netlify.app/.netlify/functions/stripe-webhook`
4. Save changes

### 6.5 Switch to Stripe Live Mode (When Ready)

1. In Stripe Dashboard, toggle to **Live mode**
2. Get your production API keys and webhook secret
3. Update environment variables in Netlify with production keys
4. Redeploy the site

## Step 7: Operational Workflow

### Adding a New Musician

Musicians can now be added without redeploying! Use the admin API:

```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/admin-musicians \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "jane-doe",
    "displayName": "Jane Doe",
    "description": "Classical violinist",
    "currency": "eur"
  }'
```

This returns a setup URL to send to the musician.

### Musician Self-Service Onboarding

1. Send the musician their unique setup URL
2. They enter their email and country
3. They complete Stripe onboarding (identity verification + bank account)
4. **Webhook automatically sets `setup_complete = true`** (no manual intervention needed!)
5. Their tipping page is immediately live at `/tip/{musician-id}`

### Generating QR Codes

Visit `https://your-site.netlify.app/` (requires admin token - see TODO.md for implementing this)

Currently the admin page needs to be updated to use the new API.

### Updating Musician Configuration

```bash
curl -X PUT https://your-site.netlify.app/.netlify/functions/admin-musicians \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "jane-doe",
    "presetAmounts": [1000, 2000, 5000, 10000]
  }'
```

Changes take effect immediately - no redeploy needed!

## Supported Currencies

- **EUR** (Euro) - Primary
- **USD** (US Dollar)
- **GBP** (British Pound)

All amounts are stored in **minor units** (cents/pence) to avoid decimal precision issues.

## Security Notes

1. **Never commit** `.env` file to Git (already in `.gitignore`)
2. **Keep ADMIN_TOKEN secret** - it has full access to create/modify musicians
3. **Keep SUPABASE_SERVICE_ROLE_KEY secret** - it bypasses Row Level Security
4. **Use HTTPS in production** - enforced by Netlify automatically
5. **Validate webhook signatures** - already implemented in webhook handler

## Troubleshooting

### Webhook Not Working

- Check Netlify function logs: Site > **Functions** > `stripe-webhook`
- Verify webhook secret matches in both Stripe and environment variables
- Test webhook using Stripe CLI: `stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook`

### Database Connection Errors

- Verify Supabase project is active
- Check that API keys are correct in environment variables
- Ensure schema has been run successfully

### Payments Not Working

- Verify Stripe account is fully activated
- Check that musician has completed onboarding (`setup_complete = true`)
- Review Stripe Dashboard logs for payment intent errors

### Rate Limiting Issues

- Rate limits: 10 checkout requests per minute per IP
- Increase limit in `database.js` if needed
- Consider implementing Netlify rate limiting for additional protection

## Next Steps

See `TODO.md` for features that haven't been implemented yet but are planned:

- Image upload functionality
- Admin UI for musician management
- Setup token-based musician configuration editor
- And more...

## Support

For issues or questions:
- Check Netlify function logs for errors
- Review Stripe Dashboard for payment issues
- Check Supabase logs for database errors
- Verify environment variables are set correctly
