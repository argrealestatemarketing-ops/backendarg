module.exports = (sequelize) => {
  const { DataTypes } = require("sequelize");
  return sequelize.define("AuditLog", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    actorId: { type: DataTypes.STRING, allowNull: true },
    actorEmployeeId: { type: DataTypes.STRING, allowNull: true },
    targetEmployeeId: { type: DataTypes.STRING, allowNull: true },
    action: { type: DataTypes.STRING, allowNull: false },
    details: { type: DataTypes.JSON, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: "audit_logs",
    timestamps: false,
    underscored: true,
    indexes: [
      { fields: ["actor_id", "created_at"] },
      { fields: ["action", "created_at"] },
      { fields: ["target_employee_id", "created_at"] }
    ]
  });
};
