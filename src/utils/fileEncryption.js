const crypto = require("crypto");
const { MASTER_KEY } = require("../config/encryption");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard
const AUTH_TAG_LENGTH = 16; // GCM standard
const KEY_LENGTH = 32; // 256 bits for AES-256

/**
 * Encrypt a file buffer
 *
 * Returns:
 * {
 *   encryptedFileBuffer: Buffer with format [fileIv(12) | fileAuthTag(16) | ciphertext]
 *   encryptedKeyPayload: HEX string with format keyIv(12) | keyAuthTag(16) | encryptedKeyCiphertext
 * }
 *
 * @param {Buffer} buffer - File content (PDF)
 * @returns {Promise<{encryptedFileBuffer: Buffer, encryptedKeyPayload: string}>}
 */
const encryptFile = async (buffer) => {
  // Generate random file encryption key
  const fileKey = crypto.randomBytes(KEY_LENGTH);

  // Generate random IV for file encryption
  const fileIv = crypto.randomBytes(IV_LENGTH);

  // Encrypt file content
  const fileCipher = crypto.createCipheriv(
    ALGORITHM,
    fileKey,
    fileIv,
  );
  const ciphertext = Buffer.concat([
    fileCipher.update(buffer),
    fileCipher.final(),
  ]);

  // Get authentication tag for file encryption
  const fileAuthTag = fileCipher.getAuthTag();

  // Combine: fileIv + fileAuthTag + ciphertext
  const encryptedFileBuffer = Buffer.concat([
    fileIv,
    fileAuthTag,
    ciphertext,
  ]);

  // Now encrypt the fileKey using MASTER_KEY

  // Generate random IV for key encryption
  const keyIv = crypto.randomBytes(IV_LENGTH);

  // Encrypt fileKey using MASTER_KEY
  const keyCipher = crypto.createCipheriv(
    ALGORITHM,
    MASTER_KEY,
    keyIv,
  );
  const encryptedKeyCiphertext = Buffer.concat([
    keyCipher.update(fileKey),
    keyCipher.final(),
  ]);

  // Get authentication tag for key encryption
  const keyAuthTag = keyCipher.getAuthTag();

  // Combine: keyIv + keyAuthTag + encryptedKeyCiphertext, then convert to hex
  const encryptedKeyPayload = Buffer.concat([
    keyIv,
    keyAuthTag,
    encryptedKeyCiphertext,
  ]).toString("hex");

  return {
    encryptedFileBuffer,
    encryptedKeyPayload,
  };
};

/**
 * Decrypt a file buffer
 *
 * @param {Buffer} encryptedFileBuffer - Encrypted file with format [fileIv(12) | fileAuthTag(16) | ciphertext]
 * @param {string} encryptedKeyPayload - Hex string with format keyIv(12) | keyAuthTag(16) | encryptedKeyCiphertext
 * @returns {Promise<Buffer>} Decrypted file content
 */
const decryptFile = async (
  encryptedFileBuffer,
  encryptedKeyPayload,
) => {
  // Parse encryptedKeyPayload to extract fileKey

  // Convert hex string to Buffer
  const encryptedKeyBuffer = Buffer.from(encryptedKeyPayload, "hex");

  // Extract components: keyIv (12) | keyAuthTag (16) | encryptedKeyCiphertext
  const keyIv = encryptedKeyBuffer.slice(0, IV_LENGTH);
  const keyAuthTag = encryptedKeyBuffer.slice(
    IV_LENGTH,
    IV_LENGTH + AUTH_TAG_LENGTH,
  );
  const encryptedKeyCiphertext = encryptedKeyBuffer.slice(
    IV_LENGTH + AUTH_TAG_LENGTH,
  );

  // Decrypt fileKey using MASTER_KEY
  const keyDecipher = crypto.createDecipheriv(
    ALGORITHM,
    MASTER_KEY,
    keyIv,
  );
  keyDecipher.setAuthTag(keyAuthTag);

  let fileKey;
  try {
    fileKey = Buffer.concat([
      keyDecipher.update(encryptedKeyCiphertext),
      keyDecipher.final(),
    ]);
  } catch (error) {
    throw new Error(
      "Failed to decrypt file key: authentication failed",
    );
  }

  // Parse encryptedFileBuffer to extract ciphertext and decrypt

  // Extract components: fileIv (12) | fileAuthTag (16) | ciphertext
  const fileIv = encryptedFileBuffer.slice(0, IV_LENGTH);
  const fileAuthTag = encryptedFileBuffer.slice(
    IV_LENGTH,
    IV_LENGTH + AUTH_TAG_LENGTH,
  );
  const ciphertext = encryptedFileBuffer.slice(
    IV_LENGTH + AUTH_TAG_LENGTH,
  );

  // Decrypt file content using fileKey
  const fileDecipher = crypto.createDecipheriv(
    ALGORITHM,
    fileKey,
    fileIv,
  );
  fileDecipher.setAuthTag(fileAuthTag);

  let plaintext;
  try {
    plaintext = Buffer.concat([
      fileDecipher.update(ciphertext),
      fileDecipher.final(),
    ]);
  } catch (error) {
    throw new Error("Failed to decrypt file: authentication failed");
  }

  return plaintext;
};

module.exports = {
  encryptFile,
  decryptFile,
};
