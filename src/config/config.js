require("dotenv").config();
const crypto = require("crypto");

// 🔒 JWT Secret يجب أن يكون قوياً ويتم التحقق منه
const validateJwtSecret = () => {
  const JWT_SECRET = process.env.JWT_SECRET;
  
  if (!JWT_SECRET) {
    console.error("❌ CRITICAL: JWT_SECRET is not set in environment variables");
    console.error("   Please set JWT_SECRET in .env file with at least 64 random characters");
    console.error("   Example: JWT_SECRET=" + crypto.randomBytes(64).toString("hex"));
    process.exit(1);
  }
  
  if (JWT_SECRET.length < 64) {
    console.warn("⚠️  WARNING: JWT_SECRET is too short (minimum 64 characters recommended)");
    console.warn("   Current length: " + JWT_SECRET.length + " characters");
  }
  
  // Check if it's a default/weak secret
  const weakSecrets = ["secret", "jwt-secret", "change-this", "1234567890"];
  if (weakSecrets.some(weak => JWT_SECRET.includes(weak))) {
    console.error("❌ CRITICAL: JWT_SECRET appears to be weak or default");
    console.error("   Please use a strong random string");
    process.exit(1);
  }
  
  return JWT_SECRET;
};

// 🔐 إعدادات الأمان
const securityConfig = {
  JWT_SECRET: validateJwtSecret(),
  JWT_ACCESS_EXPIRE: process.env.JWT_ACCESS_EXPIRE || "15m",
  JWT_REFRESH_EXPIRE: process.env.JWT_REFRESH_EXPIRE || "7d",
  JWT_ALGORITHM: "HS256",
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  
  // Password policy
  PASSWORD_MIN_LENGTH: parseInt(process.env.PASSWORD_MIN_LENGTH) || 8,
  PASSWORD_MAX_ATTEMPTS: parseInt(process.env.PASSWORD_MAX_ATTEMPTS) || 5,
  ACCOUNT_LOCKOUT_MINUTES: parseInt(process.env.ACCOUNT_LOCKOUT_MINUTES) || 15,
  
  // Session security
  SESSION_TIMEOUT_MINUTES: parseInt(process.env.SESSION_TIMEOUT_MINUTES) || 30,
  ALLOW_CONCURRENT_SESSIONS: process.env.ALLOW_CONCURRENT_SESSIONS !== "false",
};

// 🌍 إعدادات التطبيق
const appConfig = {
  PORT: parseInt(process.env.PORT) || 4000,
  HOST: process.env.HOST || "0.0.0.0",
  NODE_ENV: process.env.NODE_ENV || "development",
  
  // CORS
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
    : ["http://localhost:3000", "http://localhost:4000"],
  
  // Database
  DB_TYPE: process.env.NODE_ENV === 'production' ? 'mongodb' : (process.env.DB_TYPE || "sqlite"),
  DB_HOST: process.env.DB_HOST,
  DB_PORT: parseInt(process.env.DB_PORT) || 3306,
  DB_NAME: process.env.DB_NAME || "hr_attendance",
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  SQLITE_FILE: process.env.SQLITE_FILE || "./backend_dev.sqlite",
  
  // External services paths
  FINGERPRINT_DB_PATH: process.env.FINGERPRINT_DB_PATH || null,
  EMPLOYEE_EXCEL_PATH: process.env.EMPLOYEE_EXCEL_PATH || null,
  
  // Firebase
  FIREBASE_CONFIG: {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
  },
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  LOG_TO_FILE: process.env.LOG_TO_FILE === "true",
  LOG_DIR: process.env.LOG_DIR || "./logs",
  
  // Security headers
  SECURITY_HEADERS: {
    hstsMaxAge: parseInt(process.env.HSTS_MAX_AGE) || 31536000,
    contentSecurityPolicy: process.env.CSP || "default-src 'self'",
    xFrameOptions: process.env.X_FRAME_OPTIONS || "DENY",
    xContentTypeOptions: process.env.X_CONTENT_TYPE_OPTIONS !== "false",
    referrerPolicy: process.env.REFERRER_POLICY || "strict-origin-when-cross-origin",
  }
};

// 🔍 التحقق من الإعدادات في وضع الإنتاج
if (appConfig.NODE_ENV === "production") {
  const requiredEnvVars = [
    "JWT_SECRET",
    "MONGODB_URI",
    "ALLOWED_ORIGINS"
  ];
  
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error("❌ Missing required environment variables in production:");
    missing.forEach(varName => console.error("   - " + varName));
    process.exit(1);
  }
  
  // In production, we use MongoDB only
  console.log("   Production mode: MongoDB Atlas only, Sequelize disabled");
}

// 📊 توليد تقرير الإعدادات (لا يعرض بيانات حساسة)
const generateConfigReport = () => {
  console.log("🔧 Configuration Loaded:");
  console.log("   Environment:", appConfig.NODE_ENV);
  console.log("   Port:", appConfig.PORT);
  console.log("   Host:", appConfig.HOST);
  console.log("   Database:", appConfig.DB_TYPE);
  console.log("   JWT Expiry:", securityConfig.JWT_ACCESS_EXPIRE + " (access), " + 
              securityConfig.JWT_REFRESH_EXPIRE + " (refresh)");
  console.log("   CORS Origins:", appConfig.ALLOWED_ORIGINS.length, "origin(s) configured");
  
  // تسجيل تحذيرات الأمان
  if (securityConfig.JWT_ACCESS_EXPIRE === "7d") {
    console.warn("⚠️  Consider shorter JWT expiry for better security");
  }
  
  if (appConfig.NODE_ENV === "production" && appConfig.ALLOWED_ORIGINS.includes("*")) {
    console.error("❌ SECURITY RISK: CORS is set to allow all origins in production!");
  }
};

// تشغيل التقرير عند التحميل
if (require.main === module) {
  generateConfigReport();
}

module.exports = {
  ...securityConfig,
  ...appConfig,
  
  // Utility functions
  isProduction: () => appConfig.NODE_ENV === "production",
  isDevelopment: () => appConfig.NODE_ENV === "development",
  isTest: () => appConfig.NODE_ENV === "test",
  
  // Security helper
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
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push("Password must contain at least one special character");
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  },
  
  // Generate secure random string
  generateSecureString: (length = 32) => {
    return crypto.randomBytes(length).toString("hex");
  }
};