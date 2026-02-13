# Battery NFT Marketplace – Express Backend

## Overview

This backend handles:

- User authentication
- OCR extraction
- Battery listing logic
- Communication with ML server (FastAPI)
- LLM validation
- NFT minting via Alchemy
- Marketplace approval flow

---

## Flow

1. User submits battery data
2. Express performs:
   - OCR extraction (if image uploaded)
   - Validates input
3. Sends data to FastAPI server
4. Receives:
   - Historical data
   - Predicted voltage
5. Compare with user-provided voltage
6. If mismatch:
   - Ask for explanation
   - Pass to LLM validator
7. If approved:
   - Mint NFT via Alchemy
   - Save to MongoDB
   - List in marketplace

---

## Smart Contract Interaction

- Uses Alchemy RPC
- ethers.js to mint NFT
- Ownership transfer requires signature

---

## Endpoints

POST /auth/register  
POST /auth/login  

POST /battery/list  
POST /battery/verify-voltage  
GET /battery/:id  

POST /battery/llm-validate  

---

## Environment Variables

MONGO_URI=
JWT_SECRET=
ALCHEMY_RPC=
CONTRACT_ADDRESS=
FASTAPI_URL=
LLM_API_KEY=

---

## Future Scope

- Escrow mechanism
- Fraud detection scoring
- Reputation system
