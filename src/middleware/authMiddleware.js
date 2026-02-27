const authService = require("../services/authService");

/**
 * Auth middleware
 * Extracts JWT from Authorization header
 * Attaches user to req.user
 */
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: "Authorization header is missing",
      });
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      return res.status(401).json({
        error: "Token is missing",
      });
    }

    const decoded = authService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token has expired",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: "Invalid token",
      });
    }

    res.status(500).json({
      error: "Authentication failed",
    });
  }
};

module.exports = authMiddleware;
