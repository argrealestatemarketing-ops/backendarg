const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");

// Create logs directory if it doesn't exist
const fs = require("fs");
const logsDir = path.join(__dirname, "../../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  defaultMeta: { service: "hr-attendance-system" },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
      level: process.env.NODE_ENV === "development" ? "debug" : "info"
    }),
    
    // Daily rotate file for all logs
    new DailyRotateFile({
      filename: path.join(logsDir, "application-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "30d",
      level: "info"
    }),
    
    // Error logs separately
    new DailyRotateFile({
      filename: path.join(logsDir, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "90d",
      level: "error"
    }),
    
    // Audit/security logs
    new DailyRotateFile({
      filename: path.join(logsDir, "audit-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "10m",
      maxFiles: "180d",
      level: "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

// Special logger for audit/security events
const auditLogger = {
  info: (message, meta = {}) => {
    logger.info(message, { ...meta, logType: "AUDIT" });
  },
  warn: (message, meta = {}) => {
    logger.warn(message, { ...meta, logType: "SECURITY_WARNING" });
  },
  error: (message, meta = {}) => {
    logger.error(message, { ...meta, logType: "SECURITY_ALERT" });
  }
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      userId: req.user?.id || "anonymous",
      employeeId: req.user?.employeeId || "anonymous"
    };
    
    // Log differently based on status code
    if (res.statusCode >= 400) {
      logger.warn("HTTP Request Warning", logData);
    } else {
      logger.info("HTTP Request", logData);
    }
  });
  
  next();
};

module.exports = { logger, auditLogger, requestLogger };
