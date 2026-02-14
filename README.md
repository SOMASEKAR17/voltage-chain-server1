## Frontend - https://github.com/SOMASEKAR17/voltage-chain-frontend
## Server1 - https://github.com/SOMASEKAR17/voltage-chain-server1
## Server2 - https://github.com/SOMASEKAR17/voltage-chain-server2

# HackProject

Hackathon prototype: Express backend for battery lifecycle tracking, OCR label scanning, and optional NFT/marketplace integration.

## Prerequisites

- **Node.js** 18+
- **Docker** and **Docker Compose** (for PostgreSQL)
- **PostgreSQL 16** (via Docker or local install)

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy the example env and set your values:

```bash
cp backend-express/.env.example .env
```

Edit `.env` in the project root. Required for the app:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Full Postgres URL, e.g. `postgresql://user:password@host:5432/dbname` |
| Or use separate vars | `POSTGRES_USER`, `POSTGRES_PASSWORD`, and optionally `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB` |

Optional:

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `PREDICTION_API_URL` | Battery Prediction API base URL (default: `http://localhost:8000`). With Docker: `http://fastapi:8000`. |
| `FASTAPI_URL` | Legacy: FastAPI ML service URL (if still used) |
| `ALCHEMY_API_KEY` | For blockchain/NFT (if used) |
| `CLOUDINARY_*` | For image storage (if used) |

**Docker Postgres:** If you use the included `docker-compose.yml`, it creates user `hack` and password `hackpass`. Use in `.env`:

- `DATABASE_URL=postgresql://hack:hackpass@localhost:5432/localdb`

### 3. Start services

**Option A – Run entire project with Docker (recommended)**

Runs Postgres, FastAPI (Battery Prediction API), and the Express app:

```bash
docker compose up -d
```

First time only, apply schema and optional seed:

```bash
docker compose exec -T postgres psql -U hack -d localdb < schema.sql
docker compose exec -T postgres psql -U hack -d localdb < sample.sql
```

- **Express API:** http://localhost:3000  
- **FastAPI (prediction):** http://localhost:8000  
- **Postgres:** localhost:5432 (user `hack`, db `localdb`)

To add optional env (e.g. Cloudinary), create a `.env` in the project root and add `env_file: [".env"]` under the `app` service in `docker-compose.yml`, or set `environment` there.

**Option B – Postgres only (run app locally)**

```bash
docker compose up -d postgres
```

### 4. Apply database schema (first time)

Connect to Postgres and run:

```bash
psql -h localhost -U hack -d localdb -f schema.sql
```

(Or use any Postgres client and execute `schema.sql`.)

### 5. Run the app

**Development (with auto-reload):**

```bash
npm run dev
```

**Production:**

```bash
npm run build
npm run start
```

Server listens on `http://localhost:3000` (or the port set in `PORT`).

---

## API overview

Base URL: `http://localhost:3000/api`

### Battery (`/api/battery`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/:id` | Get battery status by ID |
| POST | `/` | Create a battery (simple payload) |
| POST | `/list` | List battery on marketplace (fraud check, voltage prediction, optional NFT) |

`POST /list` expects a JSON body with at least: `battery_code`, `brand`, `initial_voltage`, `years_used`, `owner_wallet`. Optional: `user_voltage`, `description`, `questionnaire`. The FastAPI service must be running and `FASTAPI_URL` set for fraud/prediction.

### OCR (`/api/ocr`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/scan-label` | Upload a battery label image; field name: `image`. Returns extracted text and parsed battery code/brand/voltage. Max file size 10MB; allowed types: JPEG, PNG, WebP. |

Example:

```bash
curl -X POST http://localhost:3000/api/ocr/scan-label \
  -F "image=@/path/to/label.jpg"
```

---

## Services

Detailed documentation for backend services (battery, OCR, NFT, FastAPI adapter) is available in the repository docs:

- Services docs: [docs/services.md](docs/services.md)

Refer to `backend-express/src/services` for implementation details.


## Battery Prediction API (FastAPI)

The **Voltage Chain Battery Prediction API** (RUL, health status, survey-based capacity) lives in `fastapi/voltage-chain-server2/`. Express proxies it; see `backend-express/API_TESTING.md` § 4a.

- **Run locally:** `cd fastapi/voltage-chain-server2 && python run.py` (port 8000).
- **Run with Docker:** `docker compose up -d` — the `fastapi` service is defined in `docker-compose.yml`. Set `PREDICTION_API_URL=http://fastapi:8000` for the Express app when both run in Compose.
- **Docs:** `fastapi/voltage-chain-server2/API_ENDPOINTS_REFERENCE.md`, `SURVEY_ENDPOINT_DOCUMENTATION.md`, `readme.md`.

## Project structure

```
HackProject/
├── backend-express/       # Express API (listings, questionnaire, OCR, NFT, prediction proxy)
├── fastapi/
│   └── voltage-chain-server2/   # Battery Prediction API (RUL, survey capacity)
├── schema.sql            # Postgres schema
├── docker-compose.yml    # Postgres + FastAPI
├── .env                  # Your env (not committed)
└── package.json
```

---

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Dev | `npm run dev` | Run with ts-node and nodemon (watch `backend-express/src`) |
| Build | `npm run build` | Compile TypeScript to `backend-express/dist/` |
| Start | `npm run start` | Run compiled app with `dotenv/config` (loads `.env`) |

---

## License

ISC
