const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
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
    console.error("Database query error:", error);
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
    console.error("Failed to get database client:", error);
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
    console.log("✓ Database connection successful");
    return true;
  } catch (error) {
    console.error("✗ Database connection failed:", error.message);
    return false;
  }
};

module.exports = {
  pool,
  query,
  getClient,
  testConnection,
};
