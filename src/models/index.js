const fs = require("fs");

// Production mode: Only use MongoDB Atlas
const isProduction = process.env.NODE_ENV === "production";

let sequelize = null;
let User = null;
let Attendance = null;
let LeaveRequest = null;
let Announcement = null;
let LeaveBalance = null;
let AuditLog = null;
let ImportJob = null;
let BlacklistedToken = null;
let LoginAttempt = null;
let RefreshToken = null;

if (isProduction) {
  // In production, we don't initialize Sequelize at all
  // All data operations will use MongoDB directly via Mongoose
  console.log("DB: Production mode - Sequelize disabled, using MongoDB Atlas only");
  
  // Create dummy objects to satisfy imports (these will never be used in production)
  // Actual data operations will be handled by MongoDB models in src/models/mongo/
  sequelize = {
    authenticate: () => Promise.resolve(),
    sync: () => Promise.resolve(),
    close: () => Promise.resolve(),
    options: { dialect: 'mongodb' } // Indicate we're using MongoDB
  };
  
  // Create minimal placeholder models that throw errors if used in production
  const createPlaceholderModel = (modelName) => ({
    findOne: () => { throw new Error(`Sequelize ${modelName} model should not be used in production. Use MongoDB models instead.`); },
    findAll: () => { throw new Error(`Sequelize ${modelName} model should not be used in production. Use MongoDB models instead.`); },
    create: () => { throw new Error(`Sequelize ${modelName} model should not be used in production. Use MongoDB models instead.`); },
    update: () => { throw new Error(`Sequelize ${modelName} model should not be used in production. Use MongoDB models instead.`); },
    destroy: () => { throw new Error(`Sequelize ${modelName} model should not be used in production. Use MongoDB models instead.`); }
  });
  
  User = createPlaceholderModel('User');
  Attendance = createPlaceholderModel('Attendance');
  LeaveRequest = createPlaceholderModel('LeaveRequest');
  Announcement = createPlaceholderModel('Announcement');
  LeaveBalance = createPlaceholderModel('LeaveBalance');
  AuditLog = createPlaceholderModel('AuditLog');
  ImportJob = createPlaceholderModel('ImportJob');
  BlacklistedToken = createPlaceholderModel('BlacklistedToken');
  LoginAttempt = createPlaceholderModel('LoginAttempt');
  RefreshToken = createPlaceholderModel('RefreshToken');
} else {
  // In development, initialize Sequelize as before
  const { Sequelize } = require("sequelize");
  
  if (process.env.FORCE_SQLITE === "true" ||
      fs.existsSync(process.env.SQLITE_FILE || "backend_dev.sqlite")) {
    // In development, allow SQLite fallback
    sequelize = new Sequelize({
      dialect: "sqlite",
      storage: process.env.SQLITE_FILE || "backend_dev.sqlite",
      logging: false,
    });
    console.log("DB: Using SQLite (development fallback)");
  } else {
    // Use MySQL for other non-production environments
    sequelize = new Sequelize(
      process.env.DB_NAME || "hr_attendance",
      process.env.DB_USER || "root",
      process.env.DB_PASSWORD || "password",
      {
        host: process.env.DB_HOST || "127.0.0.1",
        port: process.env.DB_PORT || 3306,
        dialect: "mysql",
        logging: false,
      }
    );
    console.log("DB: Using MySQL configuration");
  }

  const { DataTypes } = require("sequelize");

  User = require("./user")(sequelize);
  Attendance = require("./attendance")(sequelize);
  LeaveRequest = require("./leaveRequest")(sequelize);
  Announcement = require("./announcement")(sequelize);
  LeaveBalance = require("./leaveBalance")(sequelize);
  AuditLog = require("./auditLog")(sequelize);
  ImportJob = require("./importJob")(sequelize);
  const { BlacklistedToken: BT, LoginAttempt: LA, RefreshToken: RT } = require("./BlacklistedToken");

  BlacklistedToken = BT(sequelize);
  LoginAttempt = LA(sequelize);
  RefreshToken = RT(sequelize);
}

module.exports = {
  sequelize,
  User,
  Attendance,
  LeaveRequest,
  Announcement,
  LeaveBalance,
  AuditLog,
  ImportJob,
  BlacklistedToken,
  LoginAttempt,
  RefreshToken
};