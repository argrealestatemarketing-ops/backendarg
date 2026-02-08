require("dotenv").config();
const crypto = require("crypto");

function validateJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error("CRITICAL: JWT_SECRET is not set in environment variables");
    console.error("Please set JWT_SECRET in .env with at least 64 random characters");
    console.error(`Example: JWT_SECRET=${crypto.randomBytes(64).toString("hex")}`);
    process.exit(1);
  }

  if (secret.length < 64) {
    console.warn("WARNING: JWT_SECRET is shorter than recommended minimum (64 chars)");
  }

  const weakSecrets = ["secret", "jwt-secret", "change-this", "1234567890"];
  if (weakSecrets.some((weak) => secret.toLowerCase().includes(weak))) {
    console.error("CRITICAL: JWT_SECRET appears weak/default. Use a strong random value.");
    process.exit(1);
  }

  return secret;
}

const securityConfig = {
  JWT_SECRET: validateJwtSecret(),
  JWT_ACCESS_EXPIRE: process.env.JWT_ACCESS_EXPIRE || "15m",
  JWT_REFRESH_EXPIRE: process.env.JWT_REFRESH_EXPIRE || "7d",
  JWT_ALGORITHM: "HS256",
  RATE_LIMIT_WINDOW_MS: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
  RATE_LIMIT_MAX_REQUESTS: Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10),
  PASSWORD_MIN_LENGTH: Number.parseInt(process.env.PASSWORD_MIN_LENGTH || "8", 10),
  PASSWORD_MAX_ATTEMPTS: Number.parseInt(process.env.PASSWORD_MAX_ATTEMPTS || "5", 10),
  ACCOUNT_LOCKOUT_MINUTES: Number.parseInt(process.env.ACCOUNT_LOCKOUT_MINUTES || "15", 10),
  SESSION_TIMEOUT_MINUTES: Number.parseInt(process.env.SESSION_TIMEOUT_MINUTES || "30", 10),
  ALLOW_CONCURRENT_SESSIONS: process.env.ALLOW_CONCURRENT_SESSIONS !== "false"
};

const appConfig = {
  PORT: Number.parseInt(process.env.PORT || "4000", 10),
  HOST: process.env.HOST || "0.0.0.0",
  NODE_ENV: process.env.NODE_ENV || "development",

  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : ["http://localhost:3000", "http://localhost:4000"],

  DB_TYPE: process.env.DB_TYPE || "postgres",
  DATABASE_URL: process.env.DATABASE_URL || null,
  DB_HOST: process.env.PGHOST || process.env.DB_HOST || "127.0.0.1",
  DB_PORT: Number.parseInt(process.env.PGPORT || process.env.DB_PORT || "5432", 10),
  DB_NAME: process.env.PGDATABASE || process.env.DB_NAME || "hr_attendance",
  DB_USER: process.env.PGUSER || process.env.DB_USER || "postgres",
  DB_PASSWORD: process.env.PGPASSWORD || process.env.DB_PASSWORD || null,
  DB_SSL_MODE: process.env.PGSSLMODE || "disable",
  DB_DIALECT: process.env.DB_DIALECT || "postgres",

  FINGERPRINT_DB_PATH: process.env.FINGERPRINT_DB_PATH || null,
  EMPLOYEE_EXCEL_PATH: process.env.EMPLOYEE_EXCEL_PATH || null,

  FIREBASE_CONFIG: {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
  },

  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  LOG_TO_FILE: process.env.LOG_TO_FILE === "true",
  LOG_DIR: process.env.LOG_DIR || "./logs",

  SECURITY_HEADERS: {
    hstsMaxAge: Number.parseInt(process.env.HSTS_MAX_AGE || "31536000", 10),
    contentSecurityPolicy: process.env.CSP || "default-src 'self'",
    xFrameOptions: process.env.X_FRAME_OPTIONS || "DENY",
    xContentTypeOptions: process.env.X_CONTENT_TYPE_OPTIONS !== "false",
    referrerPolicy: process.env.REFERRER_POLICY || "strict-origin-when-cross-origin"
  }
};

if (appConfig.NODE_ENV === "production") {
  const requiredEnvVars = ["JWT_SECRET", "ALLOWED_ORIGINS"];
  if (!process.env.DATABASE_URL) {
    requiredEnvVars.push("PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD");
  }

  const missing = requiredEnvVars.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error("Missing required environment variables in production:");
    missing.forEach((name) => console.error(` - ${name}`));
    process.exit(1);
  }

  console.log("Production mode: PostgreSQL is configured as primary datastore");
}

function generateConfigReport() {
  console.log("Configuration loaded:");
  console.log(" Environment:", appConfig.NODE_ENV);
  console.log(" Port:", appConfig.PORT);
  console.log(" Host:", appConfig.HOST);
  console.log(" Database:", appConfig.DB_TYPE);
  console.log(
    " JWT expiry:",
    `${securityConfig.JWT_ACCESS_EXPIRE} (access), ${securityConfig.JWT_REFRESH_EXPIRE} (refresh)`
  );
  console.log(" CORS origins:", appConfig.ALLOWED_ORIGINS.length);

  if (securityConfig.JWT_ACCESS_EXPIRE === "7d") {
    console.warn("Consider shorter JWT access expiry for stronger security.");
  }

  if (appConfig.NODE_ENV === "production" && appConfig.ALLOWED_ORIGINS.includes("*")) {
    console.error("SECURITY RISK: wildcard CORS origin in production.");
  }
}

if (require.main === module) {
  generateConfigReport();
}

module.exports = {
  ...securityConfig,
  ...appConfig,
  isProduction: () => appConfig.NODE_ENV === "production",
  isDevelopment: () => appConfig.NODE_ENV === "development",
  isTest: () => appConfig.NODE_ENV === "test",
  validatePassword: (password) => {
    const minLength = securityConfig.PASSWORD_MIN_LENGTH;
    const errors = [];

    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters`);
    }
    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }
    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }
    if (!/[0-9]/.test(password)) {
      errors.push("Password must contain at least one number");
    }
    if (!/[!@#$%^&*(),.?\":{}|<>]/.test(password)) {
      errors.push("Password must contain at least one special character");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },
  generateSecureString: (length = 32) => crypto.randomBytes(length).toString("hex")
};
