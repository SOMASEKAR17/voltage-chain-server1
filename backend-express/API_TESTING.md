## VoltChain Backend API – Testing Guide

Base URL (local dev): `http://localhost:3000`

All responses are JSON. Unless noted, errors return an object like:

```json
{ "error": "message" }
```

**Test data setup**

**Docker** (postgres + app):

```bash
docker compose up -d
# Apply schema and seed (from project root)
docker compose exec -T postgres psql -U hack -d localdb < schema.sql
docker compose exec -T postgres psql -U hack -d localdb < sample.sql
```

**Local**: Load sample data before testing:

```bash
psql -U hack -d localdb -f schema.sql
psql -U hack -d localdb -f sample.sql
```

After loading **sample.sql**, you get:

| Table | Sample records (from sample.sql) |
|-------|----------------------------------|
| **users** | alice@example.com (0xAAA111), bob@example.com (0xBBB222), charlie@example.com |
| **batteries** | BAT-001 (Tesla, 75Ah), BAT-002 (Panasonic, 60Ah), BAT-003 (LG, 45Ah) |
| **listings** | 3 listings (active/active/draft), prices 12000, 8900, 6500 |
| **user_surveys** | Tesla Model X Pack / E-car / Heavy; Panasonic EB-60 / E-bike / Medium; LG PowerCell / E-bike / Light |
| **user_wallets** | 0xAAA111BBB222, 0xCCC333DDD444, 0xEEE555FFF666 |

**All curl examples in this doc use sample.sql data.** Listing and battery IDs are UUIDs (different each run). Get them with:
- `curl -s http://localhost:3000/api/listings` → use `data[0].id` or `data[0].battery_id`
- `curl -s "http://localhost:3000/api/listings/find?battery_code=BAT-001"` → use `data.listing_id`

---

**Routes overview**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/battery/:id` | Get battery by ID |
| POST | `/api/battery/list` | List battery on marketplace, mint NFT |
| GET | `/api/listings` | Get all listings |
| GET | `/api/listings/find` | Find listing by `?battery_code=` or `?battery_id=` |
| GET | `/api/listings/seed-seller-id` | Get a valid `seller_id` for testing (from sample.sql users) |
| POST | `/api/listings/create-draft` | Create draft listing + placeholder battery |
| GET | `/api/listings/:id` | Get listing by ID |
| GET | `/api/listings/:id/predict-rul` | **ML** RUL prediction (measured capacity + battery) |
| GET | `/api/listings/:id/predict-capacity-survey` | **ML** Survey-only capacity prediction |
| GET | `/api/listings/:id/predict-full` | **ML** Full analysis: survey capacity → RUL |
| POST | `/api/listings/:id/buy` | Purchase listing (NFT transfer) |
| DELETE | `/api/listings/:id` | Delete a listing |
| GET | `/api/predict/health` | **ML** Check FastAPI (prediction service) health |
| GET | `/api/predict/health-status/:soh` | **ML** Health category for SoH % (0–100) |
| POST | `/api/ocr/scan-label` | Scan battery label (multipart) |
| POST | `/api/questionnaire/:listing_id` | Create/update questionnaire (optional `?predict=true`) |
| GET | `/api/questionnaire/:listing_id` | Get questionnaire |
| POST | `/api/wallet/create` | Create custodial wallet |
| POST | `/api/nft/mint` | Mint battery NFT |
| POST | `/api/nft/update-metadata` | Update NFT metadata |
| POST | `/api/nft/transfer` | Transfer NFT |
| POST | `/api/nft/burn` | Burn NFT |
| GET | `/api/nft/:tokenId` | Get NFT on-chain |

---

## Quick start: ML / prediction routes

These routes call the **FastAPI Battery Prediction API** (ML). Ensure FastAPI is running (e.g. `docker compose up -d` or `python run.py` in `fastapi/voltage-chain-server2/`).

### Order of calls to get ML results

1. **Check ML service is up**
   ```bash
   curl -s http://localhost:3000/api/predict/health
   ```
   Expect: `{"status":"ok","message":"Battery Prediction API is healthy ✅"}` or `503` if FastAPI is down.

2. **Get a listing ID** (after loading `schema.sql` + `sample.sql`)
   ```bash
   curl -s http://localhost:3000/api/listings | jq '.data[0].id'
   ```
   Or use the raw JSON and copy one `id` from `data`. Save it as `LISTING_ID` for the next steps.

3. **Questionnaire** – sample.sql already has surveys for all 3 listings. To add/update one (sample.sql-style body):
   ```bash
   LISTING_ID=$(curl -s http://localhost:3000/api/listings | jq -r '.data[0].id')
   curl -X POST "http://localhost:3000/api/questionnaire/$LISTING_ID" \
     -H "Content-Type: application/json" \
     -d '{
       "brand_model": "Tesla Model X Pack",
       "initial_capacity": 75,
       "current_capacity": 68.4,
       "years_owned": 3,
       "primary_application": "E-car",
       "avg_daily_usage": "Heavy",
       "charging_frequency_per_week": 6,
       "typical_charge_level": "20-80",
       "avg_temperature_c": 32.5
     }'
   ```

4. **Run one of the ML routes** (use `LISTING_ID` from step 2):
   ```bash
   LISTING_ID=$(curl -s http://localhost:3000/api/listings | jq -r '.data[0].id')
   ```
   | Goal | Command (sample.sql) |
   |------|----------------------|
   | **Survey-only capacity** | `curl -s "http://localhost:3000/api/listings/$LISTING_ID/predict-capacity-survey"` |
   | **Full analysis** | `curl -s "http://localhost:3000/api/listings/$LISTING_ID/predict-full"` |
   | **RUL (measured)** | `curl -s "http://localhost:3000/api/listings/$LISTING_ID/predict-rul"` |

5. **Health category for a SoH value** (no listing needed)
   ```bash
   curl -s "http://localhost:3000/api/predict/health-status/66.7"
   ```
   Returns: `soh_percentage`, `health_status` (e.g. POOR), `health_description`.

### One-shot example (with sample data)

```bash
# 1. Health check
curl -s http://localhost:3000/api/predict/health

# 2. Get first listing id (requires jq; otherwise use GET /api/listings and copy id manually)
LISTING_ID=$(curl -s http://localhost:3000/api/listings | jq -r '.data[0].id')

# 3. ML: full analysis (survey → predicted capacity → RUL)
curl -s "http://localhost:3000/api/listings/$LISTING_ID/predict-full" | jq .

# 4. ML: survey-only capacity
curl -s "http://localhost:3000/api/listings/$LISTING_ID/predict-capacity-survey" | jq .

# 5. ML: RUL (needs listing with battery + questionnaire; works for sample listings 1–3)
curl -s "http://localhost:3000/api/listings/$LISTING_ID/predict-rul" | jq .
```

### What each ML route returns

- **predict-capacity-survey**: `predicted_current_capacity`, `confidence`, `explanation`, `input_summary` (heuristic/Gemini-based).
- **predict-full**: `survey` (same as above) + `rul` (RUL cycles, health_analysis, recommendations).
- **predict-rul**: Same as `rul` above (RUL, health_analysis, rul_prediction, recommendations).

---

### 1. Battery APIs (`/api/battery`)

- **GET** `/api/battery/:id`
  - **Purpose**: Fetch a single battery by its internal `id`.
  - **Path params**:
    - `id` (string, required): UUID of the battery record.
  - **Response**:
    - `200`:
      - `{ "data": Battery | null }`
  - **Sample** (sample.sql: get battery_id from listings):
    ```bash
    BATTERY_ID=$(curl -s http://localhost:3000/api/listings | jq -r '.data[0].battery_id')
    curl -s "http://localhost:3000/api/battery/$BATTERY_ID"
    ```

- **POST** `/api/battery`
  - **Purpose**: Create a battery record directly.
  - **Body (JSON)**:
    - `battery_code` (string, required)
    - `brand` (string, required)
    - `initial_capacity` (number, optional)
    - `current_capacity` (number, optional)
    - `manufacture_year` (number, optional)
    - `charging_cycles` (number, optional)
  - **Response**:
    - `201`:
      - `{ "data": Battery }`
    - `400`:
      - `{ "error": "invalid payload" }`
  - **Sample** (sample.sql-style: Tesla/BAT-001):
    ```bash
    curl -X POST http://localhost:3000/api/battery \
      -H "Content-Type: application/json" \
      -d '{
        "battery_code": "BAT-004",
        "brand": "Tesla",
        "initial_capacity": 75,
        "current_capacity": 68.4,
        "manufacture_year": 2021,
        "charging_cycles": 420
      }'
    ```

- **POST** `/api/battery/list`
  - **Purpose**: Create a battery for marketplace listing, mint/update NFT, and optionally attach a questionnaire.
  - **Body (JSON)**:
    - `battery_code` (string, required)
    - `brand` (string, required)
    - `initial_capacity` (number, required)
    - `current_capacity` (number, required)
    - `manufacture_year` (number, required)
    - `charging_cycles` (number, optional)
    - `owner_wallet` (string, required)
    - `questionnaire` (optional partial `QuestionnaireData`): `brand_model`, `initial_capacity`, `current_capacity`, `years_owned`, `primary_application` (E-bike, E-car), `avg_daily_usage` (Light, Medium, Heavy), `charging_frequency_per_week`, `typical_charge_level` (20-80, 0-100, Always Full); optional `avg_temperature_c`. Defaults filled from battery when omitted.
  - **Validation**:
    - Missing any of: `battery_code`, `brand`, `initial_capacity`, `current_capacity`, `manufacture_year`, `owner_wallet`
      - → `400` with:
      - `{ "error": "Missing required fields", "required": [...] }`
  - **Behavior**:
    - Computes `health_score` from capacity degradation.
    - Creates battery row in `public.batteries`.
    - Mints or updates NFT via `nftService`.
    - Records history event in `public.battery_history`.
    - If a listing exists for this battery and `questionnaire` is provided, creates/updates a `user_surveys` record.
  - **Response** (`200`):
    ```json
    {
      "success": true,
      "message": "Battery listed successfully on marketplace",
      "data": {
        "battery_id": "<uuid>",
        "battery_code": "BAT-004",
        "health_score": 91.2,
        "predicted_voltage": 0,
        "current_voltage": 0,
        "nft_token_id": "<optional>",
        "is_new_nft": true,
        "listing_url": "/marketplace/<battery_id>"
      }
    }
    ```
  - **Sample** (sample.sql: owner 0xAAA111, Tesla-style questionnaire):
    ```bash
    curl -X POST http://localhost:3000/api/battery/list \
      -H "Content-Type: application/json" \
      -d '{
        "battery_code": "BAT-004",
        "brand": "Tesla",
        "initial_capacity": 75,
        "current_capacity": 68.4,
        "manufacture_year": 2021,
        "charging_cycles": 420,
        "owner_wallet": "0xAAA111",
        "questionnaire": {
          "brand_model": "Tesla Model X Pack",
          "years_owned": 3,
          "primary_application": "E-car",
          "avg_daily_usage": "Heavy",
          "charging_frequency_per_week": 6,
          "typical_charge_level": "20-80"
        }
      }'
    ```

---

### 2. Listing APIs (`/api/listings`)

- **GET** `/api/listings`
  - **Purpose**: Fetch all listings with images and basic battery info.
  - **Response** (`200`, after sample.sql):
    ```json
    {
      "data": [
        { "id": "<uuid>", "battery_id": "<uuid>", "battery_code": "BAT-001", "brand": "Tesla", "price": 12000, "status": "active", "images": [...] },
        { "battery_code": "BAT-002", "brand": "Panasonic", "price": 8900, ... },
        { "battery_code": "BAT-003", "brand": "LG", "price": 6500, "status": "draft", ... }
      ]
    }
    ```
  - **Sample** (sample.sql):
    ```bash
    curl -s http://localhost:3000/api/listings
    ```

- **GET** `/api/listings/:id`
  - **Purpose**: Fetch a single listing with images.
  - **Path params**:
    - `id` (string, required): listing UUID.
  - **Responses**:
    - `200`: `{ "data": ListingWithImages }`
    - `404`: `{ "error": "Listing not found" }`
  - **Sample** (sample.sql: use first listing id):
    ```bash
    LISTING_ID=$(curl -s http://localhost:3000/api/listings | jq -r '.data[0].id')
    curl -s "http://localhost:3000/api/listings/$LISTING_ID"
    ```

- **GET** `/api/listings/find`
  - **Purpose**: Find a listing by battery code or battery ID.
  - **Query params**: `battery_code` (string) **or** `battery_id` (string) – one required.
  - **Responses**:
    - `200`: `{ "success": true, "data": { "listing_id": "<uuid>", "battery_id": "<uuid>" } }`
    - `400`: Missing both params. `404`: No listing found.
  - **Sample** (sample.sql: BAT-001, BAT-002, BAT-003):
    ```bash
    curl -s "http://localhost:3000/api/listings/find?battery_code=BAT-001"
    ```

- **GET** `/api/listings/seed-seller-id`
  - **Purpose**: Return a valid `seller_id` (first user UUID) for testing POST create-draft. Use after loading sample.sql.
  - **Response** (`200`): `{ "seller_id": "<uuid>" }` or `404` if no users.
  - **Sample**:
    ```bash
    curl -s http://localhost:3000/api/listings/seed-seller-id
    ```

- **POST** `/api/listings/create-draft`
  - **Purpose**: Create a draft listing with a placeholder battery (for questionnaire-first flow).
  - **Body (JSON)**:
    - `seller_id` (string, required): user UUID from `GET /api/listings/seed-seller-id`.
    - `questionnaire` (object, required): full `QuestionnaireData`.
  - **Response** (`201`): `{ "success": true, "listing_id": "<uuid>", "questionnaire": UserSurvey }`
  - **Sample** (sample.sql: get seller_id then create draft):
    ```bash
    SELLER_ID=$(curl -s http://localhost:3000/api/listings/seed-seller-id | jq -r '.seller_id')
    curl -X POST http://localhost:3000/api/listings/create-draft \
      -H "Content-Type: application/json" \
      -d "{
        \"seller_id\": \"$SELLER_ID\",
        \"questionnaire\": {
          \"brand_model\": \"Tesla Model X Pack\",
          \"initial_capacity\": 75,
          \"current_capacity\": 68.4,
          \"years_owned\": 3,
          \"primary_application\": \"E-car\",
          \"avg_daily_usage\": \"Heavy\",
          \"charging_frequency_per_week\": 6,
          \"typical_charge_level\": \"20-80\",
          \"avg_temperature_c\": 32
        }
      }"
    ```

- **POST** `/api/listings/:id/buy`
  - **Purpose**: Purchase a listing (transfers battery NFT from seller to buyer).
  - **Body (JSON)**:
    - `buyer_wallet` (string, required): buyer wallet address.
  - **Response** (`200`): `{ "success": true, "message": "Listing purchased successfully", "data": { "txHash": "0x..." } }`
  - **Sample** (sample.sql: buyer 0xBBB222):
    ```bash
    LISTING_ID=$(curl -s http://localhost:3000/api/listings | jq -r '.data[0].id')
    curl -X POST "http://localhost:3000/api/listings/$LISTING_ID/buy" \
      -H "Content-Type: application/json" \
      -d '{"buyer_wallet":"0xBBB222"}'
    ```

- **DELETE** `/api/listings/:id`
  - **Purpose**: Delete a listing by ID.
  - **Responses**:
    - `200`: `{ "success": true, "message": "Listing deleted successfully" }`
    - `404`: `{ "error": "Listing not found" }`
  - **Sample** (sample.sql):
    ```bash
    LISTING_ID=$(curl -s http://localhost:3000/api/listings | jq -r '.data[0].id')
    curl -X DELETE "http://localhost:3000/api/listings/$LISTING_ID"
    ```

---

### 3. OCR APIs (`/api/ocr`)

- **POST** `/api/ocr/scan-label`
  - **Purpose**: Upload an automotive battery label image; Gemini validates and extracts fields, stores image on Cloudinary, and saves to `ocr_records`.
  - **Content type**: `multipart/form-data`
  - **Form fields**:
    - `image` (file, required): JPEG/PNG/WEBP image of a battery label.
    - `user_id` (string, optional): UUID for `ocr_records.user_id`.
    - `battery_id` (string, optional): UUID for `ocr_records.battery_id`.
  - **Validation**:
    - No file → `400`: `{ "success": false, "message": "No image file provided. Please upload an image file.", "data": null }`
    - Non-battery image → `400`: `{ "success": false, "message": "Image is not a valid automotive vehicle battery label...", "data": null }`
    - Invalid MIME type / file too large (max 10MB) → `400` with error message.
  - **Success** (`200`):
    ```json
    {
      "success": true,
      "message": "OCR extraction completed successfully",
      "data": {
        "extracted_text": "Exide 12V 100Ah Made in India",
        "confidence_score": 0.95,
        "image_url": "https://res.cloudinary.com/...",
        "battery_code": "BAT-1001",
        "brand": "Exide",
        "voltage": 12,
        "capacity": 100,
        "manufacture_year": 2021,
        "charging_cycles": null,
        "ocr_record_id": "<uuid>"
      }
    }
    ```
  - **Sample**:
    ```bash
    curl -X POST http://localhost:3000/api/ocr/scan-label \
      -F "image=@./battery-label.jpg"
    # With user/battery linkage (use IDs from GET /api/listings):
    curl -X POST http://localhost:3000/api/ocr/scan-label \
      -F "image=@./battery-label.jpg"
    # Optional: link to user/battery (get ids from GET /api/listings)
    # -F "user_id=$USER_ID" -F "battery_id=$BATTERY_ID"
    ```

---

### 4. Questionnaire APIs (`/api/questionnaire`)

- **POST** `/api/questionnaire/:listing_id`
  - **Purpose**: Create or update a user survey (battery usage questionnaire) for a listing.
  - **Path params**:
    - `listing_id` (string, required): listing UUID.
  - **Query**: `predict=true` (optional) – after saving, run RUL prediction (FastAPI) and return `prediction` in the response; also stores result in `ai_evaluations`.
  - **Body (JSON)** `QuestionnaireData` – required: `brand_model`, `initial_capacity`, `current_capacity`, `years_owned`, `primary_application` (E-bike, E-car), `avg_daily_usage` (Light, Medium, Heavy), `charging_frequency_per_week`, `typical_charge_level` (20-80, 0-100, Always Full). Optional: `avg_temperature_c` (-30 to 100).
  - **Responses**:
    - `400`: `{ "error": "Missing required fields", "required": [...] }` or `{ "error": "listing_id is required" }`
    - `404`: `{ "error": "Listing not found" }`
    - `201`: `{ "data": UserSurvey }` or with `?predict=true`: `{ "data": UserSurvey, "prediction": PredictRulResponse }` (or `"prediction": { "error": "..." }` if FastAPI is down).
  - **Sample** (sample.sql: first listing, Tesla-style survey):
    ```bash
    LISTING_ID=$(curl -s http://localhost:3000/api/listings | jq -r '.data[0].id')
    curl -X POST "http://localhost:3000/api/questionnaire/$LISTING_ID" \
      -H "Content-Type: application/json" \
      -d '{
        "brand_model": "Tesla Model X Pack",
        "initial_capacity": 75,
        "current_capacity": 68.4,
        "years_owned": 3,
        "primary_application": "E-car",
        "avg_daily_usage": "Heavy",
        "charging_frequency_per_week": 6,
        "typical_charge_level": "20-80",
        "avg_temperature_c": 32.5
      }'
    ```

- **GET** `/api/questionnaire/:listing_id`
  - **Purpose**: Fetch user survey for a listing.
  - **Path params**:
    - `listing_id` (string, required)
  - **Responses**:
    - `400`: `{ "error": "listing_id is required" }`
    - `404`: `{ "error": "Questionnaire not found" }`
    - `200`: `{ "data": UserSurvey }`
  - **Sample** (sample.sql):
    ```bash
    LISTING_ID=$(curl -s http://localhost:3000/api/listings | jq -r '.data[0].id')
    curl -s "http://localhost:3000/api/questionnaire/$LISTING_ID"
    ```

---

### 4a. Battery Prediction (FastAPI integration)

The **Voltage Chain Battery Prediction API** (FastAPI, see `fastapi/voltage-chain-server2/`) runs at `http://localhost:8000` by default. Express proxies and maps questionnaire + battery data. Reference: `fastapi/voltage-chain-server2/API_ENDPOINTS_REFERENCE.md`, `SURVEY_ENDPOINT_DOCUMENTATION.md`.

**Which endpoint to use**

| Scenario | Endpoint | Description |
|----------|----------|--------------|
| You have **measured** capacity + battery (e.g. questionnaire has current_capacity) | `GET /api/listings/:id/predict-rul` | RUL from real metrics; requires battery + questionnaire. |
| You have **only survey** (no current capacity) | `GET /api/listings/:id/predict-capacity-survey` | Predicts current capacity from survey (heuristic/Gemini); no battery required. |
| **Full analysis** from survey only | `GET /api/listings/:id/predict-full` | 1) Predict capacity from survey, 2) Run RUL with that capacity; returns both `survey` and `rul`. |

**Recommended flow**

1. User completes **questionnaire**: `POST /api/questionnaire/:listing_id` (optionally `?predict=true` to run RUL and store in `ai_evaluations`).
2. Then call one of:
   - **Measured path**: `GET /api/listings/:id/predict-rul` (needs listing with battery + questionnaire).
   - **Survey-only path**: `GET /api/listings/:id/predict-capacity-survey` (questionnaire only).
   - **Combined path**: `GET /api/listings/:id/predict-full` (survey → predicted capacity → RUL in one response).

**Field mapping (questionnaire → FastAPI)**

- **predict-rul**: `initial_capacity`, `current_capacity` (from questionnaire or battery), `cycle_count` (battery or estimated), `age_days` = years_owned × 365, `ambient_temperature` = avg_temperature_c or 25.
- **predict-capacity-survey**: `listing_id`, `brand_model`, `initial_capacity`, `years_owned`, `primary_application`, `avg_daily_usage`, `charging_frequency_in_week` (= our `charging_frequency_per_week`), `typical_charge_level`, `avg_temperature` (= our `avg_temperature_c` or 25).

**Endpoints**

- **GET** `/api/listings/:id/predict-rul`  
  RUL prediction using battery + questionnaire (measured data).  
  Responses: `200` (full prediction), `400`/`404` (missing data or API error).  
  Sample: `LISTING_ID=$(curl -s http://localhost:3000/api/listings | jq -r '.data[0].id'); curl -s "http://localhost:3000/api/listings/$LISTING_ID/predict-rul"`

- **GET** `/api/listings/:id/predict-capacity-survey`  
  Survey-based capacity prediction only (no measured current capacity).  
  Responses: `200` (`predicted_current_capacity`, `confidence`, `explanation`, `input_summary`), `400` (e.g. questionnaire missing).  
  Sample: `LISTING_ID=$(curl -s http://localhost:3000/api/listings | jq -r '.data[0].id'); curl -s "http://localhost:3000/api/listings/$LISTING_ID/predict-capacity-survey"`

- **GET** `/api/listings/:id/predict-full`  
  Combined: predict capacity from survey, then RUL with that capacity.  
  Response: `200` with `{ "survey": CapacityPredictionResponse, "rul": PredictRulResponse }`.  
  Sample: `LISTING_ID=$(curl -s http://localhost:3000/api/listings | jq -r '.data[0].id'); curl -s "http://localhost:3000/api/listings/$LISTING_ID/predict-full"`

- **GET** `/api/predict/health`  
  Check if FastAPI is reachable.  
  Responses: `200` (status/message), `503` (unavailable).

- **GET** `/api/predict/health-status/:soh`  
  Health category for a SoH percentage (0–100).  
  Path: `soh` float (e.g. 66.7). Responses: `200` (soh_percentage, health_status, health_description), `400` (invalid range), `503` (API unreachable).  
  Sample: `curl -X GET "http://localhost:3000/api/predict/health-status/66.7"`

**Environment**

- `PREDICTION_API_URL` (default `http://localhost:8000`) – set if FastAPI runs elsewhere (e.g. in Docker use `http://fastapi:8000`).

---

### 5. Wallet APIs (`/api/wallet`)

- **POST** `/api/wallet/create`
  - **Purpose**: Create a custodial wallet.
  - **Body**: None.
  - **Response** (`201`):
    ```json
    {
      "success": true,
      "message": "Wallet created successfully",
      "data": {
        "address": "0x...",
        "encryptedPrivateKey": "..."
      }
    }
    ```
  - **Sample**:
    ```bash
    curl -X POST http://localhost:3000/api/wallet/create
    ```

---

### 6. NFT APIs (`/api/nft`)

- **POST** `/api/nft/mint`
  - **Purpose**: Mint a battery NFT on-chain.
  - **Body (JSON)**:
    - `battery_code` (string, required)
    - `owner_wallet` (string, required)
    - `cid` (string, required): IPFS CID for metadata
    - `health_score` (number, optional): defaults to 100
  - **Response** (`200`):
    ```json
    {
      "success": true,
      "message": "Battery NFT minted",
      "data": { "tokenId": "<string>", "txHash": "0x..." }
    }
    ```
  - **Sample** (sample.sql: BAT-001, owner 0xAAA111):
    ```bash
    curl -X POST http://localhost:3000/api/nft/mint \
      -H "Content-Type: application/json" \
      -d '{"battery_code":"BAT-001","owner_wallet":"0xAAA111","cid":"QmPlaceholderCid","health_score":91.2}'
    ```

- **POST** `/api/nft/update-metadata`
  - **Purpose**: Update NFT metadata URI on-chain.
  - **Body (JSON)**:
    - `tokenId` (string, required)
    - `cid` (string, required): new IPFS CID
  - **Response** (`200`):
    ```json
    {
      "success": true,
      "message": "Battery metadata updated",
      "data": { "tokenId": "<string>", "txHash": "0x..." }
    }
    ```
  - **Sample** (use `tokenId` from mint response):
    ```bash
    curl -X POST http://localhost:3000/api/nft/update-metadata \
      -H "Content-Type: application/json" \
      -d '{"tokenId":"1","cid":"QmNewMetadataCid123"}'
    ```

- **POST** `/api/nft/transfer`
  - **Purpose**: Transfer NFT from one address to another.
  - **Body (JSON)**:
    - `tokenId` (string, required)
    - `from` (string, required)
    - `to` (string, required)
  - **Response** (`200`):
    ```json
    {
      "success": true,
      "message": "Battery NFT transferred",
      "data": { "tokenId": "<string>", "txHash": "0x..." }
    }
    ```
  - **Sample** (sample.sql: 0xAAA111 → 0xBBB222):
    ```bash
    curl -X POST http://localhost:3000/api/nft/transfer \
      -H "Content-Type: application/json" \
      -d '{"tokenId":"1","from":"0xAAA111","to":"0xBBB222"}'
    ```

- **POST** `/api/nft/burn`
  - **Purpose**: Burn NFT on-chain.
  - **Body (JSON)**:
    - `tokenId` (string, required)
  - **Response** (`200`):
    ```json
    {
      "success": true,
      "message": "Battery NFT burned",
      "data": { "tokenId": "<string>", "txHash": "0x..." }
    }
    ```
  - **Sample**:
    ```bash
    curl -X POST http://localhost:3000/api/nft/burn \
      -H "Content-Type: application/json" \
      -d '{"tokenId":"1"}'
    ```

- **GET** `/api/nft/:tokenId`
  - **Purpose**: Get NFT on-chain (owner, tokenURI).
  - **Path params**: `tokenId` (string, required)
  - **Response** (`200`):
    ```json
    {
      "success": true,
      "data": {
        "tokenId": "<string>",
        "tokenURI": "https://...",
        "owner": "0x..."
      }
    }
    ```
  - **Sample** (sample.sql: BAT-001 has NFT-1001; use tokenId from mint response):
    ```bash
    curl -s http://localhost:3000/api/nft/1
    ```

**NFT test sequence** (sample.sql: run in order; requires RPC, contract, private key):

```bash
# 1. Mint NFT (sample.sql: BAT-001, 0xAAA111)
curl -s -X POST http://localhost:3000/api/nft/mint \
  -H "Content-Type: application/json" \
  -d '{"battery_code":"BAT-001","owner_wallet":"0xAAA111","cid":"QmPlaceholderCid","health_score":91.2}'
# → Save tokenId from response

# 2. Get NFT on-chain
TOKEN_ID=1   # or from step 1 response
curl -s "http://localhost:3000/api/nft/$TOKEN_ID"

# 3. Update metadata
curl -s -X POST http://localhost:3000/api/nft/update-metadata \
  -H "Content-Type: application/json" \
  -d "{\"tokenId\":\"$TOKEN_ID\",\"cid\":\"QmNewMetadataCid123\"}"

# 4. Transfer (sample.sql: 0xAAA111 → 0xBBB222)
curl -s -X POST http://localhost:3000/api/nft/transfer \
  -H "Content-Type: application/json" \
  -d "{\"tokenId\":\"$TOKEN_ID\",\"from\":\"0xAAA111\",\"to\":\"0xBBB222\"}"

# 5. Burn (optional)
curl -s -X POST http://localhost:3000/api/nft/burn \
  -H "Content-Type: application/json" \
  -d "{\"tokenId\":\"$TOKEN_ID\"}"
```


### 7. Environment & Auth Notes

- **Environment variables** (from `.env`):
  - `PORT` – server port (default `3000`).
  - `DATABASE_URL` – Postgres connection string.
  - `CLOUDINARY_*` – image hosting (listings, OCR label storage).
  - `GEMINI_API_KEY` or `API_KEY` – Gemini API key for OCR.
  - `RPC_URL`, `PRIVATE_KEY`, `CONTRACT_ADDRESS` – for NFT on-chain (Ethereum/Sepolia).
- **Authentication**:
  - Current endpoints do **not** enforce auth at the Express level (no auth middleware in `servers.ts`).
  - If you add auth later, update this document accordingly.

