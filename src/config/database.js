const { Pool } = require("pg");
const logger = require("../utils/logger");

// Validate required environment variable
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set in environment variables.\n" +
      "For local development: DATABASE_URL=postgresql://user:password@localhost:5432/dbname\n" +
      "For production (Supabase): Use the connection string from Supabase dashboard",
  );
}

const isProduction = process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err) => {
  logger.error("Unexpected error on idle client", {
    error: err.message,
  });
});

/**
 * Query helper function
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise} Query result
 */
const query = async (text, params) => {
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    logger.error("Database query error:", { message: error.message });
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 * @returns {Promise} Database client
 */
const getClient = async () => {
  try {
    const client = await pool.connect();
    return client;
  } catch (error) {
    logger.error("Failed to get database client:", {
      message: error.message,
    });
    throw error;
  }
};

/**
 * Test database connection
 * @returns {Promise<boolean>} True if connection successful
 */
const testConnection = async () => {
  try {
    const result = await pool.query("SELECT NOW()");
    logger.info("Database connection successful");
    return true;
  } catch (error) {
    logger.error("Database connection failed:", {
      message: error.message,
    });
    return false;
  }
};

module.exports = {
  pool,
  query,
  getClient,
  testConnection,
};
