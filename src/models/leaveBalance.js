const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define("LeaveBalance", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employeeId: { type: DataTypes.STRING, allowNull: false },
    year: { type: DataTypes.INTEGER, allowNull: false },
    annualLeave: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    sickLeave: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    personalLeave: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    maternityLeave: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    paternityLeave: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    otherLeave: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    totalDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    usedDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    remainingDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
  }, {
    tableName: "leave_balances",
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ["employee_id", "year"] }
    ]
  });
};
