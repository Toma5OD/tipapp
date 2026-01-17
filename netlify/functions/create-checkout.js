const Stripe = require('stripe');
const { getMusicianById, checkRateLimit } = require('./lib/database');
const { validateAmount, validateMusicianId, validateTipNote } = require('./lib/validation');
const { handleCors, validateMethod, parseBody, success, badRequest, notFound, tooManyRequests, getClientIp } = require('./lib/response');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create Stripe Checkout Session for tip payment
 * Uses DIRECT CHARGES on connected account (musician receives payment directly)
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

        const { musicianId, amount, tipNote } = body;

        // Rate limiting (10 requests per minute per IP)
        const clientIp = getClientIp(event);
        const rateLimitKey = `checkout:${clientIp}`;
        const withinLimit = await checkRateLimit(rateLimitKey, 10, 60);

        if (!withinLimit) {
            return tooManyRequests('Too many payment attempts. Please try again in a minute.');
        }

        // Validate musician ID
        const idValidation = validateMusicianId(musicianId);
        if (!idValidation.valid) {
            return badRequest(idValidation.error);
        }

        // Fetch musician from database
        const musician = await getMusicianById(musicianId);
        if (!musician) {
            return notFound('Musician not found');
        }

        // Validate setup is complete
        if (!musician.setup_complete) {
            return badRequest('This musician has not completed setup yet. Please check back later.');
        }

        if (!musician.stripe_account_id) {
            return badRequest('Stripe account not configured for this musician');
        }

        // Validate amount (amount should be in minor units - cents/pence)
        const amountValidation = validateAmount(amount, musician.currency, musician);
        if (!amountValidation.valid) {
            return badRequest(amountValidation.error);
        }

        // Validate tip note if provided
        let sanitizedNote = null;
        if (tipNote && musician.allow_tip_notes) {
            const noteValidation = validateTipNote(tipNote);
            if (!noteValidation.valid) {
                return badRequest(noteValidation.error);
            }
            sanitizedNote = noteValidation.note;
        }

        // Get base URL for redirects
        const baseUrl = process.env.URL || `https://${event.headers.host}`;

        // Build metadata
        const metadata = {
            musician_id: musicianId,
            musician_name: musician.display_name,
        };

        if (sanitizedNote) {
            metadata.tip_note = sanitizedNote;
        }

        // Create Stripe Checkout Session using DIRECT CHARGE pattern
        // Payment goes directly to connected account (fastest payout, lowest platform liability)
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: musician.currency,
                        product_data: {
                            name: `Tip for ${musician.display_name}`,
                            description: musician.payment_success_message || 'Thank you for your support!',
                        },
                        unit_amount: amount, // Amount is already in minor units
                    },
                    quantity: 1,
                },
            ],
            payment_intent_data: {
                metadata: metadata,
                description: `Tip for ${musician.display_name}`,
            },
            success_url: `${baseUrl}/tip/${musicianId}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/tip/${musicianId}`,
            metadata: metadata,
        }, {
            stripeAccount: musician.stripe_account_id, // Direct charge on connected account
        });

        return success({
            url: session.url,
            sessionId: session.id,
        });

    } catch (error) {
        console.error('Error creating checkout session:', error);

        // Handle specific Stripe errors
        if (error.type === 'StripeInvalidRequestError') {
            return badRequest(error.message);
        }

        if (error.type === 'StripeAuthenticationError') {
            return badRequest('Stripe authentication error. Please contact support.');
        }

        return badRequest(error.message || 'Failed to create checkout session');
    }
};
