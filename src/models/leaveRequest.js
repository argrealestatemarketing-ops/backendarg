const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define("LeaveRequest", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employeeId: { type: DataTypes.STRING, allowNull: false },
    employeeName: { type: DataTypes.STRING, allowNull: false },
    fromDate: { type: DataTypes.DATEONLY, allowNull: false },
    toDate: { type: DataTypes.DATEONLY, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "pending" },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: "leave_requests",
    timestamps: false,
    underscored: true,
  });
};