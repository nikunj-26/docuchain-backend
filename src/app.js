const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");
const walletRoutes = require("./routes/wallet");
const documentsRoutes = require("./routes/documents");

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use(healthRoutes);
app.use("/auth", authRoutes);
app.use("/auth", walletRoutes);
app.use("/", documentsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || "Internal Server Error",
      status: err.status || 500,
    },
  });
});

module.exports = app;
