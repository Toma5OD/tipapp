// Standard response helpers for consistent API responses

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

function success(data, statusCode = 200) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
        },
        body: JSON.stringify(data),
    };
}

function error(message, statusCode = 500, details = null) {
    const response = {
        error: message,
    };

    if (details) {
        response.details = details;
    }

    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
        },
        body: JSON.stringify(response),
    };
}

function badRequest(message, details = null) {
    return error(message, 400, details);
}

function unauthorized(message = 'Unauthorized') {
    return error(message, 401);
}

function forbidden(message = 'Forbidden') {
    return error(message, 403);
}

function notFound(message = 'Not found') {
    return error(message, 404);
}

function methodNotAllowed(allowedMethods = []) {
    return {
        statusCode: 405,
        headers: {
            'Content-Type': 'application/json',
            'Allow': allowedMethods.join(', '),
            ...CORS_HEADERS,
        },
        body: JSON.stringify({
            error: 'Method not allowed',
            allowedMethods,
        }),
    };
}

function tooManyRequests(message = 'Too many requests. Please try again later.') {
    return error(message, 429);
}

function cors() {
    return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: '',
    };
}

// Middleware to handle CORS preflight
function handleCors(event) {
    if (event.httpMethod === 'OPTIONS') {
        return cors();
    }
    return null;
}

// Middleware to validate HTTP method
function validateMethod(event, allowedMethods) {
    if (!allowedMethods.includes(event.httpMethod)) {
        return methodNotAllowed(allowedMethods);
    }
    return null;
}

// Parse JSON body safely
function parseBody(event) {
    try {
        return event.body ? JSON.parse(event.body) : {};
    } catch (error) {
        return null;
    }
}

// Get client IP address
function getClientIp(event) {
    return (
        event.headers['x-forwarded-for']?.split(',')[0].trim() ||
        event.headers['x-real-ip'] ||
        'unknown'
    );
}

module.exports = {
    success,
    error,
    badRequest,
    unauthorized,
    forbidden,
    notFound,
    methodNotAllowed,
    tooManyRequests,
    cors,
    handleCors,
    validateMethod,
    parseBody,
    getClientIp,
};
