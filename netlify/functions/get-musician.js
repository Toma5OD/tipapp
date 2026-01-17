const { getMusicianById } = require('./lib/database');
const { validateMusicianId } = require('./lib/validation');
const { handleCors, validateMethod, success, badRequest, notFound } = require('./lib/response');

/**
 * Get musician configuration by ID
 * Public endpoint - returns only active (setup complete) musicians
 */
exports.handler = async (event) => {
    // Handle CORS preflight
    const corsResponse = handleCors(event);
    if (corsResponse) return corsResponse;

    // Validate HTTP method
    const methodError = validateMethod(event, ['GET']);
    if (methodError) return methodError;

    try {
        // Get musician ID from query string
        const musicianId = event.queryStringParameters?.id;

        if (!musicianId) {
            return badRequest('Musician ID is required');
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

        // Only return active musicians to public
        if (!musician.setup_complete) {
            return success({
                id: musician.id,
                display_name: musician.display_name,
                setup_complete: false,
            });
        }

        // Return public musician data (exclude sensitive fields)
        return success({
            id: musician.id,
            display_name: musician.display_name,
            description: musician.description,
            profile_image_url: musician.profile_image_url,
            banner_image_url: musician.banner_image_url,
            currency: musician.currency,
            preset_amounts: musician.preset_amounts,
            custom_amount_enabled: musician.custom_amount_enabled,
            custom_amount_min: musician.custom_amount_min,
            custom_amount_max: musician.custom_amount_max,
            payment_success_message: musician.payment_success_message,
            allow_tip_notes: musician.allow_tip_notes,
            setup_complete: musician.setup_complete,
        });

    } catch (error) {
        console.error('Error fetching musician:', error);
        return badRequest(error.message || 'Failed to fetch musician');
    }
};
