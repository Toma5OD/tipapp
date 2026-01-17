-- Tip App Database Schema for Supabase
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Musicians table
CREATE TABLE IF NOT EXISTS public.musicians (
    id TEXT PRIMARY KEY,  -- URL-safe slug (e.g., "john-smith")
    display_name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    profile_image_url TEXT DEFAULT '/images/default-avatar.png',
    banner_image_url TEXT DEFAULT '/images/default-banner.png',
    currency TEXT NOT NULL DEFAULT 'eur',  -- ISO 4217 currency code
    preset_amounts INTEGER[] NOT NULL DEFAULT '{500, 1000, 2000, 5000}',  -- Amounts in minor units (cents/pence)
    custom_amount_enabled BOOLEAN NOT NULL DEFAULT true,
    custom_amount_min INTEGER NOT NULL DEFAULT 100,  -- Minimum in minor units
    custom_amount_max INTEGER NOT NULL DEFAULT 50000,  -- Maximum in minor units (€500)
    stripe_account_id TEXT,  -- Stripe Connect account ID
    setup_complete BOOLEAN NOT NULL DEFAULT false,
    setup_token_hash TEXT UNIQUE,  -- Hashed setup token for secure access
    payment_success_message TEXT DEFAULT 'Thank you for your support!',
    allow_tip_notes BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_id CHECK (id ~ '^[a-z0-9-]+$'),  -- Lowercase, hyphens only
    CONSTRAINT valid_currency CHECK (currency IN ('eur', 'usd', 'gbp')),
    CONSTRAINT valid_min_max CHECK (custom_amount_min < custom_amount_max),
    CONSTRAINT preset_amounts_length CHECK (array_length(preset_amounts, 1) BETWEEN 1 AND 6)
);

-- Create index on setup_token_hash for fast lookups
CREATE INDEX IF NOT EXISTS idx_musicians_setup_token ON public.musicians(setup_token_hash);

-- Create index on stripe_account_id for webhook lookups
CREATE INDEX IF NOT EXISTS idx_musicians_stripe_account ON public.musicians(stripe_account_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_musicians_updated_at ON public.musicians;
CREATE TRIGGER update_musicians_updated_at
    BEFORE UPDATE ON public.musicians
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Rate limiting table (simple in-memory alternative for serverless)
CREATE TABLE IF NOT EXISTS public.rate_limits (
    key TEXT PRIMARY KEY,  -- IP address or identifier
    count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.rate_limits(window_start);

-- Row Level Security (RLS) Policies

-- Enable RLS on musicians table
ALTER TABLE public.musicians ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous reads for active musicians (setup complete)
CREATE POLICY "Allow public read access to active musicians"
    ON public.musicians
    FOR SELECT
    USING (setup_complete = true);

-- Policy: Allow anonymous reads by setup token (for setup page)
-- Note: This requires passing the token in the query, not automatic RLS
-- We'll handle this in the application layer

-- For now, allow all reads (we'll filter in application)
DROP POLICY IF EXISTS "Allow public read access to active musicians" ON public.musicians;
CREATE POLICY "Allow public read all musicians"
    ON public.musicians
    FOR SELECT
    TO anon
    USING (true);

-- No INSERT/UPDATE/DELETE policies for anonymous users
-- These operations will be done via service role key in serverless functions

-- Enable RLS on rate_limits table
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy: No direct access to rate_limits (service role only)
CREATE POLICY "No public access to rate limits"
    ON public.rate_limits
    FOR ALL
    TO anon
    USING (false);

-- Create storage bucket for musician images (run this separately if needed)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('musician-images', 'musician-images', true);

-- Storage policies for musician-images bucket (run after bucket creation)
-- CREATE POLICY "Public read access to musician images"
--     ON storage.objects FOR SELECT
--     USING (bucket_id = 'musician-images');
--
-- CREATE POLICY "Authenticated upload to musician images"
--     ON storage.objects FOR INSERT
--     TO anon
--     WITH CHECK (bucket_id = 'musician-images' AND (storage.foldername(name))[1] IN (
--         SELECT id FROM public.musicians
--     ));

-- Sample data (optional - uncomment to insert test musician)
-- INSERT INTO public.musicians (
--     id,
--     display_name,
--     description,
--     currency,
--     preset_amounts,
--     custom_amount_enabled,
--     custom_amount_min,
--     custom_amount_max,
--     setup_complete
-- ) VALUES (
--     'test-musician',
--     'Test Musician',
--     'Jazz pianist at The Blue Note. Thank you for your support!',
--     'eur',
--     ARRAY[500, 1000, 2000, 5000],
--     true,
--     100,
--     50000,
--     false
-- );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.musicians TO anon, authenticated;
GRANT SELECT ON public.rate_limits TO anon, authenticated;

-- Views for public API (optional - provides clean interface)
CREATE OR REPLACE VIEW public.active_musicians AS
SELECT
    id,
    display_name,
    description,
    profile_image_url,
    banner_image_url,
    currency,
    preset_amounts,
    custom_amount_enabled,
    custom_amount_min,
    custom_amount_max,
    payment_success_message,
    allow_tip_notes
FROM public.musicians
WHERE setup_complete = true;

GRANT SELECT ON public.active_musicians TO anon, authenticated;

COMMENT ON TABLE public.musicians IS 'Stores musician profiles and tipping configurations';
COMMENT ON COLUMN public.musicians.preset_amounts IS 'Tip amounts in minor currency units (cents/pence)';
COMMENT ON COLUMN public.musicians.setup_token_hash IS 'SHA-256 hash of setup token for secure self-service configuration';
