const Stripe = require('stripe');
const { getMusicianById, getMusicianBySetupToken, updateMusician } = require('./lib/database');
const { validateEmail, validateMusicianId, hashToken } = require('./lib/validation');
const { handleCors, validateMethod, parseBody, success, badRequest, notFound } = require('./lib/response');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Start Stripe Connect onboarding for a musician
 * Can be called by:
 * 1. Admin with musicianId (initial setup)
 * 2. Musician with setupToken (self-service via magic link)
 */
exports.handler = async (event) => {
    // Handle CORS preflight
    const corsResponse = handleCors(event);
    if (corsResponse) return corsResponse;

    // Validate HTTP method
    const methodError = validateMethod(event, ['POST']);
    if (methodError) return methodError;

    try {
        // Parse request body
        const body = parseBody(event);
        if (!body) {
            return badRequest('Invalid JSON in request body');
        }

        const { musicianId, setupToken, email, country } = body;

        let musician = null;

        // Find musician by ID or setup token
        if (setupToken) {
            const tokenHash = hashToken(setupToken);
            musician = await getMusicianBySetupToken(tokenHash);
            if (!musician) {
                return badRequest('Invalid or expired setup link');
            }
        } else if (musicianId) {
            const idValidation = validateMusicianId(musicianId);
            if (!idValidation.valid) {
                return badRequest(idValidation.error);
            }
            musician = await getMusicianById(musicianId);
        } else {
            return badRequest('Either musicianId or setupToken is required');
        }

        if (!musician) {
            return notFound('Musician not found');
        }

        // Validate email
        if (!email) {
            return badRequest('Email is required');
        }

        const emailValidation = validateEmail(email);
        if (!emailValidation.valid) {
            return badRequest(emailValidation.error);
        }

        // Determine country (default to IE for Ireland-based app)
        const accountCountry = country || 'IE';
        const validCountries = ['IE', 'US', 'GB'];
        if (!validCountries.includes(accountCountry)) {
            return badRequest(`Country must be one of: ${validCountries.join(', ')}`);
        }

        // Get base URL for redirects
        const baseUrl = process.env.URL || `https://${event.headers.host}`;

        // Check if musician already has a Stripe account
        let accountId = musician.stripe_account_id;

        if (!accountId) {
            // Create a new Stripe Express account
            const account = await stripe.accounts.create({
                type: 'express',
                country: accountCountry,
                email: email,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
                business_type: 'individual',
                metadata: {
                    musician_id: musician.id,
                    musician_name: musician.display_name,
                },
            });

            accountId = account.id;

            // Save Stripe account ID to database
            await updateMusician(musician.id, {
                stripe_account_id: accountId,
            });
        }

        // Create Account Link for onboarding
        const accountLink = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: setupToken
                ? `${baseUrl}/setup/${setupToken}?refresh=true`
                : `${baseUrl}/setup?musician_id=${musician.id}&refresh=true`,
            return_url: setupToken
                ? `${baseUrl}/setup/${setupToken}/success`
                : `${baseUrl}/setup/success?musician_id=${musician.id}`,
            type: 'account_onboarding',
        });

        return success({
            url: accountLink.url,
            accountId: accountId,
        });

    } catch (error) {
        console.error('Error creating onboarding link:', error);

        // Handle specific Stripe errors
        if (error.type === 'StripeInvalidRequestError') {
            return badRequest(error.message);
        }

        return badRequest(error.message || 'Failed to create onboarding link');
    }
};
