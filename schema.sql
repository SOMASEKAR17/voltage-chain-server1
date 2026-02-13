CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS public;

-- ========================
-- Batteries
-- ========================
CREATE TABLE public.batteries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    battery_code text NOT NULL,
    brand text NOT NULL,

    initial_voltage numeric(6,2),
    manufacture_year int,

    nft_token_id text,
    minted boolean DEFAULT false,

    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- Users
-- ========================
CREATE TABLE public.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,

    wallet_address text UNIQUE,
    name text,

    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- Battery History
-- ========================
CREATE TABLE public.battery_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    battery_id uuid REFERENCES public.batteries(id),

    event_type text NOT NULL,

    voltage numeric(6,2),
    soh_percent numeric(5,2),

    notes text,
    ipfs_hash text,

    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- Listings
-- ========================
CREATE TABLE public.listings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    battery_id uuid REFERENCES public.batteries(id),
    seller_id uuid REFERENCES public.users(id),

    price numeric(12,2) NOT NULL,

    predicted_voltage numeric(6,2),
    user_voltage numeric(6,2),

    health_score numeric(5,2),

    status text DEFAULT 'draft',
    ai_verified boolean DEFAULT false,

    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- Usage Surveys
-- ========================
CREATE TABLE public.usage_surveys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    listing_id uuid REFERENCES public.listings(id),

    years_used int,
    first_owner boolean,

    use_case text,
    charging_frequency text,

    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- OCR Records
-- ========================
CREATE TABLE public.ocr_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid REFERENCES public.users(id),
    battery_id uuid REFERENCES public.batteries(id),

    image_url text NOT NULL,

    extracted_text text,
    confidence_score numeric(4,2),

    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- AI Evaluations
-- ========================
CREATE TABLE public.ai_evaluations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    listing_id uuid REFERENCES public.listings(id),

    predicted_voltage numeric(6,2),
    predicted_soh numeric(5,2),

    error_margin numeric(5,2),

    explanation text,
    llm_verdict text,

    confidence_score numeric(4,2),

    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE public.listing_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    listing_id uuid NOT NULL
        REFERENCES public.listings(id)
        ON DELETE CASCADE,

    image_url text NOT NULL,

    image_type text NOT NULL
        CHECK (image_type IN ('gallery', 'label')),

    position int DEFAULT 0,

    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);
