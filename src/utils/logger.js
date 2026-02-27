const winston = require("winston");

const isProduction = process.env.NODE_ENV === "production";

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  isProduction
    ? winston.format.json()
    : winston.format.printf(
        ({ timestamp, level, message, ...meta }) => {
          let log = `${timestamp} [${level.toUpperCase()}] ${message}`;
          if (Object.keys(meta).length > 0 && meta.stack) {
            log += `\n${meta.stack}`;
          } else if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta)}`;
          }
          return log;
        },
      ),
);

// Create logger
const logger = winston.createLogger({
  level: isProduction ? "info" : "debug",
  format: logFormat,
  transports: [new winston.transports.Console()],
});

module.exports = logger;
