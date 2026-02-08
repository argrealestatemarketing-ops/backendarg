const { Sequelize } = require("sequelize");

function buildSequelize() {
  const commonOptions = {
    logging: false
  };

  const enableSsl =
    process.env.PGSSLMODE === "require" || process.env.NODE_ENV === "production";

  if (process.env.DATABASE_URL) {
    return new Sequelize(process.env.DATABASE_URL, {
      ...commonOptions,
      dialect: "postgres",
      dialectOptions: enableSsl
        ? {
            ssl: {
              require: true,
              rejectUnauthorized: false
            }
          }
        : {}
    });
  }

  return new Sequelize(
    process.env.PGDATABASE || process.env.DB_NAME || "hr_attendance",
    process.env.PGUSER || process.env.DB_USER || "postgres",
    process.env.PGPASSWORD || process.env.DB_PASSWORD || "postgres",
    {
      ...commonOptions,
      dialect: "postgres",
      host: process.env.PGHOST || process.env.DB_HOST || "127.0.0.1",
      port: Number.parseInt(process.env.PGPORT || process.env.DB_PORT || "5432", 10),
      dialectOptions: enableSsl
        ? {
            ssl: {
              require: true,
              rejectUnauthorized: false
            }
          }
        : {}
    }
  );
}

const sequelize = buildSequelize();

const User = require("./user")(sequelize);
const Attendance = require("./attendance")(sequelize);
const LeaveRequest = require("./leaveRequest")(sequelize);
const Announcement = require("./announcement")(sequelize);
const LeaveBalance = require("./leaveBalance")(sequelize);
const AuditLog = require("./auditLog")(sequelize);
const ImportJob = require("./importJob")(sequelize);
const { BlacklistedToken: BT, LoginAttempt: LA, RefreshToken: RT } = require("./BlacklistedToken");

const BlacklistedToken = BT(sequelize);
const LoginAttempt = LA(sequelize);
const RefreshToken = RT(sequelize);

User.hasMany(Attendance, {
  foreignKey: "employeeId",
  sourceKey: "employeeId",
  as: "attendances",
  onUpdate: "CASCADE",
  onDelete: "RESTRICT"
});
Attendance.belongsTo(User, {
  foreignKey: "employeeId",
  targetKey: "employeeId",
  as: "employee",
  onUpdate: "CASCADE",
  onDelete: "RESTRICT"
});

User.hasMany(LeaveBalance, {
  foreignKey: "employeeId",
  sourceKey: "employeeId",
  as: "leaveBalances",
  onUpdate: "CASCADE",
  onDelete: "CASCADE"
});
LeaveBalance.belongsTo(User, {
  foreignKey: "employeeId",
  targetKey: "employeeId",
  as: "employee",
  onUpdate: "CASCADE",
  onDelete: "CASCADE"
});

User.hasMany(LeaveRequest, {
  foreignKey: "employeeId",
  sourceKey: "employeeId",
  as: "leaveRequests",
  onUpdate: "CASCADE",
  onDelete: "RESTRICT"
});
LeaveRequest.belongsTo(User, {
  foreignKey: "employeeId",
  targetKey: "employeeId",
  as: "employee",
  onUpdate: "CASCADE",
  onDelete: "RESTRICT"
});

User.hasMany(LeaveRequest, {
  foreignKey: "approvedBy",
  sourceKey: "employeeId",
  as: "approvedRequests",
  onUpdate: "CASCADE",
  onDelete: "SET NULL"
});
LeaveRequest.belongsTo(User, {
  foreignKey: "approvedBy",
  targetKey: "employeeId",
  as: "approver",
  onUpdate: "CASCADE",
  onDelete: "SET NULL"
});

User.hasMany(Announcement, {
  foreignKey: "author",
  sourceKey: "employeeId",
  as: "announcements",
  onUpdate: "CASCADE",
  onDelete: "RESTRICT"
});
Announcement.belongsTo(User, {
  foreignKey: "author",
  targetKey: "employeeId",
  as: "authorUser",
  onUpdate: "CASCADE",
  onDelete: "RESTRICT"
});

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
