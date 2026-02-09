const app = require("./app");
const config = require("./src/config/config");
const { sequelize } = require("./src/models");
const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");

function validateEnvironment() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  const hasPgVars = ["PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD"].every((envVar) =>
    Boolean(process.env[envVar])
  );
  const hasLegacyDbVars = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"].every((envVar) =>
    Boolean(process.env[envVar])
  );

  const missingJwtSecret = !process.env.JWT_SECRET;
  const missingDatabaseConfig = !hasDatabaseUrl && !hasPgVars && !hasLegacyDbVars;

  // Diagnostic summary (mask sensitive values)
  try {
    const dbInfo = (() => {
      if (process.env.DATABASE_URL) {
        try {
          // eslint-disable-next-line no-undef
          const url = new URL(process.env.DATABASE_URL);
          return `${url.protocol}//${url.hostname}:${url.port || "5432"}/${url.pathname.replace(/^\//, "")}`;
        } catch (e) {
          return "DATABASE_URL (invalid format)";
        }
      }
      if (hasPgVars) {
        return `${process.env.PGHOST || process.env.DB_HOST || "127.0.0.1"}:${process.env.PGPORT || process.env.DB_PORT || "5432"}/${
          process.env.PGDATABASE || process.env.DB_NAME || "hr_attendance"
        }`;
      }
      return "(no database configured)";
    })();

    console.error("Environment diagnostics:");
    console.error(" - NODE_ENV:", process.env.NODE_ENV || "(not set)");
    console.error(" - DATABASE:", dbInfo);
    console.error(" - PGSSLMODE:", process.env.PGSSLMODE || "(not set)");
    console.error(" - JWT_SECRET: ", process.env.JWT_SECRET ? "[SET] (masked)" : "[MISSING]");
    // MongoDB support removed; DISABLE_MONGODB is no longer applicable.

    // Additional production check: if DATABASE_URL is provided but points at loopback, fail fast (opt-in bypass available)
    try {
      const allowLocalInProd = process.env.ALLOW_LOCAL_DATABASE_IN_PROD === "true";
      if ((process.env.NODE_ENV || "").toLowerCase() === "production" && process.env.DATABASE_URL) {
        try {
          // eslint-disable-next-line no-undef
          const url = new URL(process.env.DATABASE_URL);
          if (/^(127\.0\.0\.1|localhost)$/.test(url.hostname)) {
            if (allowLocalInProd) {
              console.warn(
                `WARNING: ALLOW_LOCAL_DATABASE_IN_PROD=true — allowing local database host (${url.hostname}) in production. This is for short-term testing only and is NOT recommended for real production.`
              );
              console.warn("Attach a managed Postgres in Render or set a reachable DATABASE_URL when ready.");
            } else {
              console.error(
                `CRITICAL: DATABASE_URL resolves to a loopback address (${url.hostname}). In production on Render the DB must be reachable from the service.`
              );
              console.error("Please set DATABASE_URL to your managed Postgres connection string or use a remote host (not localhost/127.0.0.1).");
              console.error("To bypass for short-term testing only, set ALLOW_LOCAL_DATABASE_IN_PROD=true (not recommended).");
              process.exit(1);
            }
          }
        } catch (parseError) {
          console.warn("Warning: Could not parse DATABASE_URL for host validation:", parseError && parseError.message ? parseError.message : parseError);
        }
      }
    } catch (e) {
      console.error("Error validating DATABASE_URL host:", e && e.message ? e.message : e);
    }
  } catch (e) {
    console.error("Error while printing environment diagnostics:", e && e.message ? e.message : e);
  }

  if (missingJwtSecret || missingDatabaseConfig) {
    const missing = [];

    if (missingJwtSecret) {
      missing.push("JWT_SECRET");
    }

    if (missingDatabaseConfig) {
      missing.push("DATABASE_URL (or PG* / DB* variables)");
    }

    console.error(`Missing required environment variables: ${missing.join(", ")}`);
    console.error(
      "Required: JWT_SECRET and PostgreSQL connection (DATABASE_URL or PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD)"
    );
    process.exit(1);
  }

  // Extra safety for production: disallow local-only DB hosts (localhost/127.0.0.1) when no DATABASE_URL is provided.
  try {
    const allowLocalInProd = process.env.ALLOW_LOCAL_DATABASE_IN_PROD === "true";
    if ((process.env.NODE_ENV || "").toLowerCase() === "production" && !process.env.DATABASE_URL) {
      const dbHost = process.env.PGHOST || process.env.DB_HOST || "";
      if (/^(127\.0\.0\.1|localhost)$/.test(dbHost)) {
        if (allowLocalInProd) {
          console.warn(
            "WARNING: ALLOW_LOCAL_DATABASE_IN_PROD=true — allowing loopback DB host in production for testing. Attach a managed Postgres or set a reachable DB before production use."
          );
        } else {
          console.error(
            "CRITICAL: Database host is set to a loopback address in production. Render cannot reach a local database on 127.0.0.1:1122."
          );
          console.error("Please provide a reachable database connection using DATABASE_URL or set PGHOST/PGPORT to an accessible host.");
          process.exit(1);
        }
      }
    }
  } catch (e) {
    console.error("Error validating production DB host:", e && e.message ? e.message : e);
  }
}

validateEnvironment();

const PORT = config.PORT || process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "development";

const logger = winston.createLogger({
  level: NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: "hr-attendance-api" },
  transports: [
    new winston.transports.Console({
      level: NODE_ENV === "development" ? "debug" : "info",
      format:
        NODE_ENV === "production"
          ? winston.format.combine(winston.format.timestamp(), winston.format.json())
          : winston.format.combine(winston.format.colorize(), winston.format.simple())
    }),
    new DailyRotateFile({
      filename: "logs/error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxSize: "20m",
      maxFiles: "14d"
    }),
    new DailyRotateFile({
      filename: "logs/combined-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d"
    })
  ]
});

class Application {
  constructor() {
    this.server = null;
    this.isShuttingDown = false;
    this.shutdownTimeout = 30000;
  }

  async initializeDatabase() {
    const maxAttempts = Number.parseInt(process.env.DB_CONNECT_RETRIES || "15", 10);
    const retryDelayMs = Number.parseInt(process.env.DB_CONNECT_RETRY_DELAY_MS || "5000", 10);

    logger.info(`Database connection configured: maxAttempts=${maxAttempts}, retryDelayMs=${retryDelayMs}ms`);

    // Log connection target for debugging (masked)
    try {
      if (process.env.DATABASE_URL) {
        try {
          // eslint-disable-next-line no-undef
          const parsed = new URL(process.env.DATABASE_URL);
          logger.info(`Connecting using DATABASE_URL to ${parsed.hostname}:${parsed.port || 5432}/${parsed.pathname.replace(/^\//, '')} (masked)`);
        } catch (parseError) {
          logger.info(`Connecting using DATABASE_URL (masked)`);
        }
      } else {
        const host = process.env.PGHOST || process.env.DB_HOST || "127.0.0.1";
        const port = process.env.PGPORT || process.env.DB_PORT || "5432";
        const dbname = process.env.PGDATABASE || process.env.DB_NAME || "hr_attendance";
        logger.info(`Connecting to DB at ${host}:${port}/${dbname}`);
      }
    } catch (e) {
      logger.warn("Could not determine DB connection target:", e && e.message ? e.message : e);
    }

    let connected = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await sequelize.authenticate();
        connected = true;
        logger.info("PostgreSQL connection established");
        break;
      } catch (error) {
        const message = error && error.message ? error.message : String(error);
        console.error(`[Database] Connection failed (${attempt}/${maxAttempts}): ${message}`);
        // Log full error including stack where available for Render logs
        logger.error("PostgreSQL connection failed", { attempt, maxAttempts, error: message, stack: error && error.stack });

        if (attempt === maxAttempts) {
          logger.error("Exceeded maximum DB reconnect attempts. See Render DB status and environment variables (DATABASE_URL, PGSSLMODE). Consider increasing DB_CONNECT_RETRIES if needed.");
          // Add a short delay so logs have time to flush in Render before exit
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        // backoff before next attempt
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    const shouldAutoSync = process.env.AUTO_SYNC_DB === "true";

    if (!connected) {
      logger.error("Failed to establish DB connection after maximum attempts. Aborting startup.");
      throw new Error("DB_CONNECTION_FAILED");
    }

    if (shouldAutoSync) {
      await sequelize.sync({ alter: false });
      logger.info("Database schema synchronized");
    }
  }

  async startScheduler() {
    try {
      const { startScheduler } = require("./src/services/importScheduler");
      await startScheduler();
      logger.info("Import scheduler started");
    } catch (error) {
      logger.warn("Scheduler could not be started:", error);
      if (process.env.SCHEDULER_REQUIRED === "true") {
        throw error;
      }
    }
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      this.server = app.listen(PORT, HOST, () => {
        logger.info(`${NODE_ENV.toUpperCase()} server running on http://${HOST}:${PORT}`);
        if (NODE_ENV === "development") {
          logger.debug(`Process ID: ${process.pid}`);
          logger.debug(`Database dialect: ${sequelize.options.dialect}`);
        }
        resolve(this.server);
      });

      this.server.on("error", (error) => {
        if (error.code === "EADDRINUSE") {
          logger.error(`Port ${PORT} is already in use`);
          reject(new Error(`PORT_${PORT}_IN_USE`));
          return;
        }
        if (error.code === "EACCES") {
          logger.error(`Permission denied for port ${PORT}`);
          reject(new Error("PORT_ACCESS_DENIED"));
          return;
        }
        logger.error("Server error:", error);
        reject(error);
      });
    });
  }

  setupGracefulShutdown() {
    const signals = ["SIGINT", "SIGTERM", "SIGQUIT"];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        if (this.isShuttingDown) return;

        this.isShuttingDown = true;
        logger.info(`Received ${signal}, starting graceful shutdown...`);

        const shutdownTimer = setTimeout(() => {
          logger.error("Graceful shutdown timed out, forcing exit...");
          process.exit(1);
        }, this.shutdownTimeout);

        try {
          if (this.server) {
            await new Promise((resolve) => {
              this.server.close(() => {
                logger.info("HTTP server closed");
                resolve();
              });
            });
          }

          if (sequelize && typeof sequelize.close === "function") {
            await sequelize.close();
            logger.info("Database connection closed");
          }

          clearTimeout(shutdownTimer);
          logger.info("Graceful shutdown completed");
          process.exit(0);
        } catch (error) {
          clearTimeout(shutdownTimer);
          logger.error("Error during shutdown:", error);
          process.exit(1);
        }
      });
    });
  }

  setupErrorHandlers() {
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception:", error);
      if (!this.isShuttingDown) {
        this.gracefulExit(1);
      }
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled Rejection at:", promise, "reason:", reason);
      if (!this.isShuttingDown) {
        this.gracefulExit(1);
      }
    });

    process.on("warning", (warning) => {
      logger.warn("Node.js warning:", warning);
    });
  }

  async gracefulExit(code = 0) {
    this.isShuttingDown = true;

    try {
      if (this.server) {
        this.server.close();
      }
      if (sequelize) {
        await sequelize.close();
      }
    } catch (error) {
      logger.error("Error during forced exit:", error);
    } finally {
      process.exit(code);
    }
  }

  setupHealthCheck() {
    if (NODE_ENV !== "development") return;

    const INTERVAL = 30000;
    // eslint-disable-next-line no-undef
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      logger.debug(`Memory usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
      logger.debug(`Database dialect: ${sequelize.options.dialect}`);
    }, INTERVAL);
  }

  async start() {
    try {
      logger.info("Starting application...");
      logger.info(`Environment: ${NODE_ENV}`);

      await this.initializeDatabase();
      await this.startServer();
      await this.startScheduler();
      this.setupGracefulShutdown();
      this.setupErrorHandlers();
      this.setupHealthCheck();
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      console.error(`[Startup] Application failed to start: ${message}`);
      logger.error("Application failed to start:", error);
      await this.gracefulExit(1);
    }
  }
}

const application = new Application();

process.on("beforeExit", (code) => {
  logger.debug(`Process will exit with code: ${code}`);
});

if (require.main === module) {
  application.start();
}

module.exports = { application, app, logger };
