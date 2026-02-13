## VoltChain Backend API – Testing Guide

Base URL (local dev): `http://localhost:3000`

All responses are JSON. Unless noted, errors return an object like:

```json
{ "error": "message" }
```

**Test data setup**

Load sample data before testing:

```bash
psql -U hack -d localdb -f sample.sql
```

After loading, you get:

| Table | Sample records |
|-------|----------------|
| **users** | arjun.kumar@gmail.com (0xA111AAA111), neha.sharma@gmail.com (0xB222BBB222), rohit.verma@gmail.com (0xC333CCC333) |
| **batteries** | BAT-1001 (Exide, 100Ah), BAT-1002 (Amaron, 120Ah, NFT-88921), BAT-1003 (Tata Green, 95Ah) |
| **listings** | BAT-1001→active ₹4500, BAT-1002→draft ₹5200, BAT-1003→sold ₹3800 |
| **usage_surveys** | Electric Scooter/Daily (active), Solar Backup/Weekly (sold) |
| **ocr_records** | Exide 12V 100Ah, Amaron 12V 120Ah |
| **user_wallets** | 0xAAA111, 0xBBB222, 0xCCC333 |

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
| POST | `/api/ocr/scan-label` | Scan battery label (multipart) |
| POST | `/api/questionnaire/:listing_id` | Create/update questionnaire |
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
    - `questionnaire` (optional object):
      - `years_used` (number, optional)
      - `first_owner` (boolean, optional)
      - `use_case` (string, optional)
      - `charging_frequency` (string, optional)
  - **Validation**:
    - Missing any of: `battery_code`, `brand`, `initial_capacity`, `current_capacity`, `manufacture_year`, `owner_wallet`
      - → `400` with:
      - `{ "error": "Missing required fields", "required": [...] }`
  - **Behavior**:
    - Computes `health_score` from capacity degradation.
    - Creates battery row in `public.batteries`.
    - Mints or updates NFT via `nftService`.
    - Records history event in `public.battery_history`.
    - If a listing exists for this battery and `questionnaire` is provided, creates/updates a `usage_surveys` record.
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
  - **Sample** (uses sample.sql wallet):
    ```bash
    curl -X POST http://localhost:3000/api/battery/list \
      -H "Content-Type: application/json" \
      -d '{
        "battery_code": "BAT-1004",
        "brand": "Exide",
        "initial_capacity": 100,
        "current_capacity": 82.5,
        "manufacture_year": 2021,
        "charging_cycles": 320,
        "owner_wallet": "0xA111AAA111",
        "questionnaire": {
          "years_used": 2,
          "first_owner": true,
          "use_case": "Electric Scooter",
          "charging_frequency": "Daily"
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
          "battery_code": "BAT-1001",
          "brand": "Exide",
          "price": 4500,
          "predicted_voltage": 12.6,
          "user_voltage": 12.5,
          "health_score": 82.5,
          "status": "active",
          "ai_verified": true,
          "images": [
            { "id": "<uuid>", "image_url": "https://...", "image_type": "gallery", "position": 1 },
            { "id": "<uuid>", "image_url": "https://...", "image_type": "label", "position": 0 }
          ]
        },
        { "battery_code": "BAT-1002", "brand": "Amaron", "status": "draft", "price": 5200, ... },
        { "battery_code": "BAT-1003", "brand": "Tata Green", "status": "sold", "price": 3800, ... }
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
      -F "image=@./battery-label.jpg" \
      -F "user_id=<user_id>" \
      -F "battery_id=<battery_id>"
    ```

---

### 4. Questionnaire APIs (`/api/questionnaire`)

- **POST** `/api/questionnaire/:listing_id`
  - **Purpose**: Create or update a usage questionnaire for a listing.
  - **Path params**:
    - `listing_id` (string, required): listing UUID.
  - **Body (JSON)** `QuestionnaireData`:
    - `years_used` (number, optional)
    - `first_owner` (boolean, optional)
    - `use_case` (string, optional)
    - `charging_frequency` (string, optional)
  - **Responses**:
    - `400`: `{ "error": "listing_id is required" }`
    - `404`: `{ "error": "Listing not found" }`
    - `201`: `{ "data": UsageSurvey }`
  - **Sample** (use `listing_id` from `GET /api/listings`; body matches sample.sql usage_surveys):
    ```bash
    curl -X POST http://localhost:3000/api/questionnaire/<listing_id> \
      -H "Content-Type: application/json" \
      -d '{
        "years_used": 2,
        "first_owner": true,
        "use_case": "Electric Scooter",
        "charging_frequency": "Daily"
      }'
    ```

- **GET** `/api/questionnaire/:listing_id`
  - **Purpose**: Fetch questionnaire for a listing.
  - **Path params**:
    - `listing_id` (string, required)
  - **Responses**:
    - `400`: `{ "error": "listing_id is required" }`
    - `404`: `{ "error": "Questionnaire not found" }`
    - `200`: `{ "data": UsageSurvey }`
  - **Sample** (use `listing_id` from `GET /api/listings`):
    ```bash
    curl -X GET http://localhost:3000/api/questionnaire/<listing_id>
    ```

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
  - **Sample** (uses sample.sql battery/wallet):
    ```bash
    curl -X POST http://localhost:3000/api/nft/mint \
      -H "Content-Type: application/json" \
      -d '{"battery_code":"BAT-1001","owner_wallet":"0xA111AAA111","cid":"QmPlaceholderCid","health_score":82.5}'
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
  - **Sample** (sample.sql wallets: Arjun 0xA111AAA111 → Neha 0xB222BBB222):
    ```bash
    curl -X POST http://localhost:3000/api/nft/transfer \
      -H "Content-Type: application/json" \
      -d '{"tokenId":"1","from":"0xA111AAA111","to":"0xB222BBB222"}'
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
  - **Sample** (use numeric `tokenId` from mint response; sample.sql BAT-1002 has NFT-88921 on-chain):
    ```bash
    curl -X GET http://localhost:3000/api/nft/1
    ```

**NFT test sequence** (run in order; requires RPC, contract, private key):

```bash
# 1. Mint NFT
curl -X POST http://localhost:3000/api/nft/mint \
  -H "Content-Type: application/json" \
  -d '{"battery_code":"BAT-1001","owner_wallet":"0xA111AAA111","cid":"QmPlaceholderCid","health_score":82.5}'
# → Save tokenId from response

# 2. Get NFT on-chain
curl -X GET http://localhost:3000/api/nft/<tokenId>

# 3. Update metadata
curl -X POST http://localhost:3000/api/nft/update-metadata \
  -H "Content-Type: application/json" \
  -d '{"tokenId":"<tokenId>","cid":"QmNewMetadataCid123"}'

# 4. Transfer (Arjun → Neha)
curl -X POST http://localhost:3000/api/nft/transfer \
  -H "Content-Type: application/json" \
  -d '{"tokenId":"<tokenId>","from":"0xA111AAA111","to":"0xB222BBB222"}'

# 5. Burn (optional; destroys NFT)
curl -X POST http://localhost:3000/api/nft/burn \
  -H "Content-Type: application/json" \
  -d '{"tokenId":"<tokenId>"}'
```

---

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

