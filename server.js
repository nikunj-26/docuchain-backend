require("dotenv").config();
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
      console.error(
        "Failed to start server: Database connection failed",
      );
      process.exit(1);
    }

    // Verify blockchain connection before starting server
    await verifyBlockchainConnection();

    app.listen(PORT, () => {
      console.log(
        `Server running on port ${PORT} in ${NODE_ENV} mode`,
      );
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
