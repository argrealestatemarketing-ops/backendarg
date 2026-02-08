const { logger } = require("../utils/logger");

const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      contentType: req.get("content-type"),
      contentLength: req.get("content-length") || 0,
      responseLength: res.get("content-length") || 0
    };

    // تصنيف السجلات حسب نوع الاستجابة
    if (res.statusCode >= 500) {
      logger.error("HTTP request failed", logEntry);
    } else if (res.statusCode >= 400) {
      logger.warn("HTTP request warning", logEntry);
    } else if (process.env.NODE_ENV === "development") {
      logger.info("HTTP request", logEntry);
    }
  });
  
  next();
};

module.exports = { requestLogger };
