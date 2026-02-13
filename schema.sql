CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS public;




CREATE TABLE public.batteries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    battery_code text NOT NULL,
    brand text NOT NULL,

    initial_capacity numeric(6,2),
    current_capacity numeric(6,2),
    manufacture_year int,
    charging_cycles int,


    nft_token_id text,
    minted boolean DEFAULT false,

    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);




CREATE TABLE public.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    email text NOT NULL UNIQUE,
    
    

    wallet_address text UNIQUE,
    name text,

    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);




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




CREATE TABLE public.usage_surveys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    listing_id uuid REFERENCES public.listings(id),

    years_used int,
    first_owner boolean,

    use_case text,
    charging_frequency text,

    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);




CREATE TABLE public.ocr_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid REFERENCES public.users(id),
    battery_id uuid REFERENCES public.batteries(id),

    image_url text NOT NULL,

    extracted_text text,
    confidence_score numeric(4,2),

    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);




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


CREATE TABLE public.user_wallets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid NOT NULL
        REFERENCES public.users(id)
        ON DELETE CASCADE,

    wallet_address text NOT NULL UNIQUE,

    encrypted_private_key text,

    wallet_type text NOT NULL
        CHECK (wallet_type IN ('custodial', 'external')),

    is_primary boolean DEFAULT true,

    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);