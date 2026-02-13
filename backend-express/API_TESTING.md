## VoltChain Backend API – Testing Guide

Base URL (local dev): `http://localhost:3000`

All responses are JSON. Unless noted, errors return an object like:

```json
{ "error": "message" }
```

---

### 1. Battery APIs (`/api/battery`)

- **GET** `/api/battery/:id`
  - **Purpose**: Fetch a single battery by its internal `id`.
  - **Path params**:
    - `id` (string, required): UUID of the battery record.
  - **Response**:
    - `200`:
      - `{ "data": Battery | null }`
  - **Sample**:
    ```bash
    curl -X GET http://localhost:3000/api/battery/00000000-0000-0000-0000-000000000000
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
        "battery_code": "BAT-001",
        "brand": "Tesla",
        "initial_capacity": 100,
        "current_capacity": 95,
        "manufacture_year": 2023,
        "charging_cycles": 10
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
        "battery_code": "BAT-001",
        "health_score": 97.5,
        "predicted_voltage": 0,
        "current_voltage": 0,
        "nft_token_id": "<optional>",
        "is_new_nft": true,
        "listing_url": "/marketplace/<battery_id>"
      }
    }
    ```
  - **Sample**:
    ```bash
    curl -X POST http://localhost:3000/api/battery/list \
      -H "Content-Type: application/json" \
      -d '{
        "battery_code": "BAT-001",
        "brand": "Tesla",
        "initial_capacity": 100,
        "current_capacity": 90,
        "manufacture_year": 2022,
        "charging_cycles": 50,
        "owner_wallet": "0xabc123...",
        "questionnaire": {
          "years_used": 2,
          "first_owner": true,
          "use_case": "EV",
          "charging_frequency": "daily"
        }
      }'
    ```

---

### 2. Listing APIs (`/api/listings`)

- **GET** `/api/listings`
  - **Purpose**: Fetch all listings with images and basic battery info.
  - **Response** (`200`):
    ```json
    {
      "data": [
        {
          "id": "<listing_id>",
          "battery_id": "<battery_id>",
          "battery_code": "BAT-001",
          "brand": "Tesla",
          "price": 1234.56,
          "predicted_voltage": 0,
          "user_voltage": 0,
          "health_score": 95,
          "status": "draft",
          "ai_verified": false,
          "images": [
            {
              "id": "<image_id>",
              "image_url": "https://...",
              "image_type": "gallery",
              "position": 0
            }
          ]
        }
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
  - **Sample**:
    ```bash
    curl -X GET http://localhost:3000/api/listings/00000000-0000-0000-0000-000000000000
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
        "extracted_text": "...",
        "confidence_score": 0.95,
        "image_url": "https://res.cloudinary.com/...",
        "battery_code": "BAT-123",
        "brand": "Tesla",
        "voltage": 400,
        "capacity": 100,
        "manufacture_year": 2022,
        "charging_cycles": 150,
        "ocr_record_id": "<uuid>"
      }
    }
    ```
  - **Sample**:
    ```bash
    curl -X POST http://localhost:3000/api/ocr/scan-label \
      -F "image=@/path/to/battery-label.jpg"
    curl -X POST http://localhost:3000/api/ocr/scan-label \
      -F "image=@/path/to/battery-label.jpg" \
      -F "user_id=<user-uuid>" \
      -F "battery_id=<battery-uuid>"
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
  - **Sample**:
    ```bash
    curl -X POST http://localhost:3000/api/questionnaire/00000000-0000-0000-0000-000000000000 \
      -H "Content-Type: application/json" \
      -d '{
        "years_used": 3,
        "first_owner": false,
        "use_case": "home storage",
        "charging_frequency": "weekly"
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
  - **Sample**:
    ```bash
    curl -X GET http://localhost:3000/api/questionnaire/00000000-0000-0000-0000-000000000000
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

### 6. Environment & Auth Notes

- **Environment variables** (from `.env`):
  - `PORT` – server port (default `3000`).
  - `DATABASE_URL` – Postgres connection string.
  - `CLOUDINARY_*` – image hosting (listings, OCR label storage).
  - `GEMINI_API_KEY` or `API_KEY` – Gemini API key for OCR label scanning.
- **Authentication**:
  - Current endpoints do **not** enforce auth at the Express level (no auth middleware in `servers.ts`).
  - If you add auth later, update this document accordingly.

