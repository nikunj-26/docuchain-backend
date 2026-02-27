# Doc Verify Backend - Complete API Reference

**Base URL:** `http://localhost:5000`
**Authentication:** JWT Bearer Token (1 hour expiration)

---

## Table of Contents

1. [Health Check](#health-check)
2. [Authentication - Email](#authentication---email)
3. [Authentication - Wallet](#authentication---wallet)
4. [Documents](#documents)

---

## Health Check

### GET /health

Check if server is running.

**Request:**

```http
GET /health HTTP/1.1
Host: localhost:5000
```

**Response (200):**

```json
{
  "status": "healthy",
  "timestamp": "2026-02-24T18:00:00.000Z"
}
```

---

## Authentication - Email

### POST /auth/register

Register a new user with email, password, and wallet verification.

**Prerequisites:**

1. User must first call GET /auth/nonce to get a nonce
2. User signs the message with their wallet
3. User submits registration with signature

**Request:**

```http
POST /auth/register HTTP/1.1
Host: localhost:5000
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "wallet": "0x1234567890123456789012345678901234567890",
  "signature": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1c"
}
```

**Parameters:**

- `email` (string, required): User email address (must be unique)
- `password` (string, required): Minimum 6 characters
- `wallet` (string, required): Ethereum wallet address (must be unique)
- `signature` (string, required): Wallet signature of the nonce message

**Response (201):**

```json
{
  "message": "User registered successfully",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "wallet_address": "0x1234567890123456789012345678901234567890"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**

- 400: Email, password, wallet, and signature are required
- 400: Password must be at least 6 characters
- 400: Invalid wallet address
- 400: Nonce not found or expired. Please request a new nonce.
- 401: Invalid signature
- 409: Email already exists
- 409: Wallet address already registered

---

### POST /auth/login

Login with email and password to get JWT token.

**Request:**

```http
POST /auth/login HTTP/1.1
Host: localhost:5000
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Parameters:**

- `email` (string, required): Registered email
- `password` (string, required): User password

**Response (200):**

```json
{
  "message": "Login successful",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "wallet_address": "0x1234567890123456789012345678901234567890"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**

- 400: Email and password are required
- 401: Invalid email or password

---

## Authentication - Wallet

### GET /auth/nonce

Get nonce and message to sign for wallet authentication.

**Request:**

```http
GET /auth/nonce?wallet=0x1234567890123456789012345678901234567890 HTTP/1.1
Host: localhost:5000
```

**Query Parameters:**

- `wallet` (string, required): Ethereum address (0x + 40 hex characters)

**Response (200):**

```json
{
  "message": "Nonce generated successfully",
  "message_to_sign": "Welcome to Doc Verify!\n\nPlease sign this message to authenticate:\n\na1b2c3d4e5f6g7h8i9j0",
  "nonce": "a1b2c3d4e5f6g7h8i9j0"
}
```

**Notes:**

- Nonce expires after 10 minutes
- Sign the `message_to_sign` with your wallet
- Use the returned signature in wallet-login endpoint

**Errors:**

- 400: Wallet address is required
- 400: Invalid wallet address format

---

### POST /auth/wallet-login

Login with wallet signature. User must be registered first.

**Prerequisites:**

1. User must already have an account (registered via POST /auth/register)
2. User must call GET /auth/nonce to get a nonce
3. User signs the message with their wallet

**Request:**

```http
POST /auth/wallet-login HTTP/1.1
Host: localhost:5000
Content-Type: application/json

{
  "wallet": "0x1234567890123456789012345678901234567890",
  "signature": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1c"
}
```

**Parameters:**

- `wallet` (string, required): Ethereum address
- `signature` (string, required): EIP-191 signed message (sign the message_to_sign from GET /auth/nonce)

**Signature Generation (JavaScript):**

```javascript
// Using ethers.js
const signer = await provider.getSigner();
const signature = await signer.signMessage(message_to_sign);
```

**Response (200):**

```json
{
  "message": "Wallet login successful",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "wallet_address": "0x1234567890123456789012345678901234567890"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**

- 400: Wallet and signature are required
- 400: Invalid wallet address format
- 400: Nonce not found or expired. Please request a new nonce.
- 401: Invalid signature
- 404: No account found for this wallet. Please register first.

---

## Documents

All document endpoints require JWT authentication via `Authorization: Bearer <token>` header.

### POST /documents

Create a new document with file upload.

**Requires:**

- JWT token from login (user must have wallet address)
- PDF file (max 20MB)

**Request:**

```http
POST /documents HTTP/1.1
Host: localhost:5000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: multipart/form-data; boundary=----Boundary

------Boundary
Content-Disposition: form-data; name="title"

My Important Document
------Boundary
Content-Disposition: form-data; name="file"; filename="report.pdf"
Content-Type: application/pdf

[binary PDF content]
------Boundary--
```

**Form Parameters:**

- `title` (string, required): Document title (non-empty)
- `file` (file, required): PDF file (max 20MB)

**Response (201):**

```json
{
  "documentId": "550e8400-e29b-41d4-a716-446655440000",
  "blockchainDocumentId": 1,
  "version": 1,
  "txHash": "0x88e2b0d69b299d2ab3546c6740ff97d380bfa5666fb590090cfb0576ad7877b1"
}
```

**Flow:**

1. Validates JWT
2. Validates file (PDF, ≤20MB)
3. Generates SHA256 hash of original file
4. Encrypts file using AES-256-GCM (backend-managed)
5. Uploads encrypted binary to IPFS (Pinata)
6. Creates on blockchain
7. Saves to database
8. Returns documentId, version, and transaction hash

**Encryption:**

- Uploaded PDFs are encrypted using AES-256-GCM before being uploaded to IPFS.
- Encryption is fully backend-managed and transparent to the client.
- IPFS stores only encrypted binary data; the original PDF is never exposed to IPFS.
- `file_hash` represents the SHA256 hash of the **original** PDF (before encryption) for integrity verification.
- No change in request or response format; encryption is internal.

**Errors:**

- 400: Document title is required
- 400: PDF file is required
- 400: File must be a PDF
- 400: File size exceeds 20MB limit
- 400: User must have a wallet address to create documents
- 401: Authorization header is missing
- 401: Invalid token
- 404: User not found
- 500: Failed to create document

---

### GET /documents

List all documents for authenticated user.

**Request:**

```http
GET /documents HTTP/1.1
Host: localhost:5000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**

```json
{
  "documents": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "My Important Document",
      "version_count": "2",
      "created_at": "2026-02-24T10:30:00.000Z"
    },
    {
      "id": "660f9511-f30c-52e5-b827-557766551111",
      "title": "Contract",
      "version_count": "1",
      "created_at": "2026-02-23T15:20:00.000Z"
    }
  ]
}
```

**Query Database:** Documents table with version count via LEFT JOIN
**Order:** By created_at DESC (newest first)

**Errors:**

- 401: Authorization header is missing
- 401: Invalid token
- 500: Failed to retrieve documents

---

### GET /documents/:id

Get a single document with all its versions.

**Request:**

```http
GET /documents/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
Host: localhost:5000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**URL Parameters:**

- `id` (UUID, required): Document UUID

**Response (200):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "My Important Document",
  "blockchainDocumentId": 1,
  "createdAt": "2026-02-24T10:30:00.000Z",
  "versions": [
    {
      "versionNumber": 1,
      "ipfsCid": "bafkreideue5fbwlcw4jbgw2s3oxfalrr7h64n4apms4btwhdkrjkgavcte",
      "fileHash": "64a13a50d962b712135b52dbae502e31f9fdc6f00f64b819d8e35452a302a299",
      "txHash": "0x88e2b0d69b299d2ab3546c6740ff97d380bfa5666fb590090cfb0576ad7877b1",
      "createdAt": "2026-02-24T10:30:00.000Z"
    },
    {
      "versionNumber": 2,
      "ipfsCid": "bafkreig7h45jhk3lk4j5h6k7l8k9l0k1l2k3l4k5l6k7l8k9l0k1l2k3l4",
      "fileHash": "a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8a9b0c1d2",
      "txHash": "0x99f3c1e8ac3bb3ec4657d7841gg08e491cgb6777gc701101dfc1687be8988c2",
      "createdAt": "2026-02-24T11:45:00.000Z"
    }
  ]
}
```

**Query Database:** Documents + document_versions tables
**Versions Order:** By version_number ASC

**Errors:**

- 400: Invalid document ID format
- 401: Authorization header is missing
- 401: Invalid token
- 403: You do not have permission to access this document
- 404: Document not found
- 500: Failed to retrieve document

---

### POST /documents/:id/version

Add a new version to an existing document.

**Request:**

```http
POST /documents/550e8400-e29b-41d4-a716-446655440000/version HTTP/1.1
Host: localhost:5000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: multipart/form-data; boundary=----Boundary

------Boundary
Content-Disposition: form-data; name="file"; filename="report_v2.pdf"
Content-Type: application/pdf

[binary PDF content]
------Boundary--
```

**URL Parameters:**

- `id` (UUID, required): Document UUID

**Form Parameters:**

- `file` (file, required): PDF file (max 20MB)

**Response (201):**

```json
{
  "documentId": "550e8400-e29b-41d4-a716-446655440000",
  "version": 2,
  "txHash": "0x99f3c1e8ac3bb3ec4657d7841gg08e491cgb6777gc701101dfc1687be8988c2"
}
```

**Flow:**

1. Validates JWT
2. Checks document exists and belongs to user
3. Validates file (PDF, ≤20MB)
4. Generates SHA256 hash of original file
5. Encrypts file using AES-256-GCM (backend-managed)
6. Uploads encrypted binary to IPFS (Pinata)
7. Adds version on blockchain
8. Saves to database (version_number = MAX + 1)
9. Returns documentId, new version number, and transaction hash

**Encryption:**

- Each version is encrypted independently using AES-256-GCM before being uploaded to IPFS.
- Encryption is fully backend-managed and transparent to the client.
- IPFS stores only encrypted binary data for each version.
- `file_hash` always represents the SHA256 hash of the **original** PDF (before encryption) for integrity verification.
- No change in request or response format; encryption is internal.

**Errors:**

- 400: Invalid document ID format
- 400: PDF file is required
- 400: File must be a PDF
- 400: File size exceeds 20MB limit
- 401: Authorization header is missing
- 401: Invalid token
- 403: You do not have permission to modify this document
- 404: Document not found
- 500: Failed to add version

---

### GET /documents/:id/version/:version/view

Securely retrieve and decrypt a specific document version for inline viewing.

**Authentication:**

Required (JWT)

**Authorization:**

Only the owner of the document may access this endpoint. Returns 403 if not owner.

**Request:**

```http
GET /documents/550e8400-e29b-41d4-a716-446655440000/version/1/view HTTP/1.1
Host: localhost:5000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**URL Parameters:**

- `id` (UUID, required): Document UUID
- `version` (integer, required): Version number (1, 2, 3, etc.)

**Response (200):**

- **Content-Type:** `application/pdf`
- **Body:** Decrypted PDF bytes (suitable for inline viewing in browser)

The response contains the decrypted, original PDF file. No encryption metadata is exposed.

**Errors:**

- 400: Invalid document ID format
- 400: Invalid version number
- 401: Authorization header is missing
- 401: Invalid token
- 403: You do not have permission to access this document
- 404: Document not found
- 404: Version not found
- 500: Failed to retrieve or decrypt document

**Important Notes:**

- Direct IPFS gateway access is **no longer supported** for viewing documents. All documents are encrypted and stored on IPFS.
- This endpoint handles decryption transparently using backend-managed keys.
- The decrypted PDF is sent directly to the browser for inline viewing (not as download).
- No content disposition header is set; browsers will display the PDF inline.

---

## HTTP Status Codes

| Code | Meaning                                                        |
| ---- | -------------------------------------------------------------- |
| 200  | OK - Request succeeded                                         |
| 201  | Created - Resource created successfully                        |
| 400  | Bad Request - Validation error or missing required field       |
| 401  | Unauthorized - Missing or invalid JWT token                    |
| 403  | Forbidden - User lacks permission (e.g., doesn't own resource) |
| 404  | Not Found - Resource doesn't exist                             |
| 409  | Conflict - Resource already exists (e.g., duplicate email)     |
| 500  | Internal Server Error - Unexpected server error                |

---

## Authentication

### Token Usage

Include JWT token in `Authorization` header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Details

- **Duration:** 1 hour
- **Payload:**
  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "wallet_address": "0x1234567890123456789012345678901234567890",
    "iat": 1708784400,
    "exp": 1708788000
  }
  ```
- **Expiration errors:** When token expires, re-authenticate to get new token

### User Identity Model

All users must have:

- **Email** (unique, required during registration)
- **Password** (required during registration)
- **Wallet address** (unique, verified via signature during registration)

**Registration Flow:**

1. User connects wallet (e.g., MetaMask)
2. Frontend requests nonce via GET /auth/nonce
3. User signs nonce message with wallet
4. Frontend submits email, password, wallet, and signature to POST /auth/register
5. Backend verifies signature and creates account

**Login Options:**

1. **Email login**: Use POST /auth/login with email and password
2. **Wallet login**: Use POST /auth/wallet-login with wallet and signature

Both methods return the same user object with email and wallet_address.

---

## Data Models

### User

```json
{
  "id": "UUID",
  "email": "string (NOT NULL, UNIQUE)",
  "wallet_address": "string (NOT NULL, UNIQUE)",
  "created_at": "ISO 8601 timestamp"
}
```

**Note:** All users must have both email and wallet_address. Both fields are unique across all users.

### Document

```json
{
  "id": "UUID",
  "user_id": "UUID",
  "blockchain_document_id": "integer",
  "title": "string",
  "created_at": "ISO 8601 timestamp"
}
```

### DocumentVersion

```json
{
  "id": "UUID",
  "document_id": "UUID",
  "version_number": "integer",
  "ipfs_cid": "string",
  "file_hash": "string (SHA256 hex)",
  "blockchain_tx_hash": "string",
  "created_at": "ISO 8601 timestamp"
}
```

---

## Common Frontend Patterns

### Pattern 1: Register and Create Document

```javascript
// 1. Get wallet nonce
GET /auth/nonce?wallet=0x...
→ Get message_to_sign, nonce

// 2. Sign message with wallet
signature = sign(message_to_sign)

// 3. Register with email, password, and wallet signature
POST /auth/register
{
  "email": "user@email.com",
  "password": "pass123",
  "wallet": "0x...",
  "signature": "..."
}
→ Get user.id, token

// 4. Create document (wallet already verified)
POST /documents
Headers: { "Authorization": "Bearer <token>" }
Body: { "title": "Doc", "file": <PDF> }
→ Get documentId, version, txHash
```

### Pattern 2: Retrieve User Documents

```javascript
// Option A: Login with email and password
POST /auth/login
{ "email": "user@email.com", "password": "pass123" }
→ Get token

// Option B: Login with wallet
// 1. Get nonce
GET /auth/nonce?wallet=0x...
→ Get message_to_sign

// 2. Sign and login
POST /auth/wallet-login
{ "wallet": "0x...", "signature": "..." }
→ Get token

// 3. List all documents
GET /documents
Headers: { "Authorization": "Bearer <token>" }
→ Get array of documents

// 4. Get single document with versions
GET /documents/{documentId}
Headers: { "Authorization": "Bearer <token>" }
→ Get full document with all versions
```

### Pattern 3: Upload New Version

```javascript
// 1. Authenticated user uploads new version
POST /documents/{documentId}/version
Headers: { "Authorization": "Bearer <token>" }
Body: { "file": <PDF> }
→ Get documentId, version (auto-incremented), txHash
```

---

## Environment Variables Required

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=doc_verify

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=1h

# Blockchain
RPC_URL=https://rpc.sepolia.mantle.xyz
PRIVATE_KEY=0x...
CONTRACT_ADDRESS=0x...
CHAIN_ID=5003

# IPFS (Pinata)
PINATA_JWT=...
PINATA_GATEWAY=...
```

---

## Error Handling

All error responses follow this format:

```json
{
  "error": "Human-readable error message"
}
```

### Common Errors

| Scenario                     | Status | Message                                |
| ---------------------------- | ------ | -------------------------------------- |
| Missing authorization header | 401    | "Authorization header is missing"      |
| Invalid JWT                  | 401    | "Invalid token" or "Token has expired" |
| Document not found           | 404    | "Document not found"                   |
| User doesn't own document    | 403    | "You do not have permission..."        |
| Validation error             | 400    | Specific validation message            |
| Server error                 | 500    | "Failed to [operation]"                |

---

## Testing Tips

1. **Use Postman or cURL** to test all endpoints
2. **Start with health check** to verify server is running
3. **Register → Login → Create Document** to test full flow
4. **Try wallet operations** for blockchain integration
5. **Add new versions** to same document to test version tracking
6. **Fetch document details** to verify all data is persisted

---

## Rate Limiting

Currently no rate limiting. Recommended for production:

- 100 requests/minute per user for authentication
- 1000 requests/minute per user for document operations
- Blockchain operations limited by network confirmation times

---

## CORS

Currently enabled for all origins. In production, restrict to:

```
Access-Control-Allow-Origin: https://yourdomain.com
```

---

## API Versioning

Current version: `v1` (implicit in routes)
Future: Plan for `/api/v2/` routes if breaking changes needed

---

## Support & Issues

- Check logs for detailed error messages
- Verify `.env` configuration
- Ensure database is running
- Test blockchain connection on server startup
- Check JWT token hasn't expired
