const { getActiveMusicians, getAllMusicians } = require('./lib/database');
const { validateAdminToken } = require('./lib/validation');
const { handleCors, validateMethod, success, unauthorized } = require('./lib/response');

/**
 * Get all musicians
 * - Public access: returns only active musicians (setup complete)
 * - Admin access (with token): returns all musicians including setup status
 */
exports.handler = async (event) => {
    // Handle CORS preflight
    const corsResponse = handleCors(event);
    if (corsResponse) return corsResponse;

    // Validate HTTP method
    const methodError = validateMethod(event, ['GET']);
    if (methodError) return methodError;

    try {
        // Check for admin token in Authorization header
        const authHeader = event.headers.authorization || event.headers.Authorization;
        const isAdmin = authHeader && validateAdminToken(authHeader.replace('Bearer ', ''));

        let musicians;

        if (isAdmin) {
            // Admin: return all musicians with full details
            const allMusicians = await getAllMusicians();
            musicians = allMusicians.map(m => ({
                id: m.id,
                display_name: m.display_name,
                description: m.description,
                profile_image_url: m.profile_image_url,
                banner_image_url: m.banner_image_url,
                currency: m.currency,
                preset_amounts: m.preset_amounts,
                custom_amount_enabled: m.custom_amount_enabled,
                custom_amount_min: m.custom_amount_min,
                custom_amount_max: m.custom_amount_max,
                stripe_account_id: m.stripe_account_id,
                setup_complete: m.setup_complete,
                setup_token_hash: m.setup_token_hash ? 'SET' : null, // Don't expose actual hash
                payment_success_message: m.payment_success_message,
                allow_tip_notes: m.allow_tip_notes,
                created_at: m.created_at,
                updated_at: m.updated_at,
            }));
        } else {
            // Public: return only active musicians with public fields
            const activeMusicians = await getActiveMusicians();
            musicians = activeMusicians.map(m => ({
                id: m.id,
                display_name: m.display_name,
                description: m.description,
                profile_image_url: m.profile_image_url,
                banner_image_url: m.banner_image_url,
                currency: m.currency,
                preset_amounts: m.preset_amounts,
                custom_amount_enabled: m.custom_amount_enabled,
                custom_amount_min: m.custom_amount_min,
                custom_amount_max: m.custom_amount_max,
                payment_success_message: m.payment_success_message,
                allow_tip_notes: m.allow_tip_notes,
            }));
        }

        return success({
            musicians,
            count: musicians.length,
        });

    } catch (error) {
        console.error('Error fetching musicians:', error);

        if (error.message === 'Admin token not configured') {
            return unauthorized('Admin access not configured');
        }

        return success({ musicians: [], count: 0 }); // Fail gracefully for public access
    }
};
