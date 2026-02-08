const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define("User", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employeeId: { type: DataTypes.STRING, unique: true, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true },
    role: { type: DataTypes.STRING, allowNull: false, defaultValue: "employee" },
    password: { type: DataTypes.STRING, allowNull: false },
    // Persist whether the user must change password on next login
    mustChangePassword: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // When password was last changed (used to invalidate older tokens)
    passwordChangedAt: { type: DataTypes.DATE, allowNull: true },
    // Optional token version - can be incremented to invalidate tokens
    tokenVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    // Failed login attempts for account lockout
    failedLoginAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    // If locked, store the timestamp until which lock is active
    lockedUntil: { type: DataTypes.DATE, allowNull: true },
    status: {
      type: DataTypes.ENUM("active", "inactive", "locked"),
      allowNull: false,
      defaultValue: "active"
    },
    lastLoginAt: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: "users",
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ["employee_id"] },
      { unique: true, fields: ["email"] },
      { fields: ["status"] },
      { fields: ["locked_until"] }
    ]
  });
};
