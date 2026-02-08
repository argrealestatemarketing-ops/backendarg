const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const xss = require("xss-clean");
const hpp = require("hpp");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const authRoutes = require("./src/routes/authRoutes");
const attendanceRoutes = require("./src/routes/attendanceRoutes");
const leaveRoutes = require("./src/routes/leaveRoutes");
const announcementRoutes = require("./src/routes/announcementRoutes");
const adminRoutes = require("./src/routes/adminRoutes");

const config = require("./src/config/config");
const { sequelize } = require("./src/models");
const { errorHandler, notFoundHandler } = require("./src/middleware/errorHandler");
const { requestLogger } = require("./src/middleware/requestLogger");
const { logger } = require("./src/utils/logger");

const app = express();
app.set("trust proxy", 1);

function deepSanitize(value) {
  if (Array.isArray(value)) {
    return value.map((item) => deepSanitize(item));
  }

  if (value && typeof value === "object") {
    const clean = {};
    Object.entries(value).forEach(([key, nested]) => {
      if (key.startsWith("$") || key.includes(".")) {
        return;
      }
      clean[key] = deepSanitize(nested);
    });
    return clean;
  }

  return value;
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const configuredOrigins = Array.isArray(config.ALLOWED_ORIGINS) ? config.ALLOWED_ORIGINS : [];
    const allowedOrigins = [
      process.env.CLIENT_URL,
      ...configuredOrigins,
      "http://localhost:3000",
      "http://localhost:5000",
      "http://localhost:8080",
      "http://localhost:39772",
      "http://127.0.0.1:39772",
      "http://10.0.2.2:39772"
    ].filter(Boolean);

    const isAllowed = allowedOrigins.some((allowed) => {
      if (allowed instanceof RegExp) return allowed.test(origin);
      return allowed === origin;
    });

    if (isAllowed) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "X-API-Key",
    "X-CSRF-Token"
  ],
  exposedHeaders: ["X-Total-Count", "X-RateLimit-Limit", "X-RateLimit-Remaining"]
};
app.use(cors(corsOptions));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => {
    if (req.path === "/ping" || req.path === "/api/health") return 100;
    if (req.path.includes("/auth/login")) return 20;
    return 60;
  },
  message: {
    success: false,
    error: "Too many requests, please try again later.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress
});
app.use("/api", apiLimiter);

app.use(
  express.json({
    limit: process.env.MAX_REQUEST_SIZE || "10mb",
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    }
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.MAX_REQUEST_SIZE || "10mb",
    parameterLimit: 50
  })
);
app.use(cookieParser());

app.use((req, res, next) => {
  req.body = deepSanitize(req.body);
  req.query = deepSanitize(req.query);
  req.params = deepSanitize(req.params);
  next();
});

app.use(xss());
app.use(
  hpp({
    whitelist: ["page", "limit", "sort", "fields", "employeeId", "date", "status"]
  })
);

app.use(
  compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    }
  })
);

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  req.startTime = process.hrtime();
  res.setHeader("X-Request-ID", req.requestId);
  next();
});

app.use((req, res, next) => {
  const start = process.hrtime();
  const originalEnd = res.end;

  res.end = function endWithTiming(...args) {
    const diff = process.hrtime(start);
    const responseTime = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
    res.setHeader("X-Response-Time", `${responseTime}ms`);

    if (Number.parseFloat(responseTime) > 1000) {
      logger.warn(`[Performance] Slow response detected: ${responseTime}ms`, {
        path: req.path,
        method: req.method,
        requestId: req.requestId
      });
    }

    return originalEnd.apply(this, args);
  };

  next();
});

app.use(requestLogger);

if (process.env.NODE_ENV === "production") {
  app.use(
    morgan("combined", {
      skip: (req, res) => res.statusCode < 400,
      stream: {
        write: (message) => {
          logger.error(message.trim());
        }
      }
    })
  );
} else {
  app.use(morgan("dev"));
}

app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "HR Attendance API is running",
    timestamp: new Date().toISOString(),
    service: "hr-attendance-api",
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    uptime: process.uptime(),
    endpoints: [
      "/ping",
      "/api/health",
      "/api/auth",
      "/api/attendance",
      "/api/leave",
      "/api/announcements",
      "/api/admin"
    ]
  });
});

app.get("/ping", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "hr-attendance-api",
    version: process.env.npm_package_version || "1.0.0",
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/admin", adminRoutes);

if (process.env.NODE_ENV === "development") {
  const debugRoutes = require("./src/routes/debugRoutes");
  app.use("/api/debug", debugRoutes);

  app.get("/api/debug/routes", (req, res) => {
    const routes = [];
    app._router.stack.forEach((middleware) => {
      if (middleware.route) {
        routes.push({
          path: middleware.route.path,
          methods: Object.keys(middleware.route.methods)
        });
      }
    });
    res.json({ routes });
  });
}

app.get("/api/health", async (req, res) => {
  const healthcheck = {
    success: true,
    status: "OK",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    host: config.HOST || "localhost",
    port: config.PORT || 5000,
    system: {
      node: process.version,
      platform: process.platform,
      memory: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
      },
      uptime: `${Math.floor(process.uptime())}s`,
      cpuUsage: process.cpuUsage()
    },
    services: {
      database: "unknown"
    }
  };

  try {
    await sequelize.authenticate();
    healthcheck.services.database = "connected";
    healthcheck.services.databaseDialect = sequelize.getDialect();
  } catch (error) {
    healthcheck.success = false;
    healthcheck.status = "DEGRADED";
    healthcheck.services.database = "disconnected";
    healthcheck.error = error.message;
  }

  const statusCode = healthcheck.success ? 200 : 503;
  res.status(statusCode).json(healthcheck);
});

app.use(notFoundHandler);
app.use(errorHandler);

app.shutdown = async () => {
  logger.info("Shutting down gracefully...");
  return Promise.resolve();
};

module.exports = app;
