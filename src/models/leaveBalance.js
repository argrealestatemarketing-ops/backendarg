const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define("LeaveBalance", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employeeId: { type: DataTypes.STRING, allowNull: false },
    year: { type: DataTypes.INTEGER, allowNull: false },
    totalDays: { type: DataTypes.INTEGER, allowNull: false },
    usedDays: { type: DataTypes.INTEGER, allowNull: false },
    remainingDays: { type: DataTypes.INTEGER, allowNull: false }
  }, {
    tableName: "leave_balances",
    timestamps: false,
    underscored: true,
  });
};