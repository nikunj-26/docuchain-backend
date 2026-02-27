require("dotenv").config();
const logger = require("./src/utils/logger");

// Global error handlers
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection:", {
    reason: reason,
    promise: promise,
  });
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", {
    message: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// Validate required environment variables
const requiredEnvVars = [
  "DATABASE_URL",
  "JWT_SECRET",
  "FILE_ENCRYPTION_MASTER_KEY",
];

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName],
);

if (missingEnvVars.length > 0) {
  logger.error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`,
  );
  logger.error(
    "Please check your .env file or environment configuration.",
  );
  process.exit(1);
}

const app = require("./src/app");
const { testConnection } = require("./src/config/database");
const {
  verifyBlockchainConnection,
} = require("./src/services/blockchainService");

// Validate encryption configuration on startup
const { MASTER_KEY } = require("./src/config/encryption");

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

async function startServer() {
  try {
    // Test database connection before starting server
    const isConnected = await testConnection();

    if (!isConnected) {
      logger.error(
        "Failed to start server: Database connection failed",
      );
      process.exit(1);
    }

    // Verify blockchain connection before starting server
    await verifyBlockchainConnection();

    app.listen(PORT, () => {
      logger.info(
        `Server running on port ${PORT} in ${NODE_ENV} mode`,
      );
    });
  } catch (error) {
    logger.error("Server startup failed:", {
      message: error.message,
    });
    process.exit(1);
  }
}

startServer();
