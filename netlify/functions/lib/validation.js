const crypto = require('crypto');

// Supported currencies with formatting rules
const CURRENCIES = {
    eur: {
        code: 'EUR',
        symbol: '€',
        name: 'Euro',
        minorUnit: 100, // 100 cents = 1 EUR
        minAmount: 50, // €0.50 minimum
        maxAmount: 50000, // €500 maximum
        format: (amount) => `€${(amount / 100).toFixed(2)}`,
    },
    usd: {
        code: 'USD',
        symbol: '$',
        name: 'US Dollar',
        minorUnit: 100,
        minAmount: 50,
        maxAmount: 50000,
        format: (amount) => `$${(amount / 100).toFixed(2)}`,
    },
    gbp: {
        code: 'GBP',
        symbol: '£',
        name: 'British Pound',
        minorUnit: 100,
        minAmount: 50,
        maxAmount: 50000,
        format: (amount) => `£${(amount / 100).toFixed(2)}`,
    },
};

// Validate musician ID (slug format)
function validateMusicianId(id) {
    if (!id || typeof id !== 'string') {
        return { valid: false, error: 'Musician ID is required' };
    }

    if (!/^[a-z0-9-]+$/.test(id)) {
        return { valid: false, error: 'Musician ID must contain only lowercase letters, numbers, and hyphens' };
    }

    if (id.length < 2 || id.length > 50) {
        return { valid: false, error: 'Musician ID must be between 2 and 50 characters' };
    }

    if (id.startsWith('-') || id.endsWith('-')) {
        return { valid: false, error: 'Musician ID cannot start or end with a hyphen' };
    }

    return { valid: true };
}

// Validate currency code
function validateCurrency(currency) {
    if (!currency || typeof currency !== 'string') {
        return { valid: false, error: 'Currency is required' };
    }

    const normalizedCurrency = currency.toLowerCase();
    if (!CURRENCIES[normalizedCurrency]) {
        return {
            valid: false,
            error: `Currency must be one of: ${Object.keys(CURRENCIES).join(', ')}`,
        };
    }

    return { valid: true, currency: normalizedCurrency };
}

// Validate tip amount (in minor units)
function validateAmount(amount, currency, musicianConfig) {
    if (typeof amount !== 'number' || !Number.isInteger(amount)) {
        return { valid: false, error: 'Amount must be an integer' };
    }

    if (amount <= 0) {
        return { valid: false, error: 'Amount must be greater than 0' };
    }

    const currencyConfig = CURRENCIES[currency];
    if (!currencyConfig) {
        return { valid: false, error: 'Invalid currency' };
    }

    // Check absolute minimums and maximums
    if (amount < currencyConfig.minAmount) {
        return {
            valid: false,
            error: `Minimum amount is ${currencyConfig.format(currencyConfig.minAmount)}`,
        };
    }

    if (amount > currencyConfig.maxAmount) {
        return {
            valid: false,
            error: `Maximum amount is ${currencyConfig.format(currencyConfig.maxAmount)}`,
        };
    }

    // If custom amount, check musician-specific limits
    if (musicianConfig && musicianConfig.custom_amount_enabled) {
        const musicianMin = musicianConfig.custom_amount_min || currencyConfig.minAmount;
        const musicianMax = musicianConfig.custom_amount_max || currencyConfig.maxAmount;

        if (amount < musicianMin) {
            return {
                valid: false,
                error: `Minimum amount is ${currencyConfig.format(musicianMin)}`,
            };
        }

        if (amount > musicianMax) {
            return {
                valid: false,
                error: `Maximum amount is ${currencyConfig.format(musicianMax)}`,
            };
        }
    }

    return { valid: true };
}

// Validate preset amounts array
function validatePresetAmounts(amounts, currency) {
    if (!Array.isArray(amounts)) {
        return { valid: false, error: 'Preset amounts must be an array' };
    }

    if (amounts.length < 1 || amounts.length > 6) {
        return { valid: false, error: 'Must have between 1 and 6 preset amounts' };
    }

    const currencyConfig = CURRENCIES[currency];
    for (const amount of amounts) {
        if (typeof amount !== 'number' || !Number.isInteger(amount)) {
            return { valid: false, error: 'All preset amounts must be integers' };
        }

        if (amount < currencyConfig.minAmount || amount > currencyConfig.maxAmount) {
            return {
                valid: false,
                error: `Preset amounts must be between ${currencyConfig.format(currencyConfig.minAmount)} and ${currencyConfig.format(currencyConfig.maxAmount)}`,
            };
        }
    }

    // Check for duplicates
    const unique = new Set(amounts);
    if (unique.size !== amounts.length) {
        return { valid: false, error: 'Preset amounts must be unique' };
    }

    return { valid: true };
}

// Validate email format
function validateEmail(email) {
    if (!email || typeof email !== 'string') {
        return { valid: false, error: 'Email is required' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { valid: false, error: 'Invalid email format' };
    }

    if (email.length > 255) {
        return { valid: false, error: 'Email is too long' };
    }

    return { valid: true };
}

// Validate display name
function validateDisplayName(name) {
    if (!name || typeof name !== 'string') {
        return { valid: false, error: 'Display name is required' };
    }

    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
        return { valid: false, error: 'Display name must be between 2 and 100 characters' };
    }

    return { valid: true, name: trimmed };
}

// Validate description
function validateDescription(description) {
    if (description && typeof description !== 'string') {
        return { valid: false, error: 'Description must be a string' };
    }

    if (description && description.length > 500) {
        return { valid: false, error: 'Description must be 500 characters or less' };
    }

    return { valid: true, description: description ? description.trim() : '' };
}

// Validate URL
function validateUrl(url) {
    if (!url || typeof url !== 'string') {
        return { valid: false, error: 'URL is required' };
    }

    try {
        new URL(url);
        return { valid: true };
    } catch {
        return { valid: false, error: 'Invalid URL format' };
    }
}

// Generate secure token
function generateToken(length = 32) {
    return crypto.randomBytes(length).toString('base64url');
}

// Hash token for storage
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

// Validate tip note (optional tipper message)
function validateTipNote(note) {
    if (!note) {
        return { valid: true, note: '' };
    }

    if (typeof note !== 'string') {
        return { valid: false, error: 'Tip note must be a string' };
    }

    const trimmed = note.trim();
    if (trimmed.length > 200) {
        return { valid: false, error: 'Tip note must be 200 characters or less' };
    }

    // Basic XSS prevention
    const sanitized = trimmed.replace(/<[^>]*>/g, '');

    return { valid: true, note: sanitized };
}

// Validate admin token
function validateAdminToken(token) {
    const adminToken = process.env.ADMIN_TOKEN;

    if (!adminToken) {
        throw new Error('Admin token not configured');
    }

    return token === adminToken;
}

// Get currency config
function getCurrencyConfig(currency) {
    return CURRENCIES[currency.toLowerCase()];
}

// Format amount for display
function formatAmount(amount, currency) {
    const config = CURRENCIES[currency.toLowerCase()];
    return config ? config.format(amount) : `${amount}`;
}

// Convert major units to minor units (dollars to cents)
function toMinorUnits(amount, currency) {
    const config = CURRENCIES[currency.toLowerCase()];
    return Math.round(amount * (config?.minorUnit || 100));
}

// Convert minor units to major units (cents to dollars)
function toMajorUnits(amount, currency) {
    const config = CURRENCIES[currency.toLowerCase()];
    return amount / (config?.minorUnit || 100);
}

module.exports = {
    CURRENCIES,
    validateMusicianId,
    validateCurrency,
    validateAmount,
    validatePresetAmounts,
    validateEmail,
    validateDisplayName,
    validateDescription,
    validateUrl,
    validateTipNote,
    validateAdminToken,
    generateToken,
    hashToken,
    getCurrencyConfig,
    formatAmount,
    toMinorUnits,
    toMajorUnits,
};
