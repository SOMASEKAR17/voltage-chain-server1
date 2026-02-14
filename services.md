# Services

This document describes the main backend services implemented in `backend-express/src/services` and how to use them.

## batteryService
Location: `backend-express/src/services/batteryService.ts`

Exports:
- `getBatteryStatus(id: string): Promise<Battery | null>` — returns a simple battery status object (stubbed).
- `getBatteryHistory(battery_code: string, brand: string): Promise<BatteryHistoryRecord | null>` — queries DB for battery record and returns id and optional `nft_token_id`.
- `createBattery(payload: Partial<Battery>): Promise<Battery>` — creates a battery record (returns a stubbed object in current implementation).
- `createBatteryForListing(params: CreateBatteryForListingParams): Promise<CreatedBattery>` — inserts a new battery for marketplace listing and returns created id and details.
- `updateBatteryNFT(batteryId: string, tokenId: string, txHash: string): Promise<void>` — marks a battery as minted and updates `nft_token_id`.
- `recordHistoryEvent(params): Promise<void>` — records an event in `battery_history` using battery code + brand lookup.

Notes:
- Functions use the `query` helper from `config/postgres` to execute SQL.
- Types referenced are in `backend-express/src/types`.

## fastApiService
Location: `backend-express/src/services/fastApiService.ts`

Purpose: forwards requests to an external FastAPI ML service (configured via `FASTAPI_URL`).

Exports:
- `forwardToFastApi(path: string, body: any): Promise<any>` — low-level helper that POSTs JSON to `${FASTAPI_URL}${path}` and returns JSON.
- `checkFraud(params): Promise<FraudCheckResult>` — POST `/check-fraud`.
- `predictVoltage(params): Promise<PredictionResult>` — POST `/predict-voltage`.
- `predictFromQuestionnaire(params): Promise<PredictionResult>` — POST `/predict-questionnaire`.
- `validateDescription(params): Promise<ValidateDescriptionResult>` — POST `/validate-description`.

Notes:
- Ensure `FASTAPI_URL` is set in `.env` when using any predictive/fraud endpoints.

## nftService
Location: `backend-express/src/services/nftService.ts`

Exports:
- `fetchNftsForOwner(owner: string): Promise<any[]>` — (stub) returns a list of NFTs for a wallet.
- `mintBatteryNFT(battery_code: string, health_score: number): Promise<{ tokenId: string; txHash: string }>` — mints/fakes an NFT and returns token id + tx hash.
- `updateBatteryHealth(nft_token_id: string, health_score: number): Promise<void>` — update a minted NFT's health metadata (stubbed currently).

Notes:
- This service is currently a simple stub and should be replaced with actual blockchain/alchemy logic if you enable NFT functionality. Configure `ALCHEMY_API_KEY` and related env vars when integrating real minting.

## questionnaireService
Location: `backend-express/src/services/questionnaireService.ts`

Purpose: CRUD for `user_surveys` table (battery usage questionnaires).

Exports:
- `createQuestionnaire(listingId: string, questionnaire: QuestionnaireData): Promise<UserSurvey>` — inserts a new user survey.
- `getQuestionnaireByListingId(listingId: string): Promise<UserSurvey | null>` — fetches survey by listing.
- `updateQuestionnaire(listingId: string, questionnaire: QuestionnaireData): Promise<UserSurvey | null>` — updates existing survey.

Notes:
- Uses `user_surveys` table (schema-aligned). Required: `brand_model`, `initial_capacity`, `current_capacity`, `years_owned`, `primary_application` (E-bike | E-car), `avg_daily_usage` (Light | Medium | Heavy), `charging_frequency_per_week`, `typical_charge_level` (20-80 | 0-100 | Always Full). Optional: `avg_temperature_c`.

## ocrService
Location: `backend-express/src/services/ocrService.ts`

Purpose: Extracts text and battery metadata from uploaded images using `sharp` + `tesseract.js`.

Public exports / usage:
- `ocrService.extractFromFile(fileBuffer: Buffer, originalName?: string): Promise<OCRResult & { battery_code: string; brand?: string; voltage?: number }>` — saves a temp file, preprocesses the image, runs OCR, parses battery code/brand/voltage, and returns an `OCRResult` with parsed fields.
- `ocrService.extractBatteryLabel(imagePath: string): Promise<OCRResult>` — preprocesses an image file path and runs OCR, returning extracted text and metadata.
- `ocrService.terminate(): Promise<void>` — terminates the tesseract worker.

Notes / tips:
- The OCR pipeline performs greyscale, normalization, sharpening and resizing before recognition to improve accuracy.
- Known brand matching uses a small in-file list (e.g., Tesla, Panasonic, LG, Samsung, CATL, BYD, Sony). Extend as needed.
- Temporary files are cleaned up automatically; ensure the process has permission to write to the OS temp directory.

## predictionService
Location: `backend-express/src/services/predictionService.ts`

Purpose: Integrates with the Voltage Chain Battery Prediction API (FastAPI in `fastapi/voltage-chain-server2/`). Reference: `fastapi/voltage-chain-server2/API_ENDPOINTS_REFERENCE.md`, `SURVEY_ENDPOINT_DOCUMENTATION.md`.

Exports:
- `checkPredictionApiHealth(): Promise<{ status, message? } | null>` — GET /api/health.
- `getHealthStatus(sohPercentage: number)` — GET /api/health-status/{soh}.
- `predictRul(payload: PredictRulRequest): Promise<PredictRulResponse>` — POST /api/predict-rul (RUL from measured metrics).
- `predictRulForListing(battery, survey)` — builds payload from battery + questionnaire and calls predictRul.
- `buildSurveyCapacityPayload(listingId, survey): PredictCapacitySurveyRequest` — maps UserSurvey to FastAPI survey body (charging_frequency_in_week, avg_temperature).
- `predictCapacityFromSurvey(payload): Promise<CapacityPredictionResponse>` — POST /api/predict-capacity-survey (survey-based capacity prediction).
- `predictFullFromSurvey(listingId, survey)` — combined workflow: survey capacity prediction then RUL with predicted capacity; returns `{ survey, rul }`.

Notes:
- Base URL: `PREDICTION_API_URL` (default `http://localhost:8000`). When running with Docker Compose use `http://fastapi:8000` for the Express service.
- Survey endpoint uses heuristic/Gemini; optional GEMINI_API_KEY_1..5 in FastAPI .env for fallback keys.

---

If you want, I can expand these docs with example request payloads, sample responses, or add inline JSDoc comments to the service source files.
