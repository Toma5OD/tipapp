# TODO - Deferred Features

This document tracks features from the original implementation plan that have been **deferred** for future implementation. The core self-service functionality is complete and operational.

## ✅ IMPLEMENTED (Core Self-Service Flow)

- [x] Database integration (Supabase PostgreSQL)
- [x] Musician configurations stored in database (no more config.json edits)
- [x] Admin API for creating/updating/deleting musicians
- [x] Stripe webhook handler (auto-completion of setup)
- [x] Direct charges on connected accounts (fastest payouts)
- [x] Rate limiting (10 requests/minute per IP)
- [x] Comprehensive input validation
- [x] Multi-currency support (EUR, USD, GBP)
- [x] Amount handling in minor units (cents/pence)
- [x] Caching layer (60-second TTL for musician lookups)
- [x] Frontend updated to use database API
- [x] Setup instructions (SETUP.md)

## 🚧 TODO - Frontend & UX Improvements

### Priority: HIGH - Admin UI

**Current State**: Admin operations require API calls via curl/Postman
**Goal**: User-friendly admin dashboard

**Tasks**:

1. **Update `/public/index.html` (Admin Page)**
   - Add authentication using ADMIN_TOKEN
   - Replace config.json fetch with API call to `/.netlify/functions/get-musicians`
   - Add "Create Musician" form
   - Show all musicians with setup status
   - Display setup URLs with copy button
   - Add edit/delete buttons per musician
   - Keep QR code generation functionality (already works)

**Implementation Guide**:
- File to edit: `public/index.html`
- Add admin token prompt or embed in URL (e.g., `/admin?token=xxx`)
- Use `fetch()` calls to:
  - `GET /.netlify/functions/get-musicians` (with Authorization header)
  - `POST /.netlify/functions/admin-musicians` (create)
  - `PUT /.netlify/functions/admin-musicians` (update)
  - `DELETE /.netlify/functions/admin-musicians` (delete)
- Show setup token URL only for musicians with `setup_complete = false`

**Example Code Snippet**:
```javascript
// Fetch all musicians with admin token
async function loadMusicians() {
    const adminToken = getAdminToken(); // From URL param or prompt
    const response = await fetch('/.netlify/functions/get-musicians', {
        headers: {
            'Authorization': `Bearer ${adminToken}`
        }
    });
    const data = await response.json();
    renderMusicians(data.musicians);
}
```

**Estimated Effort**: 2-3 hours

---

### Priority: HIGH - Self-Service Setup Token Flow

**Current State**: Musicians get setup URL but can't configure their own profile/images
**Goal**: Musicians can configure their tipping page via setup token link

**Tasks**:

1. **Create `/public/setup/:token/index.html` (Setup Configuration Page)**
   - Musician visits `/setup/{token}` (unique URL sent by admin)
   - Page validates token via API
   - Shows form to edit:
     - Display name
     - Description
     - Profile image (upload - see image upload task)
     - Banner image (upload - see image upload task)
     - Currency selection (EUR/USD/GBP)
     - Preset amounts (editable list)
     - Custom amount settings
   - "Save & Continue to Stripe" button
   - Calls onboard API with token

2. **Update `/netlify/functions/onboard.js`**
   - Already supports `setupToken` parameter ✅
   - No changes needed

3. **Update `/public/setup/:token/success.html`**
   - Personalized completion message
   - No need to show account ID (webhook handles it automatically)

**Implementation Guide**:
- Create `public/setup/token/index.html` (or handle dynamically with JS)
- Token validation: `GET /.netlify/functions/get-musician-by-token?token={token}`
  - **Need to add this function** (currently missing)
- Configuration updates: `PUT /.netlify/functions/update-musician-by-token`
  - **Need to add this function** (currently missing)

**Required New Functions**:

```javascript
// netlify/functions/get-musician-by-token.js
// Fetch musician config using setup token (no admin auth needed)

// netlify/functions/update-musician-by-token.js
// Update musician config using setup token (no admin auth needed)
```

**Estimated Effort**: 4-5 hours

---

### Priority: MEDIUM - Image Upload Functionality

**Current State**: Musicians use default placeholder images
**Goal**: Musicians can upload custom profile and banner images

**Tasks**:

1. **Create Image Upload API Function**
   - File: `netlify/functions/upload-image.js`
   - Accepts: multipart/form-data with image file
   - Validates: file type (jpeg/png/webp), size (max 2MB), dimensions
   - Uploads to Supabase Storage bucket `musician-images`
   - Returns public URL
   - Requires authentication (either ADMIN_TOKEN or setup token)

2. **Update Setup Page**
   - Add file input fields for avatar and banner
   - Show image preview before upload
   - Upload images when "Save" is clicked
   - Store returned URLs in musician config

3. **Supabase Storage Configuration**
   - Bucket already created via schema ✅
   - May need to adjust storage policies for public access

**Implementation Guide**:
- Use `@supabase/supabase-js` storage client
- Example upload:
```javascript
const { data, error } = await supabase.storage
    .from('musician-images')
    .upload(`${musicianId}/avatar.jpg`, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: true
    });
```

**Estimated Effort**: 3-4 hours

---

### Priority: MEDIUM - Dynamic Routing for `/tip/:id`

**Current State**: Routing works via Netlify redirects in `netlify.toml` ✅
**Goal**: Clean URLs like `/tip/jane-doe` (already functional!)

**Status**: **ALREADY WORKS** via netlify.toml redirects. No changes needed.

If you want to verify, check `netlify.toml`:
```toml
[[redirects]]
  from = "/tip/:musicianId"
  to = "/tip/index.html"
  status = 200
```

---

### Priority: MEDIUM - Personalized Success Page

**Current State**: Generic success page after payment
**Goal**: Show musician name and custom thank you message

**Tasks**:

1. **Update `/public/tip/success.html`**
   - Extract `session_id` from URL query parameter
   - Option A: Parse `musicianId` from return URL
   - Option B: Call Stripe API to get session metadata (requires function)
   - Fetch musician config from database API
   - Display personalized message with musician name

2. **Create Optional Function** (if using Option B):
   - `netlify/functions/get-checkout-session.js`
   - Takes `session_id` as parameter
   - Calls Stripe API to retrieve session
   - Returns musician_id from metadata

**Implementation Guide**:
```javascript
// success.html
const params = new URLSearchParams(window.location.search);
const sessionId = params.get('session_id');
const musicianId = params.get('musician_id'); // Or extract from referrer

// Fetch musician config
const response = await fetch(`/.netlify/functions/get-musician?id=${musicianId}`);
const musician = await response.json();

// Show personalized message
document.getElementById('thank-you-message').textContent =
    musician.payment_success_message || 'Thank you for your support!';
```

**Estimated Effort**: 1-2 hours

---

### Priority: LOW - Tip Notes Feature

**Current State**: Backend supports `tipNote` parameter and stores in Stripe metadata ✅
**Goal**: Add UI to allow tippers to leave optional messages

**Tasks**:

1. **Update `/public/tip/index.html`**
   - Add checkbox: "Include a message with your tip?"
   - Show textarea when checked (if `musician.allow_tip_notes === true`)
   - Max 200 characters
   - Pass `tipNote` to create-checkout API

2. **Enable in Musician Config**
   - Admin or musician sets `allow_tip_notes = true`
   - Already supported in database schema ✅

**Implementation Guide**:
```html
<div id="tip-note-section" class="hidden">
    <label>
        <input type="checkbox" id="enable-note"> Include a message
    </label>
    <textarea id="tip-note" maxlength="200" class="hidden"></textarea>
</div>
```

```javascript
// When sending tip
const tipNote = enableNoteCheckbox.checked ? tipNoteTextarea.value : null;
fetch('/.netlify/functions/create-checkout', {
    method: 'POST',
    body: JSON.stringify({ musicianId, amount, tipNote })
});
```

**Estimated Effort**: 1 hour

---

## 🔒 TODO - Security & Stability

### Priority: HIGH - Self-Host QR Code Library

**Current State**: Loads QRCode.js from CDN without integrity check
**Goal**: Self-host library to eliminate supply chain risk

**Tasks**:

1. Download QRCode.js library
2. Place in `public/js/vendor/qrcode.min.js`
3. Update `public/index.html` to reference local file
4. Optionally add Subresource Integrity (SRI) hash

**Implementation**:
```bash
cd public/js
mkdir -p vendor
curl -o vendor/qrcode.min.js https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js
```

Update HTML:
```html
<script src="/js/vendor/qrcode.min.js"></script>
```

**Estimated Effort**: 15 minutes

---

### Priority: MEDIUM - Enhanced Rate Limiting

**Current State**: Basic rate limiting in database (10 req/min per IP)
**Goal**: Production-grade rate limiting with Netlify edge

**Options**:

1. **Use Netlify Rate Limiting** (if available in your plan)
   - Add to `netlify.toml`:
   ```toml
   [[plugins]]
   package = "@netlify/plugin-rate-limit"
   ```

2. **Use Redis for Rate Limiting** (requires external service)
   - Upstash Redis (free tier available)
   - Replace database-based rate limiting with Redis

3. **Keep Current Implementation** (good enough for small-medium traffic)

**Decision**: Evaluate based on actual traffic patterns.

**Estimated Effort**: 2-3 hours (if switching to Redis)

---

## 📊 TODO - Monitoring & Analytics (Optional)

### Priority: LOW - Payment Logging

**Current State**: No payment history stored (Stripe Dashboard has full details)
**Goal**: Optional payment log table for analytics

**Tasks**:

1. Add `payments` table to schema
2. Log payments in webhook handler
3. Create analytics dashboard (admin only)

**Note**: Stripe Dashboard already provides comprehensive payment analytics, so this is **low priority**.

**Estimated Effort**: 3-4 hours

---

### Priority: LOW - Error Logging & Monitoring

**Current State**: Errors logged to Netlify function logs
**Goal**: Centralized error tracking with alerts

**Options**:
- Sentry (free tier available)
- LogRocket
- Netlify built-in monitoring

**Implementation**: Add error tracking SDK to serverless functions

**Estimated Effort**: 1-2 hours

---

## 📱 TODO - Mobile & PWA (Future)

### Priority: LOW - Progressive Web App

**Current State**: Mobile-friendly responsive design
**Goal**: Installable PWA with offline support

**Tasks**:
1. Add `manifest.json`
2. Add service worker for offline caching
3. Add install prompt

**Estimated Effort**: 2-3 hours

---

## 🧪 TODO - Testing (Recommended)

### Priority: MEDIUM - Automated Tests

**Current State**: No automated tests
**Goal**: Basic test coverage for critical paths

**Recommended Tests**:

1. **Unit Tests** (validation functions)
   - `lib/validation.js` - all validation functions
   - Currency formatting, amount conversion

2. **Integration Tests** (API endpoints)
   - Create musician API
   - Get musician API
   - Create checkout API
   - Webhook handler

3. **Test Framework**: Jest or Vitest

**Implementation**:
```bash
npm install --save-dev jest
```

Add test files in `netlify/functions/__tests__/`

**Estimated Effort**: 4-6 hours

---

## 📝 Summary - Implementation Priority Order

For continuing development, implement in this order:

1. **Admin UI** (High priority, 2-3 hours) - Makes musician management user-friendly
2. **Self-Service Setup Flow** (High priority, 4-5 hours) - Enables full self-service
3. **Image Upload** (Medium priority, 3-4 hours) - Completes self-service onboarding
4. **Self-Host QR Library** (High security, 15 minutes) - Quick security win
5. **Personalized Success Page** (Medium priority, 1-2 hours) - Better UX
6. **Tip Notes** (Low priority, 1 hour) - Nice-to-have feature

**Total estimated effort for Priority 1-4**: ~12-15 hours

---

## 🛠️ How to Continue Development

1. Choose a task from this TODO list
2. Create a feature branch: `git checkout -b feature/admin-ui`
3. Implement the feature following the implementation guide
4. Test locally: `npm run dev`
5. Update this TODO.md to mark task as complete
6. Commit and deploy: `git commit -m "Add admin UI"`
7. Push and deploy to Netlify

---

## 💡 Need Help?

- Check `SETUP.md` for configuration details
- Review existing code in `netlify/functions/` for patterns
- Stripe API docs: https://stripe.com/docs/api
- Supabase docs: https://supabase.com/docs
- Netlify functions docs: https://docs.netlify.com/functions/overview/

---

**Last Updated**: 2026-01-16
**Status**: Core functionality complete and operational ✅
