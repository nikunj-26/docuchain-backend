const { ethers } = require("ethers");
const { query } = require("../config/database");
const logger = require("../utils/logger");

const NONCE_EXPIRY_MINUTES = 10;
const NONCE_LENGTH = 32;

/**
 * Generate a random nonce
 * @returns {string} Random nonce
 */
const generateNonce = () => {
  return ethers.hexlify(ethers.randomBytes(NONCE_LENGTH));
};

/**
 * Create and store nonce for wallet
 * @param {string} walletAddress - Ethereum wallet address
 * @returns {Promise<string>} Generated nonce
 */
const createNonce = async (walletAddress) => {
  const normalizedAddress = walletAddress.toLowerCase();
  const nonce = generateNonce();
  const expiresAt = new Date(
    Date.now() + NONCE_EXPIRY_MINUTES * 60000,
  );

  try {
    await query(
      `INSERT INTO nonces (wallet_address, nonce, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (wallet_address)
       DO UPDATE SET nonce = $2, expires_at = $3`,
      [normalizedAddress, nonce, expiresAt],
    );
    return nonce;
  } catch (error) {
    logger.error("Failed to create nonce:", {
      message: error.message,
    });
    throw error;
  }
};

/**
 * Get nonce for wallet
 * @param {string} walletAddress - Ethereum wallet address
 * @returns {Promise<object>} Nonce object
 */
const getNonce = async (walletAddress) => {
  const normalizedAddress = walletAddress.toLowerCase();

  const result = await query(
    "SELECT nonce, expires_at FROM nonces WHERE wallet_address = $1 AND expires_at > NOW()",
    [normalizedAddress],
  );

  return result.rows[0] || null;
};

/**
 * Verify signed message and validate nonce
 * @param {string} walletAddress - Ethereum wallet address
 * @param {string} message - Original message
 * @param {string} signature - Signed message
 * @returns {Promise<boolean>} True if signature is valid
 */
const verifySignature = async (walletAddress, message, signature) => {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return (
      recoveredAddress.toLowerCase() === walletAddress.toLowerCase()
    );
  } catch (error) {
    logger.error("Signature verification failed:", {
      message: error.message,
    });
    return false;
  }
};

/**
 * Delete nonce after use
 * @param {string} walletAddress - Ethereum wallet address
 * @returns {Promise<void>}
 */
const deleteNonce = async (walletAddress) => {
  const normalizedAddress = walletAddress.toLowerCase();

  await query("DELETE FROM nonces WHERE wallet_address = $1", [
    normalizedAddress,
  ]);
};

/**
 * Find user by wallet address
 * @param {string} walletAddress - Ethereum wallet address
 * @returns {Promise<object|null>} User object or null if not found
 */
const findUserByWallet = async (walletAddress) => {
  const normalizedAddress = walletAddress.toLowerCase();

  const result = await query(
    "SELECT id, email, wallet_address, created_at FROM users WHERE wallet_address = $1",
    [normalizedAddress],
  );

  return result.rows[0] || null;
};

module.exports = {
  generateNonce,
  createNonce,
  getNonce,
  verifySignature,
  deleteNonce,
  findUserByWallet,
};
