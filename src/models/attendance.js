const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define("Attendance", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employeeId: { type: DataTypes.STRING, allowNull: false },
    date: { type: DataTypes.DATE, allowNull: false },
    checkInTime: { type: DataTypes.TIME, allowNull: true },
    checkOutTime: { type: DataTypes.TIME, allowNull: true },
    status: {
      type: DataTypes.ENUM("present", "absent", "late", "half_day"),
      allowNull: false,
      defaultValue: "present"
    },
    hoursWorked: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    location: { type: DataTypes.JSONB, allowNull: true },
    deviceId: { type: DataTypes.STRING, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true }
  }, {
    tableName: "attendances",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["employee_id", "date"] },
      { fields: ["date", "status"] },
      { fields: ["employee_id", "status", "date"] }
    ]
  });
};
