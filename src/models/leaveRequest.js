const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define("LeaveRequest", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employeeId: { type: DataTypes.STRING, allowNull: false },
    employeeName: { type: DataTypes.STRING, allowNull: false },
    leaveType: {
      type: DataTypes.ENUM("annual", "sick", "personal", "maternity", "paternity", "other"),
      allowNull: false,
      defaultValue: "annual"
    },
    startDate: { type: DataTypes.DATE, allowNull: false },
    endDate: { type: DataTypes.DATE, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: false },
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "pending"
    },
    approvedBy: { type: DataTypes.STRING, allowNull: true },
    approvedAt: { type: DataTypes.DATE, allowNull: true },
    rejectionReason: { type: DataTypes.TEXT, allowNull: true },
    attachments: { type: DataTypes.JSONB, allowNull: true }
  }, {
    tableName: "leave_requests",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["employee_id", "created_at"] },
      { fields: ["status", "created_at"] },
      { fields: ["employee_id", "status", "created_at"] },
      { fields: ["employee_id", "start_date", "end_date"] }
    ]
  });
};
