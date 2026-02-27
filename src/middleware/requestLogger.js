const logger = require("../utils/logger");

/**
 * Request logging middleware
 * Logs HTTP method, route, status code, and response time
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Capture the original end function
  const originalEnd = res.end;

  // Override res.end to log after response is sent
  res.end = function (...args) {
    const duration = Date.now() - startTime;
    const logMessage = `${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${duration}ms`;

    if (res.statusCode >= 500) {
      logger.error(logMessage);
    } else if (res.statusCode >= 400) {
      logger.warn(logMessage);
    } else {
      logger.info(logMessage);
    }

    // Call the original end function
    originalEnd.apply(res, args);
  };

  next();
};

module.exports = requestLogger;
