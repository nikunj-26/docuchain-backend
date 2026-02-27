const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { query } = require("../config/database");

// Validate JWT_SECRET
if (!process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is not set in environment variables. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
  );
}

const SALT_ROUNDS = 10;
const JWT_EXPIRES_IN = "1h";
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Hash a password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if match
 */
const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

/**
 * Generate JWT token
 * @param {object} payload - Token payload
 * @returns {string} JWT token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {object} Decoded token
 */
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

/**
 * Register a new user with wallet verification
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} walletAddress - Ethereum wallet address
 * @returns {Promise<object>} User object
 */
const registerUserWithWallet = async (
  email,
  password,
  walletAddress,
) => {
  const passwordHash = await hashPassword(password);
  const normalizedAddress = walletAddress.toLowerCase();

  const result = await query(
    "INSERT INTO users (email, password_hash, wallet_address) VALUES ($1, $2, $3) RETURNING id, email, wallet_address, created_at",
    [email, passwordHash, normalizedAddress],
  );

  return result.rows[0];
};

/**
 * Find user by email
 * @param {string} email - User email
 * @returns {Promise<object>} User object
 */
const findUserByEmail = async (email) => {
  const result = await query(
    "SELECT id, email, password_hash, wallet_address, created_at FROM users WHERE email = $1",
    [email],
  );

  return result.rows[0];
};

/**
 * Authenticate user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<object>} User with token
 */
const authenticateUser = async (email, password) => {
  const user = await findUserByEmail(email);

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const isPasswordValid = await comparePassword(
    password,
    user.password_hash,
  );

  if (!isPasswordValid) {
    throw new Error("Invalid email or password");
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    wallet_address: user.wallet_address,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      wallet_address: user.wallet_address,
    },
    token,
  };
};

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  registerUserWithWallet,
  findUserByEmail,
  authenticateUser,
};
