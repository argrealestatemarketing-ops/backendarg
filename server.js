const app = require("./app");
const config = require("./src/config/config");

// Conditionally import models based on environment
let sequelize;
if (process.env.NODE_ENV === 'production') {
  // In production, get sequelize from models (will be placeholder)
  const models = require("./src/models");
  sequelize = models.sequelize;
} else {
  // In development, get sequelize directly
  ({ sequelize } = require("./src/models"));
}

const mongoDB = require("./src/config/mongodb");
const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");

// Validate required environment variables
function validateEnvironment() {
  const requiredEnvVars = [];
  
  // In production, MongoDB Atlas connection is required
  if (process.env.NODE_ENV === 'production') {
    requiredEnvVars.push('MONGODB_URI', 'JWT_SECRET');
  } else {
    // In development, at least one database connection should be available
    requiredEnvVars.push('JWT_SECRET');
  }
  
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error('Required variables for production: MONGODB_URI, JWT_SECRET');
    console.error('Required variables for development: JWT_SECRET');
    process.exit(1);
  }
}

validateEnvironment();

const PORT = config.PORT || process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "development";

// تهيئة winston logger
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
    // كتابة الأخطاء والأعلى في المستوى إلى ملف error
    new DailyRotateFile({
      filename: "logs/error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxSize: "20m",
      maxFiles: "14d"
    }),
    // كتابة جميع المستويات إلى ملف مشترك
    new DailyRotateFile({
      filename: "logs/combined-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d"
    })
  ]
});

// إذا لم نكن في بيئة الإنتاج، نقوم بإضافة console.log أيضًا
if (NODE_ENV !== "production") {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

class Application {
  constructor() {
    this.server = null;
    this.isShuttingDown = false;
    this.shutdownTimeout = 30000; // 30 ثانية مهلة للإغلاق القسري
  }

  async initializeDatabase() {
    try {
      // Initialize MongoDB connection as primary database (mandatory)
      try {
        await mongoDB.connect();
        logger.info("MongoDB connection established as primary database");
      } catch (mongoError) {
        logger.error("MongoDB connection failed:", mongoError.message);
        throw mongoError; // Make MongoDB mandatory as per requirements
      }
      
      // Initialize SQLite/MySQL database as secondary (optional, skipped in production)
      const isProduction = process.env.NODE_ENV === "production";
      const shouldAutoSync = 
        !isProduction && (
          process.env.FORCE_SQLITE === "true" || 
          !!process.env.SQLITE_FILE ||
          process.env.AUTO_SYNC_DB === "true"
        );

      if (shouldAutoSync) {
        try {
          logger.info(`Auto-syncing Sequelize models (${NODE_ENV} mode)`);
          
          const syncOptions = {};
          
          if (NODE_ENV === "development") {
            syncOptions.alter = process.env.DB_ALTER === "true";
            syncOptions.force = process.env.DB_FORCE === "true";
          }
          
          await sequelize.sync(syncOptions);
          logger.info("Secondary database synchronized successfully");
        } catch (sqlError) {
          logger.warn("Secondary database initialization failed (optional):", sqlError.message);
        }
      } else if (isProduction) {
        logger.info("Secondary database initialization skipped in production mode");
      }
      
      logger.info("Database connections initialized successfully");
      
    } catch (error) {
      logger.error("Database initialization failed:", error);
      throw error;
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
        } else if (error.code === "EACCES") {
          logger.error(`Permission denied for port ${PORT}`);
          reject(new Error("PORT_ACCESS_DENIED"));
        } else {
          logger.error("Server error:", error);
          reject(error);
        }
      });
    });
  }

  setupGracefulShutdown() {
    const signals = ["SIGINT", "SIGTERM", "SIGQUIT"];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        if (this.isShuttingDown) return;
        
        this.isShuttingDown = true;
        logger.info(`Received ${signal}, starting graceful shutdown...`);
        
        // إعداد مهلة زمنية للإغلاق القسري
        const shutdownTimer = setTimeout(() => {
          logger.error("Graceful shutdown timed out, forcing exit...");
          process.exit(1);
        }, this.shutdownTimeout);

        try {
          // إغلاق السيرفر أولاً
          if (this.server) {
            await new Promise((resolve) => {
              this.server.close(() => {
                logger.info("HTTP server closed");
                resolve();
              });
            });
          }
          
          // إغلاق اتصالات قاعدة البيانات
          if (sequelize && typeof sequelize.close === 'function') {
            await sequelize.close();
            logger.info("Database connections closed");
          }
          
          // إغلاق اتصال MongoDB
          if (mongoDB.isConnected) {
            await mongoDB.disconnect();
            logger.info("MongoDB connection closed");
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
      
      // Close MongoDB connection first as it's the primary database
      if (mongoDB && mongoDB.isConnectedToMongoDB()) {
        await mongoDB.disconnect();
        logger.info("MongoDB connection closed");
      }
      
      // Then close secondary database connection
      if (sequelize) {
        await sequelize.close();
      }
    } catch (error) {
      logger.error("Error during forced exit:", error);
    } finally {
      process.exit(code);
    }
  }

  /* eslint-disable no-undef */
  setupHealthCheck() {
    // إضافة فحص صحة دوري
    if (NODE_ENV === "development") {
      const INTERVAL = 30000; // كل 30 ثانية
      
      setInterval(() => {
        const memoryUsage = process.memoryUsage();
        logger.debug(`Memory usage: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
        
        if (mongoDB && mongoDB.isConnectedToMongoDB()) {
          logger.debug("MongoDB connection OK");
        } else {
          logger.error("MongoDB connection failed");
        }
      }, INTERVAL);
    }
  }

  async start() {
    try {
      logger.info("Starting application...");
      logger.info(`Environment: ${NODE_ENV}`);
      
      // 1. تهيئة قاعدة البيانات
      await this.initializeDatabase();
      
      // 2. بدء السيرفر
      await this.startServer();
      
      // 3. بدء السكيدولر
      await this.startScheduler();
      
      // 4. إعداد معالجة الإغلاق الآمن
      this.setupGracefulShutdown();
      
      // 5. إعداد معالجة الأخطاء
      this.setupErrorHandlers();
      
      // 6. إعداد فحص الصحة
      this.setupHealthCheck();
      
    } catch (error) {
      logger.error("Application failed to start:", error);
      
      await this.gracefulExit(1);
    }
  }
}

// بدء التطبيق
const application = new Application();

// التعامل مع أخطاء التحميل الأولي للوحدات
process.on("beforeExit", (code) => {
  logger.debug(`Process will exit with code: ${code}`);
});

// البدء
if (require.main === module) {
  application.start();
}

// للاختبارات والتكامل
module.exports = { application, app, logger };