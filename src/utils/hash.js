const crypto = require("crypto");

/**
 * Generate SHA256 hash of a buffer
 * @param {Buffer} buffer - File buffer to hash
 * @returns {string} Hex-encoded SHA256 hash
 */
const generateSHA256 = (buffer) => {
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

module.exports = {
  generateSHA256,
};
