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

if (NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple())
    })
  );
}

class Application {
  constructor() {
    this.server = null;
    this.isShuttingDown = false;
    this.shutdownTimeout = 30000;
  }

  async initializeDatabase() {
    await sequelize.authenticate();
    logger.info("PostgreSQL connection established");

    const shouldAutoSync = process.env.AUTO_SYNC_DB === "true";

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
