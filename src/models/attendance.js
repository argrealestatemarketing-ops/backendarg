const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define("Attendance", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employeeId: { type: DataTypes.STRING, allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    checkInTime: { type: DataTypes.TIME, allowNull: true },
    checkOutTime: { type: DataTypes.TIME, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "absent" }
  }, {
    tableName: "attendance",
    timestamps: true,
    underscored: true,
  });
};