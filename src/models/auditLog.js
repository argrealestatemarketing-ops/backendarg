module.exports = (sequelize) => {
  const { DataTypes } = require("sequelize");
  return sequelize.define("AuditLog", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    actorId: { type: DataTypes.INTEGER, allowNull: true },
    actorEmployeeId: { type: DataTypes.STRING, allowNull: true },
    targetEmployeeId: { type: DataTypes.STRING, allowNull: true },
    action: { type: DataTypes.STRING, allowNull: false },
    details: { type: DataTypes.JSON, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: "audit_logs",
    timestamps: false,
    underscored: true
  });
};