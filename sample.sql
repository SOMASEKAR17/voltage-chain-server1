
INSERT INTO public.users (id, email, wallet_address, name)
VALUES
(
    gen_random_uuid(),
    'alice@example.com',
    '0xA1B2C3D4E5',
    'Alice'
),
(
    gen_random_uuid(),
    'bob@example.com',
    '0xF6G7H8I9J0',
    'Bob'
),
(
    gen_random_uuid(),
    'charlie@example.com',
    NULL,
    'Charlie'
);


INSERT INTO public.batteries (
    id,
    battery_code,
    brand,
    initial_capacity,
    current_capacity,
    manufacture_year,
    charging_cycles,
    nft_token_id,
    minted
)
VALUES
(
    gen_random_uuid(),
    'BAT-001',
    'Tesla',
    75.00,
    68.40,
    2021,
    420,
    'NFT-1001',
    true
),
(
    gen_random_uuid(),
    'BAT-002',
    'Panasonic',
    60.00,
    52.10,
    2020,
    610,
    NULL,
    false
),
(
    gen_random_uuid(),
    'BAT-003',
    'LG',
    45.00,
    40.20,
    2022,
    210,
    NULL,
    false
);

-- ========================
-- LISTINGS
-- ========================
INSERT INTO public.listings (
    id,
    battery_id,
    seller_id,
    price,
    predicted_voltage,
    user_voltage,
    health_score,
    status,
    ai_verified
)
SELECT
    gen_random_uuid(),
    b.id,
    u.id,
    p.price,
    p.predicted_voltage,
    p.user_voltage,
    p.health_score,
    p.status,
    p.ai_verified
FROM
(
    SELECT
        12000.00 AS price,
        380.50 AS predicted_voltage,
        375.20 AS user_voltage,
        91.5 AS health_score,
        'active' AS status,
        true AS ai_verified
    UNION ALL
    SELECT
        8900.00,
        360.10,
        355.40,
        86.2,
        'active',
        false
    UNION ALL
    SELECT
        6500.00,
        320.00,
        315.60,
        79.4,
        'draft',
        false
) p
JOIN public.batteries b ON true
JOIN public.users u ON true
LIMIT 3;

-- ========================
-- USER SURVEYS
-- ========================
INSERT INTO public.user_surveys (
    id,
    listing_id,
    brand_model,
    initial_capacity,
    current_capacity,
    years_owned,
    primary_application,
    avg_daily_usage,
    charging_frequency_per_week,
    typical_charge_level,
    avg_temperature_c
)
SELECT
    gen_random_uuid(),
    l.id,
    s.brand_model,
    s.initial_capacity,
    s.current_capacity,
    s.years_owned,
    s.primary_application,
    s.avg_daily_usage,
    s.charging_frequency_per_week,
    s.typical_charge_level,
    s.avg_temperature_c
FROM
(
    SELECT
        'Tesla Model X Pack' AS brand_model,
        75.00 AS initial_capacity,
        68.40 AS current_capacity,
        3 AS years_owned,
        'E-car' AS primary_application,
        'Heavy' AS avg_daily_usage,
        6 AS charging_frequency_per_week,
        '20-80' AS typical_charge_level,
        32.5 AS avg_temperature_c

    UNION ALL

    SELECT
        'Panasonic EB-60',
        60.00,
        52.10,
        4,
        'E-bike',
        'Medium',
        4,
        '0-100',
        29.0

    UNION ALL

    SELECT
        'LG PowerCell',
        45.00,
        40.20,
        2,
        'E-bike',
        'Light',
        3,
        'Always Full',
        26.8
) s
JOIN public.listings l ON true
LIMIT 3;

-- ========================
-- BATTERY HISTORY
-- ========================
INSERT INTO public.battery_history (
    id,
    battery_id,
    event_type,
    voltage,
    soh_percent,
    notes,
    ipfs_hash
)
SELECT
    gen_random_uuid(),
    b.id,
    h.event_type,
    h.voltage,
    h.soh_percent,
    h.notes,
    h.ipfs_hash
FROM
(
    SELECT
        'inspection' AS event_type,
        375.40 AS voltage,
        92.1 AS soh_percent,
        'Initial inspection passed' AS notes,
        'QmABC123' AS ipfs_hash

    UNION ALL

    SELECT
        'maintenance',
        360.20,
        88.5,
        'Minor cell balancing',
        'QmDEF456'

    UNION ALL

    SELECT
        'resale_check',
        315.60,
        79.4,
        'Resale certification',
        'QmXYZ789'
) h
JOIN public.batteries b ON true
LIMIT 3;

-- ========================
-- OCR RECORDS
-- ========================
INSERT INTO public.ocr_records (
    id,
    user_id,
    battery_id,
    image_url,
    extracted_text,
    confidence_score
)
SELECT
    gen_random_uuid(),
    u.id,
    b.id,
    o.image_url,
    o.extracted_text,
    o.confidence_score
FROM
(
    SELECT
        'https://cdn.example.com/ocr1.jpg' AS image_url,
        'Voltage: 375V Capacity: 68Ah' AS extracted_text,
        94.5 AS confidence_score

    UNION ALL

    SELECT
        'https://cdn.example.com/ocr2.jpg',
        'Voltage: 355V Capacity: 52Ah',
        91.2

    UNION ALL

    SELECT
        'https://cdn.example.com/ocr3.jpg',
        'Voltage: 316V Capacity: 40Ah',
        88.9
) o
JOIN public.users u ON true
JOIN public.batteries b ON true
LIMIT 3;

-- ========================
-- AI EVALUATIONS
-- ========================
INSERT INTO public.ai_evaluations (
    id,
    listing_id,
    predicted_voltage,
    predicted_soh,
    error_margin,
    explanation,
    llm_verdict,
    confidence_score
)
SELECT
    gen_random_uuid(),
    l.id,
    a.predicted_voltage,
    a.predicted_soh,
    a.error_margin,
    a.explanation,
    a.llm_verdict,
    a.confidence_score
FROM
(
    SELECT
        378.10 AS predicted_voltage,
        92.0 AS predicted_soh,
        1.5 AS error_margin,
        'Battery health is above market average',
        'Approved',
        95.2

    UNION ALL

    SELECT
        359.50,
        87.0,
        2.1,
        'Minor degradation detected',
        'Approved',
        92.6

    UNION ALL

    SELECT
        318.00,
        78.5,
        3.8,
        'Significant wear detected',
        'Review Required',
        85.4
) a
JOIN public.listings l ON true
LIMIT 3;

-- ========================
-- LISTING IMAGES
-- ========================
INSERT INTO public.listing_images (
    id,
    listing_id,
    image_url,
    image_type,
    position
)
SELECT
    gen_random_uuid(),
    l.id,
    i.image_url,
    i.image_type,
    i.position
FROM
(
    SELECT
        'https://cdn.example.com/gallery1.jpg' AS image_url,
        'gallery' AS image_type,
        1 AS position

    UNION ALL

    SELECT
        'https://cdn.example.com/label1.jpg',
        'label',
        2

    UNION ALL

    SELECT
        'https://cdn.example.com/gallery2.jpg',
        'gallery',
        3
) i
JOIN public.listings l ON true
LIMIT 3;

-- ========================
-- USER WALLETS
-- ========================
INSERT INTO public.user_wallets (
    id,
    user_id,
    wallet_address,
    encrypted_private_key,
    wallet_type,
    is_primary
)
SELECT
    gen_random_uuid(),
    u.id,
    w.wallet_address,
    w.encrypted_private_key,
    w.wallet_type,
    w.is_primary
FROM
(
    SELECT
        '0xAAA111BBB222',
        'ENCRYPTED_KEY_1',
        'custodial',
        true

    UNION ALL

    SELECT
        '0xCCC333DDD444',
        'ENCRYPTED_KEY_2',
        'external',
        false

    UNION ALL

    SELECT
        '0xEEE555FFF666',
        'ENCRYPTED_KEY_3',
        'external',
        true
) w(wallet_address, encrypted_private_key, wallet_type, is_primary)
JOIN public.users u ON true
LIMIT 3;
