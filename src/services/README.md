# Services

This folder contains business logic modules for the Doc Verify backend.

## Available Services

### `authService.js`

Email authentication service using bcrypt and JWT.

**Exports:**

- `hashPassword(password)` - Hash password with bcrypt (10 rounds)
- `comparePassword(password, hash)` - Compare password with hash
- `generateToken(payload)` - Generate JWT token (expires in 1 hour)
- `verifyToken(token)` - Verify and decode JWT token
- `registerUser(email, password)` - Register new user with email
- `findUserByEmail(email)` - Find user by email
- `authenticateUser(email, password)` - Authenticate user and return JWT

### `walletService.js`

Ethereum wallet authentication using signature verification.

**Exports:**

- `generateNonce()` - Generate random nonce for signing
- `createNonce(walletAddress)` - Create and store nonce in database
- `getNonce(walletAddress)` - Retrieve valid nonce for wallet
- `verifySignature(walletAddress, message, signature)` - Verify signed message
- `deleteNonce(walletAddress)` - Clear nonce after use
- `findOrCreateUserByWallet(walletAddress)` - Create or get wallet user

### `pinataService.js`

IPFS file upload service using Pinata.

**Exports:**

- `uploadFile(fileContent, fileName, metadata)` - Upload PDF to IPFS via Pinata
  - Accepts file path (string) or Buffer
  - Only accepts .pdf files
  - Returns CID and gateway URL
- `getGatewayUrl(cid)` - Generate gateway URL for a CID

**Configuration:**

- `PINATA_JWT` - Pinata API JWT token (from https://app.pinata.cloud/)
- `PINATA_GATEWAY` - Pinata gateway domain (e.g., fun-llama-300.mypinata.cloud)

**Error Handling:**

- Invalid file types returned as 400 error with message
- Missing configuration logged as warnings
- Upload failures include detailed error messages

### `blockchainService.js`

Smart contract interaction service using ethers.js for Versioned Documents contract.

**Exports:**

- `createDocument(owner, title, cid, fileHash)` - Create new document on blockchain
  - Validates owner address, title, CID, and file hash
  - Sends transaction and waits for confirmation
  - Returns transaction hash and block information
- `addVersion(documentId, cid, fileHash)` - Add version to existing document
  - Validates document ID, CID, and file hash
  - Sends transaction and waits for confirmation
  - Returns transaction hash and block information
- `getDocument(documentId)` - Get document info (read-only)
  - Returns owner, title, and version count
- `contract` - ethers.js Contract instance
- `wallet` - ethers.js Wallet instance
- `provider` - ethers.js JsonRpcProvider instance

**Configuration:**

- `RPC_URL` - Blockchain RPC endpoint (e.g., https://rpc.sepolia.mantle.xyz)
- `PRIVATE_KEY` - Wallet private key (64 hex characters)
- `CONTRACT_ADDRESS` - Deployed contract address
- `CHAIN_ID` - Blockchain chain ID for reference (optional)

## Usage Example

```javascript
const authService = require("./authService");
const walletService = require("./walletService");
const pinataService = require("./pinataService");
const blockchainService = require("./blockchainService");

// Email auth
const hashedPassword = await authService.hashPassword("password123");
const user = await authService.registerUser(
  "user@example.com",
  "password123",
);
const token = authService.generateToken({ id: user.id });

// Wallet auth
const nonce = await walletService.createNonce("0x742d35Cc...");
const isValid = await walletService.verifySignature(
  address,
  message,
  signature,
);

// Pinata upload
const result = await pinataService.uploadFile(
  filePath,
  "document.pdf",
);
console.log(result.cid); // IPFS content identifier

// Blockchain
const docTx = await blockchainService.createDocument(
  "0x1caEeb00f5876835119F85D6CF46B0A2BFb54210",
  "My Document",
  result.cid,
  "0x1234567890abcdef...",
);
console.log(docTx.txHash); // Transaction hash

const versionTx = await blockchainService.addVersion(
  1,
  newCid,
  "0xabcdef1234567890...",
);
console.log(versionTx.blockNumber); // Block number
```
