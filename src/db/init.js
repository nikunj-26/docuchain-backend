require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool } = require("../config/database");
const logger = require("../utils/logger");

const initializeDatabase = async () => {
  try {
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    await pool.query(schema);
    logger.info("Database schema initialized successfully");
    process.exit(0);
  } catch (error) {
    logger.error("Failed to initialize database:", {
      message: error.message,
    });
    process.exit(1);
  }
};

initializeDatabase();
