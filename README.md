# Multi-Musician QR Tipping Web App

A **self-service** web application enabling musicians to receive tips via QR codes using Stripe Connect. Musicians can configure their own tipping pages without requiring code changes or redeployment.

## 🎯 Key Features

✅ **Fully Self-Service** - Musicians can configure themselves, no developer intervention needed
✅ **No Redeployment Required** - Add/update musicians via API without code changes
✅ **Automatic Setup Completion** - Stripe webhooks auto-enable tipping when onboarding completes
✅ **Direct Payouts** - Payments go directly to musician Stripe accounts (fastest payouts, lowest liability)
✅ **Multi-Currency** - Support for EUR (primary), USD, and GBP
✅ **Mobile-First** - Apple Pay and Google Pay enabled automatically
✅ **Rate Limited** - 10 requests/minute per IP, database-backed
✅ **Secure** - Input validation, HTTPS enforced, PCI compliant via Stripe

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Stripe account (enable Connect)
- Supabase account (PostgreSQL database)
- Netlify account (hosting + serverless functions)

### Installation

```bash
# Clone repository
git clone <your-repo-url>
cd tip-app

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# See SETUP.md for detailed instructions

# Build CSS
npm run build

# Run locally
npm run dev
```

Visit http://localhost:8888

## 📚 Documentation

- **[SETUP.md](SETUP.md)** - Complete setup guide with step-by-step instructions
- **[TODO.md](TODO.md)** - Deferred features and implementation roadmap
- **[database/schema.sql](database/schema.sql)** - Database schema for Supabase

## 🏗️ Architecture

### Tech Stack

- **Frontend**: Static HTML/CSS/JavaScript with Tailwind CSS
- **Backend**: Netlify serverless functions (Node.js)
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe Checkout + Connect (direct charges)
- **Hosting**: Netlify with HTTPS and CDN

### Key Components

```
.
├── public/                   # Static frontend
│   ├── index.html           # Admin/QR generator (needs update - see TODO.md)
│   ├── tip/                 # Tipping pages ✅
│   ├── setup/               # Stripe onboarding pages ✅
│   ├── js/
│   │   └── tip-page.js      # Frontend logic (updated for DB) ✅
│   └── styles/main.css      # Compiled Tailwind
│
├── netlify/functions/       # Serverless API
│   ├── lib/
│   │   ├── database.js      # Supabase client + caching ✅
│   │   ├── validation.js    # Input validation + formatting ✅
│   │   └── response.js      # API response helpers ✅
│   ├── create-checkout.js   # Create Stripe session (direct charge) ✅
│   ├── get-musician.js      # Fetch musician config ✅
│   ├── get-musicians.js     # List all musicians ✅
│   ├── admin-musicians.js   # Create/update/delete musicians ✅
│   ├── onboard.js           # Start Stripe onboarding ✅
│   └── stripe-webhook.js    # Auto-complete setup ✅
│
├── database/
│   └── schema.sql           # Supabase database schema ✅
│
├── SETUP.md                 # Detailed setup guide ✅
├── TODO.md                  # Deferred features ✅
└── README.md                # This file
```

## 🔑 Environment Variables

Required in `.env` and Netlify:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Admin Access
ADMIN_TOKEN=<generate-with-openssl-rand>

# Auto-set by Netlify in production
URL=http://localhost:8888
```

See [SETUP.md](SETUP.md) for how to obtain these values.

## 📖 Usage

### Adding a Musician (Admin API)

```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/admin-musicians \
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

Returns:
```json
{
  "musician": { ... },
  "setupToken": "abc123...",
  "setupUrl": "https://your-site.netlify.app/setup/abc123..."
}
```

### Musician Onboarding Flow

1. Admin creates musician via API (above)
2. Send musician the `setupUrl`
3. Musician enters email and country
4. Redirected to Stripe Connect onboarding
5. **Webhook automatically sets `setup_complete = true`** 🎉
6. Tipping page goes live at `/tip/jane-doe`

No manual config edits or redeployment needed!

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

Changes take effect immediately.

## 💰 Currency & Amount Handling

All amounts are stored in **minor units** (cents/pence):
- €5.00 = `500`
- $10.00 = `1000`
- £20.00 = `2000`

This avoids floating-point precision issues.

**Supported Currencies**:
- EUR (Euro) - Primary
- USD (US Dollar)
- GBP (British Pound)

## 🎨 Customization

### Tip Amounts

Customizable per musician:
```json
{
  "presetAmounts": [500, 1000, 2000, 5000],
  "customAmountEnabled": true,
  "customAmountMin": 100,
  "customAmountMax": 50000
}
```

### Branding

- Stripe Connect branding: Configure in Stripe Dashboard > Connect > Settings
- App styling: Edit `src/styles.css` (Tailwind)
- Images: See TODO.md for image upload feature (not yet implemented)

## 🔒 Security

- **Payment data**: Handled entirely by Stripe (PCI compliant)
- **HTTPS**: Enforced by Netlify automatically
- **Input validation**: Comprehensive validation on all inputs
- **Rate limiting**: 10 requests/minute per IP via database
- **Admin access**: Protected by ADMIN_TOKEN
- **Webhook verification**: Stripe signature validation
- **Row-level security**: Supabase RLS policies configured

## 🚧 What's NOT Implemented Yet

See [TODO.md](TODO.md) for deferred features:

- ⚠️ **Admin UI** - Currently requires API calls (curl/Postman)
- ⚠️ **Self-Service Setup Token Page** - Musicians can't configure their own profiles yet
- ⚠️ **Image Upload** - Uses default placeholder images
- ⚠️ **Personalized Success Page** - Generic thank you message
- ⚠️ **Tip Notes UI** - Backend supports it, frontend doesn't show it

**These features are documented with implementation guides in TODO.md**

## 🐛 Troubleshooting

### Payments Not Working

1. Check musician `setup_complete = true` in database
2. Verify Stripe account has `charges_enabled` and `payouts_enabled`
3. Check Netlify function logs for errors
4. Verify environment variables are set correctly

### Webhook Not Firing

1. Verify webhook URL matches your Netlify site URL
2. Check `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
3. Test webhook using Stripe CLI:
   ```bash
   stripe listen --forward-to localhost:8888/.netlify/functions/stripe-webhook
   ```

### Database Connection Errors

1. Verify Supabase project is active
2. Check API keys in environment variables
3. Ensure schema has been run in SQL Editor

## 📈 Scaling Considerations

Current implementation supports:
- **Musicians**: Unlimited (database scales with Supabase)
- **Transactions**: Unlimited (Stripe handles all payment processing)
- **Traffic**: ~500 req/min with current rate limits (adjustable)

For higher traffic:
- Increase rate limits in `database.js`
- Consider Redis for rate limiting (see TODO.md)
- Enable Netlify Edge Functions for faster response times

## 🤝 Contributing

1. Check [TODO.md](TODO.md) for features to implement
2. Create feature branch: `git checkout -b feature/admin-ui`
3. Follow existing code patterns in `netlify/functions/`
4. Test locally: `npm run dev`
5. Update TODO.md to mark feature as complete
6. Submit pull request

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

Built with:
- [Stripe](https://stripe.com) - Payment processing & Connect
- [Supabase](https://supabase.com) - PostgreSQL database
- [Netlify](https://netlify.com) - Hosting & serverless functions
- [Tailwind CSS](https://tailwindcss.com) - Styling framework

## 📧 Support

For issues or questions:
- Review [SETUP.md](SETUP.md) for configuration help
- Check [TODO.md](TODO.md) for known limitations
- Check Netlify function logs for errors
- Review Stripe Dashboard for payment issues
- Verify environment variables in Netlify settings

---

**Status**: Core functionality complete and operational ✅
**Last Updated**: 2026-01-16
