const { createClient } = require('@supabase/supabase-js');

// In-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 60000; // 60 seconds

// Initialize Supabase client (service role for admin operations)
function getSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase environment variables not configured');
    }

    return createClient(supabaseUrl, supabaseKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

// Initialize Supabase client (anon key for public read operations)
function getSupabaseAnonClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase environment variables not configured');
    }

    return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

// Cache helper
function getCached(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    cache.delete(key);
    return null;
}

function setCache(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}

function clearCache(pattern) {
    if (pattern) {
        for (const key of cache.keys()) {
            if (key.includes(pattern)) {
                cache.delete(key);
            }
        }
    } else {
        cache.clear();
    }
}

// Get musician by ID (cached for performance)
async function getMusicianById(id) {
    const cacheKey = `musician:${id}`;
    const cached = getCached(cacheKey);
    if (cached) {
        return cached;
    }

    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase
        .from('musicians')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            // Not found
            return null;
        }
        throw new Error(`Database error: ${error.message}`);
    }

    setCache(cacheKey, data);
    return data;
}

// Get musician by setup token hash
async function getMusicianBySetupToken(tokenHash) {
    const supabase = getSupabaseClient(); // Use service role for token queries
    const { data, error } = await supabase
        .from('musicians')
        .select('*')
        .eq('setup_token_hash', tokenHash)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            return null;
        }
        throw new Error(`Database error: ${error.message}`);
    }

    return data;
}

// Get musician by Stripe account ID (for webhooks)
async function getMusicianByStripeAccountId(stripeAccountId) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
        .from('musicians')
        .select('*')
        .eq('stripe_account_id', stripeAccountId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            return null;
        }
        throw new Error(`Database error: ${error.message}`);
    }

    return data;
}

// Get all active musicians (setup complete)
async function getActiveMusicians() {
    const cacheKey = 'musicians:active:all';
    const cached = getCached(cacheKey);
    if (cached) {
        return cached;
    }

    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase
        .from('active_musicians')
        .select('*')
        .order('display_name');

    if (error) {
        throw new Error(`Database error: ${error.message}`);
    }

    setCache(cacheKey, data || []);
    return data || [];
}

// Get all musicians (admin only)
async function getAllMusicians() {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
        .from('musicians')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error(`Database error: ${error.message}`);
    }

    return data || [];
}

// Create new musician
async function createMusician(musicianData) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
        .from('musicians')
        .insert([musicianData])
        .select()
        .single();

    if (error) {
        throw new Error(`Database error: ${error.message}`);
    }

    clearCache('musicians:');
    clearCache(`musician:${musicianData.id}`);
    return data;
}

// Update musician
async function updateMusician(id, updates) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
        .from('musicians')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        throw new Error(`Database error: ${error.message}`);
    }

    clearCache(`musician:${id}`);
    clearCache('musicians:');
    return data;
}

// Delete musician
async function deleteMusician(id) {
    const supabase = getSupabaseClient();
    const { error } = await supabase
        .from('musicians')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(`Database error: ${error.message}`);
    }

    clearCache(`musician:${id}`);
    clearCache('musicians:');
    return true;
}

// Rate limiting functions
async function checkRateLimit(key, limit = 10, windowSeconds = 60) {
    const supabase = getSupabaseClient();
    const windowStart = new Date(Date.now() - windowSeconds * 1000);

    // Clean up old entries first
    await supabase
        .from('rate_limits')
        .delete()
        .lt('window_start', windowStart.toISOString());

    // Get or create rate limit entry
    const { data: existing, error: fetchError } = await supabase
        .from('rate_limits')
        .select('*')
        .eq('key', key)
        .gte('window_start', windowStart.toISOString())
        .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
        // Ignore not found, throw other errors
        console.error('Rate limit check error:', fetchError);
        return true; // Fail open for availability
    }

    if (existing) {
        if (existing.count >= limit) {
            return false; // Rate limit exceeded
        }

        // Increment count
        await supabase
            .from('rate_limits')
            .update({ count: existing.count + 1 })
            .eq('key', key);

        return true;
    }

    // Create new rate limit entry
    await supabase
        .from('rate_limits')
        .insert([{ key, count: 1, window_start: new Date().toISOString() }]);

    return true;
}

module.exports = {
    getSupabaseClient,
    getSupabaseAnonClient,
    getMusicianById,
    getMusicianBySetupToken,
    getMusicianByStripeAccountId,
    getActiveMusicians,
    getAllMusicians,
    createMusician,
    updateMusician,
    deleteMusician,
    checkRateLimit,
    clearCache,
};
