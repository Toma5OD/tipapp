const Stripe = require('stripe');
const { getMusicianByStripeAccountId, updateMusician } = require('./lib/database');
const { success, badRequest } = require('./lib/response');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Stripe webhook handler
 * Automatically updates musician setup_complete status when Connect onboarding is complete
 *
 * Events handled:
 * - account.updated: Check if charges_enabled and payouts_enabled are true
 * - account.application.deauthorized: Mark setup as incomplete if account disconnects
 */
exports.handler = async (event) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return badRequest('Method not allowed');
    }

    const sig = event.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error('STRIPE_WEBHOOK_SECRET not configured');
        return badRequest('Webhook secret not configured');
    }

    let stripeEvent;

    try {
        // Verify webhook signature
        stripeEvent = stripe.webhooks.constructEvent(
            event.body,
            sig,
            webhookSecret
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return badRequest(`Webhook signature verification failed: ${err.message}`);
    }

    console.log(`Received webhook event: ${stripeEvent.type}`);

    try {
        switch (stripeEvent.type) {
            case 'account.updated': {
                const account = stripeEvent.data.object;
                await handleAccountUpdated(account);
                break;
            }

            case 'account.application.deauthorized': {
                const account = stripeEvent.data.object;
                await handleAccountDeauthorized(account);
                break;
            }

            default:
                console.log(`Unhandled event type: ${stripeEvent.type}`);
        }

        return success({ received: true });

    } catch (error) {
        console.error('Error processing webhook:', error);
        return badRequest(error.message || 'Failed to process webhook');
    }
};

/**
 * Handle account.updated event
 * Mark musician as setup complete when charges and payouts are enabled
 */
async function handleAccountUpdated(account) {
    const accountId = account.id;
    const chargesEnabled = account.charges_enabled;
    const payoutsEnabled = account.payouts_enabled;

    console.log(`Account ${accountId} updated - charges: ${chargesEnabled}, payouts: ${payoutsEnabled}`);

    // Find musician by Stripe account ID
    const musician = await getMusicianByStripeAccountId(accountId);

    if (!musician) {
        console.log(`No musician found for account ${accountId}`);
        return;
    }

    // Update setup_complete based on account capabilities
    const shouldBeComplete = chargesEnabled && payoutsEnabled;

    if (musician.setup_complete !== shouldBeComplete) {
        console.log(`Updating musician ${musician.id} setup_complete to ${shouldBeComplete}`);

        await updateMusician(musician.id, {
            setup_complete: shouldBeComplete,
        });

        console.log(`Musician ${musician.id} setup status updated successfully`);
    } else {
        console.log(`Musician ${musician.id} setup status unchanged`);
    }
}

/**
 * Handle account.application.deauthorized event
 * Mark musician as setup incomplete when they disconnect their account
 */
async function handleAccountDeauthorized(account) {
    const accountId = account.id;

    console.log(`Account ${accountId} deauthorized`);

    // Find musician by Stripe account ID
    const musician = await getMusicianByStripeAccountId(accountId);

    if (!musician) {
        console.log(`No musician found for account ${accountId}`);
        return;
    }

    console.log(`Marking musician ${musician.id} as setup incomplete`);

    await updateMusician(musician.id, {
        setup_complete: false,
    });

    console.log(`Musician ${musician.id} marked as setup incomplete`);
}
