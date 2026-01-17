const { createMusician, updateMusician, deleteMusician, getMusicianById } = require('./lib/database');
const {
    validateMusicianId,
    validateDisplayName,
    validateDescription,
    validateCurrency,
    validatePresetAmounts,
    validateAdminToken,
    generateToken,
    hashToken,
} = require('./lib/validation');
const { handleCors, validateMethod, parseBody, success, badRequest, unauthorized, notFound } = require('./lib/response');

/**
 * Admin-only endpoint for managing musicians
 * Requires ADMIN_TOKEN in Authorization header
 *
 * POST /admin-musicians - Create new musician
 * PUT /admin-musicians - Update existing musician
 * DELETE /admin-musicians - Delete musician
 */
exports.handler = async (event) => {
    // Handle CORS preflight
    const corsResponse = handleCors(event);
    if (corsResponse) return corsResponse;

    // Validate HTTP method
    const methodError = validateMethod(event, ['POST', 'PUT', 'DELETE']);
    if (methodError) return methodError;

    try {
        // Validate admin token
        const authHeader = event.headers.authorization || event.headers.Authorization;
        if (!authHeader) {
            return unauthorized('Authorization header required');
        }

        const token = authHeader.replace('Bearer ', '');
        const isValid = validateAdminToken(token);

        if (!isValid) {
            return unauthorized('Invalid admin token');
        }

        // Parse request body
        const body = parseBody(event);
        if (!body) {
            return badRequest('Invalid JSON in request body');
        }

        // Route to appropriate handler
        switch (event.httpMethod) {
            case 'POST':
                return await handleCreate(body);
            case 'PUT':
                return await handleUpdate(body);
            case 'DELETE':
                return await handleDelete(body);
        }

    } catch (error) {
        console.error('Admin musicians error:', error);

        if (error.message === 'Admin token not configured') {
            return badRequest('Admin functionality not configured. Set ADMIN_TOKEN environment variable.');
        }

        return badRequest(error.message || 'Operation failed');
    }
};

/**
 * Create new musician
 */
async function handleCreate(body) {
    const {
        id,
        displayName,
        description,
        currency,
        presetAmounts,
        customAmountEnabled,
        customAmountMin,
        customAmountMax,
        generateSetupToken,
    } = body;

    // Validate required fields
    const idValidation = validateMusicianId(id);
    if (!idValidation.valid) {
        return badRequest(idValidation.error);
    }

    const nameValidation = validateDisplayName(displayName);
    if (!nameValidation.valid) {
        return badRequest(nameValidation.error);
    }

    const currencyValidation = validateCurrency(currency || 'eur');
    if (!currencyValidation.valid) {
        return badRequest(currencyValidation.error);
    }

    // Validate preset amounts if provided
    const amounts = presetAmounts || [500, 1000, 2000, 5000]; // Default in cents
    const amountsValidation = validatePresetAmounts(amounts, currencyValidation.currency);
    if (!amountsValidation.valid) {
        return badRequest(amountsValidation.error);
    }

    // Check if musician already exists
    const existing = await getMusicianById(id);
    if (existing) {
        return badRequest('Musician with this ID already exists');
    }

    // Generate setup token if requested
    let setupTokenHash = null;
    let setupToken = null;

    if (generateSetupToken !== false) {
        // Generate by default
        setupToken = generateToken(32);
        setupTokenHash = hashToken(setupToken);
    }

    // Create musician data
    const musicianData = {
        id,
        display_name: nameValidation.name,
        description: description || '',
        profile_image_url: '/images/default-avatar.png',
        banner_image_url: '/images/default-banner.png',
        currency: currencyValidation.currency,
        preset_amounts: amounts,
        custom_amount_enabled: customAmountEnabled !== false, // Default true
        custom_amount_min: customAmountMin || 100,
        custom_amount_max: customAmountMax || 50000,
        setup_complete: false,
        setup_token_hash: setupTokenHash,
        payment_success_message: 'Thank you for your support!',
        allow_tip_notes: false,
    };

    const musician = await createMusician(musicianData);

    // Build response
    const response = {
        musician: {
            id: musician.id,
            display_name: musician.display_name,
            description: musician.description,
            currency: musician.currency,
            setup_complete: musician.setup_complete,
            created_at: musician.created_at,
        },
    };

    if (setupToken) {
        response.setupToken = setupToken;
        response.setupUrl = `${process.env.URL || 'http://localhost:8888'}/setup/${setupToken}`;
    }

    return success(response, 201);
}

/**
 * Update existing musician
 */
async function handleUpdate(body) {
    const { id, ...updates } = body;

    if (!id) {
        return badRequest('Musician ID is required');
    }

    const idValidation = validateMusicianId(id);
    if (!idValidation.valid) {
        return badRequest(idValidation.error);
    }

    // Check if musician exists
    const existing = await getMusicianById(id);
    if (!existing) {
        return notFound('Musician not found');
    }

    // Validate and sanitize updates
    const validatedUpdates = {};

    if (updates.displayName !== undefined) {
        const nameValidation = validateDisplayName(updates.displayName);
        if (!nameValidation.valid) {
            return badRequest(nameValidation.error);
        }
        validatedUpdates.display_name = nameValidation.name;
    }

    if (updates.description !== undefined) {
        const descValidation = validateDescription(updates.description);
        if (!descValidation.valid) {
            return badRequest(descValidation.error);
        }
        validatedUpdates.description = descValidation.description;
    }

    if (updates.currency !== undefined) {
        const currencyValidation = validateCurrency(updates.currency);
        if (!currencyValidation.valid) {
            return badRequest(currencyValidation.error);
        }
        validatedUpdates.currency = currencyValidation.currency;
    }

    if (updates.presetAmounts !== undefined) {
        const amountsValidation = validatePresetAmounts(
            updates.presetAmounts,
            validatedUpdates.currency || existing.currency
        );
        if (!amountsValidation.valid) {
            return badRequest(amountsValidation.error);
        }
        validatedUpdates.preset_amounts = updates.presetAmounts;
    }

    // Simple fields
    if (updates.customAmountEnabled !== undefined) {
        validatedUpdates.custom_amount_enabled = Boolean(updates.customAmountEnabled);
    }

    if (updates.customAmountMin !== undefined) {
        validatedUpdates.custom_amount_min = parseInt(updates.customAmountMin);
    }

    if (updates.customAmountMax !== undefined) {
        validatedUpdates.custom_amount_max = parseInt(updates.customAmountMax);
    }

    if (updates.profileImageUrl !== undefined) {
        validatedUpdates.profile_image_url = updates.profileImageUrl;
    }

    if (updates.bannerImageUrl !== undefined) {
        validatedUpdates.banner_image_url = updates.bannerImageUrl;
    }

    if (updates.paymentSuccessMessage !== undefined) {
        validatedUpdates.payment_success_message = updates.paymentSuccessMessage;
    }

    if (updates.allowTipNotes !== undefined) {
        validatedUpdates.allow_tip_notes = Boolean(updates.allowTipNotes);
    }

    // Update musician
    const updated = await updateMusician(id, validatedUpdates);

    return success({
        musician: {
            id: updated.id,
            display_name: updated.display_name,
            description: updated.description,
            currency: updated.currency,
            setup_complete: updated.setup_complete,
            updated_at: updated.updated_at,
        },
    });
}

/**
 * Delete musician
 */
async function handleDelete(body) {
    const { id } = body;

    if (!id) {
        return badRequest('Musician ID is required');
    }

    const idValidation = validateMusicianId(id);
    if (!idValidation.valid) {
        return badRequest(idValidation.error);
    }

    // Check if musician exists
    const existing = await getMusicianById(id);
    if (!existing) {
        return notFound('Musician not found');
    }

    await deleteMusician(id);

    return success({
        message: 'Musician deleted successfully',
        id,
    });
}
