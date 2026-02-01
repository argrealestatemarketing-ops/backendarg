const fs = require("fs");
const { Sequelize } = require("sequelize");

// Prefer SQLite fallback if a local sqlite file exists or if FORCE_SQLITE=true
const isProduction = process.env.NODE_ENV === "production";

const useSqlite =
  !isProduction &&
  (process.env.FORCE_SQLITE === "true" ||
    fs.existsSync(process.env.SQLITE_FILE || "backend_dev.sqlite"));

let sequelize;
if (useSqlite) {
  sequelize = new Sequelize({
    dialect: "sqlite",
    storage: process.env.SQLITE_FILE || "backend_dev.sqlite",
    logging: false,
  });
  console.log("DB: Using SQLite (fallback)");
} else {
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

const User = require("./user")(sequelize);
const Attendance = require("./attendance")(sequelize);
const LeaveRequest = require("./leaveRequest")(sequelize);
const Announcement = require("./announcement")(sequelize);
const LeaveBalance = require("./leaveBalance")(sequelize);
const AuditLog = require("./auditLog")(sequelize);
const ImportJob = require("./importJob")(sequelize);
const { BlacklistedToken, LoginAttempt, RefreshToken } = require("./BlacklistedToken");

const BlacklistedTokenModel = BlacklistedToken(sequelize);
const LoginAttemptModel = LoginAttempt(sequelize);
const RefreshTokenModel = RefreshToken(sequelize);

module.exports = {
  sequelize,
  User,
  Attendance,
  LeaveRequest,
  Announcement,
  LeaveBalance,
  AuditLog,
  ImportJob,
  BlacklistedToken: BlacklistedTokenModel,
  LoginAttempt: LoginAttemptModel,
  RefreshToken: RefreshTokenModel
};