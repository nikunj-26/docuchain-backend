const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const logger = require("./utils/logger");
const requestLogger = require("./middleware/requestLogger");

const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");
const walletRoutes = require("./routes/wallet");
const documentsRoutes = require("./routes/documents");

const app = express();

// CORS configuration
const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:5173";

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  }),
);
app.use(express.json());
app.use(requestLogger);

// Routes
app.use(healthRoutes);
app.use("/auth", authRoutes);
app.use("/auth", walletRoutes);
app.use("/", documentsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === "production";

  // Log error with stack trace
  logger.error("Error:", {
    message: err.message,
    stack: err.stack,
    status: err.status,
  });

  // Send sanitized error to client
  res.status(err.status || 500).json({
    error: {
      message: isProduction ? "Internal Server Error" : err.message,
      status: err.status || 500,
    },
  });
});

module.exports = app;
