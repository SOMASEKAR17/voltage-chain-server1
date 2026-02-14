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

After loading `sample.sql`, you get:

| Table | Sample records |
|-------|----------------|
| **users** | alice@example.com (0xAAA111), bob@example.com (0xBBB222), charlie@example.com (no wallet) |
| **batteries** | BAT-001 (Tesla, 75Ah initial / 68.4Ah current, NFT-1001 minted), BAT-002 (Panasonic, 60Ah / 52.1Ah), BAT-003 (LG, 45Ah / 40.2Ah) |
| **listings** | 3 listings with prices ₹12000, ₹8900, ₹6500; statuses: active, active, draft |
| **user_surveys** | Tesla Model X Pack (E-car, Heavy, 6x/week), Panasonic EB-60 (E-bike, Medium, 4x/week), LG PowerCell (E-bike, Light, 3x/week) |
| **ocr_records** | 3 OCR records with confidence scores 94.5%, 91.2%, 88.9% |
| **user_wallets** | 0xAAA111BBB222 (custodial), 0xCCC333DDD444 (external), 0xEEE555FFF666 (external) |

Use `GET /api/listings` or `GET /api/battery/:id` to get real UUIDs for path params.

---

**Routes overview**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/battery/:id` | Get battery by ID |
| POST | `/api/battery` | Create battery |
| POST | `/api/battery/list` | List battery on marketplace, mint NFT |
| GET | `/api/listings` | Get all listings |
| GET | `/api/listings/:id` | Get listing by ID |
| POST | `/api/predict/predict-rul` | RUL prediction from questionnaire data (with optional battery metrics) |
| POST | `/api/predict/predict-capacity-survey` | Survey-only capacity prediction (no measurements needed) |
| POST | `/api/predict/predict-full` | Combined: survey capacity → then RUL (full analysis) |
| GET | `/api/predict/health` | Check Battery Prediction API (FastAPI) health |
| GET | `/api/predict/health-status/:soh` | Health category for SoH % (0–100) |
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

### 1. Battery APIs (`/api/battery`)

- **GET** `/api/battery/:id`
  - **Purpose**: Fetch a single battery by its internal `id`.
  - **Path params**:
    - `id` (string, required): UUID of the battery record.
  - **Response**:
    - `200`:
      - `{ "data": Battery | null }`
  - **Sample** (use battery ID from `GET /api/listings` → `data[].battery_id`):
    ```bash
    curl -X GET http://localhost:3000/api/battery/<battery_id>
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
  - **Sample**:
    ```bash
    curl -X POST http://localhost:3000/api/battery \
      -H "Content-Type: application/json" \
      -d '{
        "battery_code": "BAT-1004",
        "brand": "Exide",
        "initial_capacity": 100,
        "current_capacity": 82.5,
        "manufacture_year": 2021,
        "charging_cycles": 320
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
        "battery_code": "BAT-1004",
        "health_score": 82.5,
        "predicted_voltage": 0,
        "current_voltage": 0,
        "nft_token_id": "<optional>",
        "is_new_nft": true,
        "listing_url": "/marketplace/<battery_id>"
      }
    }
    ```
  - **Sample** (uses sample.sql wallet - alice@example.com):
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
        {
          "id": "<uuid>",
          "battery_id": "<uuid>",
          "battery_code": "BAT-001",
          "brand": "Tesla",
          "price": 12000,
          "predicted_voltage": 380.5,
          "user_voltage": 375.2,
          "health_score": 91.5,
          "status": "active",
          "ai_verified": true,
          "images": [
            { "id": "<uuid>", "image_url": "https://...", "image_type": "gallery", "position": 1 },
            { "id": "<uuid>", "image_url": "https://...", "image_type": "label", "position": 0 }
          ]
        },
        { "battery_code": "BAT-002", "brand": "Panasonic", "status": "active", "price": 8900, ... },
        { "battery_code": "BAT-003", "brand": "LG", "status": "draft", "price": 6500, ... }
      ]
    }
    ```
  - **Sample**:
    ```bash
    curl -X GET http://localhost:3000/api/listings
    ```

- **GET** `/api/listings/:id`
  - **Purpose**: Fetch a single listing with images.
  - **Path params**:
    - `id` (string, required): listing UUID.
  - **Responses**:
    - `200`: `{ "data": ListingWithImages }`
    - `404`: `{ "error": "Listing not found" }`
  - **Sample** (use `id` from `GET /api/listings` response):
    ```bash
    curl -X GET http://localhost:3000/api/listings/<listing_id>
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
         "extracted_text": "Tesla 375V 68Ah Battery Pack",
         "confidence_score": 0.945,
         "image_url": "https://res.cloudinary.com/...",
         "battery_code": "BAT-001",
         "brand": "Tesla",
         "voltage": 375.4,
         "capacity": 68,
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
      -F "image=@./battery-label.jpg" \
      -F "user_id=<user_id>" \
      -F "battery_id=<battery_id>"
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
  - **Sample** (use `listing_id` from `GET /api/listings`):
    ```bash
     curl -X POST http://localhost:3000/api/questionnaire/<listing_id> \
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
  - **Sample** (use `listing_id` from `GET /api/listings`):
    ```bash
    curl -X GET http://localhost:3000/api/questionnaire/<listing_id>
    ```

---

### 4a. Battery Prediction (FastAPI integration)

The **Voltage Chain Battery Prediction API** (FastAPI, see `fastapi/voltage-chain-server2/`) runs at `http://localhost:8000` by default. Express accepts questionnaire data in request body and forwards to FastAPI. Reference: `fastapi/voltage-chain-server2/API_ENDPOINTS_REFERENCE.md`, `SURVEY_ENDPOINT_DOCUMENTATION.md`.

> **🔄 REFACTORED:** Prediction endpoints now accept questionnaire data directly in the request body (POST) instead of requiring a listing ID (GET). This allows predictions **before** listing creation.

**Which endpoint to use**

| Scenario | Endpoint | Description |
|----------|----------|--------------|
| You have **measured** capacity (current_capacity known) | `POST /api/predict/predict-rul` | RUL from real metrics; accepts questionnaire + optional battery data in body. |
| You have **only survey** (no current capacity) | `POST /api/predict/predict-capacity-survey` | Predicts current capacity from survey (heuristic/Gemini); questionnaire in body. |
| **Full analysis** from survey only | `POST /api/predict/predict-full` | 1) Predict capacity from survey, 2) Run RUL with that capacity; returns both `survey` and `rul`. |

**Recommended flow (NEW)**

1. User answers **questionnaire** (no listing required)
2. Call prediction endpoint with questionnaire data in request body:
   - **Measured path**: `POST /api/predict/predict-rul` (if you have current_capacity)
   - **Survey-only path**: `POST /api/predict/predict-capacity-survey` (no current_capacity needed)
   - **Combined path**: `POST /api/predict/predict-full` (survey → predicted capacity → RUL)
3. Show prediction results to user
4. If user approves, create listing with verified data

**Field mapping (questionnaire → FastAPI)**

- **predict-rul**: `initial_capacity`, `current_capacity`, `cycle_count` (from battery.charging_cycles or estimated), `age_days` = years_owned × 365, `ambient_temperature` = avg_temperature_c or 25.
- **predict-capacity-survey**: `listing_id` (temp placeholder), `brand_model`, `initial_capacity`, `years_owned`, `primary_application`, `avg_daily_usage`, `charging_frequency_in_week`, `typical_charge_level`, `avg_temperature`.

**Endpoints**

- **POST** `/api/predict/predict-rul`  
  **Purpose**: RUL prediction from questionnaire data with optional battery metrics.  
  **Body (JSON)**:
  ```json
  {
    "questionnaire": {
      "brand_model": "Tesla Model X Pack",
      "initial_capacity": 75,
      "current_capacity": 68.4,
      "years_owned": 3,
      "primary_application": "E-car",
      "avg_daily_usage": "Heavy",
      "charging_frequency_per_week": 6,
      "typical_charge_level": "20-80",
      "avg_temperature_c": 32.5
    },
    "battery": {
      "charging_cycles": 420
    }
  }
  ```
  **Required fields**: `brand_model`, `initial_capacity`, `current_capacity`, `years_owned`, `primary_application`, `avg_daily_usage`, `charging_frequency_per_week`, `typical_charge_level`  
  **Optional fields**: `avg_temperature_c` (default 25), `battery.charging_cycles` (estimated if not provided)  
  **Responses**: `200` (full prediction), `400` (missing/invalid fields)  
  **Sample**:
  ```bash
  curl -X POST http://localhost:3000/api/predict/predict-rul \
    -H "Content-Type: application/json" \
    -d '{
      "questionnaire": {
        "brand_model": "Tesla Model X Pack",
        "initial_capacity": 75,
        "current_capacity": 68.4,
        "years_owned": 3,
        "primary_application": "E-car",
        "avg_daily_usage": "Heavy",
        "charging_frequency_per_week": 6,
        "typical_charge_level": "20-80",
        "avg_temperature_c": 32.5
      },
      "battery": { "charging_cycles": 420 }
    }'
  ```

- **POST** `/api/predict/predict-capacity-survey`  
  **Purpose**: Survey-based capacity prediction (no measured current capacity needed).  
  **Body (JSON)**: Questionnaire data (same as above but without `current_capacity`)  
  **Response**: `200` with `predicted_current_capacity`, `confidence`, `explanation`, `input_summary`  
  **Sample**:
  ```bash
  curl -X POST http://localhost:3000/api/predict/predict-capacity-survey \
    -H "Content-Type: application/json" \
    -d '{
      "brand_model": "Panasonic EB-60",
      "initial_capacity": 60,
      "years_owned": 4,
      "primary_application": "E-bike",
      "avg_daily_usage": "Medium",
      "charging_frequency_per_week": 4,
      "typical_charge_level": "0-100",
      "avg_temperature_c": 29
    }'
  ```

- **POST** `/api/predict/predict-full`  
  **Purpose**: Combined workflow - predicts capacity from survey, then runs RUL with predicted capacity.  
  **Body (JSON)**: Questionnaire data (without `current_capacity`)  
  **Response**: `200` with `{ "survey": CapacityPredictionResponse, "rul": PredictRulResponse }`  
  **Sample**:
  ```bash
  curl -X POST http://localhost:3000/api/predict/predict-full \
    -H "Content-Type: application/json" \
    -d '{
      "brand_model": "LG PowerCell",
      "initial_capacity": 45,
      "years_owned": 2,
      "primary_application": "E-bike",
      "avg_daily_usage": "Light",
      "charging_frequency_per_week": 3,
      "typical_charge_level": "Always Full",
      "avg_temperature_c": 26.8
    }'
  ```

- **GET** `/api/predict/health`  
  Check if FastAPI is reachable.  
  Responses: `200` (status/message), `503` (unavailable).

- **GET** `/api/predict/health-status/:soh`  
  Health category for a SoH percentage (0–100).  
  Path: `soh` float (e.g. 66.7). Responses: `200` (soh_percentage, health_status, health_description), `400` (invalid range), `503` (API unreachable).  
  Sample: `curl -X GET "http://localhost:3000/api/predict/health-status/66.7"`

**Environment**

- `PREDICTION_API_URL` (default `http://localhost:8000`) – set if FastAPI runs elsewhere (e.g. in Docker use `http://fastapi:8000`).

**Migration from old API**

If you were using the old listing-based endpoints:
- ❌ Old: `GET /api/listings/:id/predict-rul` (required listing ID)
- ✅ New: `POST /api/predict/predict-rul` (questionnaire data in body)

Benefits:
- ✅ Predictions work **before** listing creation
- ✅ No database dependencies
- ✅ Simpler workflow
- ✅ Easier testing

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
   - **Sample** (uses sample.sql battery/wallet - alice@example.com):
     ```bash
     curl -X POST http://localhost:3000/api/nft/mint \
       -H "Content-Type: application/json" \
       -d '{"battery_code":"BAT-001","owner_wallet":"0xAAA111","cid":"QmPlaceholderCid","health_score":91.5}'
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
   - **Sample** (sample.sql wallets: Alice 0xAAA111 → Bob 0xBBB222):
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
   - **Sample** (use numeric `tokenId` from mint response; sample.sql BAT-001 has NFT-1001 minted):
    ```bash
    curl -X GET http://localhost:3000/api/nft/1
    ```

**NFT test sequence** (run in order; requires RPC, contract, private key):

```bash
# 1. Mint NFT (using sample.sql data)
curl -X POST http://localhost:3000/api/nft/mint \
  -H "Content-Type: application/json" \
  -d '{"battery_code":"BAT-002","owner_wallet":"0xBBB222","cid":"QmPlaceholderCid","health_score":86.2}'
# → Save tokenId from response

# 2. Get NFT on-chain
curl -X GET http://localhost:3000/api/nft/<tokenId>

# 3. Update metadata
curl -X POST http://localhost:3000/api/nft/update-metadata \
  -H "Content-Type: application/json" \
  -d '{"tokenId":"<tokenId>","cid":"QmNewMetadataCid123"}'

# 4. Transfer (Alice → Bob using sample.sql wallets)
curl -X POST http://localhost:3000/api/nft/transfer \
  -H "Content-Type: application/json" \
  -d '{"tokenId":"<tokenId>","from":"0xAAA111","to":"0xBBB222"}'

# 5. Burn (optional; destroys NFT)
curl -X POST http://localhost:3000/api/nft/burn \
  -H "Content-Type: application/json" \
  -d '{"tokenId":"<tokenId>"}'
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

