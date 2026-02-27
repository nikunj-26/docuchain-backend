const crypto = require("crypto");

/**
 * Encryption configuration using AES-256-GCM
 * Master key must be a 64-character hex string (32 bytes)
 */

// Load master key from environment
const masterKeyHex = process.env.FILE_ENCRYPTION_MASTER_KEY;

// Validate master key exists
if (!masterKeyHex) {
  throw new Error(
    "FILE_ENCRYPTION_MASTER_KEY is not set in environment variables. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
  );
}

// Validate master key format (must be 64 hex characters = 32 bytes)
if (!/^[0-9a-fA-F]{64}$/.test(masterKeyHex)) {
  throw new Error(
    "FILE_ENCRYPTION_MASTER_KEY must be exactly 64 hexadecimal characters (32 bytes). " +
      `Current length: ${masterKeyHex.length} characters. ` +
      "Generate a valid key with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
  );
}

// Convert hex string to Buffer
const MASTER_KEY = Buffer.from(masterKeyHex, "hex");

// Verify the buffer is exactly 32 bytes (256 bits for AES-256)
if (MASTER_KEY.length !== 32) {
  throw new Error(
    `Master key buffer must be exactly 32 bytes for AES-256. Got ${MASTER_KEY.length} bytes.`,
  );
}

// Export the master key
module.exports = {
  MASTER_KEY,
};
