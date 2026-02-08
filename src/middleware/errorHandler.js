const { logger } = require("../utils/logger");

class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    Error.captureStackTrace(this, this.constructor);
  }
}

const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  logger.error("Unhandled request error", {
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name,
      statusCode: err.statusCode,
      isOperational: err.isOperational
    }
  });

  // Development vs Production error response
  if (process.env.NODE_ENV === "development") {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      stack: err.stack,
      requestId: req.requestId
    });
  } else {
    // Production: don't leak error details
    if (err.isOperational) {
      res.status(err.statusCode).json({
        success: false,
        error: err.message,
        requestId: req.requestId
      });
    } else {
      // Programming or unknown errors
      logger.error("Unexpected non-operational error", {
        requestId: req.requestId,
        error: err.message,
        stack: err.stack,
        name: err.name
      });
      res.status(500).json({
        success: false,
        error: "Something went wrong!",
        requestId: req.requestId
      });
    }
  }
};

module.exports = { AppError, errorHandler, notFoundHandler };
