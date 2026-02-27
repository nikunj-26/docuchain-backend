require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool } = require("../config/database");

const initializeDatabase = async () => {
  try {
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    await pool.query(schema);
    console.log("✓ Database schema initialized successfully");
    process.exit(0);
  } catch (error) {
    console.error("✗ Failed to initialize database:", error.message);
    process.exit(1);
  }
};

initializeDatabase();
