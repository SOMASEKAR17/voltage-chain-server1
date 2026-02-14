BEGIN;

-- ========================
-- USERS
-- ========================
INSERT INTO public.users (id, email, wallet_address, name)
VALUES
(gen_random_uuid(), 'alice@example.com', '0xAAA111', 'Alice'),
(gen_random_uuid(), 'bob@example.com',   '0xBBB222', 'Bob'),
(gen_random_uuid(), 'charlie@example.com', NULL,    'Charlie');

-- ========================
-- BATTERIES
-- ========================
INSERT INTO public.batteries (
    id, battery_code, brand,
    initial_capacity, current_capacity,
    manufacture_year, charging_cycles,
    nft_token_id, minted
)
VALUES
(gen_random_uuid(), 'BAT-001', 'Tesla',     75.00, 68.40, 2021, 420, 'NFT-1001', true),
(gen_random_uuid(), 'BAT-002', 'Panasonic', 60.00, 52.10, 2020, 610, NULL, false),
(gen_random_uuid(), 'BAT-003', 'LG',        45.00, 40.20, 2022, 210, NULL, false);

-- ========================
-- LISTINGS
-- ========================
INSERT INTO public.listings (
    id, battery_id, seller_id,
    price, predicted_voltage, user_voltage,
    health_score, status, ai_verified
)
SELECT
    gen_random_uuid(),
    b.id,
    u.id,
    l.price,
    l.predicted_voltage,
    l.user_voltage,
    l.health_score,
    l.status,
    l.ai_verified
FROM
(
    SELECT
        12000.00 AS price,
        380.5 AS predicted_voltage,
        375.2 AS user_voltage,
        91.5 AS health_score,
        'active' AS status,
        true AS ai_verified

    UNION ALL

    SELECT
        8900.00,
        360.1,
        355.4,
        86.2,
        'active',
        false

    UNION ALL

    SELECT
        6500.00,
        320.0,
        315.6,
        79.4,
        'draft',
        false
) l
JOIN public.batteries b ON true
JOIN public.users u ON true
LIMIT 3;

-- ========================
-- USER SURVEYS
-- ========================
INSERT INTO public.user_surveys (
    id, listing_id,
    brand_model,
    initial_capacity, current_capacity,
    years_owned,
    primary_application,
    avg_daily_usage,
    charging_frequency_per_week,
    typical_charge_level,
    avg_temperature_c
)
SELECT
    gen_random_uuid(),
    ls.id,
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
        75.0 AS initial_capacity,
        68.4 AS current_capacity,
        3 AS years_owned,
        'E-car' AS primary_application,
        'Heavy' AS avg_daily_usage,
        6 AS charging_frequency_per_week,
        '20-80' AS typical_charge_level,
        32.5 AS avg_temperature_c

    UNION ALL

    SELECT
        'Panasonic EB-60',
        60.0,
        52.1,
        4,
        'E-bike',
        'Medium',
        4,
        '0-100',
        29.0

    UNION ALL

    SELECT
        'LG PowerCell',
        45.0,
        40.2,
        2,
        'E-bike',
        'Light',
        3,
        'Always Full',
        26.8
) s
JOIN public.listings ls ON true
LIMIT 3;

-- ========================
-- BATTERY HISTORY
-- ========================
INSERT INTO public.battery_history (
    id, battery_id,
    event_type, voltage, soh_percent,
    notes, ipfs_hash
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
        375.4 AS voltage,
        92.1 AS soh_percent,
        'Initial inspection passed' AS notes,
        'QmABC123' AS ipfs_hash

    UNION ALL

    SELECT
        'maintenance',
        360.2,
        88.5,
        'Minor balancing',
        'QmDEF456'

    UNION ALL

    SELECT
        'resale_check',
        315.6,
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
    id, user_id, battery_id,
    image_url, extracted_text, confidence_score
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
-- AI EVALUATIONS (FIXED)
-- ========================
INSERT INTO public.ai_evaluations (
    id, listing_id,
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
        378.1 AS predicted_voltage,
        92.0 AS predicted_soh,
        1.5 AS error_margin,
        'Battery health above average' AS explanation,
        'Approved' AS llm_verdict,
        95.2 AS confidence_score

    UNION ALL

    SELECT
        359.5,
        87.0,
        2.1,
        'Minor degradation detected',
        'Approved',
        92.6

    UNION ALL

    SELECT
        318.0,
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
    id, listing_id,
    image_url, image_type, position
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
    id, user_id,
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
        '0xAAA111BBB222' AS wallet_address,
        'ENC_KEY_1' AS encrypted_private_key,
        'custodial' AS wallet_type,
        true AS is_primary

    UNION ALL

    SELECT
        '0xCCC333DDD444',
        'ENC_KEY_2',
        'external',
        false

    UNION ALL

    SELECT
        '0xEEE555FFF666',
        'ENC_KEY_3',
        'external',
        true
) w
JOIN public.users u ON true
LIMIT 3;

COMMIT;
