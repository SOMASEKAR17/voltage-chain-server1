BEGIN;

-- ===============================
-- USERS
-- ===============================
WITH users_data AS (
    INSERT INTO public.users (email, wallet_address, name)
    VALUES
        ('arjun.kumar@gmail.com', '0xA111AAA111', 'Arjun Kumar'),
        ('neha.sharma@gmail.com', '0xB222BBB222', 'Neha Sharma'),
        ('rohit.verma@gmail.com', '0xC333CCC333', 'Rohit Verma')
    RETURNING id, email
),

-- ===============================
-- BATTERIES
-- ===============================
batteries_data AS (
    INSERT INTO public.batteries
    (battery_code, brand, initial_capacity, current_capacity,
     manufacture_year, charging_cycles, minted, nft_token_id)
    VALUES
        ('BAT-1001', 'Exide', 100.00, 82.50, 2021, 320, false, NULL),
        ('BAT-1002', 'Amaron', 120.00, 91.20, 2022, 210, true, 'NFT-88921'),
        ('BAT-1003', 'Tata Green', 95.00, 69.80, 2020, 480, false, NULL)
    RETURNING id, battery_code
),

-- ===============================
-- LISTINGS
-- ===============================
listings_data AS (
    INSERT INTO public.listings
    (battery_id, seller_id, price, user_voltage,
     predicted_voltage, health_score, status, ai_verified)

    SELECT
        b.id,
        u.id,
        4500.00,
        12.5,
        12.6,
        82.5,
        'active',
        true
    FROM batteries_data b
    JOIN users_data u
        ON b.battery_code = 'BAT-1001'
       AND u.email = 'arjun.kumar@gmail.com'

    UNION ALL

    SELECT
        b.id,
        u.id,
        5200.00,
        12.7,
        12.8,
        90.2,
        'draft',
        false
    FROM batteries_data b
    JOIN users_data u
        ON b.battery_code = 'BAT-1002'
       AND u.email = 'neha.sharma@gmail.com'

    UNION ALL

    SELECT
        b.id,
        u.id,
        3800.00,
        11.9,
        12.0,
        72.0,
        'sold',
        true
    FROM batteries_data b
    JOIN users_data u
        ON b.battery_code = 'BAT-1003'
       AND u.email = 'rohit.verma@gmail.com'

    RETURNING id, battery_id, status
),

-- ===============================
-- BATTERY HISTORY
-- ===============================
battery_history_data AS (
    INSERT INTO public.battery_history
    (battery_id, event_type, voltage, soh_percent, notes)

    SELECT
        id,
        'scan',
        12.6,
        82.5,
        'Initial inspection'
    FROM batteries_data

    UNION ALL

    SELECT
        id,
        'mint',
        12.8,
        90.0,
        'NFT minted on-chain'
    FROM batteries_data
    WHERE battery_code = 'BAT-1002'

    UNION ALL

    SELECT
        id,
        'sale',
        11.9,
        72.0,
        'Battery sold to buyer'
    FROM batteries_data
    WHERE battery_code = 'BAT-1003'

    RETURNING id
),

-- ===============================
-- USER SURVEYS
-- ===============================
user_surveys_data AS (
    INSERT INTO public.user_surveys
    (listing_id, brand_model, initial_capacity, current_capacity,
     years_owned, primary_application, avg_daily_usage, charging_frequency_per_week, typical_charge_level)

    SELECT
        l.id,
        'Exide BAT-1001',
        100.00,
        82.50,
        2,
        'E-bike',
        'Medium',
        7,
        '20-80'
    FROM listings_data l
    WHERE status = 'active'

    UNION ALL

    SELECT
        l.id,
        'Tata Green BAT-1003',
        95.00,
        69.80,
        3,
        'E-car',
        'Heavy',
        3,
        '0-100'
    FROM listings_data l
    WHERE status = 'sold'

    RETURNING id
),

-- ===============================
-- OCR RECORDS
-- ===============================
ocr_data AS (
    INSERT INTO public.ocr_records
    (user_id, battery_id, image_url, extracted_text, confidence_score)

    SELECT
        u.id,
        b.id,
        'https://cdn.app.com/ocr/bat1001.jpg',
        'Exide 12V 100Ah Made in India',
        95.2
    FROM users_data u
    JOIN batteries_data b
      ON u.email = 'arjun.kumar@gmail.com'
     AND b.battery_code = 'BAT-1001'

    UNION ALL

    SELECT
        u.id,
        b.id,
        'https://cdn.app.com/ocr/bat1002.jpg',
        'Amaron 12V 120Ah',
        92.4
    FROM users_data u
    JOIN batteries_data b
      ON u.email = 'neha.sharma@gmail.com'
     AND b.battery_code = 'BAT-1002'

    RETURNING id
),

-- ===============================
-- AI EVALUATIONS
-- ===============================
ai_data AS (
    INSERT INTO public.ai_evaluations
    (listing_id, predicted_voltage, predicted_soh,
     error_margin, explanation, llm_verdict, confidence_score)

    SELECT
        id,
        12.55,
        83.0,
        1.8,
        'Stable discharge curve',
        'Approved',
        91.5
    FROM listings_data
    WHERE status = 'active'

    UNION ALL

    SELECT
        id,
        11.95,
        72.3,
        2.5,
        'Aging cells detected',
        'Approved with warning',
        86.1
    FROM listings_data
    WHERE status = 'sold'

    RETURNING id
),

-- ===============================
-- LISTING IMAGES
-- ===============================
images_data AS (
    INSERT INTO public.listing_images
    (listing_id, image_url, image_type, position)

    SELECT
        id,
        'https://cdn.app.com/img/bat_front.jpg',
        'gallery',
        1
    FROM listings_data

    UNION ALL

    SELECT
        id,
        'https://cdn.app.com/img/bat_label.jpg',
        'label',
        0
    FROM listings_data

    RETURNING id
),

-- ===============================
-- USER WALLETS
-- ===============================
wallets_data AS (
    INSERT INTO public.user_wallets
    (user_id, wallet_address, encrypted_private_key,
     wallet_type, is_primary)

    SELECT
        id,
        '0xAAA111',
        'enc_key_aaa',
        'custodial',
        true
    FROM users_data
    WHERE email = 'arjun.kumar@gmail.com'

    UNION ALL

    SELECT
        id,
        '0xBBB222',
        NULL,
        'external',
        true
    FROM users_data
    WHERE email = 'neha.sharma@gmail.com'

    UNION ALL

    SELECT
        id,
        '0xCCC333',
        'enc_key_ccc',
        'custodial',
        true
    FROM users_data
    WHERE email = 'rohit.verma@gmail.com'

    RETURNING id
)

SELECT 'SEED COMPLETED' AS result;

COMMIT;
